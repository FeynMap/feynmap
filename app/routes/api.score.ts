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

    const scoringPrompt = `You are a strict teacher evaluating a student's understanding using the Feynman Technique. Be demanding and thorough.

Concept: "${concept}"
${topic ? `Topic context: "${topic}"` : ""}

AI's explanation (what the student was taught):
"${aiExplanation}"

Student's explanation (what they explained back):
"${userExplanation}"

Evaluate the student's explanation STRICTLY and provide:
1. A score from 0-100 based on these CRITICAL criteria:
   - Accuracy (30 points): Did they understand the core concept correctly? Are there any misconceptions or errors?
   - Depth (25 points): Did they go beyond surface-level understanding? Do they show they truly "get it"?
   - Completeness (25 points): Did they capture ALL key aspects mentioned in the AI explanation? Missing important details reduces score.
   - Originality (10 points): Did they explain in their own words, not just repeat phrases? Parroting reduces score.
   - Clarity (10 points): Is their explanation clear, coherent, and well-structured?

2. Brief but specific feedback (2-3 sentences) that:
   - Points out what they got right
   - Clearly identifies what's missing or incorrect
   - Suggests specific improvements

Scoring guidelines:
- 90-100: Exceptional understanding - demonstrates deep grasp, all key points covered, original explanation
- 75-89: Good understanding - core concept correct, most key points covered, some depth
- 60-74: Adequate understanding - basic concept understood but missing important details or depth
- 40-59: Partial understanding - some understanding but significant gaps or misconceptions
- 0-39: Poor understanding - major misconceptions or very superficial grasp

Be STRICT. A score of 100 should be rare and only for truly excellent explanations. Most explanations should score 60-80 unless they demonstrate exceptional understanding.

Return your response as JSON:
{
  "score": 75,
  "feedback": "You captured the basic idea correctly, but you're missing the key detail about [specific missing element]. Also, try to explain it in your own words rather than repeating phrases. To improve, focus on [specific suggestion]."
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a strict, demanding teacher evaluating student understanding. Be thorough, critical, and specific. Hold students to high standards. Only give high scores (90+) for truly exceptional explanations that demonstrate deep understanding. Be encouraging but honest about gaps.",
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
