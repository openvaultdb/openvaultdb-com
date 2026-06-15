// Firebase initialization (build-less, modular SDK from the CDN).
// The web apiKey is not a secret — Firebase access is governed by Auth + rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAabfgXuWV9QyLaigMjOQqHlMzqpoNNhzQ",
  authDomain: "openvaultdb.firebaseapp.com",
  projectId: "openvaultdb",
  storageBucket: "openvaultdb.firebasestorage.app",
  messagingSenderId: "323159488879",
  appId: "1:323159488879:web:6410a6a14fe2633505909a",
  measurementId: "G-8ETBR31CW2",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Analytics is best-effort: only initialize where the environment supports it.
isSupported()
  .then((ok) => { if (ok) getAnalytics(app); })
  .catch(() => {});
