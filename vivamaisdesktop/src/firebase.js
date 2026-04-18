
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyBFtOo04r-9UyhcN8k6Rxr0HS7YDDTcOiY",
  authDomain: "projeto-vida-quest.firebaseapp.com",
  projectId: "projeto-vida-quest",
  storageBucket: "projeto-vida-quest.firebasestorage.app",
  messagingSenderId: "1038084876103",
  appId: "1:1038084876103:web:d1e93d76e50db3eba4ce62",
  measurementId: "G-83QNBRW51Z"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
