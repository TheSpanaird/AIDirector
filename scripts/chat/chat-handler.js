// modules/ai-director/scripts/chat/chat-handler.js
// PASS 4 UPDATED: adds manifest summary posting helper.
import { postSceneRecordToChat } from "./chat-engine.js";

export async function postToChat(content) {
  return ChatMessage.create({
    speaker: { alias: "AI Director" },
    content
  });
}

export async function postManifestSummaryToChat(manifest, options = {}) {
  return postSceneRecordToChat(manifest, options);
}
