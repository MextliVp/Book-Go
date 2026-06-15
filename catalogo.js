// Simulador de base de datos estática para el avance de mañana
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
    }
];

// Escuchar el clic en el botón Buscar
document.getElementById('btnBuscar').addEventListener('click', function(e) {
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