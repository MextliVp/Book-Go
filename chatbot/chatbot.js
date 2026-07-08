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
    // Estado de la conversación
    // --------------------------------------------------------
    const ctx = {
        step: 'INICIO',
        destino: null,
        opciones: [],
        opcionElegida: null,
        intereses: null,
        itinerario: null,
        origen: null,
        aeropuerto: null,
        presupuesto: null,
        vuelos: [],
        vueloElegido: null,
        hoteles: [],
        hotelElegido: null,
    };

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
        const totalVuelo = ctx.vueloElegido.precio;
        const totalHotel = ctx.hotelElegido.precioPorNoche * 3; // 3 noches (itinerario de 3 días)
        const total = totalItinerario + totalVuelo + totalHotel;

        agregarBloqueHTML(`
            <div class="bgoia-resumen">
                <h6>✅ ¡Reserva realizada con éxito!</h6>
                <p class="bgoia-resumen-folio">Folio: <strong class="bgoia-folio-valor">generando...</strong></p>
                <ul>
                    <li>✈️ Vuelo (${ctx.vueloElegido.aerolinea}): ${formatoMoneda(totalVuelo)}</li>
                    <li>🏨 Hotel (${ctx.hotelElegido.nombre}, 3 noches): ${formatoMoneda(totalHotel)}</li>
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

    function parseAfirmacion(texto) {
        return /(s[ií]|me parece|bien|perfecto|ok|dale|claro|va|adelante)/i.test(texto);
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
        agregarMensajeTexto('¡Excelente elección! ¿Qué planes tienes? Puedo armarte un itinerario y, si te gusta, comenzamos con la elección de vuelos y hoteles.', 'bot');
        ctx.step = 'ESPERANDO_INTERESES';
    }

    async function elegirVuelo(index) {
        ctx.vueloElegido = ctx.vuelos[index];
        agregarMensajeTexto(`Elijo el vuelo de ${ctx.vueloElegido.aerolinea} (${formatoMoneda(ctx.vueloElegido.precio)})`, 'user');
        mostrarEscribiendo();
        try {
            const restante = ctx.presupuesto - ctx.vueloElegido.precio;
            const checkin = fechaFuturaISO(30);
            const checkout = fechaFuturaISO(33);
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
        const esPregunta = t.endsWith('?') || t.startsWith('¿');
        const palabrasClave = [
            'politica', 'política', 'reglamento', 'termino', 'término',
            'condicion', 'condición', 'mis reservas', 'mi reserva',
            'mi perfil', 'folio', 'cancelacion', 'cancelación',
            'documento', 'autorizada', 'autorizado'
        ];
        const tieneClave = palabrasClave.some(p => t.includes(p));
        return esPregunta || tieneClave;
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
        switch (ctx.step) {

            case 'INICIO': {
                ctx.destino = texto;
                mostrarEscribiendo();
                try {
                    ctx.opciones = await bgoiaGenerarOpcionesDestino(texto);
                    ocultarEscribiendo();
                    agregarMensajeTexto('Aquí tienes 3 opciones:', 'bot');
                    renderOpcionesDestino(ctx.opciones);
                    ctx.step = 'ESPERANDO_OPCION';
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('Ups, tuve un problema generando opciones: ' + err.message, 'bot');
                }
                break;
            }

            case 'ESPERANDO_OPCION': {
                const idx = parseOpcionElegida(texto, ctx.opciones);
                await elegirOpcionDestino(idx, false);
                break;
            }

            case 'ESPERANDO_INTERESES': {
                ctx.intereses = texto;
                mostrarEscribiendo();
                try {
                    ctx.itinerario = await bgoiaGenerarItinerario(ctx.destino, ctx.opcionElegida.titulo, ctx.intereses);
                    ocultarEscribiendo();
                    agregarMensajeTexto('Este sería tu itinerario:', 'bot');
                    renderItinerario(ctx.itinerario);
                    agregarMensajeTexto('¿Te parece bien este itinerario?', 'bot');
                    ctx.step = 'CONFIRMANDO_ITINERARIO';
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('Ups, tuve un problema armando el itinerario: ' + err.message, 'bot');
                }
                break;
            }

            case 'CONFIRMANDO_ITINERARIO': {
                if (parseAfirmacion(texto)) {
                    agregarMensajeTexto('¡Perfecto! ¿Desde dónde viajas?', 'bot');
                    ctx.step = 'ESPERANDO_ORIGEN';
                } else {
                    mostrarEscribiendo();
                    try {
                        ctx.itinerario = await bgoiaGenerarItinerario(ctx.destino, ctx.opcionElegida.titulo, ctx.intereses, texto);
                        ocultarEscribiendo();
                        agregarMensajeTexto('Ajusté el itinerario:', 'bot');
                        renderItinerario(ctx.itinerario);
                        agregarMensajeTexto('¿Ahora sí te parece bien?', 'bot');
                    } catch (err) {
                        ocultarEscribiendo();
                        agregarMensajeTexto('No pude ajustar el itinerario: ' + err.message, 'bot');
                    }
                }
                break;
            }

            case 'ESPERANDO_ORIGEN': {
                ctx.origen = texto;
                mostrarEscribiendo();
                try {
                    ctx.aeropuerto = await bgoiaObtenerAeropuertoCercano(ctx.origen, ctx.destino);
                    ocultarEscribiendo();
                    const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' +
                        encodeURIComponent(ctx.aeropuerto.aeropuerto_nombre + ' ' + ctx.aeropuerto.ciudad);
                    agregarBloqueHTML(`
                        <p>Tu aeropuerto más conveniente es <strong>${ctx.aeropuerto.aeropuerto_nombre} (${ctx.aeropuerto.aeropuerto_codigo_iata})</strong> en ${ctx.aeropuerto.ciudad}.</p>
                        <p>${ctx.aeropuerto.consejo}</p>
                        <a href="${mapsUrl}" target="_blank" rel="noopener" class="bgoia-map-link">📍 Ver en Google Maps</a>
                    `);
                    agregarMensajeTexto('¿Cuál es tu presupuesto aproximado para este viaje?', 'bot');
                    ctx.step = 'ESPERANDO_PRESUPUESTO';
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('No pude ubicar tu aeropuerto: ' + err.message, 'bot');
                }
                break;
            }

            case 'ESPERANDO_PRESUPUESTO': {
                const presupuesto = parsePresupuesto(texto);
                if (!presupuesto) {
                    agregarMensajeTexto('¿Me confirmas el monto en números? Ej: 10000', 'bot');
                    break;
                }
                ctx.presupuesto = presupuesto;
                mostrarEscribiendo();
                try {
                    const fecha = fechaFuturaISO(30);
                    ctx.vuelos = await bgoiaBuscarVuelos(ctx.origen, ctx.destino, fecha, presupuesto);
                    ocultarEscribiendo();
                    agregarMensajeTexto('Estos son los vuelos disponibles:', 'bot');
                    renderVuelos(ctx.vuelos);
                    ctx.step = 'ESPERANDO_VUELO';
                } catch (err) {
                    ocultarEscribiendo();
                    agregarMensajeTexto('No pude buscar vuelos: ' + err.message, 'bot');
                }
                break;
            }

            case 'ESPERANDO_VUELO':
            case 'ESPERANDO_HOTEL':
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
