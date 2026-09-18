// modules/ai-director/scripts/chat/chat-engine.js
// PASS 4 UPDATED: supports structured Scene Record chat summaries.
import { renderManifestChatSummaryHtml } from "../data/dungeon-sync.js";

export async function processAndRouteResponse(cleanAiResponse, mode, actor = null) {
  if (!cleanAiResponse) return;

  if (cleanAiResponse.includes("SPEAKER:")) {
    await dispatchMultiNpcChatMessages(cleanAiResponse);
    return;
  }

  const speakerPayload = ChatMessage.getSpeaker();
  await ChatMessage.create({
    user: game.user.id,
    speaker: speakerPayload,
    content: cleanAiResponse,
    flags: { "ai-director": { isAiGenerated: true, modeContext: mode } }
  });
}

export function formatSceneRecordForChat(manifest, options = {}) {
  return renderManifestChatSummaryHtml(manifest, options);
}

export async function postSceneRecordToChat(manifest, options = {}) {
  if (!manifest) return null;
  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ alias: "AI Director" }),
    content: formatSceneRecordForChat(manifest, options),
    flags: {
      "ai-director": {
        isAiGenerated: true,
        modeContext: "scene-record-summary",
        manifestId: manifest.manifestId || null,
        dungeonTitle: manifest.dungeonTitle || null
      }
    }
  });
}

async function dispatchMultiNpcChatMessages(normalizedText) {
  const speakerRegex = /\[SPEAKER:\s*([^\]]+)\]([\s\S]*?)(?=\[SPEAKER:|$)/g;
  let matchesFound = false;
  let match;

  while ((match = speakerRegex.exec(normalizedText)) !== null) {
    matchesFound = true;
    const speakerName = match[1].trim();
    const messageContent = match[2].trim();
    if (!messageContent) continue;
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: speakerName }),
      content: messageContent,
      flags: { "ai-director": { isAiGenerated: true, modeContext: "multi-speaker" } }
    });
  }

  if (!matchesFound) {
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ alias: "AI Director" }),
      content: normalizedText
    });
  }
}
