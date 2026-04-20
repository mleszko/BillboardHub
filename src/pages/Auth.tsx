import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { endDemo, isDemoMode } from "@/lib/demo";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp, session, loading, authConfigured, refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || isDemoMode()) return;
    if (session) {
      void navigate({ to: "/app" });
    }
  }, [loading, session, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    endDemo();

    if (!authConfigured) {
      setFormError(
        "Brak konfiguracji Supabase po stronie frontu. Dodaj VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY do pliku .env w katalogu głównym projektu (obok VITE_BACKEND_URL).",
      );
      setIsSubmitting(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await signUp(email, password);
      if (error) {
        setFormError(error.message);
        setIsSubmitting(false);
        return;
      }
      toast.message("Konto utworzone", {
        description:
          "Jeśli w projekcie Supabase włączone jest potwierdzanie e-mail, sprawdź skrzynkę. Możesz się teraz zalogować.",
      });
      setMode("signin");
      setIsSubmitting(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }
    await refreshSession();
    await navigate({ to: "/app" });
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">
            {mode === "signin" ? "Logowanie" : "Rejestracja"}
          </CardTitle>
          <CardDescription>
            {mode === "signin"
              ? "Zaloguj się, aby korzystać z danych z backendu i importu Excel."
              : "Utwórz konto (Supabase Auth). Po rejestracji możesz się zalogować."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || loading}>
              {isSubmitting ? "Proszę czekać…" : mode === "signin" ? "Zaloguj" : "Załóż konto"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col gap-2 text-center text-sm text-muted-foreground">
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setFormError(null);
              }}
            >
              {mode === "signin" ? "Nie masz konta? Zarejestruj się" : "Masz konto? Zaloguj się"}
            </button>
            <Link to="/" className="text-primary underline-offset-4 hover:underline">
              Wróć na stronę główną
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
