// src/lib/groq.ts
// Groq client singleton

import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Default model for all Groq calls
export const GROQ_MODEL = "llama-3.3-70b-versatile";
