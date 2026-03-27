import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale service worker caches on load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(r => r.update());
  });
}

createRoot(document.getElementById("root")!).render(<App />);
