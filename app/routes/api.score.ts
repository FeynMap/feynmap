import { OpenAI } from "openai";
import type { Route } from "./+types/api.score";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { concept, aiExplanation, userExplanation, topic } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Concept is required" },
        { status: 400 }
      );
    }

    if (!userExplanation || typeof userExplanation !== "string") {
      return Response.json(
        { error: "User explanation is required" },
        { status: 400 }
      );
    }

    const scoringPrompt = `You are a strict but encouraging Feynman teacher. Score how well the student explained in simple terms.

Concept: "${concept}"
${topic ? `Topic: "${topic}"` : ""}

What they were taught:
"${aiExplanation}"

Their explanation:
"${userExplanation}"

Score 0-100:
- 85-100: Simple, correct, complete. Rare.
- 70-84: Good with minor gaps.
- 50-69: Basic idea but missing key parts or too complex.
- 30-49: Partial, unclear, or jargon-heavy.
- 0-29: Wrong or just buzzwords.

Feedback rules:
- 1-2 sentences MAX
- If good: Say what they got right
- If gaps: Name the ONE most important thing to fix
- If jargon: Call out ONE complex word to simplify
- End with a short question or next step

Return JSON:
{
  "score": 42,
  "feedback": "You got [X] right. Try explaining [Y] more simply - what does it actually do?"
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Strict Feynman scorer. 1-2 sentence feedback only. Be honest but kind. Focus on the ONE thing that matters most.",
        },
        {
          role: "user",
          content: scoringPrompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    const result = JSON.parse(responseText);

    // Validate and ensure score is 0-100
    const score = Math.max(0, Math.min(100, parseInt(result.score) || 0));
    const feedback = result.feedback || "Good effort! Keep practicing.";

    return Response.json({
      success: true,
      score,
      feedback,
    });
  } catch (error) {
    console.error("Error scoring explanation:", error);
    
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to score explanation" },
      { status: 500 }
    );
  }
}
