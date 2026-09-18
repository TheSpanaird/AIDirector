// modules/ai-director/scripts/api/run-prompt.js

import { OllamaClient } from "./ollama-client.js";

/**
 * Universal runner to process single-turn system/user pairs 
 * through the standardized Ollama Client architecture.
 */
export async function runPrompt({ model, system, prompt }) {
  // Format the flat strings into a valid, structured multi-turn message payload
  const structuralMessages = [];

  if (system) {
    structuralMessages.push({ role: "system", content: system });
  }
  
  if (prompt) {
    structuralMessages.push({ role: "user", content: prompt });
  }

  // Dispatch cleanly via our unified API abstraction
  return await OllamaClient.chat(structuralMessages, {
    model: model || OllamaClient.DEFAULT_MODEL,
    temperature: 0.5,
    num_predict: 500
  });
}