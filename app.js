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
}