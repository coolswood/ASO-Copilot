"use client";

import { useEffect, useState } from "react";

interface Status {
  connected: boolean;
  host: string | null;
  projectId: string | null;
  connectedAt: string | null;
}

const HOST_PRESETS = [
  { label: "PostHog Cloud (US)", value: "https://us.posthog.com" },
  { label: "PostHog Cloud (EU)", value: "https://eu.posthog.com" },
  { label: "Self-hosted...", value: "custom" },
];

export default function PostHogSettings({ appId }: { appId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [hostPreset, setHostPreset] = useState(HOST_PRESETS[0].value);
  const [customHost, setCustomHost] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedMessage, setConnectedMessage] = useState<string | null>(null);
  const effectiveHost = (hostPreset === "custom" ? customHost.trim() : hostPreset) || HOST_PRESETS[0].value;

  useEffect(() => {
    fetch(`/api/apps/${appId}/posthog`)
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false, host: null, projectId: null, connectedAt: null }));
  }, [appId]);

  async function connect() {
    setSaving(true);
    setError(null);
    setConnectedMessage(null);
    const host = hostPreset === "custom" ? customHost.trim() : hostPreset;
    try {
      const res = await fetch(`/api/apps/${appId}/posthog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, projectId, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect");
      setStatus({ connected: true, host, projectId, connectedAt: new Date().toISOString() });
      setConnectedMessage(data.projectName ? `Connected to "${data.projectName}"` : "Connected");
      setApiKey("");
      // Other mounted widgets (e.g. the Product Health chart on the Overview
      // tab) fetched once on page load, before this connect happened - tell
      // them to refetch instead of requiring a full page reload.
      window.dispatchEvent(new CustomEvent("posthog-status-change", { detail: { appId } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await fetch(`/api/apps/${appId}/posthog`, { method: "DELETE" });
      setStatus({ connected: false, host: null, projectId: null, connectedAt: null });
      setProjectId("");
      setApiKey("");
      window.dispatchEvent(new CustomEvent("posthog-status-change", { detail: { appId } }));
    } finally {
      setSaving(false);
    }
  }

  if (!status) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium">PostHog</div>
          <p className="text-sm text-muted mt-1">
            Link this app&apos;s own PostHog project to eventually pull product analytics
            (installs, activation, retention) alongside its ASO data.
          </p>
        </div>
        {status.connected && (
          <span className="shrink-0 rounded-full bg-success/10 text-success text-xs font-medium px-2 py-1">
            Connected
          </span>
        )}
      </div>

      {status.connected ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="text-muted">
            Project <span className="text-foreground font-medium">{status.projectId}</span> on{" "}
            {status.host}
          </div>
          <button
            onClick={disconnect}
            disabled={saving}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={hostPreset}
              onChange={(e) => setHostPreset(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-accent sm:col-span-1"
            >
              {HOST_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {hostPreset === "custom" ? (
              <input
                value={customHost}
                onChange={(e) => setCustomHost(e.target.value)}
                placeholder="https://posthog.example.com"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-accent sm:col-span-2"
              />
            ) : (
              <input
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Project ID"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-accent sm:col-span-2"
              />
            )}
          </div>
          {hostPreset === "custom" && (
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Project ID"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-accent"
            />
          )}
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            placeholder="Personal API key (read access)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors focus:border-accent"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={connect}
              disabled={saving || !projectId || !apiKey || (hostPreset === "custom" && !customHost)}
              className="rounded-lg bg-accent text-accent-foreground px-4 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
            >
              {saving ? "Connecting..." : "Connect"}
            </button>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
          {connectedMessage && <div className="text-sm text-success">{connectedMessage}</div>}

          <details className="group rounded-lg border border-border">
            <summary className="cursor-pointer select-none list-none px-3 py-2 text-xs font-medium text-muted transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="inline-block transition-transform duration-200 group-open:rotate-90">▸</span>{" "}
              How do I get these?
            </summary>
            <ol className="animate-fade-in list-outside list-decimal space-y-2.5 border-t border-border px-3 py-3 pl-8 text-xs text-muted marker:font-semibold marker:text-accent">
              <li>
                Log in to PostHog at{" "}
                <a href={effectiveHost} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {effectiveHost}
                </a>{" "}
                and open the project you want to link.
              </li>
              <li>
                Go to{" "}
                <a
                  href={`${effectiveHost}/project/settings`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Project Settings → General
                </a>{" "}
                and copy the <strong className="text-foreground">Project ID</strong> shown there (also visible in the
                URL right after <code className="rounded bg-border/50 px-1 py-0.5">/project/</code>).
              </li>
              <li>
                Go to{" "}
                <a
                  href={`${effectiveHost}/settings/user-api-keys`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Account Settings → Personal API Keys
                </a>{" "}
                and create a new key. Scope it to <strong className="text-foreground">read</strong> access on{" "}
                <strong className="text-foreground">Project</strong> and{" "}
                <strong className="text-foreground">Query</strong> (that&apos;s all this integration ever calls) -
                it never needs write access.
              </li>
              <li>
                Paste the Project ID and API key above, pick the matching host (or{" "}
                <strong className="text-foreground">Self-hosted...</strong> for your own instance), and hit{" "}
                <strong className="text-foreground">Connect</strong>. This saves a read-only distinct-user count
                query against your events, nothing else.
              </li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
