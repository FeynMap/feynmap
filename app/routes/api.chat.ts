import OpenAI from "openai";
import type { Route } from "./+types/api.chat";
import type { Message } from "../types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatRequest {
  prompt: string;
  conversationHistory: Message[];
  knownConcepts?: string[];
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body: ChatRequest = await request.json();
    const { prompt, conversationHistory = [], knownConcepts = [] } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build system prompt with known concepts
    let systemPrompt = "You are a helpful assistant that explains concepts clearly. When explaining a topic, provide a clear explanation first. Then, identify 2-4 key related sub-concepts that the user might want to explore deeper.\n\nFormat each sub-concept using this EXACT syntax at the end of your response:\n\n[[CONCEPT:Name of Sub-Concept]]\nOne sentence teaser about this sub-concept\n[[/CONCEPT]]\n\nExample response:\n\"Neural networks learn by adjusting weights through a process called training. They consist of layers of interconnected nodes...\n\n[[CONCEPT:Gradient Descent]]\nThe optimization algorithm that helps neural networks learn by minimizing error.\n[[/CONCEPT]]\n\n[[CONCEPT:Backpropagation]]\nThe method for calculating how much each weight contributed to the error.\n[[/CONCEPT]]\"\n\nOnly include concepts if the topic is substantial enough to warrant exploration. For simple questions or clarifications, you can skip the concept markers.";
    
    if (knownConcepts.length > 0) {
      systemPrompt += `\n\nIMPORTANT: The user is building a knowledge map. The following concepts already exist as nodes on the map:\n${knownConcepts.map(c => `- ${c}`).join('\n')}\n\nYou should STILL EXPLAIN any concept the user asks about, including those in the list above.\n\nHowever, when suggesting NEW sub-concepts to explore (using [[CONCEPT:...]] markers), do NOT suggest:\n- Any concept in the list above (case-insensitive)\n- Variations of listed concepts (e.g., if "coroutines" is listed, do NOT suggest "coroutines in python" or "python coroutines")\n- Language-specific versions of general concepts already listed\n- Broader or narrower versions of listed concepts\n\nOnly suggest genuinely NEW concepts as [[CONCEPT]] markers that are clearly distinct from everything already on the map.`;
    }

    // Build messages array with conversation history
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user", content: prompt },
    ];

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
    });

    // Create a ReadableStream to stream the response
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
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
