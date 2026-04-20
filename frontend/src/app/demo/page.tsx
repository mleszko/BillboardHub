import { HubertWidget } from "@/components/hubert-widget";

export default function DemoPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-gradient-to-r from-indigo-500 to-fuchsia-500 p-6 text-white">
        <h1 className="text-3xl font-semibold tracking-tight">Demo Mode: Wodotryski</h1>
        <p className="max-w-3xl text-sm text-indigo-100">
          Ta przestrzen jest odseparowana od stabilnego Auth Mode. Tutaj uruchamiamy
          Hubert AI, mapy i mockupy Street View bez ryzyka dla produkcyjnego workflow.
        </p>
      </section>
      <HubertWidget accessToken="" />
    </main>
  );
}
