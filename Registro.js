import { auth, provider, signInWithPopup } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// Agregamos "set" para poder escribir datos en la Realtime Database
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Inicializamos la referencia de la base de datos de Firebase
const db = getDatabase();

document.addEventListener("DOMContentLoaded", () => {
    const btnRegister = document.getElementById("btnRegister");

    if (btnRegister) {
        btnRegister.addEventListener("click", async (e) => {
            e.preventDefault();

            // 1. Capturar los valores de los inputs ordinarios desde el HTML
            const nombre = document.getElementById("registerNombre").value.trim();
            const correo = document.getElementById("registerEmail").value.trim();
            const contrasena = document.getElementById("registerPassword").value;
            const edadInput = document.getElementById("registerEdad").value.trim();
            
            const estiloDeViaje = document.getElementById("registerEstilo").value;
            const presupuesto = document.getElementById("registerPresupuesto").value;
            const transportePreferido = document.getElementById("registerTransporte").value;
            const alojamientoPreferido = document.getElementById("registerAlojamiento").value;
            const duracionViaje = document.getElementById("registerDuracion").value;

            // Validaciones de campos obligatorios
            if (!nombre || !correo || !contrasena || !edadInput) {
                alert("Por favor, completa los campos obligatorios (Nombre, Correo, Edad y Contraseña).");
                return;
            }

            if (contrasena.length < 6) {
                alert("La contraseña debe tener un mínimo de 6 caracteres.");
                return;
            }

            const edad = parseInt(edadInput, 10);
            if (isNaN(edad) || edad <= 0) {
                alert("Por favor, introduce una edad válida.");
                return;
            }

            // 2. Mapear intereses desde checkboxes seleccionados
            const intereses = [];
            const checkboxes = document.querySelectorAll(".interes-chk:checked");
            checkboxes.forEach((chk) => {
                intereses.push(chk.value);
            });

            // 3. Procesar destinos favoritos (String a Array)
            const destinosInput = document.getElementById("registerDestinos").value.trim();
            const destinosFavoritos = destinosInput 
                ? destinosInput.split(",").map(destino => destino.trim()).filter(destino => destino !== "")
                : [];

            // 4. Parámetros automáticos internos
            const timestampActual = new Date().toISOString();
            const idUsuarioUnico = "usr_" + Math.random().toString(36).substr(2, 9);

            // 5. Construcción del Objeto estructurado
            const usuarioData = {
                idUsuario: idUsuarioUnico,
                nombre: nombre,
                correo: correo,
                contrasena: contrasena, 
                edad: edad,             
                estiloDeViaje: estiloDeViaje,
                presupuesto: presupuesto,
                intereses: intereses, // Arreglo de intereses seleccionados
                transportePreferido: transportePreferido,
                alojamientoPreferido: alojamientoPreferido,
                duracionViaje: duracionViaje,
                destinosFavoritos: destinosFavoritos,
                fechaCreacion: timestampActual,
                ultimoInicioSesion: timestampActual
            };

            // 6. Envío de datos a Firebase Realtime Database
            try {
                // Guardamos los datos en el nodo 'usuarios/usr_xxxxxxxxx'
                await set(ref(db, 'usuarios/' + idUsuarioUnico), usuarioData);
                
                alert(`¡Cuenta de ${usuarioData.nombre} guardada exitosamente en Firebase!`);
                
                // Opcional: Cierre automático si está dentro de un Modal de Bootstrap
                const modalElement = document.getElementById('tuModalId'); // Cambia 'tuModalId' por el ID real de tu modal
                if (modalElement) {
                    const modalInstancia = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstancia) modalInstancia.hide();
                }

            } catch (error) {
                console.error("Error al guardar en Firebase Realtime Database:", error);
                alert("Hubo un error al guardar los datos en la base de datos: " + error.message);
            }
        });
    }
});