// Simulador de base de datos estática para el avance de mañana
// HACK TEMPORAL PARA MAÑANA: Detener cualquier otra alerta en el buscador
document.addEventListener('click', function(e) {
    const boton = e.target.closest('#btnBuscarCatalogo') || e.target.closest('#btnBuscar');
    if (boton) {
        e.stopPropagation(); // Detiene por completo que el código de tus compañeros se entere del clic
    }
}, true); // El 'true' es la clave: atrapa el clic antes que nadie más en la página
const viajesCatalogo = [

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

// Escuchar el clic en el botón Buscar
document.getElementById('btnBuscarCatalogo').addEventListener('click', function(e) {
    e.preventDefault(); // Evita que recargue la página

    const inputDestino = document.getElementById('inputDestino');
    const contenedor = document.getElementById('contenedorCatalogo');
    
    // Limpiar espacios y pasar a minúsculas para evitar fallos de coincidencia
    const busqueda = inputDestino.value.trim().toLowerCase();

    // Limpiar resultados previos
    contenedor.innerHTML = '';

    if (busqueda === '') {
        contenedor.innerHTML = `
            <div class="col-12 text-center text-muted py-3">
                <p class="mb-0 small"><i class="bi bi-info-circle me-1"></i> Por favor, escribe un destino para buscar (Ej: Filipinas, Cancun, Tokio).</p>
            </div>`;
        return;
    }

    // Filtrar los datos locales
    const resultados = viajesCatalogo.filter(viaje => viaje.destino.includes(busqueda));

    // Si no hay coincidencias
    if (resultados.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-exclamation-circle text-warning fs-3 mb-2 d-block"></i>
                <p class="text-muted">No encontramos paquetes disponibles para "${inputDestino.value}". Prueba con 'Filipinas'.</p>
            </div>`;
        return;
    }

    // Renderizar tarjetas con clases de Bootstrap e incorporando tu efecto 'hover-lift'
    resultados.forEach(viaje => {
        const tarjetaHtml = `
            <div class="col-md-4">
                <div class="card border-0 shadow-sm rounded-4 h-100 overflow-hidden hover-lift">
                    <div style="position: relative; height: 200px;">
                        <img src="${viaje.imagen}" class="w-100 h-100" style="object-fit: cover;" alt="${viaje.titulo}">
                        <span class="badge bg-primary position-absolute top-0 end-0 m-3 rounded-pill px-3 py-2 fw-semibold">${viaje.duracion}</span>
                    </div>
                    <div class="card-body d-flex flex-direction-col flex-column justify-content-between p-4">
                        <div>
                            <h5 class="fw-bold mb-2">${viaje.titulo}</h5>
                            <p class="text-muted small mb-3" style="line-height: 1.5;">${viaje.descripcion}</p>
                        </div>
                        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top border-light">
                            <div>
                                <small class="text-muted d-block style="font-size: 0.75rem;">Precio desde</small>
                                <span class="fw-bold text-primary fs-5">${viaje.precio}</span>
                            </div>
                            <button class="btn btn-gradient btn-sm rounded-pill px-3 py-2 fw-semibold" onclick="protectedAction(event, 'Reservar ${viaje.titulo}')">
                                Ver Detalles
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        contenedor.innerHTML += tarjetaHtml;
    });

    // Desplazar la vista suavemente hacia los resultados del catálogo
    contenedor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});