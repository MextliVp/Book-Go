(function(){
  const FIREBASE_CDN = {
    app: "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
    db: "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"
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
    {destino:"cancun", titulo:"Experiencia Caribeña Cancún", precio:"$12,000 MXN", descripcion:"Sol, playa, cenotes y tours arqueológicos.", duracion:"5 días / 4 noches"},
    {destino:"paris", titulo:"Luces y Romance en París", precio:"$32,500 MXN", descripcion:"Louvre, Torre Eiffel y recorridos culturales.", duracion:"7 días / 6 noches"}
  ];

  const state = { db:null, firebaseReady:false, sessionId:getSessionId(), messages:[], viajes:[] };
  document.addEventListener("DOMContentLoaded", init);

  async function init(){
    injectMarkup(); bindEvents(); restoreLocalHistory(); renderHistory();
    if(!state.messages.length){
      addMessage("bot", "Hola, soy Book&Go IA ✈️\nPuedo ayudarte a buscar paquetes de viaje. Prueba con: \"quiero ir a Cancún\", \"viaje barato\" o \"Tokio\".");
    }
    await initFirebase();
    await loadViajes();
  }

  function injectMarkup(){
    if(document.getElementById("bookgoChatLauncher")) return;
    const launcher = document.createElement("button");
    launcher.id = "bookgoChatLauncher";
    launcher.className = "bookgo-chat-launcher";
    launcher.setAttribute("aria-label", "Abrir Book&Go IA");
    launcher.innerHTML = `<span class="bookgo-pulse"></span><span class="bookgo-launcher-avatar">✈️</span><span class="bookgo-launcher-text">¿Necesitas ayuda?<small>Book&Go IA</small></span>`;

    const chat = document.createElement("section");
    chat.id = "bookgoChatWindow";
    chat.className = "bookgo-chat-window";
    chat.innerHTML = `
      <header class="bookgo-chat-header">
        <div class="bookgo-agent"><div class="bookgo-agent-avatar">🤖</div><div><div class="bookgo-agent-title">Book&Go IA</div><div class="bookgo-agent-subtitle">Asistente de viajes</div></div></div>
        <div class="bookgo-header-actions"><button class="bookgo-icon-btn" id="bookgoClear" title="Limpiar historial">⋯</button><button class="bookgo-icon-btn" id="bookgoClose" title="Cerrar">−</button></div>
      </header>
      <main class="bookgo-chat-messages" id="bookgoMessages"></main>
      <div class="bookgo-quick-actions">
        <button class="bookgo-chip" data-text="Cancún">Cancún</button>
        <button class="bookgo-chip" data-text="París">París</button>
        <button class="bookgo-chip" data-text="Viaje barato">Viaje barato</button>
        <button class="bookgo-chip" data-text="Muéstrame todos los viajes">Todos</button>
      </div>
      <form class="bookgo-chat-input-area" id="bookgoForm"><textarea class="bookgo-chat-input" id="bookgoInput" rows="1" placeholder="Escribe tu destino..."></textarea><button class="bookgo-send-btn" type="submit">➤</button></form>
      <div class="bookgo-footer">Powered by Book&Go IA · Firebase</div>`;
    document.body.appendChild(launcher); document.body.appendChild(chat);
  }

  function bindEvents(){
    $("bookgoChatLauncher").addEventListener("click", openChat);
    $("bookgoClose").addEventListener("click", closeChat);
    $("bookgoClear").addEventListener("click", clearHistory);
    $("bookgoForm").addEventListener("submit", handleSubmit);
    $("bookgoInput").addEventListener("input", autoGrow);
    document.querySelectorAll(".bookgo-chip").forEach(btn => btn.addEventListener("click", () => sendUserText(btn.dataset.text)));
  }

  async function initFirebase(){
    try{
      const { initializeApp, getApps } = await import(FIREBASE_CDN.app);
      const { getDatabase } = await import(FIREBASE_CDN.db);
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      state.db = getDatabase(app); state.firebaseReady = true;
    }catch(e){ state.firebaseReady = false; }
  }

  async function loadViajes(){
    state.viajes = [];
    if(state.firebaseReady){
      try{
        const { ref, get } = await import(FIREBASE_CDN.db);
        for(const node of ["viajesCatalogo","viajes","catalogo","paquetes"]){
          const snap = await get(ref(state.db, node));
          if(snap.exists()){
            const items = normalizeFirebaseList(snap.val());
            if(items.length){ state.viajes = items; break; }
          }
        }
      }catch(e){}
    }
    if(!state.viajes.length){
      try{ if(typeof viajesCatalogo !== "undefined" && Array.isArray(viajesCatalogo)) state.viajes = viajesCatalogo; }catch(e){}
    }
    if(!state.viajes.length) state.viajes = fallbackViajes;
  }

  async function handleSubmit(e){
    e.preventDefault(); const input = $("bookgoInput"); const text = input.value.trim(); if(!text) return;
    input.value=""; autoGrow.call(input); await sendUserText(text);
  }

  async function sendUserText(text){
    openChat(); addMessage("user", text); showTyping(); await delay(450); hideTyping();
    const response = buildResponse(text); addMessage("bot", response.text, response.cards); saveConversation(text, response.text);
  }

  function buildResponse(text){
    const q = normalize(text);
    if(q.includes("hola") || q.includes("buenas")) return {text:"¡Hola! Soy Book&Go IA. Dime un destino, presupuesto o duración y te muestro opciones disponibles."};
    if(q.includes("gracias")) return {text:"Con gusto 😊. Cuando quieras buscar otro viaje, escríbeme el destino."};

    let results = state.viajes.filter(v => matchViaje(v, q));
    if(q.includes("barato") || q.includes("econom") || q.includes("menor precio")) results = [...state.viajes].sort((a,b)=>toNumber(a.precio)-toNumber(b.precio));
    if(q.includes("todos") || q.includes("opciones") || q.includes("paquetes")) results = state.viajes;
    results = results.slice(0,3);

    if(!results.length){
      return {text:"No encontré ese destino exacto. Te muestro algunas opciones disponibles:", cards: state.viajes.slice(0,3).map(toCard)};
    }
    return {text:`Encontré ${results.length} paquete${results.length>1?"s":""} para ti:`, cards: results.map(toCard)};
  }

  function matchViaje(v, q){
    const text = normalize(`${v.destino||""} ${v.titulo||""} ${v.nombre||""} ${v.descripcion||""} ${v.duracion||""} ${v.precio||""}`);
    const max = extractMaxPrice(q); if(max && toNumber(v.precio) && toNumber(v.precio)>max) return false;
    const words = q.split(/\s+/).filter(w => w.length>3 && !["quiero","busco","viaje","para","con","ir","viajar","donde","tienes","paquete","paquetes"].includes(w));
    return !words.length || words.some(w => text.includes(w));
  }

  function toCard(v){
    return {titulo:v.titulo||v.nombre||"Viaje recomendado", destino:v.destino||"Destino disponible", precio:v.precio||"Precio por confirmar", desc:v.descripcion||"Paquete disponible en Book&Go.", duracion:v.duracion||"Duración por confirmar", imagen:v.imagen||"", link:v.link||v.url||"#"};
  }

  function addMessage(role,text,cards){ const msg={role,text,cards:cards||[],time:new Date().toISOString()}; state.messages.push(msg); saveLocalHistory(); renderMessage(msg); }
  function renderHistory(){ $("bookgoMessages").innerHTML=""; state.messages.forEach(renderMessage); }
  function renderMessage(msg){
    const wrap=document.createElement("div"); wrap.className=`bookgo-message ${msg.role}`;
    const bubble=document.createElement("div"); bubble.className="bookgo-bubble"; bubble.textContent=msg.text;
    (msg.cards||[]).forEach(card=>{ const el=document.createElement("div"); el.className="bookgo-card"; el.innerHTML=`${card.imagen?`<img class="bookgo-card-img" src="${escapeAttr(card.imagen)}" alt="${escapeAttr(card.titulo)}">`:""}<div class="bookgo-card-title">${escapeHtml(card.titulo)}</div><div class="bookgo-card-meta">${escapeHtml(card.destino)} · ${escapeHtml(card.duracion)}</div><div class="bookgo-card-desc">${escapeHtml(card.desc)}</div><div class="bookgo-card-price">${escapeHtml(card.precio)}</div>${card.link&&card.link!=="#"?`<a class="bookgo-card-link" href="${escapeAttr(card.link)}" target="_blank" rel="noopener">Ver opción</a>`:""}`; bubble.appendChild(el); });
    const time=document.createElement("div"); time.className="bookgo-time"; time.textContent=new Date(msg.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); bubble.appendChild(time); wrap.appendChild(bubble); $("bookgoMessages").appendChild(wrap); scrollBottom();
  }
  function showTyping(){ if($("bookgoTyping")) return; const w=document.createElement("div"); w.id="bookgoTyping"; w.className="bookgo-message bot"; w.innerHTML=`<div class="bookgo-bubble"><span class="bookgo-typing"><span></span><span></span><span></span></span></div>`; $("bookgoMessages").appendChild(w); scrollBottom(); }
  function hideTyping(){ const el=$("bookgoTyping"); if(el) el.remove(); }
  async function saveConversation(userText, botText){ if(!state.firebaseReady) return; try{ const {ref,push,serverTimestamp}=await import(FIREBASE_CDN.db); await push(ref(state.db,`chatbotConversaciones/${state.sessionId}`),{usuario:userText,bot:botText,createdAt:serverTimestamp(),page:location.pathname}); }catch(e){} }
  function openChat(){ $("bookgoChatWindow").classList.add("open"); $("bookgoChatLauncher").classList.add("hidden"); setTimeout(()=>$("bookgoInput").focus(),100); }
  function closeChat(){ $("bookgoChatWindow").classList.remove("open"); $("bookgoChatLauncher").classList.remove("hidden"); }
  function clearHistory(){ state.messages=[]; localStorage.removeItem("bookgo_ia_chat_history"); renderHistory(); addMessage("bot","Historial limpiado. ¿Qué destino quieres buscar ahora?"); }
  function saveLocalHistory(){ localStorage.setItem("bookgo_ia_chat_history", JSON.stringify(state.messages.slice(-40))); }
  function restoreLocalHistory(){ try{ state.messages=JSON.parse(localStorage.getItem("bookgo_ia_chat_history")||"[]"); }catch{ state.messages=[]; } }
  function getSessionId(){ let id=localStorage.getItem("bookgo_ia_session"); if(!id){ id="session_"+Date.now()+"_"+Math.random().toString(16).slice(2); localStorage.setItem("bookgo_ia_session",id); } return id; }
  function normalizeFirebaseList(data){ if(Array.isArray(data)) return data.filter(Boolean); return Object.entries(data||{}).map(([id,value])=>({id,...value})); }
  function normalize(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
  function extractMaxPrice(q){ const m=q.match(/(?:menos de|menor a|maximo|max|hasta)\s*\$?\s*(\d{3,6})/); return m?Number(m[1]):null; }
  function toNumber(v){ if(typeof v==="number") return v; return Number(String(v||"").replace(/[^0-9.]/g,""))||0; }
  function autoGrow(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,92)+"px"; }
  function scrollBottom(){ const el=$("bookgoMessages"); el.scrollTop=el.scrollHeight; }
  function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function $(id){ return document.getElementById(id); }
  function escapeHtml(str){ return String(str||"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
  function escapeAttr(str){ return escapeHtml(str).replace(/`/g,"&#96;"); }
})();
