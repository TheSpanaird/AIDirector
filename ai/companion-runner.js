import { buildPrompt } from "./prompt-builder.js";
import { MODULE_ID } from "../settings.js";

export async function runCompanion(request){

  const model = game.settings.get(MODULE_ID, "defaultModel");

  const { system, user } = buildPrompt(request);

  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  // ✅ FIX: handle streamed / multi-part JSON from Ollama
  const text = await r.text();

  const lines = text.trim().split("\n");

  let lastResponse = "";

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.message?.content) {
        lastResponse = obj.message.content;
      }
    } catch {
      // Ignore malformed chunks
    }
  }

  return lastResponse || "No response";
}