"use client";

import { useMemo, useState } from "react";

import { apiBaseUrl } from "@/lib/config";
import type {
  HeaderMappingSuggestion,
  ImportExecuteResponse,
  MappingConfirmationItem,
  MappingProposalResponse,
} from "@/lib/types";

type Step = "upload" | "review" | "result";

const DEV_USER_ID = "demo-user-1";
const DEV_USER_EMAIL = "demo@billboardhub.local";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<MappingProposalResponse | null>(null);
  const [mapping, setMapping] = useState<HeaderMappingSuggestion[]>([]);
  const [result, setResult] = useState<ImportExecuteResponse | null>(null);

  const requiredTargetsMissing = useMemo(() => {
    const selected = new Set(mapping.map((item) => item.target_field_name).filter(Boolean));
    return !selected.has("advertiser_name") || !selected.has("expiry_date");
  }, [mapping]);

  async function handleUpload(file: File) {
    setIsBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiBaseUrl}/imports/guess-mapping`, {
        method: "POST",
        headers: {
          "x-dev-user-id": DEV_USER_ID,
          "x-dev-user-email": DEV_USER_EMAIL,
        },
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to guess mapping.");
      }
      const data = (await response.json()) as MappingProposalResponse;
      setProposal(data);
      setMapping(data.mapping_suggestions);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirm() {
    if (!proposal) return;
    setIsBusy(true);
    setError(null);
    try {
      const payload: {
        session_id: string;
        owner_user_id: string;
        mapping: MappingConfirmationItem[];
      } = {
        session_id: proposal.session_id,
        owner_user_id: proposal.owner_user_id,
        mapping: mapping.map((item) => ({
          source_column_name: item.source_column_name,
          target_field_name: item.target_field_name,
          confirmed_by_user: true,
          user_override: true,
          transform_hint: item.transform_hint ?? null,
        })),
      };

      const response = await fetch(`${apiBaseUrl}/imports/confirm-mapping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-id": DEV_USER_ID,
          "x-dev-user-email": DEV_USER_EMAIL,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to execute import.");
      }
      const data = (await response.json()) as ImportExecuteResponse;
      setResult(data);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import confirmation failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">AI Excel Wizard</h2>
        <p className="text-sm text-slate-600">
          Upload CSV/XLSX, review GPT-4o mapping, then confirm before DB write.
        </p>
      </header>

      {step === "upload" && (
        <div className="space-y-4">
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">
            We send headers + first 2 rows to GPT-4o to infer mappings.
          </p>
        </div>
      )}

      {step === "review" && proposal && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Confirmation required:</strong> nothing is persisted to contracts until you confirm.
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Source column</th>
                  <th className="py-2 pr-4">Target field</th>
                  <th className="py-2 pr-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((item, index) => (
                  <tr key={item.source_column_name} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{item.source_column_name}</td>
                    <td className="py-2 pr-4">
                      <input
                        value={item.target_field_name ?? ""}
                        onChange={(event) => {
                          const next = [...mapping];
                          next[index] = { ...item, target_field_name: event.target.value || null };
                          setMapping(next);
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        placeholder="e.g. expiry_date"
                      />
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{Math.round(item.guessed_confidence * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            disabled={isBusy || requiredTargetsMissing}
            onClick={() => void handleConfirm()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isBusy ? "Importing..." : "Confirm mapping and import"}
          </button>
          {requiredTargetsMissing && (
            <p className="text-xs text-rose-600">You must map both advertiser_name and expiry_date.</p>
          )}
        </div>
      )}

      {step === "result" && result && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Total rows", value: result.total_rows },
            { label: "Valid rows", value: result.valid_rows },
            { label: "Invalid rows", value: result.invalid_rows },
            { label: "Imported rows", value: result.imported_rows },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="text-xl font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </section>
  );
}
