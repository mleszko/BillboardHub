import { ImportWizard } from "@/components/import-wizard";

export default function AuthImportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">AI Excel Wizard</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Upload .csv or .xlsx, review AI mapping, and confirm before any DB write happens.
        </p>
      </div>

      <ImportWizard />
    </main>
  );
}
