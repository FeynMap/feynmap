import { OpenAI } from "openai";
import type { Route } from "./+types/api.transcribe";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return Response.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // Check file size (OpenAI has a 25MB limit)
    if (audioFile.size > 25 * 1024 * 1024) {
      return Response.json(
        { error: "Audio file is too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    console.log(`Transcribing audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`);

    // Convert to File object that OpenAI expects
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    if (!transcription || !transcription.text) {
      console.error("Transcription returned empty result");
      return Response.json(
        { error: "Transcription returned no text. Please try again." },
        { status: 500 }
      );
    }

    console.log(`Transcription successful: ${transcription.text.substring(0, 50)}...`);

    return Response.json({
      success: true,
      text: transcription.text,
    });
  } catch (error) {
    console.error("Error transcribing audio:", error);
    
    // More detailed error handling
    if (error && typeof error === "object") {
      // Check for OpenAI API errors
      if ("status" in error) {
        const apiError = error as { status?: number; message?: string; error?: { message?: string } };
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
        // Get error message from OpenAI error object
        const errorMessage = apiError.error?.message || apiError.message || "OpenAI API error";
        return Response.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
      
      // Check for other error types
      if ("message" in error) {
        const err = error as { message?: string };
        return Response.json(
          { error: err.message || "Failed to transcribe audio" },
          { status: 500 }
        );
      }
    }

    // Fallback error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === "string" 
      ? error 
      : "Failed to transcribe audio. Please check your microphone and try again.";
    
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
