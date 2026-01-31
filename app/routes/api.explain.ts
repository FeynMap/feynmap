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

    const feynmanPrompt = `You are a teacher using the Feynman Technique. Explain the concept "${concept}"${topic ? ` in the context of "${topic}"` : ""} as if teaching a beginner.

The Feynman Technique principles:
1. Explain simply - use plain language, avoid jargon
2. Use analogies - relate to everyday experiences
3. Be concise - focus on the essence (2-3 sentences)
4. Identify gaps - hint at what deeper understanding would reveal

Your explanation should:
- Start with a simple, clear definition
- Use a relatable analogy or example
- Be brief but complete (aim for 50-100 words)
- End with a question that prompts the learner to explain it back

Format your response as a clear, engaging explanation that makes the learner want to explain it back in their own words.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert teacher using the Feynman Technique. Explain concepts simply, using analogies and plain language. Keep explanations concise and engaging.",
        },
        {
          role: "user",
          content: feynmanPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
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
