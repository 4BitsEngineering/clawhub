export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">clawhub</h1>
        <p className="text-sm text-muted-foreground">
          Control plane multi-tenant para instancias de OpenClaw Copilot.
        </p>
        <p className="text-xs text-muted-foreground pt-8">
          v0 en construcción · ver <code>SPEC.md</code>
        </p>
      </div>
    </main>
  );
}
