import { OpenAI } from "openai";
import type { Route } from "./+types/api.generate-emoji";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { concept } = await request.json();

    if (!concept || typeof concept !== "string") {
      return Response.json(
        { error: "Concept is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const emojiCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an emoji generator. Return only a single emoji that best represents the given concept. No text, no explanation, just the emoji character.",
        },
        {
          role: "user",
          content: `Generate a single emoji that best represents the concept: "${concept}". Return only the emoji, no text.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 10,
    });

    const emoji = emojiCompletion.choices[0]?.message?.content?.trim();

    return Response.json({
      success: true,
      emoji: emoji || undefined,
    });
  } catch (error) {
    console.error("Error generating emoji:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate emoji" },
      { status: 500 }
    );
  }
}
