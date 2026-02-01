import { useState, useCallback } from "react";
import type { SessionProfile } from "../types/sessionProfile";
import {
  PERSONALIZATION_QUESTIONS,
  inferAnalogyDomainsFromProfession,
  type ProfileQuestion,
} from "../types/sessionProfile";

interface PersonalizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (profile: SessionProfile) => void;
}

type FormValues = Partial<
  Record<
    keyof SessionProfile,
    string | string[] | null
  >
>;

function buildProfileFromForm(values: FormValues): SessionProfile {
  const get = <K extends keyof SessionProfile>(
    key: K,
    cast: (v: unknown) => SessionProfile[K]
  ): SessionProfile[K] => {
    const v = values[key];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0))
      return null as SessionProfile[K];
    return cast(v);
  };
  const profession = get("profession", (v) =>
    typeof v === "string" ? v : null
  );
  return {
    mindset: get("mindset", (v) =>
      v === "humanities" || v === "technical" || v === "mixed" ? v : null
    ),
    profession,
    analogy_domains: inferAnalogyDomainsFromProfession(profession),
    math_comfort: get("math_comfort", (v) =>
      v === "low" || v === "medium" || v === "high" ? v : null
    ),
    explanation_style: get("explanation_style", (v) =>
      v === "bullets" || v === "steps" || v === "why" || v === "examples"
        ? v
        : null
    ),
    order_preference: get("order_preference", (v) =>
      v === "overview_first" || v === "example_first" ? v : null
    ),
    terminology: get("terminology", (v) =>
      v === "plain_first" || v === "terms_first" ? v : null
    ),
    pace: get("pace", (v) =>
      v === "fast" || v === "medium" || v === "slow" ? v : null
    ),
    reinforcement_mode: get("reinforcement_mode", (v) =>
      v === "quiz" || v === "exercises" || v === "summary" || v === "none"
        ? v
        : null
    ),
    feedback_tone: get("feedback_tone", (v) =>
      v === "gentle" || v === "direct" ? v : null
    ),
  };
}

const INITIAL_FORM: FormValues = {};

export function PersonalizationModal({
  isOpen,
  onClose,
  onApply,
}: PersonalizationModalProps) {
  const [step, setStep] = useState<"questions" | "confirm">("questions");
  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [detailLevel, setDetailLevel] = useState<"short" | "detailed">(
    "detailed"
  );
  const [examplePreference, setExamplePreference] = useState<
    "examples" | "theory"
  >("examples");

  const setValue = useCallback(
    (id: keyof SessionProfile, value: string | string[] | null) => {
      setForm((prev) => ({ ...prev, [id]: value }));
    },
    []
  );

  const handleSubmitQuestions = useCallback(() => {
    setStep("confirm");
  }, []);

  const handleApply = useCallback(() => {
    const profile = buildProfileFromForm(form);
    const withToggles: SessionProfile = {
      ...profile,
      detail_level: detailLevel,
      example_preference: examplePreference,
    };
    onApply(withToggles);
    onClose();
  }, [form, detailLevel, examplePreference, onApply, onClose]);

  const handleClose = useCallback(() => {
    setStep("questions");
    setForm(INITIAL_FORM);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Chat personalization
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {step === "questions" && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Answer 9 short questions so we can adapt explanations to your
                style. You can skip any question.
              </p>
              {PERSONALIZATION_QUESTIONS.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={form[q.id]}
                  setValue={(v) => setValue(q.id, v)}
                />
              ))}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitQuestions}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                OK to apply this profile?
              </p>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Length:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="detail"
                      checked={detailLevel === "short"}
                      onChange={() => setDetailLevel("short")}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    Shorter
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="detail"
                      checked={detailLevel === "detailed"}
                      onChange={() => setDetailLevel("detailed")}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    More detailed
                  </label>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Style:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="example"
                      checked={examplePreference === "examples"}
                      onChange={() => setExamplePreference("examples")}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    More examples
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="example"
                      checked={examplePreference === "theory"}
                      onChange={() => setExamplePreference("theory")}
                      className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                    />
                    More theory
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("questions")}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  Apply profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  setValue,
}: {
  question: ProfileQuestion;
  value: string | string[] | null | undefined;
  setValue: (v: string | string[] | null) => void;
}) {
  const { id, label, options } = question;

  // Profession: text input
  if (id === "profession") {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => setValue(e.target.value.trim() || null)}
          placeholder="e.g. developer, teacher, student"
          className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500"
        />
      </div>
    );
  }

  // Single choice: radio group
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <label
            key={opt.label}
            className="inline-flex items-center gap-1.5 cursor-pointer"
          >
            <input
              type="radio"
              name={id}
              checked={
                value === opt.value ||
                (opt.value === null && (value === null || value === undefined))
              }
              onChange={() => setValue(opt.value)}
              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
