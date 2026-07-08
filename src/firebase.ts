import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBSrKtWDxy-hTs7yhNn1ed7Mi6JKXmN_Zw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "yogotv-web.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "yogotv-web",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "yogotv-web.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1006166966577",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1006166966577:web:3d813140d9b9a7b696f010",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DX8X9F9ECD",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
