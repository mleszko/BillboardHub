"use client";

import type { ContractRow } from "@/lib/types";

type ContractsTableProps = {
  contracts: ContractRow[];
};

export function ContractsTable({ contracts }: ContractsTableProps) {
  if (!contracts.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        No contracts yet. Import an Excel file in Auth Mode to get started.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-700">
          <tr>
            <th className="px-4 py-3 font-medium">Contract</th>
            <th className="px-4 py-3 font-medium">Advertiser</th>
            <th className="px-4 py-3 font-medium">City</th>
            <th className="px-4 py-3 font-medium">Expiry</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Monthly Net</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((contract) => (
            <tr key={contract.id} className="border-t border-zinc-100">
              <td className="px-4 py-3">{contract.contract_number ?? "—"}</td>
              <td className="px-4 py-3">{contract.advertiser_name}</td>
              <td className="px-4 py-3">{contract.city ?? "—"}</td>
              <td className="px-4 py-3">{contract.expiry_date}</td>
              <td className="px-4 py-3 capitalize">{contract.contract_status.replaceAll("_", " ")}</td>
              <td className="px-4 py-3">
                {contract.monthly_rent_net !== null ? `${contract.monthly_rent_net.toFixed(2)} PLN` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function fetchContracts(): Promise<ContractRow[]> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
  try {
    const response = await fetch(`${backendUrl}/contracts`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-dev-user-id": "demo-user-1",
        "x-dev-user-email": "demo@billboardhub.local",
      },
    });
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as { items: ContractRow[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}
