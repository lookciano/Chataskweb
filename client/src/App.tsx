import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ChatApp from "./pages/ChatApp";
import ProductivityReport from "./pages/ProductivityReport";
import PerformanceDashboard from "./pages/PerformanceDashboard";
import { CleanupNames } from "./pages/CleanupNames";


function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/dashboard" component={PerformanceDashboard} />
      <Route path="/report" component={ProductivityReport} />
      <Route path="/cleanup" component={CleanupNames} />
      <Route path="/chat" component={ChatApp} />
<Route path="/home" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route path="/" component={ChatApp} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
