import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Only register service worker in production — in dev the SW caches old JS
// and breaks Vite HMR, causing stale code to run in the browser.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// In dev: unregister any leftover SW so cached old code is flushed immediately.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
