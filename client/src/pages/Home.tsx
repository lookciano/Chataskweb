import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Chat Task</h1>
      <p className="text-slate-600 text-sm">
        {isAuthenticated
          ? `Olá, ${user?.displayName || user?.name || "usuário"}`
          : "Selecione sua identidade para continuar"}
      </p>
      <Button asChild className="bg-teal-600 hover:bg-teal-700">
        <Link href="/">Ir para o chat</Link>
      </Button>
    </div>
  );
}
