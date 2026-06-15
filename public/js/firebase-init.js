// Firebase initialization (build-less, modular SDK from the CDN).
// The web apiKey is not a secret — Firebase access is governed by Auth + rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-analytics.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, initializeFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

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

const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);

// On localhost the emulator works most reliably with long-polling (avoids the
// streaming-transport issues seen under headless Chromium / proxies).
export const db = onLocalhost
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : getFirestore(app);

// On localhost, talk to the Firebase emulators if they are running (e2e/dev).
// In production the hostname is never localhost, so this is a no-op there.
if (onLocalhost) {
  try {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  } catch {}
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  } catch {}
}

// Analytics is best-effort: only initialize where the environment supports it.
isSupported()
  .then((ok) => { if (ok) getAnalytics(app); })
  .catch(() => {});
