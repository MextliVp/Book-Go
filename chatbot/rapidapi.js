// ==========================================================
// Book&Go IA - Wrapper de RapidAPI (Vuelos y Hoteles)
// ==========================================================
// ⚠️ Los endpoints/parámetros exactos pueden variar según la versión
// de la API a la que estés suscrito en RapidAPI. Si algo no responde
// como se espera, entra a tu API en RapidAPI > pestaña "Endpoints" y
// revisa el nombre exacto de los parámetros con el botón "Code Snippet".
// Mientras tanto, si la llamada real falla, se usan datos simulados
// para que el flujo de la conversación nunca se quede trabado.

function bgoiaHeadersRapidAPI(host) {
    return {
        "X-RapidAPI-Key": BGOIA_CONFIG.RAPIDAPI_KEY,
        "X-RapidAPI-Host": host
    };
}

// --- 1. Buscar el "skyId" de un aeropuerto/ciudad (Sky-scrapper) ---
async function bgoiaBuscarSkyId(query) {
    const url = `https://${BGOIA_CONFIG.SKYSCRAPPER_HOST}/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}&locale=es-MX`;
    const res = await fetch(url, { headers: bgoiaHeadersRapidAPI(BGOIA_CONFIG.SKYSCRAPPER_HOST) });
    if (!res.ok) throw new Error("searchAirport falló: " + res.status);
    const data = await res.json();
    const primero = data?.data?.[0];
    if (!primero) throw new Error("No se encontró aeropuerto para: " + query);
    return { skyId: primero.skyId, entityId: primero.entityId };
}

// --- 2. Buscar vuelos ---
async function bgoiaBuscarVuelos(origenQuery, destinoQuery, fechaISO, presupuesto) {
    try {
        const origen = await bgoiaBuscarSkyId(origenQuery);
        const destino = await bgoiaBuscarSkyId(destinoQuery);

        const url = `https://${BGOIA_CONFIG.SKYSCRAPPER_HOST}/api/v1/flights/searchFlights` +
            `?originSkyId=${origen.skyId}&destinationSkyId=${destino.skyId}` +
            `&originEntityId=${origen.entityId}&destinationEntityId=${destino.entityId}` +
            `&date=${fechaISO}&adults=1&currency=MXN&market=es-MX&locale=es-MX`;

        const res = await fetch(url, { headers: bgoiaHeadersRapidAPI(BGOIA_CONFIG.SKYSCRAPPER_HOST) });
        if (!res.ok) throw new Error("searchFlights falló: " + res.status);
        const data = await res.json();

        const itinerarios = data?.data?.itineraries || [];
        if (itinerarios.length === 0) throw new Error("Sin resultados de vuelos");

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
    const url = `https://${BGOIA_CONFIG.BOOKING_HOST}/api/v1/hotels/searchDestination?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: bgoiaHeadersRapidAPI(BGOIA_CONFIG.BOOKING_HOST) });
    if (!res.ok) throw new Error("searchDestination falló: " + res.status);
    const data = await res.json();
    const primero = data?.data?.[0];
    if (!primero) throw new Error("No se encontró destino para: " + query);
    return primero.dest_id;
}

// --- 4. Buscar hoteles ---
async function bgoiaBuscarHoteles(destinoQuery, checkin, checkout, presupuesto) {
    try {
        const destId = await bgoiaBuscarDestId(destinoQuery);

        const url = `https://${BGOIA_CONFIG.BOOKING_HOST}/api/v1/hotels/searchHotels` +
            `?dest_id=${destId}&search_type=CITY&arrival_date=${checkin}&departure_date=${checkout}` +
            `&adults=1&currency_code=MXN&locale=es-MX`;

        const res = await fetch(url, { headers: bgoiaHeadersRapidAPI(BGOIA_CONFIG.BOOKING_HOST) });
        if (!res.ok) throw new Error("searchHotels falló: " + res.status);
        const data = await res.json();

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
