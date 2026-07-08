// ==========================================================
// Book&Go IA - Seguridad para RAG y acceso a datos (Firebase)
// ==========================================================
// Adaptación del laboratorio "Seguridad para RAG, Documentos y Acceso a
// Base de Datos con IA" al stack real del proyecto: JavaScript + Firebase
// Realtime Database (no hay backend PHP/MySQL).
//
// Estructura de datos usada en Firebase Realtime Database:
//
// usuarios/{uid}/
//     rol: "cliente" | "admin"          <-- controla permisos
//
// documentos/{docId}/
//     titulo: "Política de cancelación"
//     categoria: "politicas"
//     nivel_acceso: "publico" | "interno" | "restringido"
//     extracto: "texto corto que SÍ se puede mandar a la IA"
//     activo: true
//
// documento_permisos/{docId}/{rol}: true
//     (ej. documento_permisos/pol-cancelacion/cliente = true)
//
// reservas/{uid}/{folio}/...            <-- ya existe, datos propios
//
// rag_logs/{uid}/{pushId}/
//     rol, pregunta_resumen, documentos_usados, resultado, fecha
//
// Estas reglas de acceso también se refuerzan del lado del servidor con
// Firebase Security Rules (ver /firebase-rules/database.rules.json), porque
// el JavaScript del navegador SIEMPRE se puede leer o modificar por el
// usuario y nunca debe ser la única barrera de seguridad.
// ==========================================================

const BGOIA_RAG = (function () {

    function normalizar(texto) {
        return (texto || "")
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita acentos
    }

    // ----------------------------------------------------------
    // 1. Validar la consulta ANTES de tocar Firebase o Gemini
    // ----------------------------------------------------------
    function validarConsultaRAG(pregunta) {
        const p = (pregunta || "").trim();

        if (p === "") {
            return { valido: false, mensaje: "La pregunta no puede estar vacía." };
        }
        if (p.length > 500) {
            return { valido: false, mensaje: "La pregunta es demasiado larga." };
        }

        const normalizada = normalizar(p);
        for (const frase of BGOIA_RAG_BLOQUEADAS) {
            if (normalizada.includes(frase)) {
                return { valido: false, mensaje: "Consulta bloqueada por política de seguridad." };
            }
        }

        return { valido: true, mensaje: p };
    }

    // ----------------------------------------------------------
    // 2. Rol del usuario autenticado (nunca confiar en un rol
    //    mandado por el propio cliente/formulario)
    // ----------------------------------------------------------
    async function obtenerRolUsuario(uid) {
        try {
            const { ref, get } = window.bgoiaFirebaseDbFns;
            const snap = await get(ref(window.bgoiaDb, `usuarios/${uid}/rol`));
            return snap.exists() ? snap.val() : "cliente";
        } catch (err) {
            console.warn("No se pudo leer el rol, se usa 'cliente' por defecto:", err.message);
            return "cliente";
        }
    }

    // ----------------------------------------------------------
    // 3. Documentos permitidos para ese rol (filtrado real, no
    //    "confiar" en lo que mande el front)
    // ----------------------------------------------------------
    async function obtenerDocumentosPermitidos(rol) {
        try {
            const { ref, get } = window.bgoiaFirebaseDbFns;
            const [docsSnap, permisosSnap] = await Promise.all([
                get(ref(window.bgoiaDb, "documentos")),
                get(ref(window.bgoiaDb, "documento_permisos")),
            ]);

            if (!docsSnap.exists()) return [];

            const documentos = docsSnap.val();
            const permisos = permisosSnap.exists() ? permisosSnap.val() : {};

            return Object.entries(documentos)
                .filter(([docId, doc]) => {
                    if (!doc.activo) return false;
                    const permisoRol = permisos?.[docId]?.[rol];
                    // "publico" siempre visible; el resto requiere permiso explícito por rol
                    return doc.nivel_acceso === "publico" || permisoRol === true;
                })
                .map(([docId, doc]) => ({
                    id: docId,
                    titulo: doc.titulo,
                    nivel_acceso: doc.nivel_acceso,
                    extracto: doc.extracto,
                }));
        } catch (err) {
            console.warn("No se pudieron leer documentos permitidos:", err.message);
            return [];
        }
    }

    // ----------------------------------------------------------
    // 4. Datos de BD permitidos: SOLO los propios del usuario.
    //    Nunca se consultan datos de otro uid, sin importar el rol.
    // ----------------------------------------------------------
    async function consultarDatosPermitidos(uid) {
        try {
            const { ref, get } = window.bgoiaFirebaseDbFns;
            const snap = await get(ref(window.bgoiaDb, `reservas/${uid}`));
            if (!snap.exists()) return [];

            const reservas = snap.val();
            return Object.entries(reservas).map(([folio, r]) => ({
                folio,
                destino: r.destino,
                fechaReserva: r.fechaReserva,
                total: r.total,
                vuelo: r.vuelo?.aerolinea,
                hotel: r.hotel?.nombre,
            }));
        } catch (err) {
            console.warn("No se pudieron leer datos propios del usuario:", err.message);
            return [];
        }
    }

    // ----------------------------------------------------------
    // 5. Construir el contexto MÍNIMO que se manda a la IA
    // ----------------------------------------------------------
    function construirContextoSeguro(documentos, datosBD) {
        let contexto = "";

        documentos.forEach((doc) => {
            contexto += `FUENTE DOCUMENTO: ${doc.titulo}\n`;
            contexto += `CONTENIDO AUTORIZADO: ${doc.extracto}\n\n`;
        });

        datosBD.forEach((fila) => {
            contexto += `FUENTE BASE DE DATOS: reserva propia del usuario\n`;
            contexto += `${JSON.stringify(fila)}\n\n`;
        });

        return contexto === "" ? null : contexto;
    }

    // ----------------------------------------------------------
    // 6. Validar la respuesta de la IA antes de mostrarla
    // ----------------------------------------------------------
    function validarRespuestaRAG(respuestaObj, fuentesUsadas) {
        if (!fuentesUsadas || fuentesUsadas.length === 0) {
            return "No encontré información autorizada para responder esa pregunta.";
        }

        const respuestaTexto = typeof respuestaObj === "string"
            ? respuestaObj
            : (respuestaObj?.respuesta || "");

        const patronesSensibles = ["password", "api_key", "apikey", "token", "secret", "contraseña", "clave"];
        const normalizada = normalizar(respuestaTexto);

        for (const patron of patronesSensibles) {
            if (normalizada.includes(patron)) {
                return "La respuesta fue bloqueada porque podría contener información sensible.";
            }
        }

        return respuestaTexto;
    }

    // ----------------------------------------------------------
    // 7. Logs de seguridad RAG
    // ----------------------------------------------------------
    async function registrarLogRAG(uid, rol, pregunta, documentosUsados, resultado) {
        try {
            const { ref, push, set } = window.bgoiaFirebaseDbFns;
            const nuevoLogRef = push(ref(window.bgoiaDb, `rag_logs/${uid}`));
            await set(nuevoLogRef, {
                rol,
                pregunta_resumen: (pregunta || "").slice(0, 255),
                documentos_usados: documentosUsados.map(d => d.titulo || d),
                resultado, // "permitido" | "bloqueado" | "sin_fuente" | "error"
                fecha: new Date().toISOString(),
            });
        } catch (err) {
            console.warn("No se pudo registrar el log RAG:", err.message);
        }
    }

    // ----------------------------------------------------------
    // 8. Orquestador: este es el único punto de entrada que debe
    //    usar chatbot.js para preguntas de tipo RAG.
    // ----------------------------------------------------------
    async function preguntarRAGSeguro(preguntaOriginal) {
        const user = window.bgoiaAuth?.currentUser;

        // 0. Debe estar autenticado
        if (!user) {
            return {
                ok: false,
                mensaje: "Debes iniciar sesión para hacer consultas al asistente.",
            };
        }
        const uid = user.uid;

        // 1. Validar consulta
        const validacion = validarConsultaRAG(preguntaOriginal);
        if (!validacion.valido) {
            const rolPrevio = await obtenerRolUsuario(uid);
            await registrarLogRAG(uid, rolPrevio, preguntaOriginal, [], "bloqueado");
            return { ok: false, mensaje: validacion.mensaje };
        }
        const pregunta = validacion.mensaje;

        // 2. Rol real (leído de Firebase, no confiar en el cliente)
        const rol = await obtenerRolUsuario(uid);

        // 3. Documentos permitidos para el rol
        const documentos = await obtenerDocumentosPermitidos(rol);

        // 4. Datos propios del usuario (nunca de otros usuarios)
        const datosBD = await consultarDatosPermitidos(uid);

        // 5. Contexto mínimo autorizado
        const contexto = construirContextoSeguro(documentos, datosBD);
        if (contexto === null) {
            await registrarLogRAG(uid, rol, pregunta, [], "sin_fuente");
            return { ok: true, mensaje: "No encontré información autorizada para responder esa pregunta.", fuente: null };
        }

        // 6. Preguntar a la IA SOLO con el contexto autorizado
        let respuestaIA;
        try {
            respuestaIA = await bgoiaAskGeminiRAG(BGOIA_RAG_SYSTEM_PROMPT, contexto, pregunta);
        } catch (err) {
            await registrarLogRAG(uid, rol, pregunta, documentos, "error");
            return { ok: false, mensaje: "Tuve un problema generando la respuesta: " + err.message };
        }

        // 7. Validar respuesta antes de mostrarla
        const respuestaFinal = validarRespuestaRAG(respuestaIA, [...documentos, ...datosBD]);

        // 8. Log de auditoría
        await registrarLogRAG(uid, rol, pregunta, documentos, "permitido");

        return {
            ok: true,
            mensaje: respuestaFinal,
            fuente: respuestaIA?.fuente || null,
        };
    }

    return {
        validarConsultaRAG,
        obtenerRolUsuario,
        obtenerDocumentosPermitidos,
        consultarDatosPermitidos,
        construirContextoSeguro,
        validarRespuestaRAG,
        registrarLogRAG,
        preguntarRAGSeguro,
    };
})();
