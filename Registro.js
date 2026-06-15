// --- LÓGICA DE INICIO DE SESIÓN ---
    const btnLogin = document.getElementById("btnLogin");

    if (btnLogin) {
        btnLogin.addEventListener("click", async (e) => {
            e.preventDefault();

            // 1. Capturar los valores de inicio de sesión (Asegúrate de que estos IDs existan en tu HTML de Login)
            const emailInput = document.getElementById("loginEmail").value.trim();
            const passwordInput = document.getElementById("loginPassword").value;

            // Validación de campos vacíos
            if (!emailInput || !passwordInput) {
                alert("Por favor, introduce tu correo y contraseña.");
                return;
            }

            try {
                // 2. Traer todos los usuarios de la base de datos para buscar coincidencias
                const usuariosRef = ref(db, 'usuarios');
                const snapshot = await get(usuariosRef);

                if (snapshot.exists()) {
                    const usuariosData = snapshot.val();
                    let usuarioEncontrado = null;
                    let idUsuarioKey = null;

                    // 3. Iterar sobre los usuarios para encontrar el correo y validar contraseña
                    for (const key in usuariosData) {
                        if (usuariosData[key].correo === emailInput) {
                            usuarioEncontrado = usuariosData[key];
                            idUsuarioKey = key;
                            break;
                        }
                    }

                    // 4. Validar si el usuario existe y si la contraseña coincide
                    if (usuarioEncontrado && usuarioEncontrado.contrasena === passwordInput) {
                        
                        // 5. Actualizar la fecha del último inicio de sesión en Firebase
                        const timestampActual = new Date().toISOString();
                        await set(ref(db, 'usuarios/' + idUsuarioKey + '/ultimoInicioSesion'), timestampActual);

                        alert(`¡Bienvenido de nuevo, ${usuarioEncontrado.nombre}!`);
                        
                        // Guardar datos en sessionStorage para mantener la sesión activa en el navegador
                        sessionStorage.setItem("usuarioLogueado", JSON.stringify(usuarioEncontrado));

                        // 6. Redirección o cierre de modal tras loguearse con éxito
                        // Redirigir a tu página principal o dashboard:
                        // window.location.href = "dashboard.html"; 
                        
                        // O si está en un modal, cerrarlo:
                        const modalElement = document.getElementById('tuModalId');
                        if (modalElement) {
                            const modalInstancia = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstancia) modalInstancia.hide();
                        }

                    } else {
                        alert("Correo electrónico o contraseña incorrectos.");
                    }
                } else {
                    alert("No existen usuarios registrados en la base de datos.");
                }

            } catch (error) {
                console.error("Error durante el inicio de sesión:", error);
                alert("Hubo un error al intentar iniciar sesión: " + error.message);
            }
        });
    }