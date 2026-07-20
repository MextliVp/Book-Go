import { auth, provider, signInWithPopup } from "./firebase.js";
import { 
    signOut, 
    createUserWithEmailAndPassword, 
    sendEmailVerification,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    get, 
    set,
    update
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const db = getDatabase();

// Bandera para evitar que el listener global de abajo (onAuthStateChanged)
// entre en carrera con el flujo de registro. createUserWithEmailAndPassword
// autentica al usuario de inmediato en el cliente, lo que dispara este
// listener EN PARALELO mientras el registro todavía está guardando el
// perfil en la base de datos. Si el listener hace signOut() primero, el
// set() del registro falla con PERMISSION_DENIED porque ya no hay sesión.
let registroEnProgreso = false;

// ==========================================
// 1. CONTROL DE ESTADO GLOBAL Y BLOQUEO VISUAL
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Refrescamos el usuario por si acaba de verificar su correo hace
        // un momento (en otra pestaña/dispositivo): el objeto "user" que
        // llega aquí puede tener info en caché.
        try {
            await user.reload();
        } catch (err) {
            console.warn("No se pudo refrescar el estado del usuario:", err.message);
        }

        // Validamos estrictamente si el usuario ya confirmó su correo
        if (user.emailVerified) {
            console.log("Usuario autenticado y verificado con éxito:", user.email);

            // El campo "emailVerificado" en Realtime Database se guardó en
            // false al momento del registro y nunca se actualizaba después,
            // aunque Firebase Authentication (user.emailVerified) sí ya
            // supiera que el correo estaba confirmado. Lo sincronizamos aquí,
            // pero SOLO si el usuario ya tiene un perfil guardado (por
            // ejemplo, alguien que entra con Google sin haberse registrado
            // antes no debe generar un registro a medias con únicamente
            // este campo).
            try {
                const snap = await get(ref(db, 'usuarios/' + user.uid));
                if (snap.exists()) {
                    await update(ref(db, 'usuarios/' + user.uid), { emailVerificado: true });
                } else {
                    console.warn("Usuario autenticado (uid: " + user.uid + ") pero sin perfil registrado en la base de datos. No se crea un registro parcial.");
                }
            } catch (err) {
                console.warn("No se pudo sincronizar emailVerificado en la base de datos:", err.message);
            }

            // [AQUÍ TU LÓGICA DE USUARIO LOGUEADO]
            // Ejemplo: ocultar botón de login, mostrar panel de control, etc.
            
        } else {
            // Si el registro está en curso, es NORMAL que el correo aún no
            // esté verificado: el propio flujo de registro se encargará de
            // guardar el perfil y cerrar la sesión en el orden correcto.
            // Si hacemos signOut() aquí, competimos con ese flujo y el
            // set() de la base de datos puede fallar con PERMISSION_DENIED.
            if (registroEnProgreso) {
                console.log("Usuario recién creado, registro en curso. El listener global no interviene.");
                return;
            }

            console.log("Usuario detectado pero NO está verificado. Forzando cierre de sesión.");
            
            // Forzamos el cierre de sesión en segundo plano para que no pre-loguee en la UI
            await signOut(auth);
            mostrarInterfazInvitado();
        }
    } else {
        console.log("No hay ninguna sesión activa.");
        mostrarInterfazInvitado();
    }
});

function mostrarInterfazInvitado() {
    // Coloca aquí los cambios visuales para cuando NO hay nadie logueado de verdad
}


// ==========================================
// 2. LÓGICA DE REGISTRO CON ENVÍO DE TOKEN A VERCEL
// ==========================================
const btnRegister = document.getElementById("btnRegister");

if (btnRegister) {
    btnRegister.addEventListener("click", async (e) => {
        e.preventDefault();

        // --- Capturar los valores del formulario ---
        const nameInput = document.getElementById("registerName").value.trim();
        const emailInput = document.getElementById("registerEmail").value.trim();
        const passwordInput = document.getElementById("registerPassword").value;
        const edadInput = document.getElementById("registerEdad").value;

        // Perfil de Viajero
        const estiloInput = document.getElementById("registerEstilo").value;
        const presupuestoInput = document.getElementById("registerPresupuesto").value;
        const transporteInput = document.getElementById("registerTransporte").value;
        const alojamientoInput = document.getElementById("registerAlojamiento").value;
        const duracionInput = document.getElementById("registerDuracion").value;
        const destinosInput = document.getElementById("registerDestinos").value.trim();

        // Intereses principales (Checkboxes)
        const interesesSeleccionados = [];
        document.querySelectorAll('.interes-chk:checked').forEach((checkbox) => {
            interesesSeleccionados.push(checkbox.value);
        });

        // --- Validaciones ---
        if (!nameInput || !emailInput || !passwordInput || !edadInput) {
            alert("Por favor, completa todos los campos de la sección 'Datos de la Cuenta'.");
            return;
        }

        // VALIDACIÓN DE CONTRASEÑA: Estrictamente mayor a 8 caracteres
        if (passwordInput.length <= 8) {
            alert("La contraseña debe ser estrictamente mayor a 8 caracteres.");
            return;
        }

        registroEnProgreso = true;

        try {
            // --- Paso A: Crear el usuario en Firebase Authentication ---
            const userCredential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
            const user = userCredential.user;

            // --- Paso B: Configurar redirección hacia tu link de Vercel ---
            const actionCodeSettings = {
                url: 'https://book-go-ecru.vercel.app/?action=login',
                handleCodeInApp: true
            };

            // Enviar el correo de verificación
            await sendEmailVerification(user, actionCodeSettings);

            // --- Paso C: Guardar perfil completo en Firebase Realtime Database ---
            const nuevoUsuarioData = {
                id: user.uid,
                nombre: nameInput,
                correo: emailInput,
                edad: parseInt(edadInput),
                // Rol por defecto para todo usuario nuevo. Nunca se debe
                // permitir que el propio formulario de registro asigne
                // rol "admin"; eso se cambia manualmente en la consola
                // de Firebase o desde un panel de administración aparte.
                rol: "cliente",
                perfilViajero: {
                    estilo: estiloInput,
                    presupuesto: presupuestoInput,
                    transporte: transporteInput,
                    alojamiento: alojamientoInput,
                    duracion: duracionInput,
                    intereses: interesesSeleccionados,
                    destinosFavoritos: destinosInput
                },
                fechaRegistro: new Date().toISOString(),
                emailVerificado: false
            };

            // Guardamos usando el UID único asignado por Firebase
            await set(ref(db, 'usuarios/' + user.uid), nuevoUsuarioData);

            alert(`¡Registro exitoso! Se ha enviado un correo de verificación a ${emailInput}. Por favor, confirma tu cuenta para poder ingresar.`);

            // --- Paso D: Forzar el cierre inmediato para evitar que se vea logueado por detrás ---
            await signOut(auth);
            registroEnProgreso = false;

            // --- Paso E: Limpieza completa del formulario ---
            document.getElementById("registerName").value = "";
            document.getElementById("registerEmail").value = "";
            document.getElementById("registerPassword").value = "";
            document.getElementById("registerEdad").value = "";
            document.getElementById("registerDestinos").value = "";
            document.querySelectorAll('.interes-chk').forEach(chk => chk.checked = false);

            // --- Paso F: Cambiar visualmente al tab de Inicio de Sesión ---
            const loginTabButton = document.getElementById('login-tab');
            if (loginTabButton) {
                loginTabButton.click();
            }

        } catch (error) {
            registroEnProgreso = false;
            console.error("Error durante el registro de usuario:", error);
            let msg = "Hubo un error al intentar registrar al usuario.";
            if (error.code === 'auth/email-already-in-use') {
                msg = "Este correo electrónico ya se encuentra registrado.";
            }
            alert(msg + "\nDetalles: " + error.message);
        }
    });
}


// ==========================================
// 3. LÓGICA DE AUTENTICACIÓN CON GOOGLE
// ==========================================
const btnGoogle = document.getElementById("btn-google");

if (btnGoogle) {
    btnGoogle.addEventListener("click", async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            const usuarioRef = ref(db, 'usuarios/' + user.uid);
            const snapshot = await get(usuarioRef);

            if (snapshot.exists()) {
                console.log("Usuario autorizado en la base de datos.");
                window.location.reload();
            } else {
                alert("Esta cuenta de Google no está registrada en la base de datos de la plataforma. Regístrate primero.");
                
                await signOut(auth);
                window.location.hash = "register-pane";
                window.location.reload();
            }

        } catch (error) {
            console.error("Error en la autenticación con Google:", error.message);
        }
    });
}


// ==========================================
// 4. DETECTAR RETORNO DESDE EL ENLACE DE VERCEL
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'login') {
        
        // Limpiamos los parámetros '?action=login' de la URL para dejarla limpia
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Simular clic en la pestaña "Iniciar Sesión"
        const loginTab = document.getElementById('login-tab');
        if (loginTab) {
            loginTab.click();
        }

        // Forzar la apertura del Modal si se encuentra cerrado
        const loginModalElement = document.getElementById('loginModal');
        if (loginModalElement) {
            const modal = new bootstrap.Modal(loginModalElement);
            modal.show();
        }
    }
});