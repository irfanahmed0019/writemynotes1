import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Detect preview/iframe environments and unregister stale SWs
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if ('serviceWorker' in navigator) {
  if (isPreviewHost || isInIframe) {
    // In preview: unregister all SWs to avoid stale cache
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
    // Also clear caches
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  } else {
    // In production: force SW update check
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.update());
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
