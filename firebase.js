import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBYOKCEgBwrKV02kiFTGZLtWOxO9ozzSso",
  authDomain: "bookandgo-ad08d.firebaseapp.com",
  databaseURL: "https://bookandgo-ad08d-default-rtdb.firebaseio.com",
  projectId: "bookandgo-ad08d",
  storageBucket: "bookandgo-ad08d.firebasestorage.app",
  messagingSenderId: "77281936771",
  appId: "1:77281936771:web:5fdf584737cf2ea3ad8570",
  measurementId: "G-NZKR4SKYC6"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const database = getDatabase(app);
export const provider = new GoogleAuthProvider();
export { signInWithPopup };