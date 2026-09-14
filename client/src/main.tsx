import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Endereço público do backend (Render). Nunca deve ser relativo dentro de um
// WebView nativo (iOS/Android), porque ali não existe uma origem HTTP válida.
const BACKEND_URL = "https://chataskweb.onrender.com";

// Detecta se estamos rodando dentro do runtime nativo do Capacitor.
// Usa primeiro a API oficial; se o bridge não estiver exposto, usa a
// heurística de esquema/host, que é segura porque um host production web
// nunca é "localhost" e nunca usa o esquema "capacitor://".
function isNativeRuntime(win = window): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    // segue à heurística
  }

  try {
    const protocol = win.location?.protocol || "";
    const hostname = win.location?.hostname || "";
    return (
      protocol.startsWith("capacitor:") ||
      hostname === "localhost" ||
      hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

const isNativeRuntimeActive = isNativeRuntime();

// URL do backend: absoluta dentro do Capacitor, relativa apenas no navegador.
const trpcUrl = isNativeRuntimeActive
  ? `${BACKEND_URL}/api/trpc`
  : "/api/trpc";

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);