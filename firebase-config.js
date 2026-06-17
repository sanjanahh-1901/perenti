import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7FBluJ3ybc1FyB-3kzh5Gnf68aSR5sUM",
  authDomain: "perenti-app.firebaseapp.com",
  projectId: "perenti-app",
  storageBucket: "perenti-app.firebasestorage.app",
  messagingSenderId: "136634053807",
  appId: "1:136634053807:web:f31bb498a6feefa28d105a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
