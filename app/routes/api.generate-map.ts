import { OpenAI } from "openai";
import type { Route } from "./+types/api.generate-map";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return Response.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY is missing. Available env vars:", Object.keys(process.env).filter(k => k.includes("OPENAI")));
      return Response.json(
        { error: "OpenAI API key not configured. Please check your .env file." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `Break down "${topic.trim()}" into 8-10 simple concepts that connect to each other.
Each concept should be one thing you can explain in 2 minutes.
Start with basics, progress to advanced.

Return JSON:
{
  "nodes": [
    {"id": "root", "label": "${topic.trim()}", "level": 0},
    {"id": "c1", "label": "Concept Name", "level": 1},
    {"id": "c2", "label": "Concept Name", "level": 1},
    {"id": "s1", "label": "Sub Concept", "level": 2}
  ],
  "edges": [
    {"source": "root", "target": "c1"},
    {"source": "root", "target": "c2"},
    {"source": "c1", "target": "s1"}
  ]
}

Rules:
- Generate 8-10 concepts total (including root)
- Each concept should be explainable in 2 minutes
- Progress from basic to advanced
- Labels should be 1-3 words, clear and simple
- IDs should be kebab-case
- Create logical connections between concepts
- Root concept should connect to 2-4 main concepts
- Main concepts can have 1-2 sub-concepts each`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "JSON concept maps. Valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "";
    const conceptMap = JSON.parse(responseText);

    // Validate the structure
    if (!conceptMap.nodes || !Array.isArray(conceptMap.nodes)) {
      throw new Error("Invalid response: missing nodes array");
    }
    if (!conceptMap.edges || !Array.isArray(conceptMap.edges)) {
      throw new Error("Invalid response: missing edges array");
    }

    return Response.json({ success: true, data: conceptMap });
  } catch (error) {
    console.error("Error generating concept map:", error);
    
    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate concept map" },
      { status: 500 }
    );
  }
}
