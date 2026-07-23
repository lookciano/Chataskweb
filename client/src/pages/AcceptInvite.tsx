import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * Public invite acceptance — person can join ONE room via token link.
 * Does not grant access to other rooms.
 */
export default function AcceptInvite() {
  const [, params] = useRoute("/convite/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const previewQuery = trpc.chat.invitePreview.useQuery(
    { token },
    { enabled: token.length >= 8, retry: false }
  );

  const acceptMutation = trpc.chat.acceptInvite.useMutation({
    onSuccess: async (result) => {
      utils.auth.me.setData(undefined, result.user);
      await utils.auth.me.invalidate();
      await utils.auth.listIdentities.invalidate();
      await utils.chat.rooms.invalidate();
      toast.success(
        result.alreadyMember
          ? `Você já participa de “${result.roomName}”`
          : `Bem-vindo à sala “${result.roomName}”`
      );
      setLocation("/chat");
    },
    onError: (err) => {
      toast.error(err.message || "Não foi possível aceitar o convite");
    },
  });

  const preview = previewQuery.data;
  const title = useMemo(() => {
    if (previewQuery.isLoading) return "Carregando convite…";
    if (previewQuery.error) return "Convite inválido";
    if (preview?.expired) return "Convite expirado";
    return preview?.roomName ? `Convite: ${preview.roomName}` : "Convite para sala";
  }, [preview, previewQuery.error, previewQuery.isLoading]);

  const canSubmit =
    Boolean(token) &&
    Boolean(preview?.valid) &&
    displayName.trim().length > 0 &&
    email.trim().length > 3 &&
    email.includes("@") &&
    !acceptMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 shadow-md border-slate-200">
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700 mb-1">
            ChaTask
          </p>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {preview?.valid && (
            <p className="text-sm text-slate-600 mt-2">
              Você entrará <span className="font-medium">somente</span> nesta sala. Outras salas
              continuam restritas.
            </p>
          )}
          {preview?.expiresAt && preview.valid && (
            <p className="text-xs text-slate-500 mt-1">
              Válido até{" "}
              {new Date(preview.expiresAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {previewQuery.isLoading && (
          <div className="py-8 text-center text-slate-500 text-sm">Verificando convite…</div>
        )}

        {(previewQuery.error || preview?.expired) && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {preview?.expired
                ? "Este link expirou. Peça um novo convite ao administrador da sala."
                : "Link inválido ou já revogado."}
            </div>
            <Button
              variant="outline"
              className="w-full border-slate-200"
              onClick={() => setLocation("/")}
            >
              Ir ao app
            </Button>
          </div>
        )}

        {preview?.valid && (
          <div className="space-y-4">
            {user && user.role !== "admin" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Você já está como{" "}
                <span className="font-medium text-slate-900">
                  {user.displayName || user.name}
                </span>
                . Ao aceitar, essa identidade entra na sala.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Seu nome no chat
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex.: Maria Silva"
                className="w-full"
                disabled={Boolean(user && user.role !== "admin")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                E-mail da conta
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
                className="w-full"
                disabled={Boolean(user?.email && user.role !== "admin")}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Cadastro da plataforma: nome + e-mail. Se o e-mail já existir, reutilizamos a mesma conta.
              </p>
            </div>
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-none"
              disabled={!canSubmit}
              onClick={() => {
                const cleanEmail = email.trim();
                const cleanName = displayName.trim();
                if (!token || !cleanEmail || !cleanName) return;
                acceptMutation.mutate({
                  token,
                  displayName: cleanName,
                  email: cleanEmail,
                });
              }}
            >
              {acceptMutation.isPending ? "Entrando…" : "Aceitar convite e entrar"}
            </Button>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              Ao entrar, você só vê mensagens e tarefas desta sala.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
