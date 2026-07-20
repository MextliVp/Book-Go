// ==========================================================
// Book&Go IA - Proxy serverless para Gemini API
// ==========================================================
// Esta función corre en el servidor de Vercel, NUNCA en el navegador.
// La API key vive únicamente en la variable de entorno GEMINI_API_KEY
// (configurada en el dashboard de Vercel), así que jamás se envía al
// cliente ni queda expuesta en el código fuente del sitio.
//
// El frontend (chatbot/gemini.js) le manda { prompt, maxOutputTokens }
// a este endpoint, y esta función reenvía la petición real a Google
// con la key puesta aquí. La respuesta se regresa tal cual la da
// Google, para no tener que tocar la lógica de parseo del frontend.

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método no permitido' });
        return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.');
        res.status(500).json({ error: 'El servidor no tiene configurada la API key de Gemini.' });
        return;
    }

    const { prompt, maxOutputTokens, model } = req.body || {};
    if (!prompt) {
        res.status(400).json({ error: 'Falta el parámetro "prompt".' });
        return;
    }

    const modeloUsado = model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloUsado}:generateContent?key=${apiKey}`;

    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
            maxOutputTokens: maxOutputTokens || 600,
            thinkingConfig: { thinkingBudget: 0 }
        }
    };

    try {
        const googleRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await googleRes.json();

        if (!googleRes.ok) {
            console.error('Error de Gemini API:', googleRes.status, data);
            res.status(googleRes.status).json({ error: 'Error de Gemini API', detalle: data });
            return;
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Error llamando a Gemini:', err);
        res.status(500).json({ error: 'No se pudo contactar a Gemini.' });
    }
}
