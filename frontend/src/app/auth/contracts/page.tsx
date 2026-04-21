import { ContractsTable } from "@/components/contracts-table";
import { ModeBadge } from "@/components/mode-badge";
import { appConfig } from "@/lib/config";
import type { ContractRow, ContractCustomColumn, ContractsListResponse } from "@/lib/types";

async function fetchContracts(): Promise<{ items: ContractRow[]; custom_columns: ContractCustomColumn[] }> {
  try {
    const response = await fetch(`${appConfig.backendUrl}/contracts`, {
      headers: {
        "x-dev-user-id": "demo-user-1",
        "x-dev-user-email": "demo@billboardhub.local",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return { items: [], custom_columns: [] };
    }
    const data = (await response.json()) as ContractsListResponse;
    return data;
  } catch {
    return { items: [], custom_columns: [] };
  }
}

export default async function AuthContractsPage() {
  const data = await fetchContracts();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted">
            Ascetic and stable contract tracking. Auth Mode is default.
          </p>
        </div>
        <ModeBadge mode="auth" />
      </header>

      <ContractsTable contracts={data.items} customColumns={data.custom_columns} />
    </main>
  );
}
