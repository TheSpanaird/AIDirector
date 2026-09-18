// modules/ai-director/scripts/modes/gm-modes.js

import { buildPrompt } from "../ai/prompt-builder.js";
import { buildScenePrompt } from "../ai/prompt-scene.js";
import { processAndRouteResponse } from "../chat/chat-engine.js";
import { buildGMPrompt } from "../prompt-factory/gm-prompts.js"; 

/**
 * Executes a targeted Game Master interaction engine strategy.
 * Handles: Question, Actions, Yes/No, and Environmental Observations.
 */
export async function executeGMMode(message, mode = "auto", contextData = {}, options = {}) {
  let safeMode = (mode || "auto").toLowerCase().replace(/\s+/g, "");
  
  let targetTokens = 300;
  let targetTemp = 0.5;

  // Track operational variations dynamically
  if (safeMode === "question" || safeMode === "yesno" || safeMode === "info") {
    targetTokens = 250;
    targetTemp = 0.3; 
  } else if (safeMode === "observe" || safeMode === "description_short" || safeMode === "action" || safeMode === "description") {
    targetTokens = 400;
    targetTemp = 0.6;
  }

  let system = "";
  let user = "";

  // 🚀 DIRECT BYPASS GATE FOR EXPLICIT MODES
  if (safeMode !== "auto") {
    // Map raw select values smoothly to buildGMPrompt switch terms
    let promptMode = safeMode;
    if (safeMode === "yes/no") promptMode = "yesno";
    if (safeMode === "description") promptMode = "description_short";

    const ctx = {
      userCharacterName: contextData.userCharacterName || "The Character",
      journalText: contextData.journalText || "NO_MATCHING_CANON_DATA_FOUND",
      currentOutput: contextData.currentOutput || "",
      chatHistoryText: contextData.chatHistoryText || "",
      state: contextData.state || { recentEvents: [] }
    };

    // FIXED: Added mandatory 'await' since buildGMPrompt is an async function
    const promptPayload = await buildGMPrompt(promptMode, message, ctx);
    system = promptPayload.systemDirective;
    user = promptPayload.userPayload;
    
    console.log(`AI Director | Bypassing Auto Builder. Routing directly via GM Prompt Blueprint: [${promptMode}]`);
  } else {
    // Fall back safely to standard open-ended generation pipeline if in Auto mode
    const builders = await buildPrompt(message, {
      mode: safeMode,
      actor: null,
      actorName: "Game Master",
      currentOutput: contextData.currentOutput || "",
      journalText: contextData.journalText || "",
      memoryText: contextData.memoryText || "",
      chatHistoryText: contextData.chatHistoryText || ""
    });
    system = builders.system;
    user = builders.user;
  }

  // Gather configuration from game settings dynamically
  const baseUrl = game.settings.get("ai-director", "ollamaHost") || "http://localhost:11434";
  const directUrl = `${baseUrl.replace(/\/$/, "")}/api/generate`;
  const defaultModel = game.settings.get("ai-director", "modelName") || "hermes3";

  // Compile the hardened ChatML layout directly to keep Hermes 3 locked in character
  const fullPrompt = [
    "<|im_start|>system",
    system,
    "<|im_end|>",
    "<|im_start|>user",
    user,
    "<|im_end|>",
    "<|im_start|>assistant"
  ].join("\n");

  const response = await fetch(directUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: defaultModel,
      prompt: fullPrompt,
      stream: false,
      options: { temperature: targetTemp, num_predict: targetTokens }
    })
  });

  if (!response.ok) throw new Error(`Ollama GM Mode Error: ${response.statusText}`);
  const data = await response.json();
  const rawAiResponse = data.response || "";

  if (!options.skipChat) {
    await processAndRouteResponse(rawAiResponse, safeMode, "Game Master");
  }
  
  return rawAiResponse;
}

export async function executeSceneGeneration(journalText, memoryText, chaosFactor) {
  const { system, user } = buildScenePrompt(journalText, memoryText, chaosFactor);

  const baseUrl = game.settings.get("ai-director", "ollamaHost") || "http://localhost:11434";
  const directUrl = `${baseUrl.replace(/\/$/, "")}/api/generate`;
  const defaultModel = game.settings.get("ai-director", "modelName") || "hermes3";

  const fullPrompt = [
    "<|im_start|>system",
    system,
    "<|im_end|>",
    "<|im_start|>user",
    user,
    "<|im_end|>",
    "<|im_start|>assistant"
  ].join("\n");

  const response = await fetch(directUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: defaultModel,
      prompt: fullPrompt,
      stream: false,
      options: { temperature: 0.7, num_predict: 800 }
    })
  });

  if (!response.ok) throw new Error(`Ollama Scene Mode Error: ${response.statusText}`);
  const data = await response.json();
  return data.response || "";
}