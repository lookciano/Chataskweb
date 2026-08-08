import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function LoginPage() {
  const { login, loading, error } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) {
      setLocalError("Informe seu email");
      return;
    }
    if (!password) {
      setLocalError("Informe sua senha");
      return;
    }

    try {
      await login(email, password);
      setLocation("/");
    } catch (err: any) {
      const message = err?.message || "Erro ao fazer login";
      if (message === "PRIMEIRO_ACESSO") {
        setLocation(`/first-access?email=${encodeURIComponent(email)}`);
        return;
      }
      setLocalError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg border-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
            <LogIn className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Chat Task</h1>
          <p className="mt-1 text-sm text-slate-500">Entre com sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" autoFocus />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input type="password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
            </div>
          </div>

          {(localError || error) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{localError || (error instanceof Error ? error.message : "Erro desconhecido")}</span>
            </div>
          )}

          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            Não tem conta?{" "}
            <Link href="/register" className="font-medium text-teal-600 hover:text-teal-700">Criar conta</Link>
          </p>
          <p className="mt-2">
            <Link href="/first-access" className="font-medium text-teal-600 hover:text-teal-700">Primeiro acesso? Defina sua senha</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}