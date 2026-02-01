import { OpenAI } from "openai";
import type { Route } from "./+types/api.analyze-explanation";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DiscoveredConcept {
  name: string;
  score: number; // 0-100 based on how well user explained this sub-concept
  description: string; // Brief context of what user said about it
  parentConcept?: string | null; // Name of parent concept if this is a nested sub-concept
  level?: number; // Hierarchy level: 1 = direct child of main concept, 2 = child of level 1, etc.
}

export interface GapConcept {
  name: string;
  description?: string; // Why this concept is important for understanding the parent
  parentConcept?: string | null; // Name of parent concept if this is a nested sub-concept
  level?: number; // Hierarchy level: 1 = direct child of main concept, 2 = child of level 1, etc.
}

export interface MentionedNode {
  nodeLabel: string; // Label of the node that was mentioned (must match a canvas node)
  partialScore: number; // 5-30% score boost based on depth of mention
  context: string; // What the user said about this concept
}

export interface AnalysisResult {
  mainScore: number; // 0-100 for the main concept
  feedback: string; // What they got right/wrong
  discoveredConcepts: DiscoveredConcept[];
  gapConcepts: GapConcept[]; // Missing concepts at the same level as discovered concepts
  mentionedNodes: MentionedNode[]; // Other canvas nodes mentioned in the explanation
  gaps: string[]; // Important things they missed
  correctAnswer: string; // What the correct/complete explanation should be
  specificGaps: string[]; // Detailed gaps based on what they actually provided
  isQuestion?: boolean; // Whether the input was a question
  teachingResponse?: string; // Conversational teaching response for questions
  isNudge?: boolean; // Whether this is a nudge (user showed no understanding)
  nudgeHint?: string; // One-sentence hint with a keyword to think about
  keyTakeaways?: string[]; // 1-2 key facts to remember (max 6 words each)
  emoji?: string; // Emoji representing the main concept
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { 
      concept, 
      userExplanation, 
      topic, 
      existingNodesMap, 
      hasBeenNudged,
      // New context fields for hierarchy-aware analysis
      currentNodeLevel,
      parentLabel,
      siblingLabels,
      expectedSubconcepts,
    } = await request.json();

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

    // Build list of existing concept labels for emphasis
    const existingConceptLabels: string[] = existingNodesMap && Array.isArray(existingNodesMap) 
      ? existingNodesMap.map((n: any) => n.label).filter((l: any) => typeof l === "string" && l.trim() !== "")
      : [];
    
    // Build context strings for hierarchy-aware prompting
    const nodeLevel = typeof currentNodeLevel === "number" ? currentNodeLevel : 0;
    const parentConceptLabel = typeof parentLabel === "string" ? parentLabel : null;
    const siblings = Array.isArray(siblingLabels) ? siblingLabels : [];
    const expectedSubs = Array.isArray(expectedSubconcepts) ? expectedSubconcepts : [];

    // Check if user has no understanding (only if not already nudged)
    if (!hasBeenNudged) {
      const noUnderstandingPatterns = [
        /^i\s*don'?t\s*know/i,
        /^no\s*idea/i,
        /^not\s*sure/i,
        /^i\s*have\s*no\s*(idea|clue)/i,
        /^idk/i,
        /^\?+$/,
        /^help/i,
        /^what\s*is\s*(this|it|that)\??$/i,
      ];

      const trimmedExplanation = userExplanation.trim();
      const isVeryShort = trimmedExplanation.length < 15;
      const matchesNoUnderstanding = noUnderstandingPatterns.some(p => p.test(trimmedExplanation));

      if (matchesNoUnderstanding || (isVeryShort && trimmedExplanation.split(/\s+/).length < 4)) {
        // Generate a nudge hint
        const nudgePrompt = `You are a patient teacher. The student said "${userExplanation}" when asked to explain "${concept}".

They clearly don't know where to start. Give them ONE helpful nudge - a single keyword or key fact to think about.

Return JSON:
{
  "nudgeHint": "Think about **[keyword]** - [short question or prompt, max 15 words]"
}

RULES:
- Use **bold** for the keyword they should focus on
- Keep it to ONE sentence
- Make it a gentle nudge, not the answer
- Help them connect to something they might already know`;

        const nudgeCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a gentle teacher giving ONE helpful nudge. Return valid JSON only.",
            },
            {
              role: "user",
              content: nudgePrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 100,
          response_format: { type: "json_object" },
        });

        const nudgeText = nudgeCompletion.choices[0]?.message?.content?.trim() || "{}";
        const nudgeResult = JSON.parse(nudgeText);

        return Response.json({
          success: true,
          isNudge: true,
          nudgeHint: nudgeResult.nudgeHint || `Think about **${concept}** - what comes to mind when you hear this term?`,
          mainScore: 0,
          feedback: "",
          discoveredConcepts: [],
          gapConcepts: [],
          gaps: [],
          correctAnswer: "",
          specificGaps: [],
          keyTakeaways: [],
        });
      }
    }

    // First, detect if the user is asking a question
    const questionDetectionPrompt = `Analyze this user input and determine if it's a QUESTION or an EXPLANATION.

User input: "${userExplanation}"

A QUESTION typically:
- Starts with question words (what, how, why, when, where, who, can, could, would, is, are, does, do, etc.)
- Ends with a question mark
- Asks for clarification, help, or information
- Uses phrases like "I don't understand", "Can you explain", "What does", "How does"

An EXPLANATION typically:
- States facts or describes something
- Explains a concept in their own words
- Attempts to demonstrate understanding
- Uses declarative statements

Return JSON:
{
  "isQuestion": true or false,
  "confidence": 0-100 (how confident you are in this classification)
}`;

    const questionDetection = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a classifier that determines if user input is a question or an explanation. Return valid JSON only.",
        },
        {
          role: "user",
          content: questionDetectionPrompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 50,
      response_format: { type: "json_object" },
    });

    const detectionText = questionDetection.choices[0]?.message?.content?.trim() || "{}";
    const detectionResult = JSON.parse(detectionText);
    const isQuestion = detectionResult.isQuestion === true && (detectionResult.confidence || 0) > 50;

    // Build context string for prompts
    const mapContextString = existingNodesMap && Array.isArray(existingNodesMap) && existingNodesMap.length > 0
      ? `FULL KNOWLEDGE MAP CONTEXT - You are chatting with an interactive knowledge network. Here's the complete current state:

${JSON.stringify(existingNodesMap, null, 2)}

CRITICAL MAP AWARENESS:
- You can see ALL nodes, their scores (0-100), levels, and parent-child relationships
- Use this context to intelligently place new concepts at the correct hierarchy level
- Check for semantic duplicates - if a concept already exists (even with different wording), DO NOT create it again
- Understand the full structure: level 0 = root topic, level 1 = main concepts, level 2 = sub-concepts
- When scoring, consider existing scores to maintain consistency
- When adding gap concepts, only add at the SAME level as discovered concepts`
      : "This is a new map - no existing concepts yet.";
    
    // Build hierarchy context string for context-aware analysis
    const hierarchyContextString = `
CURRENT NODE POSITION IN HIERARCHY:
- Active node being explained: "${concept}" at level ${nodeLevel}
- Parent node: ${parentConceptLabel ? `"${parentConceptLabel}"` : "None (this is a top-level concept)"}
- Sibling concepts (already exist at same level): ${siblings.length > 0 ? siblings.join(", ") : "None"}

EXPECTED SUB-CONCEPTS for "${concept}" (pre-generated curriculum):
${expectedSubs.length > 0 ? JSON.stringify(expectedSubs, null, 2) : "None defined"}

HIERARCHY-AWARE RULES - CRITICAL:
1. DO NOT create "${concept}" itself as a discovered sub-concept (user is ALREADY explaining this concept)
2. DO NOT create "${parentConceptLabel || 'the parent'}" as a discovered concept (that's the parent)
3. DO NOT create any sibling concepts that already exist: ${siblings.length > 0 ? siblings.join(", ") : "N/A"}
4. ONLY discover concepts that should be CHILDREN of "${concept}"
5. When user mentions something matching an expected sub-concept, use the CANONICAL name from the list above
6. Concepts the user mentions that match the expected sub-concepts should be scored based on explanation depth`;

    // If it's a question, switch to conversational teaching mode
    if (isQuestion) {
      const teachingPrompt = `You are a friendly, patient TEACHER using the Feynman technique. The student is asking a QUESTION, not providing an explanation. Chat with them directly like a teacher would.

Topic: "${topic || concept}"
Main Concept Being Explained: "${concept}"

${mapContextString}

${hierarchyContextString}

Student's Question:
"${userExplanation}"

YOUR TASK:
- Answer their question directly and conversationally
- Use simple language a child could understand
- Provide a clear, helpful explanation
- Be encouraging and supportive
- If their question reveals they're confused about something, address that confusion
- Keep it conversational - you're teaching, not evaluating

Return JSON:
{
  "isQuestion": true,
  "teachingResponse": "A friendly, conversational answer to their question. 2-4 sentences. Use simple language. Be encouraging. This is a teaching moment, not an evaluation.",
  "discoveredConcepts": [
    {
      "name": "SubConcept Name (only if their question naturally leads to exploring a new sub-concept)",
      "score": 0,
      "description": "Brief note on why this concept is relevant"
    }
  ]
}

IMPORTANT:
- Only include discoveredConcepts if their question naturally leads to exploring a genuinely NEW sub-concept that isn't already on the map
- If their question is just asking for clarification about "${concept}" itself, don't create new sub-concepts
- Be conversational and helpful, not evaluative`;

      const teachingCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a friendly, patient teacher using the Feynman technique. When students ask questions, answer them conversationally and helpfully. Return valid JSON only.",
          },
          {
            role: "user",
            content: teachingPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: "json_object" },
      });

      const teachingText = teachingCompletion.choices[0]?.message?.content?.trim() || "{}";
      const teachingResult = JSON.parse(teachingText);

      return Response.json({
        success: true,
        isQuestion: true,
        teachingResponse: teachingResult.teachingResponse || "I'm here to help! What would you like to know?",
        discoveredConcepts: Array.isArray(teachingResult.discoveredConcepts)
          ? teachingResult.discoveredConcepts.map((c: any) => ({
              name: (c.name || "").trim(),
              score: 0,
              description: (c.description || "").trim(),
              parentConcept: c.parentConcept === null || c.parentConcept === undefined 
                ? null 
                : (c.parentConcept || "").trim() || null,
              level: c.level !== undefined && c.level !== null 
                ? Math.max(1, Math.min(2, parseInt(c.level) || 1))
                : 1,
            })).filter((c: DiscoveredConcept) => c.name !== "")
          : [],
        mainScore: 0, // Not applicable for questions
        feedback: "",
        gapConcepts: [],
        gaps: [],
        correctAnswer: "",
        specificGaps: [],
      });
    }

    // If it's an explanation, proceed with evaluation
    const analysisPrompt = `You are a Feynman technique TEACHER. Your job is to TEACH, not just judge. Analyze the student's explanation and provide comprehensive teaching feedback.

Topic: "${topic || concept}"
Main Concept Being Explained: "${concept}"

${mapContextString}

${hierarchyContextString}

Student's Explanation:
"${userExplanation}"

YOUR TASK:
1. Identify EXACTLY what they got right from their explanation
2. Identify SPECIFIC gaps based on what they actually said (not generic gaps)
3. Provide what the CORRECT and COMPLETE explanation should be
4. Give constructive feedback that helps them learn
5. Identify missing concepts at the SAME LEVEL as what they mentioned (gap concepts)

CRITICAL SCORING RUBRIC - BE STRICT:
Score sub-concepts based on EXPLANATION DEPTH, not just mention:
- **5-15%**: Just mentioned the name (e.g., "there's cardio")
- **15-30%**: Mentioned with brief context (e.g., "cardio is for heart health")
- **30-60%**: Explained how it works (e.g., "cardio increases heart rate to improve cardiovascular fitness")
- **60-85%**: Explained with examples/analogies (e.g., "cardio is like running - it makes your heart stronger")
- **85-100%**: Complete Feynman-level explanation (simple, complete, correct, with examples)

The score reflects HOW WELL they explained that specific sub-concept, NOT just that they mentioned it.

EXISTING CONCEPTS ON THE MAP (use **bold** when mentioning these):
${existingConceptLabels.length > 0 ? existingConceptLabels.join(", ") : "None yet"}

Analyze and return JSON:
{
  "mainScore": 0-100 (how well they explained "${concept}" - be strict but fair),
  "feedback": "2-3 sentences: Start with what they got RIGHT. Then clearly state the main gap. Be specific about what they said vs what they should have said. End with encouragement to try again. Use **bold** for question words (how, what, why, when, where) and concept names.",
  "discoveredConcepts": [
    {
      "name": "Correct SubConcept Name",
      "score": 0-100 (STRICT: 5-15% if just named, 15-30% if brief context, 30-60% if explained how, 60-85% if with examples, 85-100% if complete),
      "description": "Brief note on what they said about it",
      "parentConcept": null or "Parent Concept Name" (null if direct child of "${concept}", otherwise the name of the parent discovered concept),
      "level": 1 or 2 (1 = direct child of "${concept}", 2 = child of a level 1 concept)
    }
  ],
  "gapConcepts": [
    {
      "name": "Missing Concept Name",
      "description": "Why this concept is important for understanding the parent (1 sentence)",
      "parentConcept": null or "Parent Concept Name" (null if should be at same level as discovered level 1 concepts, otherwise the name of the parent),
      "level": 1 or 2 (MUST match the level of discovered concepts - if user mentioned level 1 concepts, gaps are level 1; if they mentioned level 2, gaps are level 2 under the same parent)
    }
  ],
  "gaps": ["Important thing they missed", "Another gap"],
  "correctAnswer": "A complete, simple, correct explanation of '${concept}' in 2-3 sentences that a child could understand. This is what they SHOULD have said. Make it clear and complete. Use **bold** for key terms and concept names.",
  "specificGaps": [
    "Specific gap 1: What they said vs what they should have said (be precise)",
    "Specific gap 2: Another specific issue based on their actual explanation"
  ],
  "keyTakeaways": [
    "One essential fact to remember (max 6 words)",
    "Another key point if needed (max 6 words)"
  ],
  "mentionedNodes": [
    {
      "nodeLabel": "Exact label of another canvas node they mentioned (MUST exist in EXISTING CONCEPTS ON THE MAP)",
      "partialScore": 5-30 (5 if just named, 15 if with context, 30 if explained in relation to main concept),
      "context": "Brief note on what they said about this other concept"
    }
  ]
}

CRITICAL TEACHING RULES:
- **correctAnswer**: This is THE teaching moment. Provide a complete, simple, correct explanation that shows them what they should aim for. 2-3 sentences max, in simple terms.
- **specificGaps**: Be VERY specific. Compare what they actually said to what they should have said. For example:
  - If they said "it moves fast" but should have said "it moves at 300,000 km/s", the gap is: "You said 'it moves fast' but you should specify the speed: light travels at 300,000 kilometers per second"
  - If they missed a key component, say: "You explained X well, but you didn't mention Y, which is crucial because..."
- **feedback**: Must reference their ACTUAL explanation. Say things like "You correctly said [quote their words], but you missed [specific thing]. The complete explanation should include..."
- **EXTRACT EVERYTHING MENTIONED**: If the user mentions a concept, it MUST appear in discoveredConcepts, even if poorly explained. The score reflects explanation quality but does NOT filter concepts. Extract ALL distinct concepts they mentioned.
- **HIERARCHICAL EXTRACTION**: Create proper parent-child relationships. Identify:
  - **Level 1 concepts** (direct children of "${concept}"): Categories, types, or major components (e.g., "Red Light", "Near-Infrared Light", "Penetration Depth")
  - **Level 2 concepts** (children of level 1): Specific instances or details (e.g., "650nm" under "Red Light", "850nm" under "Near-Infrared Light")
  - Use parentConcept field to link level 2 concepts to their level 1 parent
  - Use level field to indicate hierarchy depth (1 or 2)
- **DISTINCT CONCEPTS MUST BE SEPARATE**: If the user mentions TWO or MORE genuinely different things, create SEPARATE discoveredConcepts for EACH one. DO NOT merge distinct concepts.
  - Example: If they mention "650nm and 850nm", create:
    - Level 1: "Red Light" (parentConcept: null, level: 1) - category for 650nm
    - Level 2: "650nm" (parentConcept: "Red Light", level: 2) - specific instance
    - Level 1: "Near-Infrared Light" (parentConcept: null, level: 1) - category for 850nm
    - Level 2: "850nm" (parentConcept: "Near-Infrared Light", level: 2) - specific instance
- **CONCEPT NAME NORMALIZATION**: Use canonical, academic terminology. Map informal terms to standard names:
  - Use category names for level 1 (e.g., "Red Light" not "650nm light")
  - Use specific names for level 2 (e.g., "650nm" not "red light wavelength")
- **AVOID REDUNDANT CONCEPTS**: Do NOT create concepts that are just the parent + context. For example, if "${concept}" is "Wavelengths", don't create "Wavelengths in Red Light Therapy" - instead create "Red Light Therapy" as a separate concept if mentioned, or just "Red Light" if that's what they meant.
- **CRITICAL: NO SEMANTIC DUPLICATES - AGGRESSIVE DETECTION REQUIRED**: Before creating ANY new concept, you MUST check if it already exists semantically on the map. This is about building a knowledge map, not listing synonyms. Examples of semantic duplicates to AVOID:
  - "Cell Energy Production" = "Mitochondrial Function" = "Cellular Respiration" (all refer to the same core process)
  - "Cardio" = "Cardiovascular Training" = "Cardiovascular Exercise" = "Aerobic Exercise" (same concept, different terms)
  - "Resistance Training" = "Strength Training" = "Weight Training" (same concept)
  - "Zone 2" = "Zone 2 Training" = "Aerobic Zone" (same concept)
  - "Photosynthesis" = "How plants make food" = "Plant energy production" (same concept)
  
  **DUPLICATE DETECTION RULES:**
  1. **Context is key**: Always consider the CONTEXT and MEANING, not just the words. If two concepts describe the same process, mechanism, or idea, they are duplicates.
  2. **Check the full map**: Look at ALL existing nodes in the map context. If a concept already exists (even with different wording), DO NOT create it again.
  3. **Semantic similarity**: Use your understanding of the domain. "Cell Energy Production" and "Mitochondrial Function" are the SAME concept - mitochondria ARE what produce cell energy. Don't create both.
  4. **Level doesn't matter**: If a concept exists at any level, don't create a duplicate at another level.
  5. **When in doubt, DON'T create**: If you're unsure whether something is a duplicate, err on the side of NOT creating it. The goal is a clean knowledge map, not exhaustive listing.
  6. **Check parent-child relationships**: If a concept is already a parent or child of the current concept, it's likely a duplicate or redundant.
  
  **ONLY create a new concept if:**
  - It's genuinely a DIFFERENT concept (not just a different way to say the same thing)
  - It adds NEW information that isn't already captured by existing nodes
  - It represents a distinct aspect, component, or sub-process that isn't already on the map
  
  **Remember**: The goal is to build a MAP of knowledge, not a list of synonyms. Each node should represent a UNIQUE concept or idea.
- **mainScore**: Be strict. 80+ means excellent, simple, complete explanation. 50-79 means good but missing parts. Below 50 means significant gaps.
- **gapConcepts - CRITICAL RULES**:
  - **SAME LEVEL ONLY**: Gap concepts must be at the SAME level as the discovered concepts the user mentioned
  - If user mentioned level 1 concepts (direct children of "${concept}"), gapConcepts should be level 1 concepts that are missing
  - If user mentioned level 2 concepts (under a level 1 parent), gapConcepts should be level 2 concepts under the SAME parent
  - **DO NOT pre-fill deeper levels**: Only show gaps at the level the user is currently exploring
  - **Focus on most important gaps**: Only include 2-4 most important missing concepts at that level
  - **Use parentConcept field**: If gap is level 2, set parentConcept to the level 1 parent name
  - Example: If user explains "Exercise" and mentions "Cardio" and "Resistance Training" (level 1), add gaps like "Mobility" and "Recovery" at level 1. Do NOT add sub-concepts under Cardio yet - those only appear when user explores Cardio.
- **mentionedNodes - CROSS-REFERENCE DETECTION**:
  - Scan the user's explanation for mentions of OTHER nodes that exist on the canvas (listed in EXISTING CONCEPTS ON THE MAP)
  - Do NOT include "${concept}" itself - that's the main concept being explained
  - Do NOT include child concepts being discovered - those go in discoveredConcepts
  - ONLY include nodes that ALREADY EXIST on the canvas and are NOT the active concept or its children
  - nodeLabel MUST exactly match one of the existing concept labels listed above
  - partialScore: 5-10 if just named in passing, 15-20 if mentioned with context, 25-30 if explained the relationship to the main concept
  - Example: If user is explaining "Mechanism of Action" and says "this is important for therapeutic benefits", add "Therapeutic Benefits" to mentionedNodes with a partial score
- The goal is to TEACH them, not just score them. They should be able to read your feedback and the correctAnswer, then try again with better understanding.

TEXT EMPHASIS RULES:
- Use **bold** for question words: **how**, **what**, **why**, **when**, **where**, **who**
- Use **bold** for concept names that exist on the map (listed above)
- Use **bold** for key terms in the correctAnswer
- This helps users scan and understand the text quickly

KEY TAKEAWAYS RULES:
- Extract 1-2 essential facts the user should absolutely remember
- Each takeaway must be MAX 6 words
- Base these on what they discussed or should remember
- Make them memorable and concise (e.g., "Mitochondria powers the cell", "Light travels at 300,000 km/s")`;


    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a TEACHER using the Feynman technique. Your goal is to help students learn by showing them what they got right, what they missed, and what the correct answer should be. Be specific, constructive, and encouraging. Return valid JSON only.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content?.trim() || "{}";
    const result = JSON.parse(responseText);

    // Generate emoji for the main concept
    let emoji: string | undefined;
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
            content: `Generate a single emoji that best represents the concept: "${concept}". Return only the emoji, no text.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 10,
      });
      emoji = emojiCompletion.choices[0]?.message?.content?.trim() || undefined;
    } catch (emojiError) {
      console.error("Error generating emoji:", emojiError);
      // Continue without emoji if generation fails
    }

    // Validate and normalize the response
    const analysis: AnalysisResult = {
      mainScore: Math.max(0, Math.min(100, parseInt(result.mainScore) || 0)),
      feedback: result.feedback || "Good effort! Keep practicing.",
      discoveredConcepts: Array.isArray(result.discoveredConcepts) 
        ? result.discoveredConcepts.map((c: any) => ({
            name: (c.name || "").trim(),
            score: Math.max(0, Math.min(100, parseInt(c.score) || 0)),
            description: (c.description || "").trim(),
            parentConcept: c.parentConcept === null || c.parentConcept === undefined 
              ? null 
              : (c.parentConcept || "").trim() || null,
            level: c.level !== undefined && c.level !== null 
              ? Math.max(1, Math.min(2, parseInt(c.level) || 1))
              : 1,
          })).filter((c: DiscoveredConcept) => c.name !== "")
        : [],
      gapConcepts: Array.isArray(result.gapConcepts)
        ? result.gapConcepts.map((c: any) => ({
            name: (c.name || "").trim(),
            description: (c.description || "").trim() || undefined,
            parentConcept: c.parentConcept === null || c.parentConcept === undefined 
              ? null 
              : (c.parentConcept || "").trim() || null,
            level: c.level !== undefined && c.level !== null 
              ? Math.max(1, Math.min(2, parseInt(c.level) || 1))
              : 1,
          })).filter((c: GapConcept) => c.name !== "")
        : [],
      gaps: Array.isArray(result.gaps) 
        ? result.gaps.filter((g: any) => typeof g === "string" && g.trim() !== "")
        : [],
      correctAnswer: (result.correctAnswer || "").trim() || "A complete explanation will be provided.",
      specificGaps: Array.isArray(result.specificGaps)
        ? result.specificGaps.filter((g: any) => typeof g === "string" && g.trim() !== "")
        : [],
      keyTakeaways: Array.isArray(result.keyTakeaways)
        ? result.keyTakeaways
            .filter((t: any) => typeof t === "string" && t.trim() !== "")
            .slice(0, 2) // Max 2 takeaways
        : [],
      mentionedNodes: Array.isArray(result.mentionedNodes)
        ? result.mentionedNodes
            .filter((m: any) => 
              m.nodeLabel && 
              typeof m.nodeLabel === "string" && 
              m.nodeLabel.trim() !== "" &&
              // Only include nodes that actually exist on the canvas
              existingConceptLabels.some((label: string) => 
                label.toLowerCase() === m.nodeLabel.toLowerCase().trim()
              )
            )
            .map((m: any) => ({
              nodeLabel: m.nodeLabel.trim(),
              partialScore: Math.max(5, Math.min(30, parseInt(m.partialScore) || 10)),
              context: (m.context || "").trim(),
            }))
        : [],
      emoji,
    };

    return Response.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    console.error("Error analyzing explanation:", error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Check for OpenAI API errors
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status?: number; message?: string };
      if (apiError.status === 401) {
        return Response.json(
          { error: "OpenAI API key is invalid or missing. Please check your configuration." },
          { status: 500 }
        );
      }
      if (apiError.status === 429) {
        return Response.json(
          { error: "Rate limit exceeded. Please try again in a moment." },
          { status: 500 }
        );
      }
    }

    if (error instanceof SyntaxError) {
      return Response.json(
        { error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    return Response.json(
      { 
        error: error instanceof Error 
          ? `Failed to analyze explanation: ${error.message}` 
          : "Failed to analyze explanation. Please check server logs for details." 
      },
      { status: 500 }
    );
  }
}
