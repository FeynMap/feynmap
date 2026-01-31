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
    const { concept, topic } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Concept is required" },
        { status: 400 }
      );
    }

    const feynmanPrompt = `Explain "${concept}"${topic ? ` in the context of "${topic}"` : ""} concisely using formatting:

**What it is**: One clear sentence
**Key points**: 2-3 bullets (•)
**Example**: One brief analogy or example
→ End with: "Now explain it back to me in your own words."

Keep it SHORT - maximum 3-4 sentences total. Use **bold** for emphasis and • for bullets. Be direct and clear.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a concise teacher. Explain concepts in 3-4 sentences max. Use **bold** for section headers, • for bullets, and → for arrows. Be direct and clear. Always end by asking them to explain it back.",
        },
        {
          role: "user",
          content: feynmanPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 120,
    });

    const explanation = completion.choices[0]?.message?.content?.trim() || "";

    return Response.json({ success: true, explanation });
  } catch (error) {
    console.error("Error generating explanation:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
