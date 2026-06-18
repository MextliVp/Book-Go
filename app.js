import { auth, provider, signInWithPopup } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const btnGoogle = document.getElementById("btn-google");

if (btnGoogle) {
    btnGoogle.addEventListener("click", async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const db = getDatabase();
            
            const usuarioRef = ref(db, 'usuarios/' + user.uid);
            
            const snapshot = await get(usuarioRef);

            if (snapshot.exists()) {
                console.log("Usuario autorizado en la base de datos.");
                window.location.reload();
            } else {
                alert("Esta cuenta de Google no está registrada en la base de datos de la plataforma. Regístrate primero.");
                
                await signOut(auth);
                //cambialo pór la ruta real
                window.location.hash = "register-pane";
                window.location.reload();
            }

        } catch (error) {
            console.error("Error en la autenticación con Google:", error.message);
        }
    });
    const btnRegister = document.getElementById("btnRegister"); // ID de tu botón de registro

if (btnRegister) {
    btnRegister.addEventListener("click", async (e) => {
        e.preventDefault();

        // 1. Capturar los valores del formulario de registro
        const nameInput = document.getElementById("registerName").value.trim();
        const emailInput = document.getElementById("registerEmail").value.trim();
        const passwordInput = document.getElementById("registerPassword").value;

        // Validación de campos vacíos
        if (!nameInput || !emailInput || !passwordInput) {
            alert("Por favor, completa todos los campos para registrarte.");
            return;
        }

        try {
            // 2. Crear una referencia con ID único en el nodo 'usuarios'
            const nuevoUsuarioRef = push(ref(db, 'usuarios'));
            const idUsuarioKey = nuevoUsuarioRef.key;

            // 3. Estructurar el objeto del usuario
            const nuevoUsuarioData = {
                id: idUsuarioKey,
                nombre: nameInput,
                correo: emailInput,
                contrasena: passwordInput,
                fechaRegistro: new Date().toISOString(),
                ultimoInicioSesion: ""
            };

            // 4. Guardar directamente el usuario en Firebase
            await set(nuevoUsuarioRef, nuevoUsuarioData);

            alert(`¡Usuario ${nameInput} registrado con éxito!`);

            // 5. Limpiar los campos del formulario para que quede vacío
            document.getElementById("registerName").value = "";
            document.getElementById("registerEmail").value = "";
            document.getElementById("registerPassword").value = "";

            // 6. Opcional: Si está dentro de un modal, cerrarlo tras registrar
            const modalElement = document.getElementById('tuModalRegistroId');
            if (modalElement) {
                const modalInstancia = bootstrap.Modal.getInstance(modalElement);
                if (modalInstancia) modalInstancia.hide();
            }

        } catch (error) {
            console.error("Error durante el registro de usuario:", error);
            alert("Hubo un error al intentar registrar al usuario: " + error.message);
        }
    });
}
}