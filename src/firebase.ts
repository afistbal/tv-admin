/**
 * 与 slot_old `src/firebase.tsx` 同源配置，供 Web Google 弹窗登录 → `POST login/uid`。
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBSrKtWDxy-hTs7yhNn1ed7Mi6JKXmN_Zw",
  authDomain: "yogotv-web.firebaseapp.com",
  projectId: "yogotv-web",
  storageBucket: "yogotv-web.firebasestorage.app",
  messagingSenderId: "1006166966577",
  appId: "1:1006166966577:web:3d813140d9b9a7b696f010",
  measurementId: "G-DX8X9F9ECD",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
