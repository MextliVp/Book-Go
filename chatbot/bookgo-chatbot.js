(function () {
  "use strict";

  const FIREBASE_CDN = {
    app: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
    db: "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js",
    auth: "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  };

  // Config del proyecto. Se mantiene dentro de chatbot para no tocar archivos del equipo.
  const firebaseConfig = {
    apiKey: "AIzaSyBY0KCEgBwrKV02kiFTGZLtWOxO9ozzSso",
    authDomain: "bookandgo-ad08d.firebaseapp.com",
    databaseURL: "https://bookandgo-ad08d-default-rtdb.firebaseio.com",
    projectId: "bookandgo-ad08d",
    storageBucket: "bookandgo-ad08d.firebasestorage.app",
    messagingSenderId: "772819367761",
    appId: "1:772819367761:web:5fdf584737cf2ea3ad8570",
    measurementId: "G-NZKR4SKYC6"
  };

  // Catálogo de respaldo. El chatbot primero intenta usar Firebase o catalogo.js.
  const fallbackViajes = [
    {
      id: 1,
      destino: "filipinas",
      titulo: "Paraíso Tropical en Filipinas",
      precio: "$24,500 MXN",
      imagen: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&q=80&w=600",
      descripcion: "Explora las islas de El Nido, lagunas de aguas cristalinas y playas de arena blanca con guías locales gestionados por IA.",
      duracion: "10 días / 9 noches"
    },
    {
      id: 2,
      destino: "cancun",
      titulo: "Experiencia Caribeña Cancún",
      precio: "$12,000 MXN",
      imagen: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=600",
      descripcion: "Disfruta del sol de Quintana Roo, acceso exclusivo a cenotes y tours arqueológicos personalizados en Chichén Itzá.",
      duracion: "5 días / 4 noches"
    },
    {
      id: 3,
      destino: "tokio",
      titulo: "Tradición y Futuro en Japón",
      precio: "$45,000 MXN",
      imagen: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=600",
      descripcion: "Un viaje interactivo desde los templos históricos de Kioto hasta los barrios tecnológicos y futuristas de Tokio.",
      duracion: "12 días / 11 noches"
    },
    {
      id: 4,
      destino: "paris",
      titulo: "Luces y Romance en París",
      precio: "$32,500 MXN",
      imagen: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=600",
      descripcion: "Recorrido cultural por el Museo del Louvre, la Torre Eiffel y paseos románticos junto al río Sena con itinerario optimizado.",
      duracion: "7 días / 6 noches"
    },
    {
      id: 5,
      destino: "nueva york",
      titulo: "Aventura Urbana en Nueva York",
      precio: "$28,000 MXN",
      imagen: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=600",
      descripcion: "Vive la energía de Times Square, camina por Central Park y disfruta de las mejores obras de Broadway.",
      duracion: "6 días / 5 noches"
    },
    {
      id: 6,
      destino: "machu picchu",
      titulo: "Ruta del Inca en Machu Picchu",
      precio: "$18,500 MXN",
      imagen: "https://images.unsplash.com/photo-1587595421260-30c513ef508b?auto=format&fit=crop&q=80&w=600",
      descripcion: "Descubre los secretos de la civilización Inca en Cusco y maravíllate con la imponente vista de la ciudadela sagrada.",
      duracion: "8 días / 7 noches"
    },
    {
      id: 7,
      destino: "roma",
      titulo: "Historia Viva en Roma",
      precio: "$29,900 MXN",
      imagen: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&q=80&w=600",
      descripcion: "Viaja en el tiempo visitando el Coliseo Romano, el Vaticano y la Fontana di Trevi mientras disfrutas de la gastronomía italiana.",
      duracion: "7 días / 6 noches"
    }
  ];

  const STOPWORDS = [
    "quiero", "busco", "buscar", "viaje", "viajes", "paquete", "paquetes", "para", "con", "sin", "donde", "tienes", "tienen", "mostrar", "muestra", "muestrame", "ver", "opcion", "opciones", "disponible", "disponibles", "recomienda", "recomiendame", "informacion", "info", "sobre", "del", "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "ir", "viajar", "me", "por", "favor", "turistico", "turisticos", "lugar", "lugares"
  ];

  const CHATBOT_VERSION = "reservas-transporte-total-v3";

  const state = {
    db: null,
    auth: null,
    firebaseReady: false,
    user: null,
    uid: null,
    sessionId: getSessionId(),
    messages: [],
    viajes: [],
    firebaseDbTools: null,
    reservaActiva: null
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    injectMarkup();
    bindEvents();

    await initFirebase();
    await loadViajes();
    await loadHistory();

    renderHistory();

    if (!state.messages.length) {
      addMessage(
        "bot",
        "Hola, soy Book&Go IA ✈️\nPuedo ayudarte a buscar viajes, filtrar por presupuesto y hacer reservas desde el chat. Prueba con:\n• lugares turísticos por menos de 20k\n• muéstrame todos los viajes\n• reservar Cancún"
      );
    }
  }

  function injectMarkup() {
    if (document.getElementById("bookgoChatLauncher")) return;

    const launcher = document.createElement("button");
    launcher.id = "bookgoChatLauncher";
    launcher.className = "bookgo-chat-launcher";
    launcher.setAttribute("aria-label", "Abrir Book&Go IA");
    launcher.innerHTML = `
      <span class="bookgo-pulse"></span>
      <span class="bookgo-launcher-avatar">✈️</span>
      <span class="bookgo-launcher-text">¿Necesitas ayuda?<small>Book&Go IA</small></span>
    `;

    const chat = document.createElement("section");
    chat.id = "bookgoChatWindow";
    chat.className = "bookgo-chat-window";
    chat.innerHTML = `
      <header class="bookgo-chat-header">
        <div class="bookgo-agent">
          <div class="bookgo-agent-avatar">🤖</div>
          <div>
            <div class="bookgo-agent-title">Book&Go IA</div>
            <div class="bookgo-agent-subtitle">Asistente de viajes y reservas</div>
          </div>
        </div>
        <div class="bookgo-header-actions">
          <button class="bookgo-icon-btn bookgo-clear-btn" id="bookgoClearChat" type="button" title="Limpiar chat" aria-label="Limpiar chat">🧹</button>
          <button class="bookgo-icon-btn bookgo-close-btn" id="bookgoClose" type="button" title="Contraer chat" aria-label="Contraer chat">×</button>
        </div>
      </header>

      <main class="bookgo-chat-messages" id="bookgoMessages"></main>

      <div class="bookgo-quick-actions">
        <button class="bookgo-chip" data-text="Lugares turísticos por menos de 20k">Menos de $20k</button>
        <button class="bookgo-chip" data-text="Quiero viajar 3 noches con presupuesto de 20k">Presupuesto + noches</button>
        <button class="bookgo-chip" data-text="Reservar Cancún con traslado en avión">Reserva guiada</button>
        <button class="bookgo-chip" data-text="Quiero reservar con transporte desde CDMX">Con transporte</button>
        <button class="bookgo-chip" data-text="Muéstrame todos los viajes">Todos</button>
      </div>

      <form class="bookgo-chat-input-area" id="bookgoForm">
        <textarea class="bookgo-chat-input" id="bookgoInput" rows="1" placeholder="Escribe destino, presupuesto o reserva..."></textarea>
        <button class="bookgo-send-btn" type="submit">➤</button>
      </form>

      <div class="bookgo-footer">Powered by Book&Go IA · Firebase</div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(chat);
  }

  function bindEvents() {
    $("bookgoChatLauncher").addEventListener("click", openChat);
    $("bookgoClose").addEventListener("click", closeChat);
    $("bookgoClearChat").addEventListener("click", clearChat);
    $("bookgoForm").addEventListener("submit", handleSubmit);
    $("bookgoInput").addEventListener("input", autoGrow);
    $("bookgoInput").addEventListener("keydown", handleInputKeydown);

    document.querySelectorAll(".bookgo-chip").forEach((btn) => {
      btn.addEventListener("click", () => sendUserText(btn.dataset.text));
    });

    document.addEventListener("click", (event) => {
      const reserveButton = event.target.closest(".bookgo-reserve-btn");
      if (reserveButton) {
        event.preventDefault();
        sendUserText(`reservar ${reserveButton.dataset.destino || reserveButton.dataset.id || ""}`.trim());
        return;
      }

      const actionButton = event.target.closest(".bookgo-action-btn");
      if (actionButton) {
        event.preventDefault();
        const text = actionButton.dataset.text || "";
        if (text) sendUserText(text);
        return;
      }

      const customFocusButton = event.target.closest(".bookgo-focus-input");
      if (customFocusButton) {
        event.preventDefault();
        openChat();
        const input = $("bookgoInput");
        if (input) {
          input.value = "";
          input.placeholder = customFocusButton.dataset.placeholder || "Escribe tu respuesta...";
          input.focus();
        }
        return;
      }

      const dateButton = event.target.closest(".bookgo-date-submit");
      if (dateButton) {
        event.preventDefault();
        const picker = dateButton.closest(".bookgo-date-picker");
        if (!picker) return;

        const entrada = picker.querySelector(".bookgo-date-start")?.value;
        const salida = picker.querySelector(".bookgo-date-end")?.value;

        if (!entrada || !salida) {
          alert("Selecciona fecha de entrada y fecha de salida.");
          return;
        }

        if (new Date(salida) <= new Date(entrada)) {
          alert("La fecha de salida debe ser posterior a la entrada.");
          return;
        }

        sendUserText(`fechas ${entrada} ${salida}`);
      }
    });
  }

  async function initFirebase() {
    try {
      const firebaseApp = await import(FIREBASE_CDN.app);
      const firebaseDb = await import(FIREBASE_CDN.db);
      const firebaseAuth = await import(FIREBASE_CDN.auth);

      const app = firebaseApp.getApps().length
        ? firebaseApp.getApps()[0]
        : firebaseApp.initializeApp(firebaseConfig);

      state.db = firebaseDb.getDatabase(app);
      state.auth = firebaseAuth.getAuth(app);
      state.firebaseDbTools = firebaseDb;
      state.firebaseReady = true;

      state.user = await waitForFirebaseUser(firebaseAuth);
      state.uid = state.user ? state.user.uid : null;

      firebaseAuth.onAuthStateChanged(state.auth, async (user) => {
        const oldUid = state.uid;
        state.user = user;
        state.uid = user ? user.uid : null;

        if (oldUid !== state.uid) {
          await loadHistory();
          renderHistory();
          if (!state.messages.length) {
            addMessage("bot", "Hola, soy Book&Go IA ✈️ ¿Qué viaje quieres buscar o reservar?");
          }
        }
      });
    } catch (error) {
      console.warn("Firebase no está disponible para el chatbot:", error.message);
      state.firebaseReady = false;
    }
  }

  function waitForFirebaseUser(firebaseAuth) {
    return new Promise((resolve) => {
      let finished = false;
      let unsubscribe = () => {};

      const finish = (user) => {
        if (finished) return;
        finished = true;
        try { unsubscribe(); } catch (e) {}
        resolve(user || null);
      };

      unsubscribe = firebaseAuth.onAuthStateChanged(
        state.auth,
        (user) => finish(user),
        () => finish(null)
      );

      setTimeout(() => finish(state.auth ? state.auth.currentUser : null), 1200);
    });
  }

  async function loadViajes() {
    state.viajes = [];

    if (state.firebaseReady) {
      try {
        const { ref, get } = state.firebaseDbTools;
        const possibleNodes = ["viajesCatalogo", "viajes", "paquetes", "catalogo"];

        for (const node of possibleNodes) {
          const snap = await get(ref(state.db, node));

          if (snap.exists()) {
            const items = normalizeFirebaseList(snap.val()).filter(esViajeValido);

            if (items.length) {
              state.viajes = limpiarDuplicados(items);
              break;
            }
          }
        }
      } catch (error) {
        console.warn("No se pudo leer catálogo desde Firebase:", error.message);
      }
    }

    if (!state.viajes.length) {
      try {
        if (typeof viajesCatalogo !== "undefined" && Array.isArray(viajesCatalogo)) {
          state.viajes = viajesCatalogo.filter(esViajeValido);
        }
      } catch (e) {}
    }

    if (!state.viajes.length && Array.isArray(window.viajesCatalogo)) {
      state.viajes = window.viajesCatalogo.filter(esViajeValido);
    }

    if (!state.viajes.length) {
      state.viajes = fallbackViajes;
    }

    state.viajes = limpiarDuplicados(state.viajes).sort((a, b) => toComparableId(a.id) - toComparableId(b.id));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const input = $("bookgoInput");
    const text = input.value.trim();

    if (!text) return;

    input.value = "";
    autoGrow.call(input);

    await sendUserText(text);
  }


  function handleInputKeydown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    $("bookgoForm").requestSubmit();
  }

  async function sendUserText(text) {
    openChat();

    addMessage("user", text);
    await saveMessageRemote("user", text);

    showTyping();
    await delay(320);
    hideTyping();

    const response = await buildResponse(text);

    addMessage("bot", response.text, response.cards, response.actions);
    await saveMessageRemote("bot", response.text, response.cards);
  }

  async function buildResponse(text) {
    const q = normalize(text);

    if (state.reservaActiva) {
      return handleReservaStep(text, q);
    }

    if (esSaludo(q)) {
      return {
        text: "¡Hola! Soy Book&Go IA 😊\nPuedo mostrar viajes, filtrar lugares turísticos por presupuesto y hacer reservas desde el chat. Ejemplo: \"lugares turísticos por menos de 20k\" o \"reservar Cancún\".",
        cards: []
      };
    }

    if (q.includes("gracias")) {
      return { text: "Con gusto 😊. Cuando quieras buscar o reservar otro viaje, dime el destino o tu presupuesto.", cards: [] };
    }

    if (preguntaFueraDeCatalogo(q)) {
      return {
        text: "Por ahora Book&Go solo asesora sobre paquetes de viaje del catálogo. No manejo autos, renta de vehículos ni servicios fuera de los viajes disponibles.",
        cards: []
      };
    }

    const allTrips = [...state.viajes];
    const destino = detectarDestino(q, allTrips);
    const maxPrice = extractMaxPrice(q);
    const requestedNights = extractNights(q);
    const transporte = detectarTransporte(q);
    const pideTodos = quiereTodos(q);
    const pideBaratos = quiereBaratos(q);
    const pideCaros = quiereCaros(q);
    const pideReserva = quiereReservar(q);
    const preguntaServicios = preguntaServiciosHospedaje(q);

    if (pideReserva) {
      return iniciarReservaDesdeTexto(q, allTrips, destino);
    }

    if (preguntaServicios) {
      return responderServicios(q, allTrips, destino);
    }

    // Primero resolvemos búsquedas de presupuesto. Así "lugares turísticos por menos de 20k"
    // siempre muestra los paquetes debajo de $20,000 y no cae en una FAQ.
    let results = [...allTrips];
    let modo = "busqueda";

    if (destino) {
      results = results.filter((v) => normalizarDestino(v.destino) === destino);
      modo = "destino";
    }

    if (maxPrice) {
      results = results.filter((v) => {
        if (!requestedNights) return toNumber(v.precio) <= maxPrice;
        return calcularTotalPorNoches(v, requestedNights) <= maxPrice;
      });
      results = results.sort((a, b) => {
        const totalA = requestedNights ? calcularTotalPorNoches(a, requestedNights) : toNumber(a.precio);
        const totalB = requestedNights ? calcularTotalPorNoches(b, requestedNights) : toNumber(b.precio);
        return totalA - totalB;
      });
      modo = requestedNights ? "presupuesto_noches" : "presupuesto";
    }

    if (!maxPrice && requestedNights && !destino) {
      results = results.sort((a, b) => calcularTotalPorNoches(a, requestedNights) - calcularTotalPorNoches(b, requestedNights));
      modo = "noches";
    }

    if (!destino && !maxPrice && !pideTodos && !pideBaratos && !pideCaros) {
      if (esPreguntaFAQ(q)) return buildFAQResponse(q);
      results = buscarPorPalabras(q, allTrips);
      modo = "palabras";
    }

    if (pideBaratos) {
      results = results.sort((a, b) => toNumber(a.precio) - toNumber(b.precio));
      modo = maxPrice ? "presupuesto" : "baratos";
    }

    if (pideCaros) {
      results = results.sort((a, b) => toNumber(b.precio) - toNumber(a.precio));
      modo = "premium";
    }

    if (pideTodos && !destino && !maxPrice) {
      results = [...allTrips];
      modo = "todos";
    }

    if (!pideTodos && !maxPrice && !destino && pideBaratos) results = results.slice(0, 3);
    if (!pideTodos && !maxPrice && !destino && pideCaros) results = results.slice(0, 3);

    if (!results.length) {
      return {
        text: "No encontré viajes que coincidan exactamente con tu búsqueda.\n\nPuedes intentar con:\n• Muéstrame todos los viajes\n• Lugares turísticos por menos de 20k\n• Viajes baratos\n• Reservar Cancún",
        cards: []
      };
    }

    return {
      text: crearTextoRespuesta(modo, results, { destino, maxPrice, requestedNights, transporte, pideTodos, pideBaratos }),
      cards: results.map((v) => toCard(v, { requestedNights, transporte }))
    };
  }

  function iniciarReservaDesdeTexto(q, viajes, destinoDetectado) {
    let viaje = null;

    const idMatch = q.match(/(?:id|#)?\s*(\d+)/);
    if (idMatch) {
      viaje = viajes.find((v) => String(v.id) === String(idMatch[1]));
    }

    if (!viaje && destinoDetectado) {
      viaje = viajes.find((v) => normalizarDestino(v.destino) === destinoDetectado);
    }

    if (!viaje) {
      const cards = viajes.map(toCard);
      return {
        text: "Claro, puedo ayudarte a reservar desde el chat. ¿Qué paquete quieres reservar?\n\nPuedes escribir, por ejemplo:\n• reservar Cancún\n• reservar Machu Picchu\n• reservar 2",
        cards
      };
    }

    return iniciarReserva(viaje, q);
  }

  function iniciarReserva(viaje, q = "") {
    const precioTotalCatalogo = toNumber(viaje.precio);
    const nochesCatalogo = getNochesFromDuracion(viaje.duracion || viaje.duración);
    const precioNoche = nochesCatalogo ? Math.round(precioTotalCatalogo / nochesCatalogo) : 0;
    const servicios = obtenerServicios(viaje);
    const transporteDetectado = detectarTransporte(q);

    state.reservaActiva = {
      viaje,
      step: "fechas",
      fechaEntrada: null,
      fechaSalida: null,
      noches: nochesCatalogo || 1,
      personas: 1,
      mascotas: null,
      transporte: transporteDetectado || null,
      origen: null,
      transporteEstimado: 0,
      transporteDetalle: null,
      wifi: servicios.wifi,
      precioNoche,
      totalEstimado: precioTotalCatalogo,
      totalViajeEstimado: precioTotalCatalogo
    };

    return {
      text:
        `Perfecto, iniciamos tu reserva para:\n` +
        `🏨 ${viaje.titulo || viaje.nombre}\n` +
        `📍 Destino: ${formatoDestino(normalizarDestino(viaje.destino))}\n` +
        `📅 Duración del catálogo: ${viaje.duracion || viaje.duración || "por confirmar"}\n` +
        `💰 Precio del paquete: ${formatoDinero(precioTotalCatalogo)} MXN\n` +
        `🌙 Precio estimado por noche: ${precioNoche ? formatoDinero(precioNoche) + " MXN" : "por confirmar"}\n` +
        `📶 WiFi: ${servicios.wifi}\n` +
        `🐾 Mascotas: ${servicios.mascotas}\n` +
        `🚕 Traslado: ${transporteDetectado ? formatoTransporte(transporteDetectado) : "lo elegiremos más adelante"}\n\n` +
        `Selecciona tus fechas de viaje aquí abajo para continuar.`,
      cards: [toCard(viaje)],
      actions: [crearDatePickerAction(), crearBotonAction("Cancelar reserva", "cancelar reserva", "secondary")]
    };
  }

  async function handleReservaStep(text, q) {
    const reserva = state.reservaActiva;

    if (q.includes("cancelar") || q.includes("salir") || q.includes("detener")) {
      state.reservaActiva = null;
      return { text: "Listo, cancelé el proceso de reserva. Puedes iniciar otra escribiendo \"reservar Cancún\".", cards: [] };
    }

    if (reserva.step === "fechas") {
      const fechas = parseDateRange(text);

      if (!fechas) {
        return {
          text: "Para continuar con la reserva, selecciona fecha de entrada y salida en el calendario.",
          cards: [],
          actions: [crearDatePickerAction(), crearBotonAction("Cancelar reserva", "cancelar reserva", "secondary")]
        };
      }

      reserva.fechaEntrada = fechas.start;
      reserva.fechaSalida = fechas.end;
      reserva.noches = Math.max(1, diffDays(fechas.start, fechas.end));
      reserva.totalEstimado = calcularTotalReserva(reserva);
      reserva.step = "personas";

      return {
        text:
          `Perfecto. Tengo estas fechas:\n` +
          `📅 Entrada: ${formatDate(reserva.fechaEntrada)}\n` +
          `📅 Salida: ${formatDate(reserva.fechaSalida)}\n` +
          `🌙 Noches: ${reserva.noches}\n` +
          `💰 Total estimado: ${formatoDinero(reserva.totalEstimado)} MXN\n\n` +
          `¿Para cuántas personas será la reserva?`,
        cards: [],
        actions: [
          crearBotonAction("1 persona", "1 persona"),
          crearBotonAction("2 personas", "2 personas"),
          crearBotonAction("3 personas", "3 personas"),
          crearBotonAction("4 personas", "4 personas"),
          crearBotonAction("Cancelar", "cancelar reserva", "secondary")
        ]
      };
    }

    if (reserva.step === "personas") {
      const personas = extractPeople(q);

      if (!personas) {
        return {
          text: "¿Para cuántas personas será la reserva? Puedes elegir una opción:",
          cards: [],
          actions: [
            crearBotonAction("1 persona", "1 persona"),
            crearBotonAction("2 personas", "2 personas"),
            crearBotonAction("3 personas", "3 personas"),
            crearBotonAction("4 personas", "4 personas"),
            crearBotonAction("Cancelar", "cancelar reserva", "secondary")
          ]
        };
      }

      reserva.personas = personas;
      reserva.step = "mascotas";

      return {
        text:
          `Perfecto, ${personas} persona${personas === 1 ? "" : "s"}.\n` +
          `¿Viajan con mascotas o animales?`,
        cards: [],
        actions: [
          crearBotonAction("Sí, llevo mascotas", "sí llevo mascotas"),
          crearBotonAction("No llevo mascotas", "no llevo mascotas"),
          crearBotonAction("Cancelar", "cancelar reserva", "secondary")
        ]
      };
    }

    if (reserva.step === "mascotas") {
      const respuesta = detectarSiNo(q);

      if (respuesta === null) {
        return {
          text: "Solo necesito saber si viajan con mascotas. Elige una opción:",
          cards: [],
          actions: [
            crearBotonAction("Sí, llevo mascotas", "sí llevo mascotas"),
            crearBotonAction("No llevo mascotas", "no llevo mascotas"),
            crearBotonAction("Cancelar", "cancelar reserva", "secondary")
          ]
        };
      }

      reserva.mascotas = respuesta;
      reserva.step = "transporte";

      return {
        text:
          `Perfecto. Ahora elige cómo te gustaría considerar el traslado para el viaje.\n` +
          `Esto queda guardado como preferencia para que administración pueda cotizarlo o confirmarlo.`,
        cards: [],
        actions: [
          crearBotonAction("Avión", "traslado en avión"),
          crearBotonAction("Vehículo", "traslado en vehículo"),
          crearBotonAction("Tren", "traslado en tren"),
          crearBotonAction("Solo hospedaje", "sin traslado"),
          crearBotonAction("Cancelar", "cancelar reserva", "secondary")
        ]
      };
    }

    if (reserva.step === "transporte") {
      const transporte = detectarTransporte(q);

      if (!transporte) {
        return {
          text: "Elige una opción de transporte para calcular el costo aproximado de llegada:",
          cards: [],
          actions: crearAccionesTransporte()
        };
      }

      reserva.transporte = transporte;

      if (transporte === "sin traslado") {
        reserva.origen = "No aplica";
        reserva.transporteEstimado = 0;
        reserva.transporteDetalle = {
          texto: "Sin transporte agregado. Solo se calcula el paquete/hospedaje.",
          costo: 0
        };
        reserva.totalViajeEstimado = reserva.totalEstimado;
        reserva.step = "confirmar";

        return {
          text: crearResumenReserva(reserva) + "\n\n¿Confirmo tu reserva?",
          cards: [toCard(reserva.viaje)],
          actions: crearAccionesConfirmacion()
        };
      }

      reserva.step = "origen";

      return {
        text:
          `Perfecto, calcularé el transporte en ${formatoTransporte(transporte)}.

` +
          `Ahora dime tu ubicación exacta o ciudad de salida. Ejemplos:
` +
          `• CDMX, México
` +
          `• Guadalajara, Jalisco
` +
          `• Monterrey, Nuevo León
` +
          `• Puebla, Puebla

` +
          `Con eso haré un cálculo supuesto del transporte y el total aproximado del viaje.`,
        cards: [],
        actions: crearAccionesOrigen()
      };
    }

    if (reserva.step === "origen") {
      const origen = extraerOrigen(text);

      if (!origen || normalize(origen).includes("otra ubicacion")) {
        return {
          text:
            "Escribe tu ubicación exacta o ciudad de salida para calcular el transporte.\n" +
            "Ejemplo: CDMX, Guadalajara, Monterrey, Puebla, Mérida o tu ciudad.",
          cards: [],
          actions: crearAccionesOrigen()
        };
      }

      reserva.origen = origen;
      reserva.transporteDetalle = estimarTransporte(reserva);
      reserva.transporteEstimado = reserva.transporteDetalle.costo;
      reserva.totalViajeEstimado = reserva.totalEstimado + reserva.transporteEstimado;
      reserva.step = "confirmar";

      return {
        text:
          crearResumenReserva(reserva) +
          "\n\n¿Confirmo tu reserva con este cálculo aproximado?",
        cards: [toCard(reserva.viaje, { transporte: reserva.transporte })],
        actions: crearAccionesConfirmacion()
      };
    }

    if (reserva.step === "confirmar") {
      if (q.includes("confirm") || q.includes("si") || q.includes("sí") || q.includes("acepto")) {
        const reservaGuardada = crearReservaPayload(reserva);
        await guardarReserva(reservaGuardada);
        state.reservaActiva = null;

        return {
          text:
            `✅ Reserva registrada correctamente.\n\n` +
            `Folio: ${reservaGuardada.folio}\n` +
            crearResumenReservaFromPayload(reservaGuardada) +
            `\n\nPuedes revisar el historial del chat cuando vuelvas a iniciar sesión.`,
          cards: []
        };
      }

      if (q.includes("cancel")) {
        state.reservaActiva = null;
        return { text: "Reserva cancelada. No se guardó ningún registro.", cards: [] };
      }

      return {
        text: "Para finalizar elige una opción:",
        cards: [],
        actions: [
          crearBotonAction("Confirmar reserva", "confirmar reserva"),
          crearBotonAction("Cancelar", "cancelar reserva", "secondary")
        ]
      };
    }

    state.reservaActiva = null;
    return { text: "Reinicié el flujo de reserva. Puedes escribir: reservar Cancún.", cards: [] };
  }

  function crearBotonAction(label, text, variant) {
    return {
      type: "button",
      label,
      text,
      variant: variant || "primary"
    };
  }

  function crearDatePickerAction() {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);

    return {
      type: "dateRange",
      start: toInputDate(start),
      end: toInputDate(end)
    };
  }


  function crearAccionesTransporte() {
    return [
      crearBotonAction("Avión", "traslado en avión"),
      crearBotonAction("Vehículo", "traslado en vehículo"),
      crearBotonAction("Tren", "traslado en tren"),
      crearBotonAction("Solo hospedaje", "sin traslado"),
      crearBotonAction("Cancelar", "cancelar reserva", "secondary")
    ];
  }

  function crearAccionesOrigen() {
    return [
      crearBotonAction("Salir desde CDMX", "CDMX, México"),
      crearBotonAction("Salir desde Guadalajara", "Guadalajara, Jalisco"),
      crearBotonAction("Salir desde Monterrey", "Monterrey, Nuevo León"),
      crearBotonAction("Salir desde Puebla", "Puebla, Puebla"),
      crearBotonAction("Salir desde Mérida", "Mérida, Yucatán"),
      { type: "focus", label: "Escribir otra ubicación", placeholder: "Ej. Toluca, Estado de México" },
      crearBotonAction("Cancelar", "cancelar reserva", "secondary")
    ];
  }

  function crearAccionesConfirmacion() {
    return [
      crearBotonAction("Confirmar reserva", "confirmar reserva"),
      crearBotonAction("Cancelar", "cancelar reserva", "secondary")
    ];
  }

  function crearResumenReserva(reserva) {
    const servicios = obtenerServicios(reserva.viaje);

    return (
      `Resumen de reserva:
` +
      `🏨 Paquete: ${reserva.viaje.titulo || reserva.viaje.nombre}
` +
      `📍 Destino: ${formatoDestino(normalizarDestino(reserva.viaje.destino))}
` +
      `📅 Entrada: ${formatDate(reserva.fechaEntrada)}
` +
      `📅 Salida: ${formatDate(reserva.fechaSalida)}
` +
      `🌙 Noches: ${reserva.noches}
` +
      `👥 Personas: ${reserva.personas}
` +
      `🐾 Mascotas solicitadas: ${reserva.mascotas ? "Sí" : "No"}
` +
      `📶 WiFi en catálogo: ${servicios.wifi}
` +
      `🐾 Mascotas en catálogo: ${servicios.mascotas}
` +
      `🚕 Transporte elegido: ${formatoTransporte(reserva.transporte || "sin traslado")}
` +
      `📌 Salida desde: ${reserva.origen || "por definir"}
` +
      `🧾 Cálculo transporte: ${reserva.transporteDetalle ? reserva.transporteDetalle.texto : "pendiente"}
` +
      `💰 Precio por noche estimado: ${reserva.precioNoche ? formatoDinero(reserva.precioNoche) + " MXN" : "por confirmar"}
` +
      `💰 Subtotal paquete/hospedaje: ${formatoDinero(reserva.totalEstimado)} MXN
` +
      `🚕 Transporte aproximado: ${formatoDinero(reserva.transporteEstimado || 0)} MXN
` +
      `✅ Total aproximado del viaje: ${formatoDinero(reserva.totalViajeEstimado || reserva.totalEstimado)} MXN`
    );
  }

  function crearReservaPayload(reserva) {
    const servicios = obtenerServicios(reserva.viaje);

    return {
      folio: `BGO-${Date.now().toString().slice(-6)}`,
      uid: state.uid || null,
      sessionId: state.sessionId,
      viajeId: reserva.viaje.id || null,
      titulo: reserva.viaje.titulo || reserva.viaje.nombre || "Viaje reservado",
      destino: reserva.viaje.destino || "",
      fechaEntrada: reserva.fechaEntrada.toISOString(),
      fechaSalida: reserva.fechaSalida.toISOString(),
      noches: reserva.noches,
      personas: reserva.personas,
      mascotasSolicitadas: reserva.mascotas,
      transportePreferido: reserva.transporte || "sin traslado",
      origenSalida: reserva.origen || "No especificado",
      transporteDetalle: reserva.transporteDetalle || null,
      transporteEstimado: reserva.transporteEstimado || 0,
      wifiCatalogo: servicios.wifi,
      mascotasCatalogo: servicios.mascotas,
      precioPaqueteCatalogo: toNumber(reserva.viaje.precio),
      precioPorNocheEstimado: reserva.precioNoche || 0,
      totalEstimado: reserva.totalEstimado,
      totalViajeEstimado: reserva.totalViajeEstimado || reserva.totalEstimado,
      estado: "pendiente",
      origen: "chatbot",
      createdAtClient: new Date().toISOString()
    };
  }

  function crearResumenReservaFromPayload(reserva) {
    return (
      `🏨 Paquete: ${reserva.titulo}
` +
      `📍 Destino: ${formatoDestino(normalizarDestino(reserva.destino))}
` +
      `📅 Entrada: ${formatDate(new Date(reserva.fechaEntrada))}
` +
      `📅 Salida: ${formatDate(new Date(reserva.fechaSalida))}
` +
      `🌙 Noches: ${reserva.noches}
` +
      `👥 Personas: ${reserva.personas}
` +
      `🐾 Mascotas solicitadas: ${reserva.mascotasSolicitadas ? "Sí" : "No"}
` +
      `🚕 Transporte elegido: ${formatoTransporte(reserva.transportePreferido || "sin traslado")}
` +
      `📌 Salida desde: ${reserva.origenSalida || "No especificado"}
` +
      `💰 Subtotal paquete/hospedaje: ${formatoDinero(reserva.totalEstimado)} MXN
` +
      `🚕 Transporte aproximado: ${formatoDinero(reserva.transporteEstimado || 0)} MXN
` +
      `✅ Total aproximado del viaje: ${formatoDinero(reserva.totalViajeEstimado || reserva.totalEstimado)} MXN
` +
      `Estado: pendiente de confirmación por administración.`
    );
  }

  async function guardarReserva(reserva) {
    guardarReservaLocal(reserva);

    if (!state.firebaseReady || !state.db || !state.firebaseDbTools) return;

    try {
      const { ref, push, serverTimestamp } = state.firebaseDbTools;
      const path = state.uid
        ? `reservasChatbotPorUsuario/${state.uid}`
        : `reservasChatbotSesion/${state.sessionId}`;

      await push(ref(state.db, path), {
        ...reserva,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("No se pudo guardar reserva remota:", error.message);
    }
  }

  function guardarReservaLocal(reserva) {
    const key = state.uid ? `bookgo_reservas_${state.uid}` : `bookgo_reservas_${state.sessionId}`;
    let reservas = [];

    try { reservas = JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { reservas = []; }

    reservas.push(reserva);
    localStorage.setItem(key, JSON.stringify(reservas.slice(-30)));
  }

  function responderServicios(q, viajes, destino) {
    if (!destino) {
      return {
        text: "Dime el destino para revisar servicios del paquete. Ejemplo: ¿Cancún tiene wifi? o ¿Machu Picchu acepta mascotas?",
        cards: viajes.slice(0, 4).map(toCard)
      };
    }

    const viaje = viajes.find((v) => normalizarDestino(v.destino) === destino);

    if (!viaje) {
      return { text: "No encontré ese destino en el catálogo.", cards: [] };
    }

    const servicios = obtenerServicios(viaje);
    const precio = toNumber(viaje.precio);
    const noches = getNochesFromDuracion(viaje.duracion || viaje.duración);
    const precioNoche = noches ? Math.round(precio / noches) : 0;

    return {
      text:
        `Estos son los datos disponibles del catálogo para ${formatoDestino(destino)}:\n` +
        `🏨 ${viaje.titulo || viaje.nombre}\n` +
        `💰 Precio del paquete: ${formatoDinero(precio)} MXN\n` +
        `🌙 Precio por noche estimado: ${precioNoche ? formatoDinero(precioNoche) + " MXN" : "por confirmar"}\n` +
        `📶 WiFi: ${servicios.wifi}\n` +
        `🐾 Mascotas: ${servicios.mascotas}\n\n` +
        `También puedo guardar preferencia de traslado en avión, vehículo o tren durante la reserva.
` +
        `Si quieres, puedo iniciar la reserva. Escribe: reservar ${formatoDestino(destino)}.` ,
      cards: [toCard(viaje)]
    };
  }

  function obtenerServicios(viaje) {
    return {
      wifi: valorServicio(viaje.wifi ?? viaje.internet ?? viaje.amenidades?.wifi ?? viaje.servicios?.wifi),
      mascotas: valorServicio(viaje.mascotas ?? viaje.petFriendly ?? viaje.aceptaMascotas ?? viaje.animales ?? viaje.servicios?.mascotas)
    };
  }

  function valorServicio(value) {
    if (value === true || value === "true" || normalize(value) === "si" || normalize(value) === "sí") return "Sí";
    if (value === false || value === "false" || normalize(value) === "no") return "No";
    return "No especificado en catálogo";
  }

  function crearTextoRespuesta(modo, results, filtros) {
    const total = results.length;

    if (modo === "todos") return `Claro, estos son todos los viajes disponibles (${total}):`;
    if (modo === "destino") return `Encontré ${total} opción${total === 1 ? "" : "es"} para ${formatoDestino(filtros.destino)}:`;
    if (modo === "presupuesto") return `Encontré ${total} lugar${total === 1 ? " turístico" : "es turísticos"} por menos de $${formatoNumero(filtros.maxPrice)} MXN:`;
    if (modo === "presupuesto_noches") return `Encontré ${total} opción${total === 1 ? "" : "es"} para ${filtros.requestedNights} noche${filtros.requestedNights === 1 ? "" : "s"} con presupuesto máximo de $${formatoNumero(filtros.maxPrice)} MXN:`;
    if (modo === "noches") return `Estas opciones pueden estimarse para ${filtros.requestedNights} noche${filtros.requestedNights === 1 ? "" : "s"}. También puedo ayudarte a elegir traslado en avión, vehículo o tren:`;
    if (modo === "baratos") return `Estos son los ${total} viajes más económicos del catálogo:`;
    if (modo === "premium") return `Estas son las opciones premium o de mayor precio disponibles:`;

    return `Encontré ${total} resultado${total === 1 ? "" : "s"} relacionado${total === 1 ? "" : "s"} con tu búsqueda:`;
  }

  function buscarPorPalabras(q, viajes) {
    const words = q
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && !STOPWORDS.includes(w));

    if (!words.length) return [];

    return viajes.filter((v) => {
      const data = normalize(`${v.destino || ""} ${v.titulo || ""} ${v.nombre || ""} ${v.descripcion || ""} ${v.duracion || ""} ${v.precio || ""}`);
      return words.some((w) => data.includes(w));
    });
  }

  function detectarDestino(q, viajes) {
    const destinos = viajes.map((v) => normalizarDestino(v.destino)).filter(Boolean);
    const aliases = crearAliasesDestino(destinos);

    for (const [destino, lista] of Object.entries(aliases)) {
      if (lista.some((alias) => q.includes(alias))) return destino;
    }

    return null;
  }

  function crearAliasesDestino(destinos) {
    const aliases = {};
    destinos.forEach((destino) => { aliases[destino] = [destino]; });

    agregarAlias(aliases, "cancun", ["cancun", "cancún", "quintana roo", "caribe"]);
    agregarAlias(aliases, "paris", ["paris", "parís", "francia"]);
    agregarAlias(aliases, "tokio", ["tokio", "japon", "japón", "japan"]);
    agregarAlias(aliases, "nueva york", ["nueva york", "new york", "ny", "estados unidos"]);
    agregarAlias(aliases, "machu picchu", ["machu picchu", "peru", "perú", "cusco"]);
    agregarAlias(aliases, "roma", ["roma", "italia"]);
    agregarAlias(aliases, "filipinas", ["filipinas", "el nido", "philippines"]);

    return aliases;
  }

  function agregarAlias(aliases, destino, lista) {
    if (!aliases[destino]) return;
    aliases[destino] = Array.from(new Set([...aliases[destino], ...lista.map(normalize)]));
  }

  function toCard(v, opts = {}) {
    const precio = toNumber(v.precio);
    const noches = getNochesFromDuracion(v.duracion || v.duración);
    const precioNoche = noches ? Math.round(precio / noches) : 0;
    const destino = v.destino || "Destino disponible";
    const totalPorNoches = opts.requestedNights && precioNoche ? precioNoche * opts.requestedNights : 0;

    return {
      id: v.id || "",
      titulo: v.titulo || v.nombre || "Viaje recomendado",
      destino,
      precio: v.precio || "Precio por confirmar",
      precioNoche: totalPorNoches
        ? `${formatoDinero(precioNoche)} MXN aprox. por noche · ${formatoDinero(totalPorNoches)} MXN por ${opts.requestedNights} noche${opts.requestedNights === 1 ? "" : "s"}`
        : (precioNoche ? `${formatoDinero(precioNoche)} MXN aprox. por noche` : "Precio por noche por confirmar"),
      desc: v.descripcion || "Paquete disponible en Book&Go.",
      duracion: v.duracion || v.duración || "Duración por confirmar",
      imagen: v.imagen || "",
      link: v.link || v.url || "#"
    };
  }

  function buildFAQResponse(q) {
    if (q.includes("reserv")) {
      return {
        text: "Sí, puedes reservar desde el chat. Escribe: reservar Cancún, reservar Machu Picchu o reservar 2. El flujo ahora usa botones para fechas, personas, mascotas, traslado y confirmación.",
        cards: []
      };
    }

    if (q.includes("cancel")) {
      return {
        text: "La cancelación depende de las políticas del paquete o proveedor. En esta demo, las reservas quedan como pendientes para que administración las confirme o cancele.",
        cards: []
      };
    }

    if (q.includes("pago") || q.includes("pagar") || q.includes("precio")) {
      return {
        text: "Los precios del catálogo están en MXN. También puedo calcular un precio estimado por noche usando la duración del paquete. Prueba: ¿precio por noche de Cancún?",
        cards: []
      };
    }

    if (q.includes("duracion") || q.includes("duración") || q.includes("dias") || q.includes("días")) {
      return {
        text: "Cada tarjeta muestra duración, precio del paquete y precio estimado por noche. También puedo filtrar por noches, por ejemplo: quiero viajar 3 noches con presupuesto de 20k.",
        cards: []
      };
    }

    return {
      text: "Puedo resolver dudas sobre reservas, precios, duración, precio por noche, wifi, mascotas, cancelaciones, presupuesto, noches y traslado en avión, vehículo o tren.",
      cards: []
    };
  }

  function addMessage(role, text, cards, actions) {
    const msg = { role, text, cards: cards || [], actions: actions || [], time: new Date().toISOString() };
    state.messages.push(msg);
    saveLocalHistory();
    renderMessage(msg);
    return msg;
  }

  function renderHistory() {
    const container = $("bookgoMessages");
    if (!container) return;
    container.innerHTML = "";
    state.messages.forEach(renderMessage);
  }

  function renderMessage(msg) {
    const wrap = document.createElement("div");
    wrap.className = `bookgo-message ${msg.role}`;

    const bubble = document.createElement("div");
    bubble.className = "bookgo-bubble";
    bubble.textContent = msg.text;

    (msg.cards || []).forEach((card) => {
      const el = document.createElement("div");
      el.className = "bookgo-card";
      el.innerHTML = `
        ${card.imagen ? `<img class="bookgo-card-img" src="${escapeAttr(card.imagen)}" alt="${escapeAttr(card.titulo)}">` : ""}
        <div class="bookgo-card-title">${escapeHtml(card.titulo)}</div>
        <div class="bookgo-card-meta">${escapeHtml(card.destino)} · ${escapeHtml(card.duracion)}</div>
        <div class="bookgo-card-desc">${escapeHtml(card.desc)}</div>
        <div class="bookgo-card-price">${escapeHtml(card.precio)}</div>
        <div class="bookgo-card-night">${escapeHtml(card.precioNoche || "")}</div>
        <button class="bookgo-reserve-btn" type="button" data-id="${escapeAttr(card.id)}" data-destino="${escapeAttr(card.destino)}">Reservar desde el chat</button>
        ${card.link && card.link !== "#" ? `<a class="bookgo-card-link" href="${escapeAttr(card.link)}" target="_blank" rel="noopener">Ver opción</a>` : ""}
      `;
      bubble.appendChild(el);
    });

    renderActions(bubble, msg.actions || []);

    const time = document.createElement("div");
    time.className = "bookgo-time";
    time.textContent = new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    bubble.appendChild(time);
    wrap.appendChild(bubble);
    $("bookgoMessages").appendChild(wrap);
    scrollBottom();
  }

  function renderActions(container, actions) {
    if (!Array.isArray(actions) || !actions.length) return;

    const wrap = document.createElement("div");
    wrap.className = "bookgo-actions";

    actions.forEach((action) => {
      if (!action || !action.type) return;

      if (action.type === "button") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `bookgo-action-btn ${action.variant === "secondary" ? "secondary" : ""}`;
        btn.dataset.text = action.text || action.label || "";
        btn.textContent = action.label || action.text || "Elegir";
        wrap.appendChild(btn);
        return;
      }

      if (action.type === "focus") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "bookgo-action-btn secondary bookgo-focus-input";
        btn.dataset.placeholder = action.placeholder || "Escribe tu respuesta...";
        btn.textContent = action.label || "Escribir";
        wrap.appendChild(btn);
        return;
      }

      if (action.type === "dateRange") {
        const picker = document.createElement("div");
        picker.className = "bookgo-date-picker";
        picker.innerHTML = `
          <label>Entrada
            <input class="bookgo-date-start" type="date" value="${escapeAttr(action.start || "")}">
          </label>
          <label>Salida
            <input class="bookgo-date-end" type="date" value="${escapeAttr(action.end || "")}">
          </label>
          <button class="bookgo-date-submit" type="button">Usar estas fechas</button>
        `;
        wrap.appendChild(picker);
      }
    });

    if (wrap.children.length) container.appendChild(wrap);
  }

  function showTyping() {
    if ($("bookgoTyping")) return;
    const typing = document.createElement("div");
    typing.id = "bookgoTyping";
    typing.className = "bookgo-message bot";
    typing.innerHTML = `<div class="bookgo-bubble"><span class="bookgo-typing"><span></span><span></span><span></span></span></div>`;
    $("bookgoMessages").appendChild(typing);
    scrollBottom();
  }

  function hideTyping() {
    const el = $("bookgoTyping");
    if (el) el.remove();
  }

  async function saveMessageRemote(role, text, cards) {
    if (!state.firebaseReady || !state.db || !state.firebaseDbTools) return;

    try {
      const { ref, push, serverTimestamp } = state.firebaseDbTools;
      const basePath = state.uid
        ? `chatbotConversacionesPorUsuario/${state.uid}`
        : `chatbotConversacionesSesion/${state.sessionId}`;

      await push(ref(state.db, basePath), {
        role,
        text,
        cards: cards || [],
        createdAt: serverTimestamp(),
        page: location.pathname,
        version: CHATBOT_VERSION
      });
    } catch (error) {
      console.warn("No se pudo guardar el mensaje del chatbot:", error.message);
    }
  }

  async function loadHistory() {
    state.messages = [];

    if (state.firebaseReady && state.uid) {
      const remote = await loadRemoteHistory(state.uid);
      if (remote.length) {
        state.messages = remote;
        saveLocalHistory();
        return;
      }
    }

    restoreLocalHistory();
  }

  async function loadRemoteHistory(uid) {
    try {
      const { ref, get } = state.firebaseDbTools;
      const snap = await get(ref(state.db, `chatbotConversacionesPorUsuario/${uid}`));
      if (!snap.exists()) return [];

      return normalizeFirebaseList(snap.val())
        .map((item) => ({
          role: item.role === "user" ? "user" : "bot",
          text: item.text || item.texto || "",
          cards: Array.isArray(item.cards) ? item.cards : [],
          actions: Array.isArray(item.actions) ? item.actions : [],
          time: item.time || item.createdAtClient || new Date().toISOString(),
          createdAt: item.createdAt || 0
        }))
        .filter((item) => item.text && !esMensajeLegacy(item.text))
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(-60);
    } catch (error) {
      console.warn("No se pudo cargar historial remoto:", error.message);
      return [];
    }
  }

  function saveLocalHistory() {
    const cleanMessages = state.messages.slice(-60).map((msg) => ({
      role: msg.role,
      text: msg.text,
      cards: msg.cards || [],
      actions: msg.actions || [],
      time: msg.time
    }));
    localStorage.setItem(getLocalHistoryKey(), JSON.stringify(cleanMessages));
  }

  function restoreLocalHistory() {
    try {
      state.messages = JSON.parse(localStorage.getItem(getLocalHistoryKey()) || "[]")
        .filter((item) => item && item.text && !esMensajeLegacy(item.text));
    }
    catch (error) { state.messages = []; }
  }

  function getLocalHistoryKey() {
    return state.uid ? `bookgo_ia_chat_history_${CHATBOT_VERSION}_${state.uid}` : `bookgo_ia_chat_history_${CHATBOT_VERSION}_${state.sessionId}`;
  }

  function esMensajeLegacy(text) {
    const t = String(text || "");
    return t.includes("15/07/2026") || t.includes("17/07/2026") || t.includes("Responde sí o no") || t.includes("confirmar reserva o cancelar");
  }

  function openChat() {
    const chatWindow = $("bookgoChatWindow");
    const launcher = $("bookgoChatLauncher");
    if (!chatWindow || !launcher) return;
    chatWindow.classList.add("open");
    launcher.classList.add("bookgo-launcher-hidden");
    setTimeout(() => { const input = $("bookgoInput"); if (input) input.focus(); }, 100);
  }

  function closeChat() {
    const chatWindow = $("bookgoChatWindow");
    const launcher = $("bookgoChatLauncher");
    if (!chatWindow || !launcher) return;
    chatWindow.classList.remove("open");
    launcher.classList.remove("bookgo-launcher-hidden");
  }


  async function clearChat() {
    const ok = confirm("¿Quieres limpiar el chat? Se borrará el historial visible de Book&Go IA en este navegador.");
    if (!ok) return;

    state.messages = [];
    state.reservaActiva = null;
    localStorage.removeItem(getLocalHistoryKey());

    if (state.firebaseReady && state.db && state.firebaseDbTools) {
      try {
        const { ref, remove } = state.firebaseDbTools;
        const basePath = state.uid
          ? `chatbotConversacionesPorUsuario/${state.uid}`
          : `chatbotConversacionesSesion/${state.sessionId}`;
        await remove(ref(state.db, basePath));
      } catch (error) {
        console.warn("No se pudo limpiar historial remoto:", error.message);
      }
    }

    const container = $("bookgoMessages");
    if (container) container.innerHTML = "";

    addMessage(
      "bot",
      "Chat limpiado ✅\nPuedo ayudarte a buscar viajes por presupuesto, reservar y calcular transporte desde tu ubicación. Prueba: reservar Cancún."
    );
  }

  function normalizeFirebaseList(data) {
    if (Array.isArray(data)) return data.filter(Boolean);
    return Object.entries(data || {}).map(([id, value]) => ({
      id,
      ...(typeof value === "object" && value !== null ? value : { value })
    }));
  }

  function limpiarDuplicados(items) {
    const map = new Map();
    items.forEach((item) => {
      const key = normalize(`${item.id || ""}-${item.destino || ""}-${item.titulo || item.nombre || ""}`);
      if (!map.has(key)) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function esViajeValido(item) {
    if (!item || typeof item !== "object") return false;
    const data = normalize(`${item.tipo || ""} ${item.categoria || ""} ${item.destino || ""} ${item.titulo || ""} ${item.nombre || ""} ${item.descripcion || ""}`);
    const palabrasProhibidas = ["renta de auto", "renta de autos", "renta de carro", "renta de carros", "venta de auto", "venta de carro"];
    if (palabrasProhibidas.some((word) => data.includes(word))) return false;
    return Boolean(item.destino || item.titulo || item.nombre) && Boolean(item.precio || item.descripcion || item.duracion || item.duración);
  }

  function quiereTodos(q) {
    return q.includes("todos") || q.includes("todo") || q.includes("catalogo") || q.includes("catálogo") || q.includes("todas") || q.includes("opciones") || q.includes("paquetes disponibles") || q.includes("viajes disponibles");
  }

  function quiereBaratos(q) {
    return q.includes("barato") || q.includes("baratos") || q.includes("economico") || q.includes("economicos") || q.includes("económico") || q.includes("económicos") || q.includes("menor precio") || q.includes("mas barato") || q.includes("más barato");
  }

  function quiereCaros(q) {
    return q.includes("caro") || q.includes("caros") || q.includes("premium") || q.includes("lujo") || q.includes("mayor precio");
  }

  function quiereReservar(q) {
    return q.includes("reserv") || q.includes("apartar") || q.includes("agendar") || q.includes("comprar paquete");
  }

  function preguntaServiciosHospedaje(q) {
    return q.includes("wifi") || q.includes("wi-fi") || q.includes("internet") || q.includes("mascota") || q.includes("mascotas") || q.includes("animales") || q.includes("animal") || q.includes("precio por noche") || q.includes("por noche");
  }

  function preguntaFueraDeCatalogo(q) {
    if (q.includes("traslado") || q.includes("transport") || q.includes("avion") || q.includes("avión") || q.includes("tren") || q.includes("vehiculo") || q.includes("vehículo")) return false;
    return q.includes("renta de auto") || q.includes("renta de carro") || q.includes("comprar auto") || q.includes("comprar carro");
  }

  function esPreguntaFAQ(q) {
    return q.includes("reserv") || q.includes("cancel") || q.includes("pago") || q.includes("pagar") || q.includes("duracion") || q.includes("duración") || q.includes("dias") || q.includes("días") || q.includes("precio");
  }

  function esSaludo(q) {
    return q === "hola" || q.includes("hola ") || q.includes("buenas") || q.includes("buen dia") || q.includes("buen día") || q.includes("buenos dias") || q.includes("buenos días");
  }


  function extractNights(q) {
    const match = q.match(/(\d{1,2})\s*(?:noche|noches)/);
    if (!match) return null;
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n < 1 || n > 30) return null;
    return n;
  }

  function calcularTotalPorNoches(viaje, nochesSolicitadas) {
    const precio = toNumber(viaje.precio);
    const nochesCatalogo = getNochesFromDuracion(viaje.duracion || viaje.duración);
    const precioNoche = nochesCatalogo ? Math.round(precio / nochesCatalogo) : precio;
    return precioNoche * nochesSolicitadas;
  }

  function detectarTransporte(q) {
    const t = normalize(q);
    if (t.includes("sin traslado") || t.includes("solo hospedaje") || t.includes("sin transporte")) return "sin traslado";
    if (t.includes("avion") || t.includes("avión") || t.includes("vuelo") || t.includes("aereo") || t.includes("aéreo")) return "avion";
    if (t.includes("tren")) return "tren";
    if (t.includes("vehiculo") || t.includes("vehículo") || t.includes("camioneta") || t.includes("auto") || t.includes("carro") || t.includes("terrestre")) return "vehiculo";
    return null;
  }

  function formatoTransporte(value) {
    const v = normalize(value);
    if (v === "avion") return "Avión";
    if (v === "vehiculo") return "Vehículo";
    if (v === "tren") return "Tren";
    if (v === "sin traslado") return "Solo hospedaje / sin traslado";
    return "Por definir";
  }


  function extraerOrigen(text) {
    let origen = String(text || "").trim();
    origen = origen.replace(/^(salgo desde|salir desde|desde|mi ubicacion es|mi ubicación es|ubicacion|ubicación|origen)\s*/i, "").trim();
    return origen;
  }

  function normalizarOrigen(text) {
    const q = normalize(text);
    if (q.includes("cdmx") || q.includes("ciudad de mexico") || q.includes("mexico df") || q === "mexico") return "cdmx";
    if (q.includes("guadalajara") || q.includes("jalisco")) return "guadalajara";
    if (q.includes("monterrey") || q.includes("nuevo leon")) return "monterrey";
    if (q.includes("puebla")) return "puebla";
    if (q.includes("merida") || q.includes("yucatan")) return "merida";
    if (q.includes("cancun") || q.includes("quintana roo")) return "cancun";
    return "otro";
  }

  function nombreOrigen(origenKey, origenTexto) {
    const nombres = {
      cdmx: "CDMX",
      guadalajara: "Guadalajara",
      monterrey: "Monterrey",
      puebla: "Puebla",
      merida: "Mérida",
      cancun: "Cancún",
      otro: origenTexto || "ubicación indicada"
    };
    return nombres[origenKey] || origenTexto || "ubicación indicada";
  }

  function estimarTransporte(reserva) {
    const destino = normalizarDestino(reserva.viaje.destino);
    const origenKey = normalizarOrigen(reserva.origen);
    const origenNombre = nombreOrigen(origenKey, reserva.origen);
    const transporte = normalize(reserva.transporte || "sin traslado");
    const personas = Math.max(1, Number(reserva.personas || 1));
    const localDestino = costoTrasladoLocal(destino);

    if (transporte === "sin traslado") {
      return { costo: 0, texto: "Sin transporte agregado." };
    }

    if (transporte === "avion") {
      const vueloPorPersona = costoVueloEstimado(destino, origenKey);
      const vueloTotal = vueloPorPersona * personas;
      const costo = vueloTotal + localDestino;
      return {
        costo,
        texto:
          `Vuelo supuesto ${origenNombre} → ${formatoDestino(destino)}: ${formatoDinero(vueloPorPersona)} MXN por persona x ${personas} = ${formatoDinero(vueloTotal)} MXN. ` +
          `Traslado local al hotel: ${formatoDinero(localDestino)} MXN. Total transporte: ${formatoDinero(costo)} MXN.`
      };
    }

    if (transporte === "vehiculo") {
      if (!esDestinoTerrestreDesdeMexico(destino)) {
        return {
          costo: localDestino,
          texto:
            `Para ${formatoDestino(destino)} no hay ruta práctica en vehículo desde México en esta demo. ` +
            `Se considera únicamente traslado local al hospedaje: ${formatoDinero(localDestino)} MXN.`
        };
      }

      const km = distanciaTerrestreEstimado(destino, origenKey);
      const gasolina = Math.round(km * 4.2);
      const casetas = Math.round(km * 1.25);
      const costo = gasolina + casetas + localDestino;
      return {
        costo,
        texto:
          `Ruta supuesta ${origenNombre} → ${formatoDestino(destino)} en vehículo: ${formatoNumero(km)} km aprox. ` +
          `Gasolina: ${formatoDinero(gasolina)} MXN, casetas/peajes: ${formatoDinero(casetas)} MXN, traslado local: ${formatoDinero(localDestino)} MXN. ` +
          `Total transporte: ${formatoDinero(costo)} MXN.`
      };
    }

    if (transporte === "tren") {
      const trenPorPersona = costoTrenEstimado(destino, origenKey);
      const trenTotal = trenPorPersona * personas;
      const costo = trenTotal + localDestino;
      return {
        costo,
        texto:
          `Tren o traslado ferroviario/turístico estimado para ${formatoDestino(destino)}: ${formatoDinero(trenPorPersona)} MXN por persona x ${personas} = ${formatoDinero(trenTotal)} MXN. ` +
          `Traslado local al hotel: ${formatoDinero(localDestino)} MXN. Total transporte: ${formatoDinero(costo)} MXN.`
      };
    }

    return { costo: 0, texto: "Transporte por definir." };
  }

  function costoVueloEstimado(destino, origenKey) {
    const base = {
      "cancun": { cdmx: 2500, guadalajara: 3400, monterrey: 3800, puebla: 2900, merida: 1800, cancun: 0, otro: 3600 },
      "machu picchu": { cdmx: 9500, guadalajara: 10800, monterrey: 11500, puebla: 9800, merida: 11200, cancun: 10500, otro: 11000 },
      "filipinas": { cdmx: 18500, guadalajara: 19800, monterrey: 20500, puebla: 19000, merida: 20500, cancun: 19800, otro: 20500 },
      "tokio": { cdmx: 19500, guadalajara: 21000, monterrey: 21500, puebla: 20000, merida: 22000, cancun: 21000, otro: 21500 },
      "paris": { cdmx: 14500, guadalajara: 15800, monterrey: 16500, puebla: 15000, merida: 16800, cancun: 15500, otro: 16500 },
      "nueva york": { cdmx: 8500, guadalajara: 9800, monterrey: 9200, puebla: 8900, merida: 10800, cancun: 7500, otro: 9800 },
      "roma": { cdmx: 15000, guadalajara: 16500, monterrey: 17000, puebla: 15500, merida: 17500, cancun: 16200, otro: 17000 }
    };

    return base[destino]?.[origenKey] ?? base[destino]?.otro ?? 6000;
  }

  function costoTrasladoLocal(destino) {
    const local = {
      "cancun": 450,
      "machu picchu": 1200,
      "filipinas": 1400,
      "tokio": 1300,
      "paris": 1200,
      "nueva york": 1100,
      "roma": 1200
    };
    return local[destino] || 700;
  }

  function esDestinoTerrestreDesdeMexico(destino) {
    return destino === "cancun";
  }

  function distanciaTerrestreEstimado(destino, origenKey) {
    if (destino !== "cancun") return 0;
    const km = {
      cdmx: 1610,
      guadalajara: 2150,
      monterrey: 2300,
      puebla: 1500,
      merida: 310,
      cancun: 25,
      otro: 1450
    };
    return km[origenKey] || km.otro;
  }

  function costoTrenEstimado(destino, origenKey) {
    if (destino === "cancun") {
      if (origenKey === "merida") return 850;
      if (origenKey === "cancun") return 250;
      return 1600;
    }
    if (destino === "machu picchu") return 2800;
    if (destino === "paris" || destino === "roma" || destino === "tokio" || destino === "nueva york") return 1800;
    if (destino === "filipinas") return 1200;
    return 1000;
  }

  function extractMaxPrice(q) {
    const qClean = normalize(q).replace(/,/g, "").replace(/\s+/g, " ").trim();

    const patterns = [
      /(?:menos de|menor a|menor de|maximo|max|hasta|presupuesto de|presupuesto|por debajo de|debajo de|abajo de|no pase de|no mas de|menos a)\s*\$?\s*(\d+(?:\.\d+)?)\s*(k|mil|mxn|pesos)?/,
      /\$?\s*(\d+(?:\.\d+)?)\s*(k|mil|mxn|pesos)\s*(?:o menos|maximo|max|para abajo)/,
      /\$?\s*(\d{4,6})(?:\s*mxn|\s*pesos)?/
    ];

    for (const pattern of patterns) {
      const match = qClean.match(pattern);
      if (!match) continue;

      let amount = Number(match[1]);
      const unit = match[2] || "";
      if (!Number.isFinite(amount)) continue;
      if (unit === "k" || unit === "mil") amount *= 1000;
      if (amount < 1000) continue;
      return amount;
    }

    return null;
  }

  function parseDateRange(text) {
    const raw = normalize(text).replace(/\s+/g, " ").trim();
    const numericDates = raw.match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g);

    if (numericDates && numericDates.length >= 2) {
      const start = parseDate(numericDates[0]);
      const end = parseDate(numericDates[1]);
      if (start && end && end > start) return { start, end };
    }

    return null;
  }

  function parseDate(value) {
    const clean = value.trim();
    let day, month, year;

    if (/^\d{4}[\/\-]/.test(clean)) {
      const parts = clean.split(/[\/\-]/).map(Number);
      year = parts[0]; month = parts[1]; day = parts[2];
    } else {
      const parts = clean.split(/[\/\-]/).map(Number);
      day = parts[0]; month = parts[1]; year = parts[2] || new Date().getFullYear();
      if (year < 100) year += 2000;
    }

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return null;
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function diffDays(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.ceil(ms / 86400000);
  }

  function extractPeople(q) {
    const match = q.match(/(\d{1,2})/);
    if (!match) return null;
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n < 1 || n > 30) return null;
    return n;
  }

  function detectarSiNo(q) {
    if (q.includes("no") || q.includes("ninguna") || q.includes("ninguno") || q.includes("sin")) return false;
    if (q.includes("si") || q.includes("sí") || q.includes("claro") || q.includes("llevo") || q.includes("mascota")) return true;
    return null;
  }

  function calcularTotalReserva(reserva) {
    if (reserva.precioNoche) return reserva.precioNoche * reserva.noches;
    return toNumber(reserva.viaje.precio);
  }

  function getNochesFromDuracion(value) {
    const text = normalize(value);
    const noches = text.match(/(\d+)\s*noches?/);
    if (noches) return Number(noches[1]);
    const dias = text.match(/(\d+)\s*dias?/);
    if (dias) return Math.max(1, Number(dias[1]) - 1);
    return 0;
  }

  function toComparableId(id) {
    const n = Number(id);
    return Number.isFinite(n) ? n : 9999;
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    return Number(String(value || "").replace(/[^0-9.]/g, "")) || 0;
  }

  function normalizarDestino(destino) {
    return normalize(destino).trim();
  }

  function formatoDestino(destino) {
    const names = {
      "cancun": "Cancún",
      "paris": "París",
      "tokio": "Tokio",
      "nueva york": "Nueva York",
      "machu picchu": "Machu Picchu",
      "roma": "Roma",
      "filipinas": "Filipinas"
    };
    return names[destino] || destino;
  }

  function formatoNumero(num) {
    return Number(num || 0).toLocaleString("es-MX");
  }

  function formatoDinero(num) {
    return `$${formatoNumero(num)}`;
  }

  function toInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(date) {
    return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function normalize(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function getSessionId() {
    let id = localStorage.getItem("bookgo_ia_session");
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      localStorage.setItem("bookgo_ia_session", id);
    }
    return id;
  }

  function autoGrow() {
    this.style.height = "auto";
    this.style.height = `${Math.min(this.scrollHeight, 92)}px`;
  }

  function scrollBottom() {
    const el = $("bookgoMessages");
    if (el) el.scrollTop = el.scrollHeight;
  }

  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function $(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/`/g, "&#96;");
  }
})();
