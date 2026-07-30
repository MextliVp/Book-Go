import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, update, child } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

window.isLoggedIn = false;

const loggedOutView = document.getElementById('logged-out-view');
const loggedInView = document.getElementById('logged-in-view');

// Escuchador de cerrar sesión
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
        e.preventDefault();
        signOut(auth).then(() => {
            alert('Sesión cerrada.');
            window.location.href = "index.html"; 
        }).catch((error) => {
            console.error("Error al cerrar sesión:", error);
        });
    });
}

// CONTROL DE SESIÓN Y LOGIN SEGURO
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.isLoggedIn = true;
        if (loggedOutView) loggedOutView.classList.add('d-none');
        if (loggedInView) loggedInView.classList.remove('d-none');
        
        const nombreAMostrar = user.displayName || user.email;

        const menuNombre = document.getElementById("NombreMenuUsuario");
        if (menuNombre) menuNombre.textContent = nombreAMostrar;

        const perfilNombre = document.getElementById("NombrePerfil");
        if (perfilNombre) perfilNombre.textContent = `Hola, ${nombreAMostrar}`;

        // Carga únicamente las reservaciones del usuario actual
        cargarReservacionesUsuario(user);
        
        if (document.getElementById("editNombre")) document.getElementById("editNombre").value = user.displayName || "";
        if (document.getElementById("editCorreo")) document.getElementById("editCorreo").value = user.email || "";

        const dbRef = ref(database);
        get(child(dbRef, `usuarios/${user.uid}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (document.getElementById("editEdad")) document.getElementById("editEdad").value = data.edad || "";
                if (document.getElementById("editGenero")) document.getElementById("editGenero").value = data.genero || "";
            }
        }).catch((error) => console.error("Error al traer datos de Realtime DB:", error));

    } else {
        window.isLoggedIn = false;
        if (loggedOutView) loggedOutView.classList.remove('d-none');
        if (loggedInView) loggedInView.classList.add('d-none');

        const menuNombre = document.getElementById("NombreMenuUsuario");
        if (menuNombre) menuNombre.textContent = "Nombre Usuario";
    }
});

// PROCESO: GUARDAR DATOS PERSONALES
const formDatos = document.getElementById("formDatosPersonales");
if (formDatos) {
    formDatos.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const btn = document.getElementById("btnGuardarDatos");
        const spinner = document.getElementById("spinnerDatos");
        const alertBox = document.getElementById("alertDatos");

        btn.disabled = true;
        spinner.classList.remove("d-none");
        alertBox.classList.add("d-none");

        const nuevoNombre = document.getElementById("editNombre").value;
        const nuevaEdad = document.getElementById("editEdad").value;
        const nuevoGenero = document.getElementById("editGenero").value;

        try {
            await updateProfile(user, { displayName: nuevoNombre });

            await update(ref(database, `usuarios/${user.uid}`), {
                nombre: nuevoNombre,
                correo: user.email,
                edad: nuevaEdad,
                genero: nuevoGenero,
                updatedAt: new Date().toISOString()
            });

            if (document.getElementById("NombreMenuUsuario")) document.getElementById("NombreMenuUsuario").textContent = nuevoNombre;
            if (document.getElementById("NombrePerfil")) document.getElementById("NombrePerfil").textContent = `Hola, ${nuevoNombre}`;

            alertBox.className = "alert alert-success small py-2";
            alertBox.textContent = "¡Datos guardados correctamente!";
            alertBox.classList.remove("d-none");

        } catch (error) {
            console.error(error);
            alertBox.className = "alert alert-danger small py-2";
            alertBox.textContent = "Error al guardar los datos: " + error.message;
            alertBox.classList.remove("d-none");
        } finally {
            btn.disabled = false;
            spinner.classList.add("d-none");
        }
    });
}

// PROCESO: CAMBIAR CONTRASEÑA
const formPass = document.getElementById("formPassword");
if (formPass) {
    formPass.addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const btn = document.getElementById("btnGuardarPass");
        const spinner = document.getElementById("spinnerPass");
        const alertBox = document.getElementById("alertPass");

        const newPass = document.getElementById("newPassword").value;
        const confirmPass = document.getElementById("confirmPassword").value;

        alertBox.classList.add("d-none");

        if (newPass !== confirmPass) {
            alertBox.className = "alert alert-danger small py-2";
            alertBox.textContent = "Las contraseñas no coinciden.";
            alertBox.classList.remove("d-none");
            return;
        }

        btn.disabled = true;
        spinner.classList.remove("d-none");

        try {
            await updatePassword(user, newPass);
            
            alertBox.className = "alert alert-success small py-2";
            alertBox.textContent = "¡Contraseña actualizada con éxito!";
            alertBox.classList.remove("d-none");
            formPass.reset();

        } catch (error) {
            console.error(error);
            alertBox.className = "alert alert-danger small py-2";
            if (error.code === "auth/requires-recent-login") {
                alertBox.textContent = "Por seguridad, necesitas volver a iniciar sesión antes de cambiar tu contraseña.";
            } else {
                alertBox.textContent = "Error: " + error.message;
            }
            alertBox.classList.remove("d-none");
        } finally {
            btn.disabled = false;
            spinner.classList.add("d-none");
        }
    });
}

// FUNCIONES AUXILIARES DE FORMATO
function formatearFecha(fechaIso) {
    if (!fechaIso) return 'N/A';
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return fechaIso;
    
    return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatearMoneda(monto) {
    if (!monto && monto !== 0) return '$0.00 MXN';
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(monto);
}

// CARGAR RESERVACIONES FILTRADAS POR USUARIO
async function cargarReservacionesUsuario(user) {
    const tbody = document.getElementById("tablaReservacionesBody");
    if (!tbody) return;

    try {
        const dbRef = ref(database, 'reservasChatbotSesion');
        const snapshot = await get(dbRef);

        if (!snapshot.exists()) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted fs-6 fw-medium">No hay viajes</td>
                </tr>`;
            return;
        }

        let reservacionesHTML = "";
        let contadorReservas = 0;

        snapshot.forEach((sesionSnap) => {
            sesionSnap.forEach((reservaSnap) => {
                const reserva = reservaSnap.val();
                
                // Validación para asegurar que la reserva le pertenezca al usuario en sesión
                const perteneceAlUsuario = (reserva.userId === user.uid) || 
                                           (reserva.usuarioUid === user.uid) ||
                                           (reserva.correo && reserva.correo === user.email);

                if (perteneceAlUsuario) {
                    const destino = reserva.titulo || (reserva.destino ? reserva.destino.toUpperCase() : "Destino N/A");
                    const folio = reserva.folio || "BG-PENDIENTE";
                    const fechaEntrada = formatearFecha(reserva.fechaEntrada);
                    const fechaSalida = formatearFecha(reserva.fechaSalida);
                    const rangoFechas = `${fechaEntrada} - ${fechaSalida}`;
                    
                    const precioTotal = formatearMoneda(reserva.totalViajeEstimado || reserva.totalEstimado || 0);
                    const estado = reserva.estado || "pendiente";

                    let badgeClass = "bg-warning bg-opacity-10 text-warning";
                    if (estado.toLowerCase() === "confirmado" || estado.toLowerCase() === "completado") {
                        badgeClass = "bg-success bg-opacity-10 text-success";
                    } else if (estado.toLowerCase() === "cancelado") {
                        badgeClass = "bg-danger bg-opacity-10 text-danger";
                    }

                    contadorReservas++;

                    reservacionesHTML += `
                        <tr>
                            <td class="px-4 py-3">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="bg-primary bg-opacity-10 text-primary rounded-3 p-2 d-inline-flex">
                                        <i class="bi bi-building fs-5"></i>
                                    </div>
                                    <div>
                                        <span class="fw-bold text-dark d-block">${destino}</span>
                                        <small class="text-muted">Folio: ${folio}</small>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-muted">${rangoFechas}</td>
                            <td class="px-4 py-3 fw-bold text-dark">${precioTotal}</td>
                            <td class="px-4 py-3">
                                <span class="badge ${badgeClass} rounded-pill px-2.5 py-1.5 text-capitalize" style="font-size: 0.75rem;">
                                    ${estado}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-end">
                                <button class="btn btn-light btn-sm rounded-pill px-3 fw-medium me-1 shadow-sm border" 
                                        onclick="generarPDFReserva('${reservaSnap.key}', '${sesionSnap.key}')">
                                    <i class="bi bi-file-earmark-pdf me-1"></i> Ver Detalles / PDF
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });
        });

        if (contadorReservas === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted fs-6 fw-medium">No hay viajes</td>
                </tr>`;
        } else {
            tbody.innerHTML = reservacionesHTML;
        }

    } catch (error) {
        console.error("Error al cargar reservaciones:", error);
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-danger">Error al cargar la información de reservaciones.</td>
            </tr>`;
    }
}

// ==========================================
// FUNCIÓN GLOBAL PARA GENERAR Y DESCARGAR EL PDF
// ==========================================
window.generarPDFReserva = async function(reservaKey, sesionKey) {
    if (!reservaKey || !sesionKey) {
        alert("Error: No se encontró la referencia completa de la reservación.");
        return;
    }

    try {
        // 1. Consultar la reservación específica desde Firebase
        const dbRef = ref(database, `reservasChatbotSesion/${sesionKey}/${reservaKey}`);
        const snapshot = await get(dbRef);

        if (!snapshot.exists()) {
            alert("No se encontró la información detallada de esta reservación.");
            return;
        }

        const r = snapshot.val();

        // Extraer campos de la base de datos
        const folio = r.folio || "BG-PENDIENTE";
        const titulo = r.titulo || (r.destino ? `Viaje a ${r.destino.toUpperCase()}` : "Detalles del Viaje");
        const destino = r.destino ? r.destino.toUpperCase() : "N/A";
        const origen = r.origenSalida || "No especificado";
        const fechaEntrada = formatearFecha(r.fechaEntrada);
        const fechaSalida = formatearFecha(r.fechaSalida);
        const noches = r.noches || "N/A";
        const personas = r.personas || 1;
        const transporte = r.transportePreferido ? r.transportePreferido.toUpperCase() : "No especificado";
        const mascotas = r.mascotasSolicitadas ? "Solicitado" : "No solicitado";
        const estado = (r.estado || "pendiente").toUpperCase();

        const precioPorNoche = formatearMoneda(r.precioPorNocheEstimado || 0);
        const totalAlojamiento = formatearMoneda(r.totalEstimado || 0);
        const totalTransporte = formatearMoneda(r.transporteEstimado || 0);
        const totalViaje = formatearMoneda(r.totalViajeEstimado || r.totalEstimado || 0);

        // 2. Crear Modal Dinámico con la Plantilla de Impresión
        const modalExistente = document.getElementById("pdfModalContainer");
        if (modalExistente) modalExistente.remove();

        const modalContainer = document.createElement("div");
        modalContainer.id = "pdfModalContainer";
        modalContainer.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(11, 17, 33, 0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
                    
                    <!-- Barra Superior de Acciones -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">
                        <h5 style="margin: 0; font-weight: bold; color: #0f172a;">Vista Previa de Comprobante</h5>
                        <div>
                            <button id="btnBajarPDF" style="background: linear-gradient(135deg, #6366f1, #a855f7); color: white; border: none; padding: 8px 18px; border-radius: 20px; font-weight: 600; cursor: pointer; margin-right: 8px;">
                                <i class="bi bi-download"></i> Descargar PDF
                            </button>
                            <button onclick="document.getElementById('pdfModalContainer').remove()" style="background: #e2e8f0; color: #334155; border: none; padding: 8px 14px; border-radius: 20px; font-weight: 600; cursor: pointer;">
                                Cerrar
                            </button>
                        </div>
                    </div>

                    <!-- Estructura Imprimible del Vocher -->
                    <div id="contenidoParaPDF" style="padding: 24px; font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; background: #f8fafc; border-radius: 12px;">
                        
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #0b1121 0%, #1e1b4b 100%); color: white; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h2 style="margin: 0; font-size: 22px; font-weight: bold;">Book&Go <span style="color: #818cf8;">AI</span></h2>
                                <p style="margin: 4px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Comprobante Oficial de Reservación</p>
                            </div>
                            <div style="text-align: right; background: rgba(255,255,255,0.1); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                                <span style="font-size: 9px; text-transform: uppercase; color: #cbd5e1; display: block;">Folio</span>
                                <strong style="font-size: 14px; color: #38bdf8;">${folio}</strong>
                            </div>
                        </div>

                        <!-- Estado -->
                        <div style="margin-top: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;">
                            ● Estado de la Reserva: ${estado}
                        </div>

                        <!-- Información del Itinerario -->
                        <h4 style="font-size: 14px; font-weight: bold; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">Información del Itinerario</h4>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
                            <div style="background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Título / Destino</span>
                                <strong style="font-size: 14px; color: #4f46e5;">${titulo}</strong>
                                <small style="display: block; color: #64748b;">${destino}</small>
                            </div>
                            <div style="background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Fechas de Instancia</span>
                                <strong style="font-size: 13px;">${fechaEntrada} — ${fechaSalida}</strong>
                                <small style="display: block; color: #64748b;">Duración: ${noches} Noches</small>
                            </div>
                            <div style="background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Origen de Salida</span>
                                <strong style="font-size: 13px;">${origen}</strong>
                            </div>
                            <div style="background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                                <span style="font-size: 10px; color: #64748b; text-transform: uppercase; display: block;">Pasajeros y Servicios</span>
                                <strong style="font-size: 13px;">${personas} Personas | ${transporte}</strong>
                                <small style="display: block; color: #64748b;">Mascotas: ${mascotas}</small>
                            </div>
                        </div>

                        <!-- Tabla Desglose -->
                        <h4 style="font-size: 14px; font-weight: bold; margin-top: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">Desglose de Costos Estimados</h4>
                        
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; font-size: 12px;">
                            <thead>
                                <tr style="background: #f1f5f9; text-align: left; color: #475569;">
                                    <th style="padding: 10px;">Concepto / Descripción</th>
                                    <th style="padding: 10px; text-align: right;">Monto Estimado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 10px;">Hospedaje & Paquete (${noches} noches @ ${precioPorNoche}/noche)</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${totalAlojamiento}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px;">Transporte Estimado (${transporte})</td>
                                    <td style="padding: 10px; text-align: right; font-weight: 600;">${totalTransporte}</td>
                                </tr>
                            </tbody>
                        </table>

                        <!-- Total -->
                        <div style="background: #1e1b4b; color: white; padding: 14px 20px; border-radius: 8px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 13px; font-weight: 500;">Total Viaje Estimado</span>
                            <strong style="font-size: 18px; color: #38bdf8;">${totalViaje}</strong>
                        </div>

                        <!-- Pie de página -->
                        <p style="margin-top: 20px; font-size: 10px; color: #64748b; background: white; padding: 10px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                            <strong>Notas de la Reservación:</strong> Este documento fue generado de manera automática por el asistente Book&Go AI. Los montos expresados son estimaciones basadas en el itinerario seleccionado.
                        </p>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modalContainer);

        // 3. Configurar Evento para Descargar PDF
        document.getElementById("btnBajarPDF").addEventListener("click", () => {
            const elemento = document.getElementById("contenidoParaPDF");
            const opt = {
                margin:       8,
                filename:     `Reserva_${folio}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            if (typeof html2pdf !== "undefined") {
                html2pdf().set(opt).from(elemento).save();
            } else {
                alert("La librería html2pdf.js no está cargada en la página HTML.");
            }
        });

    } catch (error) {
        console.error("Error al generar vista/PDF de reservación:", error);
        alert("Ocurrió un error al preparar la información para el PDF.");
    }
};