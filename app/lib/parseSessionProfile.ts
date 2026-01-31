import type { SessionProfile } from "../types/sessionProfile";

const VALID_ANALOGY_DOMAINS = new Set([
  "construction",
  "cooking",
  "sport",
  "business",
  "medical",
  "mechanics",
  "it",
  "study",
  "art",
]);

function normalizeAnalogyDomains(arr: unknown): string[] | null {
  if (!Array.isArray(arr)) return null;
  const out: string[] = [];
  for (const item of arr) {
    const s = typeof item === "string" ? item.trim().toLowerCase() : "";
    if (s && VALID_ANALOGY_DOMAINS.has(s)) out.push(s);
  }
  return out.length ? out : null;
}

function safeString(
  val: unknown,
  allowed: readonly string[] | null
): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (allowed && !allowed.includes(s)) return null;
  return s;
}

/**
 * Extract SESSION_PROFILE JSON from assistant text (e.g. from ```json ... ``` block).
 * Returns null on parse error or invalid structure.
 */
export function parseSessionProfile(assistantText: string): SessionProfile | null {
  const jsonMatch =
    assistantText.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ??
    assistantText.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonMatch) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(jsonMatch) as Record<string, unknown>;
  } catch {
    return null;
  }

  const mindset = safeString(raw.mindset, [
    "humanities",
    "technical",
    "mixed",
  ]) as SessionProfile["mindset"];
  const math_comfort = safeString(raw.math_comfort, [
    "low",
    "medium",
    "high",
  ]) as SessionProfile["math_comfort"];
  const explanation_style = safeString(raw.explanation_style, [
    "bullets",
    "steps",
    "why",
    "examples",
  ]) as SessionProfile["explanation_style"];
  const order_preference = safeString(raw.order_preference, [
    "overview_first",
    "example_first",
  ]) as SessionProfile["order_preference"];
  const terminology = safeString(raw.terminology, [
    "plain_first",
    "terms_first",
  ]) as SessionProfile["terminology"];
  const pace = safeString(raw.pace, ["fast", "medium", "slow"]) as SessionProfile["pace"];
  const reinforcement_mode = safeString(raw.reinforcement_mode, [
    "quiz",
    "exercises",
    "summary",
    "none",
  ]) as SessionProfile["reinforcement_mode"];
  const feedback_tone = safeString(raw.feedback_tone, [
    "gentle",
    "direct",
  ]) as SessionProfile["feedback_tone"];

  const profession =
    raw.profession != null && String(raw.profession).trim()
      ? String(raw.profession).trim()
      : null;

  return {
    mindset: mindset ?? null,
    profession,
    analogy_domains: normalizeAnalogyDomains(raw.analogy_domains),
    math_comfort: math_comfort ?? null,
    explanation_style: explanation_style ?? null,
    order_preference: order_preference ?? null,
    terminology: terminology ?? null,
    pace: pace ?? null,
    reinforcement_mode: reinforcement_mode ?? null,
    feedback_tone: feedback_tone ?? null,
  };
}
