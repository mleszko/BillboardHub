export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-400">BillboardHub</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Contract command center</h1>
        <p className="mt-3 max-w-2xl text-zinc-300">
          Production app path is now separated into two explicit experiences: stable Auth Mode
          and feature-rich Demo Mode.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <a href="/auth/contracts" className="panel">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Auth Mode</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Stable Contracts Dashboard</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Minimal, reliable contracts table optimized for daily operations.
          </p>
        </a>
        <a href="/demo" className="panel">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Demo Mode</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Hubert + Showcase Features</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Gamified advisory layer and high-impact demo surfaces.
          </p>
        </a>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <a href="/auth/import" className="panel">
          <h3 className="text-lg font-semibold text-white">AI Excel Import Wizard</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Upload CSV/XLSX, review AI mapping proposal, confirm, and import.
          </p>
        </a>
        <div className="panel">
          <h3 className="text-lg font-semibold text-white">Deployment Ready</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Frontend targets Vercel, backend targets Railway, DB/Auth on Supabase.
          </p>
        </div>
      </section>
    </main>
  );
}
