
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyCVbdgi2m_hgXEOfssbh9e2uOEqE_DrE2Q",
  authDomain: "vidamais-7d95d.firebaseapp.com",
  projectId: "vidamais-7d95d",
  storageBucket: "vidamais-7d95d.firebasestorage.app",
  messagingSenderId: "794947986054",
  appId: "1:794947986054:web:5a1bec5bac9ba16b4ee707",
  measurementId: "G-L7VRY7T4BG"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
