// ==========================================================
// Book&Go IA - Proxy serverless para RapidAPI (vuelos y hoteles)
// ==========================================================
// La RAPIDAPI_KEY vive únicamente aquí, como variable de entorno de
// Vercel, y nunca se manda al navegador. El frontend (chatbot/rapidapi.js)
// le dice a este endpoint a qué "host" y "path" de RapidAPI quiere
// llamar, y esta función arma la petición real agregando la key.
//
// Por seguridad, solo se permite llamar a los hosts que el propio
// proyecto usa (Sky-scrapper y Booking.com15); cualquier otro host se
// rechaza, para que este endpoint no se pueda usar como proxy abierto
// hacia cualquier URL.

const HOSTS_PERMITIDOS = [
    'sky-scrapper.p.rapidapi.com',
    'booking-com15.p.rapidapi.com'
];

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método no permitido' });
        return;
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
        console.error('Falta configurar RAPIDAPI_KEY en las variables de entorno de Vercel.');
        res.status(500).json({ error: 'El servidor no tiene configurada la API key de RapidAPI.' });
        return;
    }

    const { host, path, query } = req.body || {};

    if (!host || !HOSTS_PERMITIDOS.includes(host)) {
        res.status(400).json({ error: 'Host no permitido.' });
        return;
    }
    if (!path || !path.startsWith('/')) {
        res.status(400).json({ error: 'Path inválido.' });
        return;
    }

    const queryString = query ? '?' + new URLSearchParams(query).toString() : '';
    const url = `https://${host}${path}${queryString}`;

    try {
        const apiRes = await fetch(url, {
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': host
            }
        });

        const data = await apiRes.json();

        if (!apiRes.ok) {
            res.status(apiRes.status).json({ error: 'Error de RapidAPI', detalle: data });
            return;
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Error llamando a RapidAPI:', err);
        res.status(500).json({ error: 'No se pudo contactar a RapidAPI.' });
    }
}
