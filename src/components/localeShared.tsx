import { AlertTriangle, ShieldAlert } from "lucide-react";

// Mirrors src/lib/localeCandidates.ts labels - duplicated here (client
// component) rather than importing, since that module also pulls in
// server-only fetch/scoring code we don't want in the client bundle.
export const LOCALE_LABELS: Record<string, string> = {
  en: "English (US)",
  es: "Spanish",
  de: "German",
  fr: "French",
  pt: "Portuguese (Brazil)",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  tr: "Turkish",
  id: "Indonesian",
  vi: "Vietnamese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Chinese (Simplified)",
  ar: "Arabic",
  hi: "Hindi",
  th: "Thai",
};

export interface LocaleIssue {
  type: "title_not_localized" | "foreign_script" | "meta_leak" | "citation_artifact";
  field: "title" | "subtitle" | "description";
  message: string;
  snippet?: string;
}

export const ISSUE_LABELS: Record<LocaleIssue["type"], string> = {
  title_not_localized: "Title not translated",
  foreign_script: "Leaked foreign-script text",
  meta_leak: "Leftover AI-generation note",
  citation_artifact: "Stray citation artifact",
};

export function IssueBadge({ issue }: { issue: LocaleIssue }) {
  const Icon = issue.type === "title_not_localized" ? AlertTriangle : ShieldAlert;
  return (
    <div
      className="flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs"
      style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
      title={issue.snippet ?? issue.message}
    >
      <Icon className="h-3 w-3 shrink-0 mt-0.5" />
      <span>
        {ISSUE_LABELS[issue.type]}
        <span className="opacity-70"> · {issue.field}</span>
      </span>
    </div>
  );
}
