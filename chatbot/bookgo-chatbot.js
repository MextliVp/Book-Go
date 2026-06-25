(function () {
  "use strict";

  const FIREBASE_CDN = {
    app: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
    db: "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js",
    auth: "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
  };

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
    "quiero", "busco", "buscar", "viaje", "viajes", "paquete", "paquetes", "para", "con", "sin", "donde", "tienes", "tienen", "mostrar", "muestra", "muestrame", "ver", "opcion", "opciones", "disponible", "disponibles", "recomienda", "recomiendame", "informacion", "info", "sobre", "del", "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "ir", "viajar", "me", "por", "favor"
  ];

  const state = {
    db: null,
    auth: null,
    firebaseReady: false,
    user: null,
    uid: null,
    sessionId: getSessionId(),
    messages: [],
    viajes: [],
    firebaseDbTools: null
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
        "Hola, soy Book&Go IA ✈️\nPuedo ayudarte a buscar paquetes de viaje. Prueba con: \"muéstrame todos los viajes\", \"viajes baratos\", \"Cancún\" o \"viajes menores a 20000\"."
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
            <div class="bookgo-agent-subtitle">Asistente de viajes</div>
          </div>
        </div>
        <div class="bookgo-header-actions">
          <button class="bookgo-icon-btn" id="bookgoClear" title="Limpiar historial">⋯</button>
          <button class="bookgo-icon-btn" id="bookgoClose" title="Cerrar">−</button>
        </div>
      </header>

      <main class="bookgo-chat-messages" id="bookgoMessages"></main>

      <div class="bookgo-quick-actions">
        <button class="bookgo-chip" data-text="Cancún">Cancún</button>
        <button class="bookgo-chip" data-text="Viajes baratos">Baratos</button>
        <button class="bookgo-chip" data-text="Viajes menores a 20000">Menos de $20,000</button>
        <button class="bookgo-chip" data-text="Muéstrame todos los viajes">Todos</button>
      </div>

      <form class="bookgo-chat-input-area" id="bookgoForm">
        <textarea class="bookgo-chat-input" id="bookgoInput" rows="1" placeholder="Escribe tu destino, presupuesto o duda..."></textarea>
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
    $("bookgoClear").addEventListener("click", clearHistory);
    $("bookgoForm").addEventListener("submit", handleSubmit);
    $("bookgoInput").addEventListener("input", autoGrow);

    document.querySelectorAll(".bookgo-chip").forEach((btn) => {
      btn.addEventListener("click", () => sendUserText(btn.dataset.text));
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
            addMessage("bot", "Hola, soy Book&Go IA ✈️ ¿Qué viaje quieres buscar?");
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

    if (!state.viajes.length) {
      state.viajes = fallbackViajes;
    }

    state.viajes = limpiarDuplicados(state.viajes).sort((a, b) => (a.id || 9999) - (b.id || 9999));
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

  async function sendUserText(text) {
    openChat();

    addMessage("user", text);
    await saveMessageRemote("user", text);

    showTyping();
    await delay(350);
    hideTyping();

    const response = buildResponse(text);

    addMessage("bot", response.text, response.cards);
    await saveMessageRemote("bot", response.text, response.cards);
  }

  function buildResponse(text) {
    const q = normalize(text);

    if (esSaludo(q)) {
      return {
        text: "¡Hola! Soy Book&Go IA 😊\nPuedo mostrarte todos los viajes, buscar por destino, ordenar por precio o filtrar por presupuesto.",
        cards: []
      };
    }

    if (q.includes("gracias")) {
      return { text: "Con gusto 😊. Cuando quieras buscar otro viaje, dime el destino o tu presupuesto.", cards: [] };
    }

    if (preguntaFueraDeCatalogo(q)) {
      return {
        text: "Por ahora Book&Go solo asesora sobre paquetes de viaje del catálogo. No manejo autos, renta de vehículos ni servicios fuera de los viajes disponibles.",
        cards: []
      };
    }

    if (esPreguntaFAQ(q)) {
      return buildFAQResponse(q);
    }

    const allTrips = [...state.viajes];
    const destino = detectarDestino(q, allTrips);
    const maxPrice = extractMaxPrice(q);
    const pideTodos = quiereTodos(q);
    const pideBaratos = quiereBaratos(q);
    const pideCaros = quiereCaros(q);

    let results = [...allTrips];
    let modo = "busqueda";

    if (destino) {
      results = results.filter((v) => normalizarDestino(v.destino) === destino);
      modo = "destino";
    }

    if (maxPrice) {
      results = results.filter((v) => toNumber(v.precio) <= maxPrice);
      modo = "presupuesto";
    }

    if (!destino && !maxPrice && !pideTodos && !pideBaratos && !pideCaros) {
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

    if (!pideTodos && !maxPrice && !destino && pideBaratos) {
      results = results.slice(0, 3);
    }

    if (!pideTodos && !maxPrice && !destino && pideCaros) {
      results = results.slice(0, 3);
    }

    if (!results.length) {
      return {
        text: "No encontré viajes que coincidan exactamente con tu búsqueda.\n\nPuedes intentar con:\n• Muéstrame todos los viajes\n• Viajes baratos\n• Cancún\n• Viajes menores a 20000",
        cards: []
      };
    }

    return {
      text: crearTextoRespuesta(modo, results, { destino, maxPrice, pideTodos, pideBaratos }),
      cards: results.map(toCard)
    };
  }

  function crearTextoRespuesta(modo, results, filtros) {
    const total = results.length;

    if (modo === "todos") {
      return `Claro, estos son todos los viajes disponibles (${total}):`;
    }

    if (modo === "destino") {
      return `Encontré ${total} opción${total === 1 ? "" : "es"} para ${formatoDestino(filtros.destino)}:`;
    }

    if (modo === "presupuesto") {
      return `Encontré ${total} viaje${total === 1 ? "" : "s"} dentro de tu presupuesto máximo de $${formatoNumero(filtros.maxPrice)} MXN:`;
    }

    if (modo === "baratos") {
      return `Estos son los ${total} viajes más económicos del catálogo:`;
    }

    if (modo === "premium") {
      return `Estas son las opciones premium o de mayor precio disponibles:`;
    }

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
      if (lista.some((alias) => q.includes(alias))) {
        return destino;
      }
    }

    return null;
  }

  function crearAliasesDestino(destinos) {
    const aliases = {};

    destinos.forEach((destino) => {
      aliases[destino] = [destino];
    });

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

  function toCard(v) {
    return {
      titulo: v.titulo || v.nombre || "Viaje recomendado",
      destino: v.destino || "Destino disponible",
      precio: v.precio || "Precio por confirmar",
      desc: v.descripcion || "Paquete disponible en Book&Go.",
      duracion: v.duracion || v.duración || "Duración por confirmar",
      imagen: v.imagen || "",
      link: v.link || v.url || "#"
    };
  }

  function buildFAQResponse(q) {
    if (q.includes("reserv")) {
      return {
        text: "Para reservar, selecciona el paquete que te interesa, revisa duración y precio, y continúa con el botón de detalles o reserva del sistema. Si ya iniciaste sesión, la reserva puede asociarse a tu cuenta.",
        cards: []
      };
    }

    if (q.includes("cancel")) {
      return {
        text: "La cancelación depende de las políticas del paquete o proveedor. Para la demostración, se recomienda solicitar cambios o cancelaciones desde el panel del usuario o con soporte antes de la fecha del viaje.",
        cards: []
      };
    }

    if (q.includes("pago") || q.includes("pagar") || q.includes("precio")) {
      return {
        text: "Los precios mostrados están en MXN y corresponden al paquete publicado. Puedo ayudarte a filtrar opciones por presupuesto, por ejemplo: \"viajes menores a 20000\".",
        cards: []
      };
    }

    if (q.includes("duracion") || q.includes("duración") || q.includes("dias") || q.includes("días")) {
      return {
        text: "Cada tarjeta muestra la duración del paquete, por ejemplo: 5 días / 4 noches. Puedes pedirme un destino específico para ver su duración.",
        cards: []
      };
    }

    return {
      text: "Puedo resolver dudas sobre reservas, precios, duración, cancelaciones y paquetes disponibles. También puedo mostrarte todos los viajes o filtrar por presupuesto.",
      cards: []
    };
  }

  function addMessage(role, text, cards) {
    const msg = {
      role,
      text,
      cards: cards || [],
      time: new Date().toISOString()
    };

    state.messages.push(msg);
    saveLocalHistory();
    renderMessage(msg);

    return msg;
  }

  function renderHistory() {
    $("bookgoMessages").innerHTML = "";
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
        ${card.link && card.link !== "#" ? `<a class="bookgo-card-link" href="${escapeAttr(card.link)}" target="_blank" rel="noopener">Ver opción</a>` : ""}
      `;
      bubble.appendChild(el);
    });

    const time = document.createElement("div");
    time.className = "bookgo-time";
    time.textContent = new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    bubble.appendChild(time);
    wrap.appendChild(bubble);
    $("bookgoMessages").appendChild(wrap);
    scrollBottom();
  }

  function showTyping() {
    if ($("bookgoTyping")) return;

    const typing = document.createElement("div");
    typing.id = "bookgoTyping";
    typing.className = "bookgo-message bot";
    typing.innerHTML = `
      <div class="bookgo-bubble">
        <span class="bookgo-typing"><span></span><span></span><span></span></span>
      </div>
    `;

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
        page: location.pathname
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
          time: item.time || (item.createdAt ? new Date(item.createdAt).toISOString() : new Date().toISOString()),
          createdAt: item.createdAt || 0
        }))
        .filter((item) => item.text)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(-60);
    } catch (error) {
      console.warn("No se pudo cargar historial remoto:", error.message);
      return [];
    }
  }

  async function clearHistory() {
    state.messages = [];
    localStorage.removeItem(getLocalHistoryKey());
    renderHistory();

    if (state.firebaseReady && state.uid && state.firebaseDbTools) {
      try {
        const { ref, remove } = state.firebaseDbTools;
        await remove(ref(state.db, `chatbotConversacionesPorUsuario/${state.uid}`));
      } catch (error) {
        console.warn("No se pudo limpiar historial remoto:", error.message);
      }
    }

    addMessage("bot", "Historial limpiado. ¿Qué destino quieres buscar ahora?");
  }

  function saveLocalHistory() {
    localStorage.setItem(getLocalHistoryKey(), JSON.stringify(state.messages.slice(-60)));
  }

  function restoreLocalHistory() {
    try {
      state.messages = JSON.parse(localStorage.getItem(getLocalHistoryKey()) || "[]");
    } catch (error) {
      state.messages = [];
    }
  }

  function getLocalHistoryKey() {
    return state.uid
      ? `bookgo_ia_chat_history_${state.uid}`
      : `bookgo_ia_chat_history_${state.sessionId}`;
  }

  function openChat() {
    $("bookgoChatWindow").classList.add("open");
    $("bookgoChatLauncher").classList.add("hidden");
    setTimeout(() => $("bookgoInput").focus(), 100);
  }

  function closeChat() {
    $("bookgoChatWindow").classList.remove("open");
    $("bookgoChatLauncher").classList.remove("hidden");
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

    const palabrasProhibidas = ["carro", "carros", "auto", "autos", "coche", "coches", "vehiculo", "vehiculos", "renta de auto", "renta de carros"];

    if (palabrasProhibidas.some((word) => data.includes(word))) {
      return false;
    }

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

  function preguntaFueraDeCatalogo(q) {
    return q.includes("carro") || q.includes("carros") || q.includes("auto") || q.includes("autos") || q.includes("coche") || q.includes("coches") || q.includes("vehiculo") || q.includes("vehiculos") || q.includes("renta de auto");
  }

  function esPreguntaFAQ(q) {
    return q.includes("reserv") || q.includes("cancel") || q.includes("pago") || q.includes("pagar") || q.includes("duracion") || q.includes("duración") || q.includes("dias") || q.includes("días") || q.includes("precio");
  }

  function esSaludo(q) {
    return q === "hola" || q.includes("hola ") || q.includes("buenas") || q.includes("buen dia") || q.includes("buen día") || q.includes("buenos dias") || q.includes("buenos días");
  }

  function extractMaxPrice(q) {
    const qClean = q.replace(/,/g, "");

    const milMatch = qClean.match(/(?:menos de|menor a|maximo|max|hasta|presupuesto de|presupuesto)\s*\$?\s*(\d{1,3})\s*mil/);
    if (milMatch) return Number(milMatch[1]) * 1000;

    const numberMatch = qClean.match(/(?:menos de|menor a|maximo|max|hasta|presupuesto de|presupuesto)\s*\$?\s*(\d{4,6})/);
    if (numberMatch) return Number(numberMatch[1]);

    return null;
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

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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
    el.scrollTop = el.scrollHeight;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function $(id) {
    return document.getElementById(id);
  }

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
