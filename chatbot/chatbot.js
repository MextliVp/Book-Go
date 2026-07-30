// ==========================================================
// Book&Go IA - Conversación inteligente (Gemini + RapidAPI + Firebase)
// ==========================================================

(function () {
    const toggleBtn = document.getElementById('bgoiaChatToggleBtn');
    const chatWindow = document.getElementById('bgoiaChatWindow');
    const closeBtn = document.getElementById('bgoiaChatCloseBtn');
    const chatBody = document.getElementById('bgoiaChatBody');
    const chatForm = document.getElementById('bgoiaChatForm');
    const chatInput = document.getElementById('bgoiaChatInput');
    const ragModeBtn = document.getElementById('bgoiaRagModeBtn');

    if (!toggleBtn || !chatWindow) return;

    // --------------------------------------------------------
    // Identificador de sesión de chat, para agrupar los mensajes que se
    // guardan en Firebase bajo 'conversaciones/{uid}/{sessionId}/mensajes'.
    // Se genera una sola vez por carga de página.
    // --------------------------------------------------------
    const sessionId = 'sesion_' + Date.now();

    // --------------------------------------------------------
    // Guarda un mensaje del historial de chat en Firebase Realtime
    // Database, para que el perfil del usuario pueda mostrar/usar el
    // historial completo de conversación (no solo los logs de RAG).
    // Solo se guarda si hay un usuario autenticado, porque las reglas
    // de la base de datos requieren auth.uid === uid del nodo.
    // --------------------------------------------------------
    async function guardarMensajeEnFirebase(rol, texto) {
        try {
            if (!window.bgoiaDb || !window.bgoiaFirebaseDbFns) return;
            const user = window.bgoiaAuth?.currentUser;
            if (!user) return; // Invitados: no se guarda (no tienen permiso de escritura)

            const { ref, push, set } = window.bgoiaFirebaseDbFns;
            const nuevoMensajeRef = push(ref(window.bgoiaDb, `conversaciones/${user.uid}/${sessionId}/mensajes`));
            await set(nuevoMensajeRef, {
                rol,       // 'usuario' | 'asistente'
                texto,
                fecha: new Date().toISOString(),
            });
        } catch (err) {
            console.warn('No se pudo guardar el mensaje de chat en Firebase:', err.message);
        }
    }

    // --------------------------------------------------------
    // Estado de la conversación
    // --------------------------------------------------------
    const ctx = {
        step: 'CHARLA_LIBRE',
        historialCharla: [],
        resumenPreferencias: '',
        destino: null,
        opciones: [],
        opcionElegida: null,
        intereses: null,
        itinerario: null,
        origen: null,
        aeropuerto: null,
        requiereVuelo: null, // null = aún no evaluado, true/false = ya se evaluó origen->destino
        trasladoLocal: null, // recomendación de transporte cuando NO se necesita vuelo
        presupuesto: null,
        vuelos: [],
        vueloElegido: null,
        hoteles: [],
        hotelElegido: null,
        // Datos que el usuario ya dio en la charla libre (ej: "desde
        // Chimalhuacán, presupuesto de $20,000"). Si ya los mencionó, el
        // flujo formal no debe volver a preguntarlos: por eso viven fuera
        // del reinicio de reiniciarContextoDeViaje() y solo se limpian
        // cuando se consumen (ver processarOrigen/processarPresupuesto).
        origenPrellenado: null,
        presupuestoPrellenado: null,
        diasPrellenados: null,
        diasViaje: 3, // duración real usada para generar el itinerario y calcular noches de hotel
    };

    // Reinicia los campos de un viaje anterior al empezar uno nuevo, para
    // que un vuelo/hotel elegido antes no se "arrastre" a la siguiente
    // planeación (por ejemplo, si el viaje anterior sí llevaba vuelo y el
    // nuevo es local, o viceversa).
    function reiniciarContextoDeViaje() {
        ctx.destino = null;
        ctx.opciones = [];
        ctx.opcionElegida = null;
        ctx.intereses = null;
        ctx.itinerario = null;
        ctx.origen = null;
        ctx.aeropuerto = null;
        ctx.requiereVuelo = null;
        ctx.trasladoLocal = null;
        ctx.presupuesto = null;
        ctx.vuelos = [];
        ctx.vueloElegido = null;
        ctx.hoteles = [];
        ctx.hotelElegido = null;
        ctx.historialCharla = [];
        ctx.resumenPreferencias = '';
        ctx.diasViaje = 3;
    }

    // --------------------------------------------------------
    // Utilidades de UI
    // --------------------------------------------------------
    function abrirChat() {
        toggleBtn.classList.add('bgoia-hidden');
        chatWindow.classList.add('bgoia-open');
        setTimeout(() => chatInput && chatInput.focus(), 300);
    }

    function cerrarChat() {
        chatWindow.classList.remove('bgoia-open');
        toggleBtn.classList.remove('bgoia-hidden');
    }

    function scrollAbajo() {
        chatBody.scrollTop = chatBody.scrollHeight;
    }

    function agregarMensajeTexto(texto, tipo) {
        const msg = document.createElement('div');
        msg.className = 'bgoia-msg ' + (tipo === 'user' ? 'bgoia-msg-user' : 'bgoia-msg-bot');
        msg.textContent = texto;
        chatBody.appendChild(msg);
        scrollAbajo();
        return msg;
    }

    function agregarBloqueHTML(html) {
        const wrap = document.createElement('div');
        wrap.className = 'bgoia-msg bgoia-msg-bot bgoia-bloque';
        wrap.innerHTML = html;
        chatBody.appendChild(wrap);
        scrollAbajo();
        return wrap;
    }

    // --------------------------------------------------------
    // Botones de respuesta rápida.
    // El objetivo es hacer la conversación más práctica en móvil, pero
    // SIN quitar nunca la opción de escribir libremente: el campo de
    // texto (chatInput/chatForm) sigue activo en todo momento, y estos
    // botones simplemente envían un mensaje por la misma ruta
    // (manejarMensaje) que usaría un mensaje escrito a mano.
    // --------------------------------------------------------

    // Selección única: un clic = una respuesta enviada de inmediato.
    function agregarRespuestasRapidas(opciones) {
        const botones = opciones.map((op, i) =>
            `<button type="button" class="bgoia-quick-btn" data-quick-index="${i}">${op.label}</button>`
        ).join('');
        const wrap = agregarBloqueHTML(`<div class="bgoia-quick-replies">${botones}</div>`);
        wrap.querySelectorAll('[data-quick-index]').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                wrap.querySelectorAll('.bgoia-quick-btn').forEach(b => b.disabled = true);
                manejarMensaje(opciones[i].texto);
            });
        });
        return wrap;
    }

    // Selección múltiple tipo "chips": se pueden marcar varias y luego
    // confirmar con un botón, que envía todas las elegidas como un solo
    // mensaje (igual que si el usuario las hubiera escrito juntas).
    function agregarSeleccionMultiple(opciones, textoConfirmar) {
        const chips = opciones.map((op, i) =>
            `<button type="button" class="bgoia-quick-btn" data-chip-index="${i}">${op.label}</button>`
        ).join('');
        const wrap = agregarBloqueHTML(`
            <div class="bgoia-quick-replies">${chips}</div>
            <div class="bgoia-quick-replies" style="margin-top:8px;">
                <button type="button" class="bgoia-quick-btn bgoia-quick-confirm">${textoConfirmar}</button>
            </div>
        `);
        const seleccionadas = new Set();
        wrap.querySelectorAll('[data-chip-index]').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                if (seleccionadas.has(i)) {
                    seleccionadas.delete(i);
                    btn.classList.remove('bgoia-quick-selected');
                } else {
                    seleccionadas.add(i);
                    btn.classList.add('bgoia-quick-selected');
                }
            });
        });
        wrap.querySelector('.bgoia-quick-confirm').addEventListener('click', () => {
            wrap.querySelectorAll('.bgoia-quick-btn').forEach(b => b.disabled = true);
            const textos = [...seleccionadas].map(i => opciones[i].texto);
            manejarMensaje(textos.length ? textos.join(', ') : 'sorpréndeme, lo que se te ocurra');
        });
        return wrap;
    }

    // Botones específicos para confirmar/ajustar el itinerario. Si el
    // usuario toca "ajustar", NO se llama a Gemini todavía (mandar un
    // texto vago como "quiero ajustarlo" solo gastaría tokens sin dar
    // información útil); en vez de eso se le pide el detalle primero.
    function agregarBotonesConfirmarItinerario() {
        const wrap = agregarBloqueHTML(`
            <div class="bgoia-quick-replies">
                <button type="button" class="bgoia-quick-btn" data-accion="confirmar">👍 Sí, me gusta</button>
                <button type="button" class="bgoia-quick-btn" data-accion="ajustar">✏️ Quiero ajustarlo</button>
            </div>
        `);
        wrap.querySelector('[data-accion="confirmar"]').addEventListener('click', () => {
            wrap.querySelectorAll('.bgoia-quick-btn').forEach(b => b.disabled = true);
            manejarMensaje('Sí, me gusta');
        });
        wrap.querySelector('[data-accion="ajustar"]').addEventListener('click', () => {
            wrap.querySelectorAll('.bgoia-quick-btn').forEach(b => b.disabled = true);
            agregarMensajeTexto('Quiero ajustarlo', 'user');
            agregarMensajeTexto('Cuéntame qué te gustaría cambiar (por ejemplo: "más playas", "menos museos", "otro horario") y ajusto el itinerario.', 'bot');
            // ctx.step ya está en CONFIRMANDO_ITINERARIO, así que el próximo
            // texto que escriba el usuario se toma como el feedback real.
        });
        return wrap;
    }

    let typingEl = null;
    function mostrarEscribiendo() {
        typingEl = document.createElement('div');
        typingEl.className = 'bgoia-msg bgoia-msg-bot bgoia-typing';
        typingEl.innerHTML = '<span></span><span></span><span></span>';
        chatBody.appendChild(typingEl);
        scrollAbajo();
    }
    function ocultarEscribiendo() {
        if (typingEl) { typingEl.remove(); typingEl = null; }
    }

    function imagenPara(keyword) {
        return `https://loremflickr.com/400/240/${encodeURIComponent(keyword)}`;
    }

    // Imagen chica dentro de la charla libre, cuando la respuesta gira en
    // torno a un lugar concreto (Gemini manda el keyword en inglés).
    function renderImagenCharla(keyword) {
        agregarBloqueHTML(`
            <div class="bgoia-charla-img">
                <img src="${imagenPara(keyword)}" alt="${keyword}" loading="lazy">
            </div>
        `);
    }

    // Tarjeta de "vista previa" de cómo se vería el viaje, con un botón para
    // saltar directo al armado formal sin tener que escribirlo. Si el
    // usuario prefiere seguir platicando, simplemente ignora el botón y
    // sigue escribiendo normal (el campo de texto nunca se bloquea).
    function renderSugerenciaArmado(textoSugerencia, contextoDestino) {
        const wrap = agregarBloqueHTML(`
            <div class="bgoia-sugerencia">
                <p>💡 ${textoSugerencia}</p>
                <button class="bgoia-sugerencia-btn">Sí, armemos el viaje ✅</button>
            </div>
        `);
        const btn = wrap.querySelector('.bgoia-sugerencia-btn');
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Armando tu viaje...';
            agregarMensajeTexto('Sí, armemos el viaje', 'user');
            ctx.step = 'INICIO';
            await procesarPaso(contextoDestino);
        });
    }

    function formatoMoneda(n) {
        return '$' + Number(n || 0).toLocaleString('es-MX') + ' MXN';
    }

    // --------------------------------------------------------
    // Modo de "Consulta segura" (RAG): preguntas sobre políticas,
    // datos propios, etc. Se activa con el botón 🔒 o escribiendo
    // "/consulta". Se sale escribiendo "salir".
    // --------------------------------------------------------
    let modoRAG = false;

    function entrarModoRAG() {
        modoRAG = true;
        if (ragModeBtn) ragModeBtn.classList.add('bgoia-rag-activo');
        agregarMensajeTexto('🔒 Modo de consulta segura activado. Pregúntame sobre políticas, tus reservas o tu perfil. Escribe "salir" para volver a planear un viaje.', 'bot');
    }

    function salirModoRAG() {
        modoRAG = false;
        if (ragModeBtn) ragModeBtn.classList.remove('bgoia-rag-activo');
        agregarMensajeTexto('Saliste del modo de consulta segura. ¿A dónde te gustaría viajar?', 'bot');
        ctx.step = 'INICIO';
    }

    async function manejarPreguntaRAG(texto) {
        mostrarEscribiendo();
        try {
            const resultado = await BGOIA_RAG.preguntarRAGSeguro(texto);
            ocultarEscribiendo();
            agregarMensajeTexto(resultado.mensaje, 'bot');
            if (resultado.ok && resultado.fuente && resultado.fuente !== 'ninguna') {
                agregarMensajeTexto('📎 Fuente: ' + resultado.fuente, 'bot');
            }
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('No pude procesar tu consulta: ' + err.message, 'bot');
        }
    }

    if (ragModeBtn) {
        ragModeBtn.addEventListener('click', () => {
            if (modoRAG) {
                salirModoRAG();
            } else {
                entrarModoRAG();
            }
        });
    }

    // --------------------------------------------------------
    // Render: 3 tarjetas de opciones de destino
    // --------------------------------------------------------
    function renderOpcionesDestino(opciones) {
        const cards = opciones.map((op, i) => `
            <div class="bgoia-option-card">
                <img src="${imagenPara(op.imagen_keyword)}" alt="${op.titulo}">
                <div class="bgoia-option-card-body">
                    <h6>${op.titulo}</h6>
                    <p>${op.descripcion}</p>
                    <div class="bgoia-option-price">${formatoMoneda(op.precio_aprox)} aprox.</div>
                    <button class="bgoia-select-btn" data-op-index="${i}">Elegir</button>
                </div>
            </div>
        `).join('');

        const wrap = agregarBloqueHTML(`<div class="bgoia-cards-row">${cards}</div>`);
        wrap.querySelectorAll('[data-op-index]').forEach(btn => {
            btn.addEventListener('click', () => elegirOpcionDestino(Number(btn.dataset.opIndex)));
        });
    }

    // --------------------------------------------------------
    // Render: itinerario
    // --------------------------------------------------------
    function renderItinerario(itinerario) {
        const dias = itinerario.dias.map(dia => {
            const items = dia.actividades.map(a => `
                <div class="bgoia-itinerary-item">
                    <span class="bgoia-itinerary-hora">${a.hora}</span>
                    <div>
                        <strong>${a.lugar}</strong>
                        <p>${a.actividad}</p>
                    </div>
                    <span class="bgoia-itinerary-precio">${formatoMoneda(a.precio_aprox)}</span>
                </div>
            `).join('');
            return `
                <div class="bgoia-itinerary-day">
                    <h6>Día ${dia.dia}: ${dia.titulo}</h6>
                    ${items}
                </div>
            `;
        }).join('');

        agregarBloqueHTML(`<div class="bgoia-itinerary">${dias}</div>`);
    }

    // --------------------------------------------------------
    // Render: tarjetas de vuelos / hoteles
    // --------------------------------------------------------
    function renderVuelos(vuelos) {
        if (vuelos.length === 0) {
            agregarMensajeTexto('No encontré vuelos dentro de tu presupuesto 😕 ¿quieres ampliar el presupuesto?', 'bot');
            return;
        }
        const cards = vuelos.map((v, i) => `
            <div class="bgoia-flight-card">
                <div class="bgoia-flight-info">
                    <strong>${v.aerolinea}</strong>
                    <span>${v.salida ? v.salida.slice(11, 16) : ''} → ${v.llegada ? v.llegada.slice(11, 16) : ''} · ${v.escalas === 0 ? 'Directo' : v.escalas + ' escala(s)'}</span>
                </div>
                <div class="bgoia-flight-precio">${formatoMoneda(v.precio)}</div>
                <button class="bgoia-select-btn" data-vuelo-index="${i}">Elegir</button>
            </div>
        `).join('');
        const wrap = agregarBloqueHTML(`<div class="bgoia-list">${cards}</div>`);
        wrap.querySelectorAll('[data-vuelo-index]').forEach(btn => {
            btn.addEventListener('click', () => elegirVuelo(Number(btn.dataset.vueloIndex)));
        });
    }

    function renderHoteles(hoteles) {
        if (hoteles.length === 0) {
            agregarMensajeTexto('No encontré hoteles dentro de tu presupuesto restante 😕 ¿ajustamos el presupuesto?', 'bot');
            return;
        }
        const cards = hoteles.map((h, i) => `
            <div class="bgoia-hotel-card">
                <div class="bgoia-flight-info">
                    <strong>${h.nombre}</strong>
                    <span>${'⭐'.repeat(Math.round(h.estrellas))}</span>
                </div>
                <div class="bgoia-flight-precio">${formatoMoneda(h.precioPorNoche)}/noche</div>
                <button class="bgoia-select-btn" data-hotel-index="${i}">Elegir</button>
            </div>
        `).join('');
        const wrap = agregarBloqueHTML(`<div class="bgoia-list">${cards}</div>`);
        wrap.querySelectorAll('[data-hotel-index]').forEach(btn => {
            btn.addEventListener('click', () => elegirHotel(Number(btn.dataset.hotelIndex)));
        });
    }

    function renderResumenFinal() {
        const totalItinerario = ctx.itinerario.dias.reduce((sum, d) =>
            sum + d.actividades.reduce((s, a) => s + Number(a.precio_aprox || 0), 0), 0);
        // ctx.vueloElegido es null cuando el viaje no necesitó vuelo
        // (origen y destino cercanos, ver evaluación en ESPERANDO_ORIGEN).
        const totalVuelo = ctx.vueloElegido ? ctx.vueloElegido.precio : 0;
        const noches = ctx.diasViaje; // misma convención que antes (3 días -> 3 noches), ahora dinámico
        const totalHotel = ctx.hotelElegido.precioPorNoche * noches;
        const total = totalItinerario + totalVuelo + totalHotel;

        const lineaVuelo = ctx.vueloElegido
            ? `<li>✈️ Vuelo (${ctx.vueloElegido.aerolinea}): ${formatoMoneda(totalVuelo)}</li>`
            : `<li>🚗 Traslado: sin vuelo, ${ctx.trasladoLocal || 'trayecto local'}</li>`;

        agregarBloqueHTML(`
            <div class="bgoia-resumen">
                <h6>✅ ¡Reserva realizada con éxito!</h6>
                <p class="bgoia-resumen-folio">Folio: <strong class="bgoia-folio-valor">generando...</strong></p>
                <ul>
                    ${lineaVuelo}
                    <li>🏨 Hotel (${ctx.hotelElegido.nombre}, ${noches} noche${noches === 1 ? '' : 's'}): ${formatoMoneda(totalHotel)}</li>
                    <li>🗺️ Actividades del itinerario: ${formatoMoneda(totalItinerario)}</li>
                </ul>
                <div class="bgoia-resumen-total">Total estimado: ${formatoMoneda(total)}</div>
            </div>
        `);
        return total;
    }

    // --------------------------------------------------------
    // Parsers simples de intención
    // --------------------------------------------------------
    function parseOpcionElegida(texto, opciones) {
        const t = texto.toLowerCase();
        if (/(primera|opci[oó]n\s*1|^1$|\bla 1\b)/.test(t)) return 0;
        if (/(segunda|opci[oó]n\s*2|^2$|\bla 2\b)/.test(t)) return 1;
        if (/(tercera|opci[oó]n\s*3|^3$|\bla 3\b)/.test(t)) return 2;
        const idx = opciones.findIndex(o => t.includes(o.titulo.toLowerCase()));
        return idx !== -1 ? idx : 0; // por defecto la primera si no entendemos
    }

    // Detecta si el usuario está pidiendo editar el itinerario (quitar,
    // agregar o cambiar una actividad/día), sin importar en qué paso del
    // flujo esté parado. Esto evita que, por ejemplo, "Quita la actividad 1"
    // se interprete como el origen del viaje o cualquier otro dato del paso
    // en el que se encuentre la conversación.
    // Detecta frases explícitas de intención de avanzar al flujo formal
    // (reservar, armar itinerario, etc.), como respaldo por código además
    // del criterio de Gemini (listo_para_reservar), para no depender
    // únicamente de que el modelo lo clasifique bien.
    function pareceIntencionDeReservar(texto) {
        const t = texto.toLowerCase();
        return /(itinerari\w*|res[eé]rv\w*|arma(me)?\s+(el|un|mi)?\s*(viaje|plan|rut\w*)|creame?\s+(un|una)?\s*(rut\w*|itinerari\w*|plan)|dame\s+(un|una|los?|las?)?\s*(paquet\w*|rut\w*|opciones|itinerari\w*)|quiero\s+(ir|viajar)\s+a|planea(r|me)?\s+(el|mi)\s+viaje|quiero\s+(ese|este)\s+plan|quiero\s+ya|ya\s+quiero)/.test(t);
    }

    // Junta el resumen de preferencias + todo lo que dijo el usuario en la
    // charla libre, para que el flujo formal (bgoiaGenerarOpcionesDestino)
    // identifique el destino con TODO el contexto y no solo el último
    // mensaje suelto (ej: "Playas" sin más).
    function construirContextoDestino(ultimoTexto) {
        const partes = [];
        if (ctx.resumenPreferencias) partes.push(ctx.resumenPreferencias);
        ctx.historialCharla.filter(h => h.rol === 'usuario').forEach(h => partes.push(h.texto));
        if (ultimoTexto) partes.push(ultimoTexto);
        return partes.join('. ');
    }

    // El usuario responde "¿Desde dónde viajas?" de formas muy variadas
    // ("Desde la CDMX", "Vivo en Monterrey", "Salgo de Guadalajara"...).
    // Si se manda ese texto tal cual a la búsqueda de aeropuertos/vuelos,
    // palabras como "Desde" o "Vivo en" rompen la búsqueda y no encuentra
    // el aeropuerto (cae al modo simulado). Aquí quitamos esas muletillas
    // para quedarnos solo con el nombre de la ciudad.
    function limpiarOrigen(texto) {
        return texto
            .replace(/^\s*(desde|de|salgo desde|salgo de|vivo en|estoy en|parto de|parto desde|viajo desde|viajo de)\s+/i, '')
            .trim();
    }

    function pareceEdicionItinerario(texto) {
        const t = texto.toLowerCase();
        const tieneAccion = /(quita|quitar|elimina|eliminar|borra|borrar|cambia|cambiar|reemplaza|mueve|agrega|agregar|añade|añadir|modifica|modificar|actualiza)/.test(t);
        const tieneObjeto = /(actividad|d[ií]a\s*\d|itinerario|hora|horario)/.test(t);
        return tieneAccion && tieneObjeto;
    }

    function parseAfirmacion(texto) {
        return /(s[ií]|me parece|bien|perfecto|ok|dale|claro|va|adelante)/i.test(texto);
    }

    // Heurística rápida (sin llamar a Gemini) para detectar que el usuario
    // probablemente NO está respondiendo lo que se le preguntó, sino
    // haciendo una pregunta o comentario suyo.
    function pareceDudaOComentario(texto) {
        return /\?|¿/.test(texto);
    }

    // Red de seguridad: se llama SOLO cuando el paso actual ya detectó que
    // el mensaje no encaja con lo esperado (pregunta, comentario, datos
    // mezclados, etc.). Contesta la pregunta si aplica, guarda cualquier
    // dato de viaje que haya mencionado (para no volver a pedirlo después)
    // y devuelve el resultado para que el paso decida si ya puede avanzar
    // o si debe repetir amablemente lo que necesita.
    async function manejarEntradaConfusa(texto, preguntaPendiente, opcionesReintento) {
        mostrarEscribiendo();
        try {
            const resultado = await bgoiaInterpretarLibre(construirContextoDestino(texto), texto);
            ocultarEscribiendo();
            if (resultado.respuesta) {
                agregarMensajeTexto(resultado.respuesta, 'bot');
            }
            if (resultado.origen) ctx.origenPrellenado = ctx.origenPrellenado || resultado.origen;
            if (resultado.presupuesto) ctx.presupuestoPrellenado = ctx.presupuestoPrellenado || resultado.presupuesto;
            if (resultado.dias) ctx.diasPrellenados = ctx.diasPrellenados || Number(resultado.dias);
            return resultado;
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('Perdón, no entendí bien eso 😅. ' + preguntaPendiente, 'bot');
            if (opcionesReintento) agregarRespuestasRapidas(opcionesReintento);
            return null;
        }
    }

    function parsePresupuesto(texto) {
        const match = texto.replace(/,/g, '').match(/(\d{3,7})/);
        return match ? Number(match[1]) : null;
    }

    function fechaFuturaISO(diasAdelante) {
        const d = new Date();
        d.setDate(d.getDate() + diasAdelante);
        return d.toISOString().slice(0, 10);
    }

    // --------------------------------------------------------
    // Guardar reserva simulada en Firebase Realtime Database
    // --------------------------------------------------------
    async function guardarReservaEnFirebase(total) {
        const folio = 'BGOIA-' + Date.now().toString(36).toUpperCase();
        try {
            if (window.bgoiaDb && window.bgoiaFirebaseDbFns) {
                const { ref, set } = window.bgoiaFirebaseDbFns;
                const uid = window.bgoiaAuth?.currentUser?.uid || 'invitado_' + Date.now();
                await set(ref(window.bgoiaDb, 'reservas/' + uid + '/' + folio), {
                    destino: ctx.destino,
                    opcionElegida: ctx.opcionElegida.titulo,
                    itinerario: ctx.itinerario,
                    origen: ctx.origen,
                    aeropuerto: ctx.aeropuerto,
                    vuelo: ctx.vueloElegido,
                    hotel: ctx.hotelElegido,
                    total,
                    fechaReserva: new Date().toISOString()
                });
            }
        } catch (err) {
            console.warn('No se pudo guardar la reserva en Firebase:', err.message);
        }
        return folio;
    }

    // --------------------------------------------------------
    // Handlers de cada paso
    // --------------------------------------------------------
    async function elegirOpcionDestino(index, mostrarMensajeUsuario = true) {
        ctx.opcionElegida = ctx.opciones[index];
        if (mostrarMensajeUsuario) {
            agregarMensajeTexto(`Me interesa: ${ctx.opcionElegida.titulo}`, 'user');
        }
        agregarMensajeTexto('¡Excelente elección! ¿Qué te interesa hacer? Elige una o varias, o escríbeme lo que se te ocurra.', 'bot');
        agregarSeleccionMultiple([
            { label: '🏖️ Playas', texto: 'playas' },
            { label: '🍜 Comida', texto: 'comida' },
            { label: '🏛️ Museos', texto: 'museos' },
            { label: '🎉 Vida nocturna', texto: 'vida nocturna' },
            { label: '🛍️ Compras', texto: 'compras' },
            { label: '🌳 Naturaleza', texto: 'naturaleza' },
        ], 'Continuar ✅');
        ctx.step = 'ESPERANDO_INTERESES';
    }

    // Reajusta el itinerario ya generado con el comentario/edición del
    // usuario (ej: "quita la actividad 1", "pon menos museos") y vuelve a
    // pedir confirmación. Se usa tanto en CONFIRMANDO_ITINERARIO como cuando
    // el usuario pide un cambio estando ya en pasos posteriores (origen,
    // presupuesto, vuelos, hoteles).
    async function ajustarItinerarioExistente(texto) {
        mostrarEscribiendo();
        try {
            ctx.itinerario = await bgoiaGenerarItinerario(ctx.destino, ctx.opcionElegida.titulo, ctx.intereses, texto, ctx.diasViaje);
            ocultarEscribiendo();
            agregarMensajeTexto('Ajusté el itinerario:', 'bot');
            renderItinerario(ctx.itinerario);
            agregarMensajeTexto('¿Ahora sí te parece bien?', 'bot');
            agregarBotonesConfirmarItinerario();
            ctx.step = 'CONFIRMANDO_ITINERARIO';
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('No pude ajustar el itinerario: ' + err.message, 'bot');
        }
    }

    // Evalúa el trayecto origen->destino y sigue el flujo. Se usa tanto
    // cuando el usuario responde "¿Desde dónde viajas?" como cuando ya lo
    // había dicho antes en la charla libre (ctx.origenPrellenado).
    async function processarOrigen(textoOrigen) {
        ctx.origen = limpiarOrigen(textoOrigen);
        mostrarEscribiendo();
        try {
            // Antes de buscar aeropuerto/vuelos, preguntamos si el
            // trayecto realmente los necesita. Esto evita el caso de
            // pedir "ir a Tepito desde CDMX": son la misma ciudad, así
            // que buscar vuelos ahí solo desperdicia una consulta.
            const evaluacion = await bgoiaEvaluarViaje(ctx.origen, ctx.destino);
            ctx.requiereVuelo = evaluacion.requiere_vuelo !== false;

            if (ctx.requiereVuelo) {
                ctx.aeropuerto = await bgoiaObtenerAeropuertoCercano(ctx.origen, ctx.destino);
                ocultarEscribiendo();
                const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' +
                    encodeURIComponent(ctx.aeropuerto.aeropuerto_nombre + ' ' + ctx.aeropuerto.ciudad);
                agregarBloqueHTML(`
                    <p>Tu aeropuerto más conveniente es <strong>${ctx.aeropuerto.aeropuerto_nombre} (${ctx.aeropuerto.aeropuerto_codigo_iata})</strong> en ${ctx.aeropuerto.ciudad}.</p>
                    <p>${ctx.aeropuerto.consejo}</p>
                    <a href="${mapsUrl}" target="_blank" rel="noopener" class="bgoia-map-link">📍 Ver en Google Maps</a>
                `);
            } else {
                ctx.trasladoLocal = evaluacion.recomendacion || 'Puedes llegar por tierra, no necesitas volar.';
                ocultarEscribiendo();
                agregarBloqueHTML(`
                    <p>🚗 ${ctx.destino} está lo bastante cerca de ${ctx.origen} como para no necesitar vuelo.</p>
                    <p>${ctx.trasladoLocal}</p>
                `);
            }

            if (ctx.presupuestoPrellenado) {
                // También nos dijo su presupuesto en la charla libre: nos
                // saltamos la pregunta y buscamos vuelos/hotel directo.
                const presupuesto = ctx.presupuestoPrellenado;
                ctx.presupuestoPrellenado = null;
                agregarMensajeTexto(`Y ya sé que tu presupuesto es de ${formatoMoneda(presupuesto)}, buscando...`, 'bot');
                await processarPresupuesto(presupuesto);
            } else {
                agregarMensajeTexto(
                    ctx.requiereVuelo
                        ? '¿Cuál es tu presupuesto aproximado para vuelo, hospedaje y actividades?'
                        : '¿Cuál es tu presupuesto aproximado para hospedaje y actividades (sin vuelo)?',
                    'bot'
                );
                agregarRespuestasRapidas([
                    { label: '$8,000', texto: '8000' },
                    { label: '$15,000', texto: '15000' },
                    { label: '$25,000', texto: '25000' },
                    { label: '$40,000+', texto: '40000' },
                ]);
                ctx.step = 'ESPERANDO_PRESUPUESTO';
            }
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('No pude evaluar tu traslado: ' + err.message, 'bot');
        }
    }

    // Busca vuelos (o directo hoteles, si no se necesita volar) con el
    // presupuesto ya conocido, venga de la pregunta formal o de la charla
    // libre.
    async function processarPresupuesto(presupuesto) {
        ctx.presupuesto = presupuesto;
        mostrarEscribiendo();
        try {
            if (ctx.requiereVuelo) {
                const fecha = fechaFuturaISO(30);
                ctx.vuelos = await bgoiaBuscarVuelos(ctx.origen, ctx.destino, fecha, presupuesto);
                ocultarEscribiendo();
                agregarMensajeTexto('Estos son los vuelos disponibles:', 'bot');
                renderVuelos(ctx.vuelos);
                ctx.step = 'ESPERANDO_VUELO';
            } else {
                // Sin vuelo: todo el presupuesto se destina a hospedaje,
                // así que buscamos hoteles directamente.
                const checkin = fechaFuturaISO(30);
                const checkout = fechaFuturaISO(30 + ctx.diasViaje);
                ctx.hoteles = await bgoiaBuscarHoteles(ctx.destino, checkin, checkout, presupuesto);
                ocultarEscribiendo();
                agregarMensajeTexto('Con ese presupuesto, aquí tienes opciones de hospedaje:', 'bot');
                renderHoteles(ctx.hoteles);
                ctx.step = 'ESPERANDO_HOTEL';
            }
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('No pude buscar opciones para tu viaje: ' + err.message, 'bot');
        }
    }

    async function elegirVuelo(index) {
        ctx.vueloElegido = ctx.vuelos[index];
        agregarMensajeTexto(`Elijo el vuelo de ${ctx.vueloElegido.aerolinea} (${formatoMoneda(ctx.vueloElegido.precio)})`, 'user');
        mostrarEscribiendo();
        try {
            const restante = ctx.presupuesto - ctx.vueloElegido.precio;
            const checkin = fechaFuturaISO(30);
            const checkout = fechaFuturaISO(30 + ctx.diasViaje);
            ctx.hoteles = await bgoiaBuscarHoteles(ctx.destino, checkin, checkout, restante);
            ocultarEscribiendo();
            agregarMensajeTexto('Con lo que te queda de presupuesto, aquí tienes algunas opciones de hospedaje:', 'bot');
            renderHoteles(ctx.hoteles);
            ctx.step = 'ESPERANDO_HOTEL';
        } catch (err) {
            ocultarEscribiendo();
            agregarMensajeTexto('Tuve un problema buscando hoteles: ' + err.message, 'bot');
        }
    }

    async function elegirHotel(index) {
        ctx.hotelElegido = ctx.hoteles[index];
        agregarMensajeTexto(`Elijo ${ctx.hotelElegido.nombre}`, 'user');

        const total = renderResumenFinal();

        mostrarEscribiendo();
        const folio = await guardarReservaEnFirebase(total);
        ocultarEscribiendo();

        const folioEl = chatBody.querySelector('.bgoia-folio-valor');
        if (folioEl) folioEl.textContent = folio;

        agregarMensajeTexto('¿Quieres planear otro viaje? Solo dime a dónde 😊', 'bot');
        ctx.step = 'INICIO';
    }

    // --------------------------------------------------------
    // Detección de preguntas tipo RAG (políticas, datos propios)
    // para enrutarlas automáticamente, sin depender de que el
    // usuario active el modo manual.
    // --------------------------------------------------------
    function parecePreguntaRAG(texto) {
        const t = texto.trim().toLowerCase();
        // OJO: antes cualquier "?" mandaba el mensaje al RAG, aunque fuera
        // una pregunta normal de viaje (ej. "¿nos funciona esto para 2
        // personas?"). Eso lo hacía caer siempre en el mensaje genérico
        // "No encontré información autorizada...", cortando la conversación
        // de tajo. Ahora SOLO se considera pregunta de RAG si de verdad
        // toca temas de política/reserva/perfil, sin importar si termina
        // en signo de interrogación o no.
        const palabrasClave = [
            'politica', 'política', 'reglamento', 'termino', 'término',
            'condicion', 'condición', 'mis reservas', 'mi reserva',
            'mi perfil', 'folio', 'cancelacion', 'cancelación',
            'documento', 'autorizada', 'autorizado'
        ];
        return palabrasClave.some(p => t.includes(p));
    }

    async function manejarMensaje(texto) {
        agregarMensajeTexto(texto, 'user');

        // --------------------------------------------------------
        // 1. SEGURIDAD SIEMPRE PRIMERO. Se valida todo mensaje, sin
        // importar el paso del flujo ni si el "modo consulta segura"
        // está activado. No existe un modo "sin protección": si el
        // mensaje intenta un prompt injection o pedir SQL/BD completa,
        // se bloquea aquí y no llega ni al flujo de viajes ni a Gemini.
        // --------------------------------------------------------
        const validacion = BGOIA_RAG.validarConsultaRAG(texto);
        if (!validacion.valido) {
            agregarMensajeTexto(validacion.mensaje, 'bot');
            const user = window.bgoiaAuth?.currentUser;
            if (user) {
                const rol = await BGOIA_RAG.obtenerRolUsuario(user.uid);
                await BGOIA_RAG.registrarLogRAG(user.uid, rol, texto, [], 'bloqueado');
            }
            return;
        }

        const textoLower = texto.trim().toLowerCase();

        // Comando explícito para forzar el modo de consulta segura
        if (!modoRAG && textoLower.startsWith('/consulta')) {
            entrarModoRAG();
            const resto = texto.trim().slice('/consulta'.length).trim();
            if (resto) await manejarPreguntaRAG(resto);
            return;
        }

        // Dentro del modo RAG manual: todo pasa por el pipeline seguro
        if (modoRAG) {
            if (textoLower === 'salir') {
                salirModoRAG();
                return;
            }
            await manejarPreguntaRAG(texto);
            return;
        }

        // Detección automática: preguntas sobre políticas/datos propios
        // se enrutan al RAG aunque el usuario nunca haya tocado el botón 🔒
        if (parecePreguntaRAG(texto)) {
            await manejarPreguntaRAG(texto);
            return;
        }

        await procesarPaso(texto);
    }

    async function procesarPaso(texto) {
        // Si ya existe un itinerario y el usuario pide editarlo, eso tiene
        // prioridad sobre lo que esperaba el paso actual (origen,
        // presupuesto, vuelo, hotel, etc.). Así "Quita la actividad 1" se
        // ajusta de verdad en vez de responder con el mensaje genérico del
        // siguiente paso ("¿Desde dónde viajas?" y similares).
        if (ctx.itinerario && ctx.step !== 'CONFIRMANDO_ITINERARIO' && ctx.step !== 'ESPERANDO_INTERESES' && pareceEdicionItinerario(texto)) {
            agregarMensajeTexto('Claro, ajusto tu itinerario.', 'bot');
            await ajustarItinerarioExistente(texto);
            return;
        }

        switch (ctx.step) {

            case 'CHARLA_LIBRE': {
                const intencionExplicita = pareceIntencionDeReservar(texto);
                mostrarEscribiendo();
                try {
                    const resultado = await bgoiaCharlaLibre(ctx.historialCharla, texto);
                    ocultarEscribiendo();
                    agregarMensajeTexto(resultado.respuesta, 'bot');
                    if (resultado.imagen_keyword) {
                        renderImagenCharla(resultado.imagen_keyword);
                    }
                    ctx.historialCharla.push({ rol: 'usuario', texto });
                    ctx.historialCharla.push({ rol: 'asistente', texto: resultado.respuesta });
                    guardarMensajeEnFirebase('usuario', texto);
                    guardarMensajeEnFirebase('asistente', resultado.respuesta);
                    if (resultado.resumen_preferencias) {
                        ctx.resumenPreferencias = resultado.resumen_preferencias;
                    }
                    if (resultado.origen_detectado) {
                        ctx.origenPrellenado = resultado.origen_detectado;
                    }
                    if (resultado.presupuesto_detectado) {
                        ctx.presupuestoPrellenado = resultado.presupuesto_detectado;
                    }
                    if (resultado.duracion_dias_detectada) {
                        ctx.diasPrellenados = Number(resultado.duracion_dias_detectada);
                    }
                    // Si fue "fuera_de_tema", nos quedamos en CHARLA_LIBRE:
                    // el propio texto de "respuesta" ya redirige con amabilidad.
                    // Esto SOLO avanza cuando el usuario lo pide explícitamente
                    // (o Gemini detecta intención clara): la charla libre puede
                    // seguir dando itinerarios y detalle todo lo que haga falta
                    // sin que eso dispare la reserva por sí solo.
                    if (intencionExplicita || resultado.listo_para_reservar) {
                        // No agregamos un mensaje extra aquí: la respuesta de
                        // Gemini de arriba ya cierra la charla libre de forma
                        // natural, y el siguiente mensaje del bot lo pone el
                        // propio paso INICIO (con su typing normal de por
                        // medio). Meter un tercer mensaje fijo aquí es lo que
                        // hacía sentir la transición forzada/atropellada.
                        const contextoDestino = construirContextoDestino();
                        ctx.step = 'INICIO';
                        await procesarPaso(contextoDestino);
                    } else if (resultado.sugerencia_armado) {
                        // Aún no hay intención explícita, pero ya sabemos lo
                        // suficiente para darle una vista previa + un atajo
                        // (botón) por si le late armar el viaje ya mismo.
                        renderSugerenciaArmado(resultado.sugerencia_armado, construirContextoDestino());
                    }
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('Ups, tuve un problema platicando: ' + err.message, 'bot');
                }
                break;
            }

            case 'INICIO': {
                // Guardamos el historial de charla ANTES de resetearlo, solo
                // para poder checar si el usuario ya nombró el destino con
                // sus propias palabras en algún momento (ver más abajo).
                const historialAntesDeResetear = ctx.historialCharla.slice();
                reiniciarContextoDeViaje();
                mostrarEscribiendo();
                try {
                    const resultado = await bgoiaGenerarOpcionesDestino(texto);
                    ctx.destino = resultado.destino;
                    ctx.opciones = resultado.opciones;
                    ocultarEscribiendo();

                    // Gemini puede haber INFERIDO el destino (p. ej. el
                    // usuario solo dijo "me gusta la fiesta" y nunca escribió
                    // "Cancún"), así que en ese caso sí vale la pena
                    // confirmar antes de seguir. Pero si el usuario YA
                    // escribió el nombre del destino con sus propias palabras
                    // en algún mensaje anterior, volver a preguntar "¿armamos
                    // tu viaje ahí?" solo repite algo que él mismo ya dijo y
                    // se siente forzado/redundante: en ese caso pasamos
                    // directo a mostrarle las opciones.
                    const nombreCorto = ctx.destino.split(',')[0].trim().toLowerCase();
                    const destinoYaMencionadoPorUsuario =
                        texto.toLowerCase().includes(nombreCorto) ||
                        historialAntesDeResetear.some(h => h.rol === 'usuario' && h.texto.toLowerCase().includes(nombreCorto));

                    if (destinoYaMencionadoPorUsuario) {
                        agregarMensajeTexto(`¡Va! Para tu viaje a ${ctx.destino}, aquí tienes 3 opciones:`, 'bot');
                        renderOpcionesDestino(ctx.opciones);
                        ctx.step = 'ESPERANDO_OPCION';
                    } else {
                        agregarMensajeTexto(`Entendí que te gustaría explorar ${ctx.destino}. ¿Armamos tu viaje ahí?`, 'bot');
                        agregarRespuestasRapidas([
                            { label: `Sí, ${ctx.destino}`, texto: 'sí' },
                            { label: 'No, otro destino', texto: 'no' },
                        ]);
                        ctx.step = 'CONFIRMANDO_DESTINO';
                    }
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('Ups, tuve un problema generando opciones: ' + err.message, 'bot');
                }
                break;
            }

            case 'CONFIRMANDO_DESTINO': {
                if (pareceDudaOComentario(texto)) {
                    const preguntaPendiente = `¿Armamos tu viaje a ${ctx.destino}?`;
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                        agregarRespuestasRapidas([
                            { label: `Sí, ${ctx.destino}`, texto: 'sí' },
                            { label: 'No, otro destino', texto: 'no' },
                        ]);
                    }
                } else if (parseAfirmacion(texto)) {
                    agregarMensajeTexto(`Para tu viaje a ${ctx.destino}, aquí tienes 3 opciones:`, 'bot');
                    renderOpcionesDestino(ctx.opciones);
                    ctx.step = 'ESPERANDO_OPCION';
                } else {
                    agregarMensajeTexto('Sin problema, ¿a qué destino te gustaría ir entonces?', 'bot');
                    // El siguiente mensaje libre del usuario se toma como el
                    // destino real y se vuelve a generar todo desde cero.
                    ctx.step = 'INICIO';
                }
                break;
            }

            case 'ESPERANDO_OPCION': {
                if (pareceDudaOComentario(texto)) {
                    const preguntaPendiente = '¿Cuál de las 3 opciones prefieres?';
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                        renderOpcionesDestino(ctx.opciones);
                    }
                } else {
                    const idx = parseOpcionElegida(texto, ctx.opciones);
                    await elegirOpcionDestino(idx, false);
                }
                break;
            }

            case 'ESPERANDO_INTERESES': {
                ctx.intereses = texto;
                // Si en la charla libre ya dijo cuántos días viaja, se respeta
                // esa duración en vez de generar siempre 3 días por default.
                if (ctx.diasPrellenados) {
                    ctx.diasViaje = ctx.diasPrellenados;
                    ctx.diasPrellenados = null;
                }
                mostrarEscribiendo();
                try {
                    ctx.itinerario = await bgoiaGenerarItinerario(ctx.destino, ctx.opcionElegida.titulo, ctx.intereses, "", ctx.diasViaje);
                    ocultarEscribiendo();
                    agregarMensajeTexto('Este sería tu itinerario:', 'bot');
                    renderItinerario(ctx.itinerario);
                    agregarMensajeTexto('¿Te parece bien este itinerario?', 'bot');
                    agregarBotonesConfirmarItinerario();
                    ctx.step = 'CONFIRMANDO_ITINERARIO';
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('Ups, tuve un problema armando el itinerario: ' + err.message, 'bot');
                }
                break;
            }

            case 'CONFIRMANDO_ITINERARIO': {
                if (pareceDudaOComentario(texto)) {
                    // Se revisa ANTES que la afirmación a propósito: un
                    // mensaje como "sisis... funcionaría si vamos 2
                    // personas?" sí hace match con "parece afirmación" (por
                    // el "si"), pero eso ignoraría la pregunta real que trae
                    // el usuario. Primero contestamos la duda/comentario sin
                    // perder el itinerario ya armado, y volvemos a pedir
                    // confirmación clara.
                    const preguntaPendiente = '¿Te parece bien este itinerario?';
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                        agregarBotonesConfirmarItinerario();
                    }
                } else if (parseAfirmacion(texto)) {
                    if (ctx.origenPrellenado) {
                        // Ya nos dijo desde dónde sale en la charla libre (ej:
                        // "desde Chimalhuacón"): no se lo volvemos a preguntar,
                        // solo confirmamos que lo tomamos en cuenta y seguimos.
                        const origen = ctx.origenPrellenado;
                        ctx.origenPrellenado = null;
                        agregarMensajeTexto(`Ya sé que sales de ${origen}, dame un momento.`, 'bot');
                        await processarOrigen(origen);
                    } else {
                        agregarMensajeTexto('¡Perfecto! ¿Desde qué ciudad viajas? (ej: Guadalajara, CDMX, Monterrey)', 'bot');
                        ctx.step = 'ESPERANDO_ORIGEN';
                    }
                } else {
                    await ajustarItinerarioExistente(texto);
                }
                break;
            }

            case 'ESPERANDO_ORIGEN': {
                // Si parece pregunta/comentario, o si trae un número (probable
                // presupuesto mezclado, ej: "salgo de CDMX y tengo 15000"),
                // usamos la interpretación libre en vez de tomar el mensaje
                // completo como si fuera el nombre de una ciudad.
                if (pareceDudaOComentario(texto) || parsePresupuesto(texto)) {
                    const preguntaPendiente = '¿Desde qué ciudad viajas? (ej: Guadalajara, CDMX, Monterrey)';
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado && resultado.origen) {
                        await processarOrigen(resultado.origen);
                    } else if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                    }
                } else {
                    await processarOrigen(texto);
                }
                break;
            }

            case 'ESPERANDO_PRESUPUESTO': {
                const presupuesto = parsePresupuesto(texto);
                if (presupuesto) {
                    await processarPresupuesto(presupuesto);
                    break;
                }
                const preguntaPendiente = '¿Me confirmas tu presupuesto aproximado en números? Ej: 10000';
                const opcionesReintento = [
                    { label: '$8,000', texto: '8000' },
                    { label: '$15,000', texto: '15000' },
                    { label: '$25,000', texto: '25000' },
                    { label: '$40,000+', texto: '40000' },
                ];
                const resultado = await manejarEntradaConfusa(texto, preguntaPendiente, opcionesReintento);
                if (resultado && resultado.presupuesto) {
                    await processarPresupuesto(resultado.presupuesto);
                } else if (resultado) {
                    agregarMensajeTexto(preguntaPendiente, 'bot');
                    agregarRespuestasRapidas(opcionesReintento);
                }
                break;
            }

            case 'ESPERANDO_VUELO': {
                if (pareceDudaOComentario(texto)) {
                    const preguntaPendiente = 'Elige uno de los vuelos de arriba para continuar 👆';
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                        renderVuelos(ctx.vuelos);
                    }
                } else {
                    // No parece duda/pregunta: probablemente sí quiere
                    // empezar un viaje nuevo, se permite reiniciar.
                    ctx.step = 'INICIO';
                    await procesarPaso(texto);
                }
                break;
            }

            case 'ESPERANDO_HOTEL': {
                if (pareceDudaOComentario(texto)) {
                    const preguntaPendiente = 'Elige uno de los hoteles de arriba para continuar 👆';
                    const resultado = await manejarEntradaConfusa(texto, preguntaPendiente);
                    if (resultado) {
                        agregarMensajeTexto(preguntaPendiente, 'bot');
                        renderHoteles(ctx.hoteles);
                    }
                } else {
                    ctx.step = 'INICIO';
                    await procesarPaso(texto);
                }
                break;
            }

            case 'FINALIZADO':
            default: {
                // Si el usuario escribe algo libre en estos pasos, lo tratamos como
                // un nuevo destino (permite reiniciar la conversación).
                ctx.step = 'INICIO';
                await procesarPaso(texto);
                break;
            }
        }
    }

    // --------------------------------------------------------
    // Eventos
    // --------------------------------------------------------
    toggleBtn.addEventListener('click', abrirChat);
    closeBtn.addEventListener('click', cerrarChat);

    if (chatForm) {
        chatForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const texto = chatInput.value.trim();
            if (!texto) return;
            chatInput.value = '';
            manejarMensaje(texto);
        });
    }
})();