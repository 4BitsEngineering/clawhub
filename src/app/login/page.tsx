import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function loginAction(formData: FormData) {
  "use server";
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return;
  await signIn("nodemailer", { email, redirectTo: "/" });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params?.sent === "1";

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceder a clawhub</CardTitle>
          <CardDescription>
            Introduce tu email. Te enviaremos un magic link (en dev, aparece
            en la consola del server donde corre <code>npm run dev</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>✔ Magic link generado.</p>
              <p>
                Mira la consola del server (terminal donde está
                <code> npm run dev</code>). Verás un bloque con la URL.
                Cópiala y ábrela en este navegador.
              </p>
            </div>
          ) : (
            <form action={loginAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                />
              </div>
              <Button type="submit" className="w-full">
                Enviar magic link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
