import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import { lazy, Suspense, type ComponentType } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const ChatApp = lazy(() => import("./pages/ChatApp"));
const Home = lazy(() => import("./pages/Home"));
const ProductivityReport = lazy(() => import("./pages/ProductivityReport"));
const PerformanceDashboard = lazy(() => import("./pages/PerformanceDashboard"));
const CleanupNames = lazy(() =>
  import("./pages/CleanupNames").then((m) => ({ default: m.CleanupNames }))
);
const NotFound = lazy(() => import("./pages/NotFound"));

function LazyRoute({
 component: Component,
}: {
  component: ComponentType<any>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-teal-200 border-t-teal-700" />
            Carregando…
          </div>
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/dashboard">
        <LazyRoute component={PerformanceDashboard} />
      </Route>
      <Route path="/report">
        <LazyRoute component={ProductivityReport} />
      </Route>
      <Route path="/cleanup">
        <LazyRoute component={CleanupNames} />
      </Route>
      <Route path="/chat">
        <LazyRoute component={ChatApp} />
      </Route>
      <Route path="/home">
        <LazyRoute component={Home} />
      </Route>
      <Route path="/404">
        <LazyRoute component={NotFound} />
      </Route>
      <Route path="/">
        <LazyRoute component={ChatApp} />
      </Route>
      <Route>
        <LazyRoute component={NotFound} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
