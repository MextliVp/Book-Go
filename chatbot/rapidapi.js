// ==========================================================
// Book&Go IA - Wrapper de RapidAPI (Vuelos y Hoteles)
// ==========================================================
// ⚠️ Los endpoints/parámetros exactos pueden variar según la versión
// de la API a la que estés suscrito en RapidAPI. Si algo no responde
// como se espera, entra a tu API en RapidAPI > pestaña "Endpoints" y
// revisa el nombre exacto de los parámetros con el botón "Code Snippet".
// Mientras tanto, si la llamada real falla, se usan datos simulados
// para que el flujo de la conversación nunca se quede trabado.

// La RAPIDAPI_KEY vive en el servidor (/api/rapidapi.js), nunca en el
// navegador. Esta función le pide a nuestro propio backend que haga la
// llamada real a RapidAPI, indicando host + path + query.
async function bgoiaLlamarRapidAPI(host, path, query) {
    const res = await fetch('/api/rapidapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, path, query })
    });
    if (!res.ok) {
        const err = new Error('Llamada a RapidAPI falló: ' + res.status);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

// Pequeña pausa entre peticiones seguidas a RapidAPI: algunos planes
// gratuitos limitan las peticiones "por segundo", no solo al mes, y
// nuestro flujo dispara varias llamadas casi al mismo tiempo (aeropuerto
// de origen, de destino, y luego vuelos). Sin esta pausa se puede recibir
// un 429 aunque la cuota mensual esté casi intacta.
function bgoiaEsperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Alias/acrónimos comunes en México que la API de vuelos normalmente NO
// reconoce tal cual (busca nombres de ciudad, no siglas). Los normalizamos
// antes de buscar.
const BGOIA_ALIAS_CIUDADES = {
    'cdmx': 'Ciudad de México',
    'df': 'Ciudad de México',
    'ciudad de mexico': 'Ciudad de México',
    'mexico city': 'Ciudad de México',
    'gdl': 'Guadalajara',
    'mty': 'Monterrey',
    'slp': 'San Luis Potosí',
    'qro': 'Querétaro',
    'tj': 'Tijuana',
    'vsa': 'Villahermosa',
    'mid': 'Mérida',
    'cun': 'Cancún',
    'pue': 'Puebla'
};

function bgoiaNormalizarCiudad(query) {
    const clave = query.trim().toLowerCase();
    return BGOIA_ALIAS_CIUDADES[clave] || query;
}

// --- 1. Buscar el "skyId" de un aeropuerto/ciudad (Sky-scrapper) ---
// La API a veces no encuentra resultados con el texto tal cual lo escribió
// el usuario (acrónimos, nombres cortos, etc.), aunque responda 200 OK.
// Por eso probamos varias variantes de la búsqueda antes de rendirnos.
async function bgoiaBuscarSkyId(query) {
    const normalizado = bgoiaNormalizarCiudad(query);
    // Ya no probamos el texto "original" además del normalizado (si son
    // iguales no aporta nada) para no duplicar peticiones y gastar cuota
    // de más en la API. Como mucho: normalizado, y si no tiene coma, una
    // variante con ", México" agregado.
    const intentos = [normalizado];
    if (!/,/.test(normalizado)) intentos.push(normalizado + ', México');

    let ultimoError = null;
    for (let i = 0; i < intentos.length; i++) {
        const q = intentos[i];
        if (i > 0) await bgoiaEsperar(500);
        try {
            const data = await bgoiaLlamarRapidAPI(
                BGOIA_CONFIG.SKYSCRAPPER_HOST,
                '/api/v1/flights/searchAirport',
                { query: q, locale: 'en-US' }
            );
            const primero = data?.data?.[0];
            if (primero) {
                return { skyId: primero.skyId, entityId: primero.entityId };
            }
            console.warn(`🔎 searchAirport("${q}") respondió 200 OK pero sin resultados.`);
            ultimoError = new Error("No se encontró aeropuerto para: " + q);
        } catch (err) {
            console.warn(`🔎 searchAirport("${q}") falló. ` +
                (err.status === 429 ? 'Límite de peticiones alcanzado (puede ser por segundo/minuto, o cuota mensual).' :
                 err.status === 403 ? 'Probablemente la key no está suscrita a Sky-scrapper.' :
                 'Revisa la respuesta completa en la pestaña Network de DevTools.'));
            ultimoError = err;
            // Si ya nos limitaron (429), seguir intentando con más
            // variantes solo desperdicia las peticiones que quedan;
            // mejor cortar aquí y caer directo a datos simulados.
            if (err.status === 429) break;
        }
    }
    throw ultimoError || new Error("No se encontró aeropuerto para: " + query);
}

// --- 2. Buscar vuelos ---
async function bgoiaBuscarVuelos(origenQuery, destinoQuery, fechaISO, presupuesto) {
    try {
        const origen = await bgoiaBuscarSkyId(origenQuery);
        await bgoiaEsperar(500);
        const destino = await bgoiaBuscarSkyId(destinoQuery);
        await bgoiaEsperar(500);

        const data = await bgoiaLlamarRapidAPI(
            BGOIA_CONFIG.SKYSCRAPPER_HOST,
            '/api/v1/flights/searchFlights',
            {
                originSkyId: origen.skyId,
                destinationSkyId: destino.skyId,
                originEntityId: origen.entityId,
                destinationEntityId: destino.entityId,
                date: fechaISO,
                adults: 1,
                currency: 'MXN',
                market: 'en-US',
                locale: 'en-US'
            }
        );

        const itinerarios = data?.data?.itineraries || [];
        if (itinerarios.length === 0) {
            // Diagnóstico: algunas APIs de este estilo devuelven la búsqueda
            // en estado "incompleto" en la primera llamada (todavía están
            // consultando aerolíneas) y hay que reintentar. Mostramos la
            // respuesta cruda para saber si es ese el caso o si de plano no
            // hay vuelos para esa ruta/fecha.
            console.warn(`🔎 searchFlights(${origen.skyId}→${destino.skyId}, fecha=${fechaISO}) no trajo itinerarios. status de contexto:`, data?.data?.context?.status || '(sin campo context.status)');
            console.warn('🔎 Respuesta cruda completa de searchFlights:', data);
            throw new Error("Sin resultados de vuelos");
        }

        return itinerarios.slice(0, 4).map((it, i) => ({
            id: it.id || `vuelo-${i}`,
            aerolinea: it.legs?.[0]?.carriers?.marketing?.[0]?.name || "Aerolínea",
            salida: it.legs?.[0]?.departure || "",
            llegada: it.legs?.[0]?.arrival || "",
            precio: Math.round(it.price?.raw || 0),
            escalas: it.legs?.[0]?.stopCount ?? 0
        })).filter(v => !presupuesto || v.precio <= presupuesto);

    } catch (err) {
        console.warn("⚠️ Usando vuelos simulados (revisa tu API de vuelos):", err.message);
        return bgoiaVuelosSimulados(presupuesto);
    }
}

function bgoiaVuelosSimulados(presupuesto) {
    const base = [
        { id: "sim-1", aerolinea: "Volaris", salida: "06:40", llegada: "08:10", precio: 1850, escalas: 0 },
        { id: "sim-2", aerolinea: "Viva Aerobus", salida: "11:15", llegada: "12:50", precio: 1590, escalas: 0 },
        { id: "sim-3", aerolinea: "Aeroméxico", salida: "18:05", llegada: "19:35", precio: 2470, escalas: 0 },
    ];
    const tope = presupuesto || Infinity;
    return base.filter(v => v.precio <= tope);
}

// --- 3. Buscar destino de hotel (Booking.com15) ---
async function bgoiaBuscarDestId(query) {
    const data = await bgoiaLlamarRapidAPI(
        BGOIA_CONFIG.BOOKING_HOST,
        '/api/v1/hotels/searchDestination',
        { query }
    );
    const primero = data?.data?.[0];
    if (!primero) throw new Error("No se encontró destino para: " + query);
    return primero.dest_id;
}

// --- 4. Buscar hoteles ---
async function bgoiaBuscarHoteles(destinoQuery, checkin, checkout, presupuesto) {
    try {
        const destId = await bgoiaBuscarDestId(destinoQuery);

        const data = await bgoiaLlamarRapidAPI(
            BGOIA_CONFIG.BOOKING_HOST,
            '/api/v1/hotels/searchHotels',
            {
                dest_id: destId,
                search_type: 'CITY',
                arrival_date: checkin,
                departure_date: checkout,
                adults: 1,
                currency_code: 'MXN',
                locale: 'es-MX'
            }
        );

        const hoteles = data?.data?.hotels || [];
        if (hoteles.length === 0) throw new Error("Sin resultados de hoteles");

        return hoteles.slice(0, 4).map((h, i) => ({
            id: h.hotel_id || `hotel-${i}`,
            nombre: h.property?.name || "Hotel",
            estrellas: h.property?.propertyClass || 3,
            precioPorNoche: Math.round(h.property?.priceBreakdown?.grossPrice?.value || 0)
        })).filter(h => !presupuesto || h.precioPorNoche <= presupuesto);

    } catch (err) {
        console.warn("⚠️ Usando hoteles simulados (revisa tu API de hoteles):", err.message);
        return bgoiaHotelesSimulados(presupuesto);
    }
}

function bgoiaHotelesSimulados(presupuesto) {
    const base = [
        { id: "hsim-1", nombre: "Hotel Marina Vallarta", estrellas: 4, precioPorNoche: 1200 },
        { id: "hsim-2", nombre: "Boutique Zona Romántica", estrellas: 3, precioPorNoche: 950 },
        { id: "hsim-3", nombre: "Resort Nuevo Vallarta", estrellas: 5, precioPorNoche: 2100 },
    ];
    const tope = presupuesto || Infinity;
    return base.filter(h => h.precioPorNoche <= tope);
}
