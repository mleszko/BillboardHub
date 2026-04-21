"use client";

import { useMemo, useState } from "react";

import { appConfig } from "@/lib/config";
import type {
  ContractCustomColumn,
  ContractCustomColumnCreatePayload,
  ContractCustomColumnCreateResponse,
  ContractRow,
} from "@/lib/types";

type ContractsTableProps = {
  contracts: ContractRow[];
  customColumns: ContractCustomColumn[];
};

export function ContractsTable({ contracts, customColumns }: ContractsTableProps) {
  const [name, setName] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [outputType, setOutputType] = useState<"text" | "number">("text");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasRows = contracts.length > 0;
  const dynamicColumns = useMemo(() => customColumns.filter((column) => column.is_active), [customColumns]);

  async function handleCreateColumn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (!name.trim() || !promptTemplate.trim()) {
      setErrorMessage("Name and prompt are required.");
      return;
    }
    setIsSubmitting(true);
    const payload: ContractCustomColumnCreatePayload = {
      owner_user_id: "demo-user-1",
      name: name.trim(),
      prompt_template: promptTemplate.trim(),
      output_type: outputType,
    };
    try {
      const response = await fetch(`${appConfig.backendUrl}/contracts/custom-columns`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dev-user-id": "demo-user-1",
          "x-dev-user-email": "demo@billboardhub.local",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setErrorMessage("Failed to create custom column.");
        return;
      }
      await response.json() as ContractCustomColumnCreateResponse;
      setName("");
      setPromptTemplate("");
      setOutputType("text");
      window.location.reload();
    } catch {
      setErrorMessage("Failed to create custom column.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!contracts.length) {
    return (
      <div className="space-y-4">
        <form onSubmit={handleCreateColumn} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-600">Column name</span>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Distance to central station"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-600">Output type</span>
              <select
                className="rounded-md border border-zinc-300 px-3 py-2"
                value={outputType}
                onChange={(event) => setOutputType(event.target.value as "text" | "number")}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 md:col-span-1">
              <span className="text-xs text-zinc-600">Prompt</span>
              <input
                className="rounded-md border border-zinc-300 px-3 py-2"
                value={promptTemplate}
                onChange={(event) => setPromptTemplate(event.target.value)}
                placeholder="Score showing how many people see this billboard"
              />
            </label>
          </div>
          {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Add LLM column"}
            </button>
          </div>
        </form>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No contracts yet. Import an Excel file in Auth Mode to get started.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreateColumn} className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600">Column name</span>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Distance to central station"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600">Output type</span>
            <select
              className="rounded-md border border-zinc-300 px-3 py-2"
              value={outputType}
              onChange={(event) => setOutputType(event.target.value as "text" | "number")}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-xs text-zinc-600">Prompt</span>
            <input
              className="rounded-md border border-zinc-300 px-3 py-2"
              value={promptTemplate}
              onChange={(event) => setPromptTemplate(event.target.value)}
              placeholder="Score showing how many people see this billboard"
            />
          </label>
        </div>
        {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Add LLM column"}
          </button>
        </div>
      </form>

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
              {dynamicColumns.map((column) => (
                <th key={column.id} className="px-4 py-3 font-medium">
                  {column.name}
                </th>
              ))}
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
                {dynamicColumns.map((column) => {
                  const value = contract.custom_values[column.id];
                  if (!value) {
                    return (
                      <td key={`${contract.id}-${column.id}`} className="px-4 py-3 text-zinc-400">
                        pending
                      </td>
                    );
                  }
                  if (value.status === "failed") {
                    return (
                      <td key={`${contract.id}-${column.id}`} className="px-4 py-3 text-red-600">
                        failed
                      </td>
                    );
                  }
                  if (column.output_type === "number") {
                    return (
                      <td key={`${contract.id}-${column.id}`} className="px-4 py-3">
                        {value.value_number ?? "—"}
                      </td>
                    );
                  }
                  return (
                    <td key={`${contract.id}-${column.id}`} className="px-4 py-3">
                      {value.value_text ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
