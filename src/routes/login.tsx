import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/logo";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";
import { firstAllowedAppPath } from "@/lib/auth/menu-access";
import { getAuthSessionFn, loginFn } from "@/lib/auth/auth.server";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn();
    if (session) {
      throw redirect({ to: firstAllowedAppPath(session) });
    }
  },
  head: () => ({
    meta: [
      { title: "Entrar — Sinal Verde CRM" },
      { name: "description", content: "Acesse o CRM Sinal Verde." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginFn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid min-h-screen lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-login-brand text-primary-foreground p-10">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 size-[420px] rounded-full bg-accent/20 blur-3xl" />
        </div>
        <div className="relative z-10">
          <Logo size="xl-login" />
        </div>
        <div className="relative z-10 max-w-md space-y-6">
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">
            O CRM que <span className="text-accent">acelera</span> sua operação comercial.
          </h2>
          <p className="text-primary-foreground/80">
            Pipeline de propostas, agenda de contatos, follow-up e atendimento
            centralizado em um só lugar.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-accent">
                <Zap className="size-4" />
              </span>
              Operação 3× mais rápida com Kanban inteligente
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-accent">
                <Sparkles className="size-4" />
              </span>
              Agenda e follow-up organizados por prioridade
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-accent/20 text-accent">
                <ShieldCheck className="size-4" />
              </span>
              Documentos e dados sensíveis sob controle
            </li>
          </ul>
        </div>
        <div className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Sinal Verde — Todos os direitos reservados.
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size="lg-login" />
          </div>
          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse seu painel para gerenciar leads, propostas e clientes.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              const form = e.currentTarget;
              const email = (form.elements.namedItem("email") as HTMLInputElement).value;
              const password = (form.elements.namedItem("senha") as HTMLInputElement).value;

              try {
                const session = await login({ data: { email, password } });
                await navigate({ to: firstAllowedAppPath(session) });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Não foi possível entrar.");
              } finally {
                setLoading(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="mozart@sinalverde.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">Senha</Label>
                <a href="#" className="text-xs font-medium text-primary hover:underline">
                  Esqueci minha senha
                </a>
              </div>
              <Input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="remember" defaultChecked />
              <Label htmlFor="remember" className="text-sm font-normal">
                Manter-me conectado
              </Label>
            </div>
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-soft"
            >
              {loading ? "Entrando…" : "Entrar"} <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            Ao continuar você concorda com os Termos de Uso e Política de Privacidade.
          </div>
        </div>
      </div>
    </div>
  );
}
