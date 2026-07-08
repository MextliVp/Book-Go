// ==========================================================
// Book&Go IA - Wrapper de Gemini API
// ==========================================================
// Pide a Gemini que responda SIEMPRE en JSON, usando responseMimeType.
// Documentación: https://ai.google.dev/gemini-api/docs

async function bgoiaAskGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${BGOIA_CONFIG.GEMINI_MODEL}:generateContent?key=${BGOIA_CONFIG.GEMINI_API_KEY}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.8
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error("Error de Gemini API: " + res.status + " " + errText);
    }

    const data = await res.json();
    const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textoRespuesta) {
        throw new Error("Gemini no devolvió contenido.");
    }

    try {
        return JSON.parse(textoRespuesta);
    } catch (e) {
        console.error("No se pudo parsear el JSON de Gemini:", textoRespuesta);
        throw new Error("Gemini devolvió un formato inesperado.");
    }
}

// --- RAG seguro: separado de los prompts de viaje de abajo ---
// Recibe el prompt del sistema (con reglas), el CONTEXTO ya filtrado por
// permisos (documentos + datos propios del usuario) y la pregunta.
// Nunca se le manda a Gemini nada que no haya pasado antes por los filtros
// de bgoiaObtenerDocumentosPermitidos / bgoiaConsultarDatosPermitidos.
async function bgoiaAskGeminiRAG(promptSistema, contextoAutorizado, pregunta) {
    const promptCompleto = `
${promptSistema}

CONTEXTO AUTORIZADO (única fuente de verdad permitida):
"""
${contextoAutorizado}
"""

PREGUNTA DEL USUARIO:
"${pregunta}"
`;
    return bgoiaAskGemini(promptCompleto);
}

// --- Prompts específicos de cada paso de la conversación ---

async function bgoiaGenerarOpcionesDestino(mensajeUsuario) {
    const prompt = `
Eres el asistente de viajes de Book&Go IA. El usuario escribió: "${mensajeUsuario}".
Identifica el destino turístico al que quiere viajar y genera EXACTAMENTE 3 opciones de
experiencia de viaje distintas para ese destino (por ejemplo diferentes zonas, estilos o
niveles de precio dentro del mismo destino).

Responde SOLO con un arreglo JSON con este formato exacto, sin texto adicional:
[
  {
    "titulo": "Nombre corto de la opción",
    "imagen_keyword": "palabra clave en inglés para buscar una foto (ej: beach, resort, downtown)",
    "precio_aprox": 5000,
    "descripcion": "Descripción breve y atractiva en 1-2 frases"
  }
]
Los precios son montos en pesos mexicanos (MXN), números enteros sin símbolos.
`;
    return bgoiaAskGemini(prompt);
}

async function bgoiaGenerarItinerario(destino, opcionElegida, intereses, feedback = "") {
    const prompt = `
Eres el asistente de viajes de Book&Go IA. El usuario eligió viajar a "${destino}",
específicamente la experiencia: "${opcionElegida}".
Sus intereses son: "${intereses}".
${feedback ? `Ajusta considerando este comentario del usuario: "${feedback}".` : ""}

Genera un itinerario de 3 días. Responde SOLO con este JSON exacto, sin texto adicional:
{
  "dias": [
    {
      "dia": 1,
      "titulo": "Título corto del día",
      "actividades": [
        { "hora": "09:00", "lugar": "Nombre del lugar", "actividad": "Qué se hace ahí", "precio_aprox": 300 }
      ]
    }
  ]
}
Los precios son en pesos mexicanos (MXN), números enteros. Incluye playas, comida y museos
si el usuario los mencionó como interés.
`;
    return bgoiaAskGemini(prompt);
}

async function bgoiaObtenerAeropuertoCercano(origen, destino) {
    const prompt = `
Un viajero está en "${origen}" (México) y quiere volar hacia "${destino}".
Indica cuál es el aeropuerto de salida más conveniente/cercano para esa persona.

Responde SOLO con este JSON exacto, sin texto adicional:
{
  "aeropuerto_nombre": "Nombre completo del aeropuerto",
  "aeropuerto_codigo_iata": "Código IATA de 3 letras",
  "ciudad": "Ciudad donde está el aeropuerto",
  "direccion_aprox": "Dirección o referencia aproximada",
  "consejo": "Frase corta con recomendación para llegar (transporte, tiempo estimado, etc.)"
}
`;
    return bgoiaAskGemini(prompt);
}
