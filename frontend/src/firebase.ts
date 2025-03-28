// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTwQvhGe79W3Lx3WGfGe0it8yyghVnWXc",
  authDomain: "retro-app-a95ca.firebaseapp.com",
  projectId: "retro-app-a95ca",
  storageBucket: "retro-app-a95ca.firebasestorage.app",
  messagingSenderId: "9788879482",
  appId: "1:9788879482:web:6ada9a09c50149baa701c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Add Firestore

export { db };
