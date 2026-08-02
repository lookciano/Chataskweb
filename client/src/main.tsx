import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// Detecta se está rodando dentro do Capacitor (Android/iOS WebView).
// Com androidScheme: 'https', o protocol é https: mas hostname é localhost.
// No navegador normal (Render), hostname é chataskweb.onrender.com.
const isCapacitor =
  typeof window !== "undefined" &&
  (window.location.protocol.startsWith("capacitor") ||
   window.location.hostname === "localhost");

// URL do backend — absoluta quando no Capacitor, relativa quando no navegador
const trpcUrl = isCapacitor
  ? "https://chataskweb.onrender.com/api/trpc"
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
