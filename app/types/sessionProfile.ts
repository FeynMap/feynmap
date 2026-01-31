/**
 * Session-only learning profile (not persisted between sessions).
 * Used to adapt chat answers: structure, depth, analogies, terminology, pace, feedback tone.
 */
export interface SessionProfile {
  mindset: "humanities" | "technical" | "mixed" | null;
  profession: string | null;
  analogy_domains: string[] | null; // e.g. ["construction", "cooking"]
  math_comfort: "low" | "medium" | "high" | null;
  explanation_style: "bullets" | "steps" | "why" | "examples" | null;
  order_preference: "overview_first" | "example_first" | null;
  terminology: "plain_first" | "terms_first" | null;
  pace: "fast" | "medium" | "slow" | null;
  reinforcement_mode: "quiz" | "exercises" | "summary" | "none" | null;
  feedback_tone: "gentle" | "direct" | null;
  /** From post-questions toggles */
  detail_level?: "short" | "detailed";
  example_preference?: "examples" | "theory";
}

/** Single-choice question for building SessionProfile from user selections */
export interface ProfileQuestionOption<T = string | null> {
  value: T;
  label: string;
}

export interface ProfileQuestion {
  id: keyof SessionProfile;
  label: string;
  options: ProfileQuestionOption[];
}

/** Multi-select: user picks up to 2. Value is the analogy domain code. */
export const ANALOGY_OPTIONS: ProfileQuestionOption<string>[] = [
  { value: "construction", label: "Construction / repair" },
  { value: "cooking", label: "Cooking / recipes" },
  { value: "sport", label: "Sport / training" },
  { value: "business", label: "Business / money" },
  { value: "medical", label: "Medicine / biology" },
  { value: "mechanics", label: "Mechanics / tech" },
  { value: "it", label: "IT / code / networks" },
  { value: "study", label: "Study / exams" },
  { value: "art", label: "Art / design" },
];

export const PERSONALIZATION_QUESTIONS: ProfileQuestion[] = [
  {
    id: "mindset",
    label: "How would you describe your thinking style?",
    options: [
      { value: "humanities", label: "Humanities" },
      { value: "technical", label: "Technical" },
      { value: "mixed", label: "Mixed" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "profession",
    label: "What do you do? (role or field in 2–6 words, e.g. developer, teacher, student)",
    options: [], // rendered as text input
  },
  {
    id: "analogy_domains",
    label: "Which analogies work best for you? (pick up to 2)",
    options: ANALOGY_OPTIONS,
  },
  {
    id: "math_comfort",
    label: "How comfortable are you with formulas and abstraction?",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "explanation_style",
    label: "Preferred explanation style",
    options: [
      { value: "bullets", label: "Short bullet points" },
      { value: "steps", label: "Step-by-step (algorithm)" },
      { value: "why", label: "Detailed “why” reasoning" },
      { value: "examples", label: "Examples / cases" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "order_preference",
    label: "What order do you prefer?",
    options: [
      { value: "overview_first", label: "Overview first, then details" },
      { value: "example_first", label: "Example / task first, then rule" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "terminology",
    label: "How strict should terms be?",
    options: [
      { value: "plain_first", label: "Plain language first; terms only when needed" },
      { value: "terms_first", label: "Correct terms and definitions from the start" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "pace",
    label: "What pace works best?",
    options: [
      { value: "fast", label: "Fast and to the point" },
      { value: "medium", label: "Medium" },
      { value: "slow", label: "Slow and very clear, no gaps" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "reinforcement_mode",
    label: "How do you like to reinforce learning?",
    options: [
      { value: "quiz", label: "Mini quiz (3 questions)" },
      { value: "exercises", label: "1–2 exercises" },
      { value: "summary", label: "Short summary / notes" },
      { value: "none", label: "No reinforcement" },
      { value: null, label: "Skip" },
    ],
  },
  {
    id: "feedback_tone",
    label: "How should feedback be given?",
    options: [
      { value: "gentle", label: "Gentle and supportive" },
      { value: "direct", label: "Direct and strict on mistakes" },
      { value: null, label: "Skip" },
    ],
  },
];

/** English tutor prompt for API-based personalization (optional flow). */
export const PERSONALIZATION_TUTOR_PROMPT = `You are an AI tutor in chat. Your task: in 10 simple questions, collect a "learning profile" for the user for THIS SESSION ONLY (no persistence between sessions), so you can explain ANY topic in a suitable style and via analogies from their background (e.g. construction for builders, recipes for cooks).

Important: Do NOT ask "what are we studying now" — the user may ask any topics in different chats. The profile must be universal and applicable to any question.

Rules:
- First ask exactly 10 short questions (numbered list 1–10) in one message.
- Ask them to answer briefly (e.g. "1) … 2) …"). Any question can be skipped ("-").
- Do not ask sensitive personal data (address, documents, health, contacts, exact finances). Only general background and preferences.
- After answers: 1) Form a short profile summary (3–6 bullets). 2) Output SESSION_PROFILE as JSON in a separate block. 3) Ask: "OK to apply this profile?" and offer toggles: "shorter / more detailed" and "more examples / more theory".
- In all subsequent answers, adapt structure, depth, terminology, analogies, practice amount, and feedback tone according to SESSION_PROFILE.
- If the user gave a profession/field, use 1–2 analogies from that domain; do not replace definitions with analogies — give the correct idea first, then the analogy.

Output SESSION_PROFILE JSON with fields: mindset ("humanities"|"technical"|"mixed"|null), profession (string|null), analogy_domains (array|null, codes: construction, cooking, sport, business, medical, mechanics, it, study, art), math_comfort ("low"|"medium"|"high"|null), explanation_style ("bullets"|"steps"|"why"|"examples"|null), order_preference ("overview_first"|"example_first"|null), terminology ("plain_first"|"terms_first"|null), pace ("fast"|"medium"|"slow"|null), reinforcement_mode ("quiz"|"exercises"|"summary"|"none"|null), feedback_tone ("gentle"|"direct"|null). Use null for skipped answers.

Start now: ask the 10 questions and wait for answers.`;
