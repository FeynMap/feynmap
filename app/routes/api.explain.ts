import { OpenAI } from "openai";
import type { Route } from "./+types/api.explain";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { concept, topic, existingNodes } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Concept is required" },
        { status: 400 }
      );
    }

    const feynmanPrompt = `Explain "${concept}"${topic ? ` for understanding "${topic}"` : ""} in 2-3 simple sentences a child could understand. No jargon. One concrete example or analogy at the end.`;

    const improvementGuidePrompt = `For "${concept}"${topic ? ` in "${topic}"` : ""}, give brief tips:
• 2-3 key points to mention
• 1 common mistake to avoid
• 1 word to simplify

Keep it to 3-4 bullets max.`;

    const [explanationCompletion, improvementCompletion, relatedConceptsCompletion] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Explain like talking to a curious child. 2-3 sentences max. End with one simple example.",
          },
          {
            role: "user",
            content: feynmanPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Brief tips only. Use • for bullets. 3-4 bullets max.",
          },
          {
            role: "user",
            content: improvementGuidePrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Return JSON only. Be very conservative - only suggest concepts that are essential and not already covered. Use standard terminology and think critically about concept merging.",
          },
          {
            role: "user",
            content: `Topic: "${topic || concept}"
Current concept: "${concept}"
${existingNodes && existingNodes.length > 0 ? `Already on the map: ${existingNodes.join(", ")}` : ""}

Should we add any new concepts to the map? Only if they:
1. Are NOT already covered by existing nodes (check if they're the same concept with different wording)
2. Are essential for understanding "${concept}" in context of "${topic || concept}"
3. Would help the user understand the topic better

CRITICAL RULES FOR SUB-CONCEPT CREATION:
- **MERGE similar concepts**: If a suggested concept is really the same as an existing one (just worded differently), DO NOT create it. Check existingNodes carefully - if "Photosynthesis" exists, don't create "How plants make food".
- **CREATE separate sub-concepts for distinct topics**: If two concepts are genuinely different, they MUST be separate. For example, if explaining "Photosynthesis", both "Chlorophyll" and "Light Reactions" are different sub-concepts and should both exist.
- **Use standard terminology**: Always use canonical, academic names. Link back to real, established concepts. Don't use informal phrasings or alternative wordings.
- **Think before creating**: Ask "Is this a distinct concept that needs its own node, or is it just a different way of describing something already on the map?" If it's the same, skip it. If it's different, include it.

Return JSON:
{
  "relatedConcepts": [
    {"name": "Standard Concept Name", "description": "Why this matters for ${topic || concept}: [1 sentence]"}
  ]
}

Return empty array if nothing essential is missing or if concepts would duplicate existing ones. Be conservative.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    ]);

    const explanation = explanationCompletion.choices[0]?.message?.content?.trim() || "";
    const improvementGuide = improvementCompletion.choices[0]?.message?.content?.trim() || "";
    
    let relatedConcepts: Array<{ name: string; description: string }> = [];
    try {
      const relatedConceptsText = relatedConceptsCompletion.choices[0]?.message?.content?.trim() || "{}";
      const relatedConceptsData = JSON.parse(relatedConceptsText);
      relatedConcepts = relatedConceptsData.relatedConcepts || [];
    } catch (e) {
      console.error("Error parsing related concepts:", e);
      relatedConcepts = [];
    }

    return Response.json({ 
      success: true, 
      explanation,
      improvementGuide,
      relatedConcepts,
    });
  } catch (error) {
    console.error("Error generating explanation:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
