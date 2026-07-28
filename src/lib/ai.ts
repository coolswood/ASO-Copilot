import { prisma } from "./prisma";
import type { StorePlatform } from "./stores/types";
import type { AILocale } from "./aiLocales";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Any model on https://openrouter.ai/models works here since OpenRouter
// normalizes the request/response shape across providers - override via
// OPENROUTER_MODEL if you'd rather use something cheaper/faster/newer.
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export class AIConfigError extends Error {}

export interface CopySuggestionInput {
  platform: StorePlatform;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  keywords: string[];
  locale: AILocale;
  limits: {
    title: number;
    subtitle: readonly [number, number];
    description: number;
  };
}

export type CopyField = "title" | "subtitle" | "description";

export interface CopySuggestion {
  field: CopyField;
  current: string;
  suggestion: string;
  rationale: string;
}

/** Models occasionally wrap JSON in a ```json fence despite being told not
 * to - strip it rather than failing the whole request over formatting. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : trimmed;
}

/** Shared between the OpenRouter prompt below and the key-free MCP brief
 * (buildCopyLocalizationBrief) so the two paths never drift - whichever
 * model ends up writing the copy (OpenRouter's, or the MCP client's own)
 * gets the same localization rule. en-gb/en-ca are the same language, a
 * different storefront - regional spelling/idiom only ("colour",
 * "favourite", "organise"), not a translation, so the tracked keywords
 * (already English) stay as-is. */
function localizationInstruction(locale: AILocale): string {
  const isBaseEnglish = locale.code === "en";
  const isEnglishVariant = locale.code.startsWith("en-");

  if (isBaseEnglish) return "Refine the existing English copy rather than just repeating it.";
  if (isEnglishVariant) {
    return `The copy is already in English - keep the tracked keywords as-is, just rewrite spelling, phrasing, and idioms to match ${locale.label} conventions (e.g. British/Canadian spelling like "colour", "favourite", "organise") rather than US English.`;
  }
  return `Do not just translate literally - adapt each tracked keyword into the real ${locale.label} search term a local user would type for that concept (translate it or use the natural local equivalent), not the literal English word, unless it's a brand name or common loanword locals actually search in English.`;
}

function buildPrompt(input: CopySuggestionInput): string {
  const store = input.platform === "IOS" ? "Apple App Store" : "Google Play";
  const [subtitleMin, subtitleMax] = input.limits.subtitle;
  const instruction = localizationInstruction(input.locale);

  return `You are an ASO (App Store Optimization) copywriter localizing a ${store} listing into ${input.locale.label} (locale "${input.locale.code}").

Current (source, English) title: ${input.title || "(none set)"}
Current (source, English) subtitle: ${input.subtitle || "(none set)"}
Current (source, English) description:
${input.description || "(none set)"}

Tracked keywords (English, input signals only): ${
    input.keywords.length ? input.keywords.join(", ") : "(none tracked yet)"
  }

Write the new title, subtitle, and description entirely in ${input.locale.label}, the way a native ${input.locale.label} speaker would naturally write and search for this app. ${instruction}

Hard character limits - do not exceed these (character count, not byte count):
- title: ${input.limits.title} characters
- subtitle: aim for ${subtitleMin}-${subtitleMax} characters
- description: up to ${input.limits.description} characters

Respond with ONLY a JSON object, no markdown code fence, no commentary, in exactly this shape:
{"title":{"suggestion":"...","rationale":"..."},"subtitle":{"suggestion":"...","rationale":"..."},"description":{"suggestion":"...","rationale":"..."}}

Each "suggestion" must be written in ${input.locale.label}. Each "rationale" is one short sentence written in English explaining what changed and why - if the current copy for a field is already strong, keep "suggestion" close to it (still in ${input.locale.label}) and say so.`;
}

export interface CopyLocalizationBrief {
  locale: string;
  localeLabel: string;
  platform: StorePlatform;
  currentTitle: string | null;
  currentSubtitle: string | null;
  currentDescription: string | null;
  trackedKeywords: string[];
  limits: { title: number; subtitle: readonly [number, number]; description: number };
  instructions: string;
}

/** The key-free path: instead of calling OpenRouter, hand back everything a
 * model needs to write the copy itself - the calling MCP client (already an
 * LLM, e.g. Claude) reads this and composes title/subtitle/description
 * directly as its own output, no OPENROUTER_API_KEY or extra API spend
 * required. Same source data and localization rule as buildPrompt, just
 * structured for a model that's already in the conversation rather than
 * serialized into a single message for a fresh one. */
export function buildCopyLocalizationBrief(input: CopySuggestionInput): CopyLocalizationBrief {
  return {
    locale: input.locale.code,
    localeLabel: input.locale.label,
    platform: input.platform,
    currentTitle: input.title,
    currentSubtitle: input.subtitle,
    currentDescription: input.description,
    trackedKeywords: input.keywords,
    limits: input.limits,
    instructions: `${localizationInstruction(input.locale)} Title must be <= ${input.limits.title} characters. Subtitle should be ${input.limits.subtitle[0]}-${input.limits.subtitle[1]} characters. Description must be <= ${input.limits.description} characters. Write persuasive copy a real app would ship, not keyword-stuffed filler.`,
  };
}

/** Calls out to OpenRouter to write the copy - the caller is responsible for
 * persisting the result (see saveCopySuggestions) if it should stick around;
 * this function itself has no DB side effects. Routed through OpenRouter
 * rather than a single provider's SDK so the backing model is just a config
 * value (OPENROUTER_MODEL), not a code change. */
export async function generateCopySuggestions(input: CopySuggestionInput): Promise<CopySuggestion[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIConfigError("OPENROUTER_API_KEY is not configured on the server");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter uses these purely for its own traffic attribution/rankings.
      "HTTP-Referer": "https://github.com/aso-copilot",
      "X-Title": "ASO Copilot",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages: [{ role: "user", content: buildPrompt(input) }],
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter request failed: ${res.status} ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");

  let parsed: Record<string, { suggestion?: string; rationale?: string }>;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch {
    throw new Error("Couldn't parse the model's response as JSON");
  }

  const fields: { key: CopyField; current: string | null }[] = [
    { key: "title", current: input.title },
    { key: "subtitle", current: input.subtitle },
    { key: "description", current: input.description },
  ];

  return fields
    .filter((f) => parsed[f.key]?.suggestion)
    .map((f) => ({
      field: f.key,
      current: f.current ?? "",
      suggestion: String(parsed[f.key].suggestion),
      rationale: String(parsed[f.key].rationale ?? ""),
    }));
}

export type CopySuggestionSource = "openrouter" | "mcp";

/** Persists a generated set of suggestions for an app+locale, overwriting
 * whatever was there before. Two writers: the OpenRouter REST route (after
 * generateCopySuggestions succeeds) and the save_copy_suggestions MCP tool
 * (an MCP client with its own model, e.g. Claude, composed the copy itself -
 * no OPENROUTER_API_KEY involved). Either way the read side (the web panel,
 * GET /api/apps/[id]/ai-suggestions) doesn't care which wrote it. */
export async function saveCopySuggestions(
  appId: string,
  locale: string,
  suggestions: CopySuggestion[],
  source: CopySuggestionSource,
) {
  return prisma.aiCopySuggestion.upsert({
    where: { appId_locale: { appId, locale } },
    create: { appId, locale, suggestions: suggestions as unknown as object, source },
    update: { suggestions: suggestions as unknown as object, source },
  });
}

export async function getSavedCopySuggestions(
  appId: string,
  locale: string,
): Promise<{ suggestions: CopySuggestion[]; source: CopySuggestionSource } | null> {
  const row = await prisma.aiCopySuggestion.findUnique({ where: { appId_locale: { appId, locale } } });
  if (!row) return null;
  return { suggestions: row.suggestions as unknown as CopySuggestion[], source: row.source as CopySuggestionSource };
}
