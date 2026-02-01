# FeynMap Project State

Last updated: 2026-01-31

## Product Summary
FeynMap is an AI learning coach that turns a topic into a small concept map, teaches each concept, and scores the learner using the Feynman Technique. The core loop is: generate a map, click a node to learn, explain it back in simple words, get a strict score and feedback, and unlock progress.

## Current UX Flow
1. User enters a topic.
2. The app calls `/api/generate-map` and renders a small ReactFlow graph.
3. User clicks a concept node to get a concise explanation.
4. User explains the concept back in their own words.
5. The app calls `/api/score` to evaluate the explanation and updates node progress and chat feedback.
6. The app suggests what to learn next and allows retry.

## Core Screens and Components
- `app/routes/canvas.tsx` renders the main `ConceptCanvas`.
- `app/components/ConceptCanvas.tsx` manages the map, chat, and the scoring flow.
- `app/components/ConceptChat.tsx` renders chat UI, structured explanations, and score display.
- `app/components/TextInputNode.tsx` supports a text-input node UI (used for chat-like input).
- `app/components/ChatCanvas.tsx` exists as a ReactFlow-based chat canvas (not the main flow).

## Backend Routes (AI)
- `app/routes/api.generate-map.ts`:
  - Generates a small, focused concept map (4-6 nodes) using OpenAI.
  - Enforces concise labels and limited branching for a demo-friendly map.
- `app/routes/api.explain.ts`:
  - Generates a concise, structured explanation.
  - Provides a strict “how to improve” guide.
  - Suggests related concepts only when they add real value.
- `app/routes/api.score.ts`:
  - Scores the learner’s explanation using a strict Feynman rubric.
  - Requires simple language, flags jargon, and calls out gaps.

## Prompting Architecture (Current)
- Map generation prompt focuses on essential concepts and strict JSON output.
- Explanation prompt is short, structured, and optimized for simple language.
- Scoring prompt is now strict and child-simple:
  - Penalizes jargon and undefined terms.
  - Rewards clear, short, accurate explanations.
  - Feedback restates the learner’s explanation in simpler words, then lists exact gaps and a next step.

## Data and Persistence
- Database scaffold exists (`database/`, `drizzle/`) with a sample guest book used in `app/routes/home.tsx`.
- The learning flow does not currently persist sessions, scores, or maps to the database.

## Current Strengths
- Clear product loop with a visible, motivating map.
- Small, fast concept maps that are demo-ready.
- Tight feedback loop (explain → score → unlock) with immediate UI response.
- Structured explanation formatting improves readability and consistency.

## Current Gaps and Risks
- No persistent user progress, map history, or session tracking.
- Evaluation feedback is strict but still only returns score + text; no structured gap list in UI.
- Related concepts are generated without access to existing map context (risk of overlap).
- Limited guardrails for hallucinated or off-topic explanations.
- Home route is still a template guest book; product entry is via `/canvas`.

## Product Evaluation (Strict Feynman Lens)
- The app already matches the Feynman loop, but strictness must stay high:
  - If learners use complex words without explaining them, scores should stay low.
  - Feedback should always point to exact missing ideas and ask for simpler words.
  - New concepts should only appear when they add real value and are not duplicates.
- The best version of this product will surface gaps clearly and consistently:
  - Make “unknown words” visible.
  - Ask one clear next-step question after every score.
  - Keep the map small and focused so progress feels meaningful.

## Suggested Next Steps (Non-Blocking)
- Persist sessions and node scores (per topic) in the database.
- Add UI hints for “jargon detected” or “missing key point” without cluttering the chat.
- Track and avoid duplicate related concepts by referencing current node labels.
- Add a lightweight onboarding flow and redirect `/` to `/canvas`.

## Run Locally (from README)
1. Install and configure PostgreSQL.
2. `pnpm install`
3. `cp .env.example .env` and add API keys
4. `pnpm db:migrate`
5. `pnpm dev`
