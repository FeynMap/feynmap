import OpenAI from "openai";
import type { Route } from "./+types/api.personalize";
import { PERSONALIZATION_TUTOR_PROMPT } from "../types/sessionProfile";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PersonalizeRequest {
  conversationHistory: Message[];
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: PersonalizeRequest = await request.json();
    const { conversationHistory = [] } = body;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: PERSONALIZATION_TUTOR_PROMPT },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Personalize API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
