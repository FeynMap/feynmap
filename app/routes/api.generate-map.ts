import { OpenAI } from "openai";
import type { Route } from "./+types/api.generate-map";

export interface ExpectedSubconcept {
  name: string;
  importance: "high" | "medium" | "low";
}

export interface GeneratedNode {
  id: string;
  label: string;
  level: number;
  emoji?: string;
  expectedSubconcepts?: ExpectedSubconcept[];
}

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

    const prompt = `Assess the breadth of "${topic.trim()}" and determine how many core concepts are needed:

- **Small/focused topics** (e.g., "Pomodoro Technique", "Binary Search"): Generate 3 concepts
- **Medium topics** (e.g., "Exercise", "Personal Finance"): Generate 4 concepts  
- **Broad topics** (e.g., "Machine Learning", "World History"): Generate 5 concepts

Based on the topic breadth, generate the appropriate number (3, 4, or 5) of the MOST IMPORTANT things someone must understand to be proficient in "${topic.trim()}".

Return JSON with ONLY high-level concepts (no sub-concepts):
{
  "nodes": [
    {"id": "root", "label": "${topic.trim()}", "level": 0},
    {"id": "c1", "label": "Core Concept 1", "level": 1},
    {"id": "c2", "label": "Core Concept 2", "level": 1},
    {"id": "c3", "label": "Core Concept 3", "level": 1}
  ],
  "edges": [
    {"source": "root", "target": "c1"},
    {"source": "root", "target": "c2"},
    {"source": "root", "target": "c3"}
  ]
}

CRITICAL RULES:
- Generate 3, 4, or 5 concepts (plus root) based on topic breadth - assess carefully
- All concepts are level 1 (direct children of root) - NO sub-concepts
- Labels should be 1-3 words, simple and clear, using STANDARD terminology
- IDs should be kebab-case
- Every concept connects directly to root
- Pick the concepts that unlock the most understanding

CONCEPT MERGING & NORMALIZATION:
- **MERGE similar concepts**: If two concepts are really the same thing (just worded differently), merge them into ONE concept with the standard name. For example, "Photosynthesis" and "How plants make food" should be ONE concept called "Photosynthesis".
- **KEEP distinct concepts separate**: If two concepts are genuinely different topics, they MUST be separate concepts. For example, "Photosynthesis" and "Cellular Respiration" are different and should both exist.
- **Use standard terminology**: Always use the canonical, academic name for concepts. Don't use informal or alternative phrasings. Link back to real, established concepts in the field.
- **Think critically**: Before creating a concept, ask: "Is this really a distinct concept, or is it just a different way of saying something I already have?" If it's the same, merge it. If it's different, keep it separate.
- **Grade 1 appropriateness**: These are level 1 concepts (direct children of the root topic). They should be fundamental, foundational concepts that are distinct enough to warrant separate exploration.`;

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
      max_tokens: 600,
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

    // Generate emojis and expectedSubconcepts for all concepts in parallel
    const nodesWithMetadata = await Promise.all(
      conceptMap.nodes.map(async (node: any): Promise<GeneratedNode> => {
        const nodeResult: GeneratedNode = { ...node };
        
        // Generate emoji
        try {
          const emojiCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are an emoji generator. Return only a single emoji that best represents the given concept. No text, no explanation, just the emoji character.",
              },
              {
                role: "user",
                content: `Generate a single emoji that best represents the concept: "${node.label}". Return only the emoji, no text.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 10,
          });
          nodeResult.emoji = emojiCompletion.choices[0]?.message?.content?.trim() || undefined;
        } catch (emojiError) {
          console.error(`Error generating emoji for ${node.label}:`, emojiError);
        }

        // Generate expectedSubconcepts for non-root nodes (level > 0)
        if (node.level > 0) {
          try {
            const subconceptsPrompt = `For the concept "${node.label}" (which is a sub-topic of "${topic.trim()}"), generate 3-5 expected sub-concepts that a learner should understand to fully master this concept.

Return JSON:
{
  "expectedSubconcepts": [
    { "name": "Sub-concept Name", "importance": "high" },
    { "name": "Another Sub-concept", "importance": "medium" },
    { "name": "Third Sub-concept", "importance": "low" }
  ]
}

RULES:
- Generate 3-5 sub-concepts that are CHILDREN of "${node.label}"
- Use canonical, academic terminology
- Each sub-concept should be distinct (no overlapping concepts)
- Importance levels: "high" = essential for understanding, "medium" = important, "low" = helpful but not critical
- Names should be 1-4 words, simple and clear
- These sub-concepts will be used to measure comprehension depth`;

            const subconceptsCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "Generate expected sub-concepts for learning assessment. Return valid JSON only.",
                },
                {
                  role: "user",
                  content: subconceptsPrompt,
                },
              ],
              temperature: 0.3,
              max_tokens: 400,
              response_format: { type: "json_object" },
            });

            const subconceptsText = subconceptsCompletion.choices[0]?.message?.content?.trim() || "{}";
            const subconceptsResult = JSON.parse(subconceptsText);
            
            if (Array.isArray(subconceptsResult.expectedSubconcepts)) {
              nodeResult.expectedSubconcepts = subconceptsResult.expectedSubconcepts
                .filter((sc: any) => sc.name && typeof sc.name === "string")
                .map((sc: any) => ({
                  name: sc.name.trim(),
                  importance: ["high", "medium", "low"].includes(sc.importance) ? sc.importance : "medium",
                }));
            }
          } catch (subconceptsError) {
            console.error(`Error generating expectedSubconcepts for ${node.label}:`, subconceptsError);
            nodeResult.expectedSubconcepts = [];
          }
        }

        return nodeResult;
      })
    );

    return Response.json({ success: true, data: { ...conceptMap, nodes: nodesWithMetadata } });
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
