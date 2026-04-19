"use client";

import { useState } from "react";

import type { HubertChatResponse } from "@/lib/types";

type HubertWidgetProps = {
  accessToken?: string;
};

export function HubertWidget({ accessToken }: HubertWidgetProps) {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [reply, setReply] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      } else {
        headers["x-dev-user-id"] = "demo-user-1";
        headers["x-dev-user-email"] = "demo@billboardhub.local";
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/hubert/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message,
          conversation_id: conversationId,
          mode: "demo",
        }),
      });

      if (!response.ok) {
        throw new Error("Hubert request failed.");
      }
      const data: HubertChatResponse = await response.json();
      setReply(data.response);
      setConversationId(data.conversation_id ?? null);
      setMessage("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown Hubert error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-100 p-4">
      <h3 className="text-lg font-semibold text-cyan-900">Hubert Advisor (Demo)</h3>
      <p className="mt-1 text-sm text-cyan-900/80">
        Rozmawiaj tylko o billboardach, ROI i strategii lokalizacji. Hubert motywuje jak prawdziwy mistrz!
      </p>
      <textarea
        className="mt-4 w-full rounded-md border border-cyan-200 bg-white p-2 text-sm"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Np. Czy lokalizacja przy obwodnicy ma lepszy ROI niz centrum?"
      />
      <button
        className="mt-3 rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-600 disabled:opacity-60"
        type="button"
        onClick={sendMessage}
        disabled={loading}
      >
        {loading ? "Hubert mysli..." : "Zapytaj Huberta"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {reply ? (
        <div className="mt-3 rounded-md border border-cyan-200 bg-white p-3 text-sm text-zinc-800">
          <span className="font-semibold text-cyan-800">Hubert:</span> {reply}
        </div>
      ) : null}
    </section>
  );
}
