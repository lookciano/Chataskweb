import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { KeyRound, Mail, Lock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "wouter";

export default function FirstAccessPage() {
  const { firstAccess, loading, error } = useAuth();
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim()) { setLocalError("Informe seu email"); return; }
    if (!password) { setLocalError("Informe uma senha"); return; }
    if (password.length < 6) { setLocalError("A senha deve ter no mínimo 6 caracteres"); return; }
    if (password !== confirmPassword) { setLocalError("As senhas não conferem"); return; }

    try {
      await firstAccess(email, password);
      setSuccess(true);
      setTimeout(() => setLocation("/"), 1500);
    } catch (err: any) {
      setLocalError(err?.message || "Erro ao definir senha");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 shadow-lg border-slate-200 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Senha definida com sucesso!</h1>
          <p className="mt-2 text-sm text-slate-500">Redirecionando para o chat...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg border-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Primeiro Acesso</h1>
          <p className="mt-1 text-sm text-slate-500">Seu email já está cadastrado. Defina uma senha para continuar.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="first-access-email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="first-access-email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" autoFocus />
            </div>
          </div>
          <div>
            <label htmlFor="first-access-password" className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="first-access-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
            </div>
          </div>
          <div>
            <label htmlFor="first-access-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input id="first-access-confirm-password" type="password" placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" />
            </div>
          </div>

          {(localError || error) && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{localError || (error instanceof Error ? error.message : "Erro desconhecido")}</span>
            </div>
          )}

          <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={loading}>
            {loading ? "Definindo senha..." : "Definir Senha"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            Já tem senha?{" "}
            <Link href="/login" className="font-medium text-teal-600 hover:text-teal-700">Fazer login</Link>
          </p>
        </div>
      </Card>
    </div>
  );
}