// test-scene-record-export.js
// Foundry/browser-console smoke test for Pass 4 journal/chat Scene Record export.

(async () => {
  const cacheBust = Date.now();
  const syncModule = await import(`/modules/ai-director/scripts/data/dungeon-sync.js?v=${cacheBust}`);
  const chatModule = await import(`/modules/ai-director/scripts/chat/chat-engine.js?v=${cacheBust}`);

  const manifest = {
    manifestId: "pass-4-export-test",
    dungeonTitle: "Abandoned Barracks Test",
    overallGoal: "Learn why the garrison vanished.",
    totalSectors: 1,
    structureType: "CASTLE",
    sceneArchetype: "KEEP_AND_BAILEY",
    occupancyState: "ABANDONED",
    sectors: [
      {
        sectorId: "abandoned-barracks",
        name: "Abandoned Barracks",
        displayName: "Abandoned Barracks",
        floor: 1,
        sectorType: "DETACHED_BUILDING",
        areaState: "RUINED",
        mundaneAllowed: true,
        sensoryDescription: "Dusty bunks line the walls. Broken shields hang from rusted hooks.",
        playerViewPrompt: "Eye-level view from the doorway of a ruined barracks with dusty bunks and broken shields.",
        tacticalMapPrompt: "Top-down tactical layout of a rectangular barracks with bunks and one doorway.",
        mapPrompt: "Top-down tactical layout of a rectangular barracks with bunks and one doorway.",
        inhabitants: [],
        monsters: [],
        traps: [],
        secrets: [{ id: "loose-stone", description: "A loose stone hides an old warning note.", visibility: "GM_ONLY" }],
        clues: [{ id: "tally-marks", description: "Scratched tally marks on the inside of a bunk frame.", visibility: "VISIBLE" }],
        loot: [],
        interactables: [{ id: "bunk-frame", name: "Bunk Frame", description: "A damaged bunk frame with scratches.", visibility: "VISIBLE" }],
        encounters: [],
        npcs: [],
        trapsAndSecrets: "Loose stone hides an old warning note.",
        gmNotes: "GM-only note should stay in memory export, not chat summary.",
        connections: [{ to: "bailey", doorType: "open_archway", connectionType: "DIRECT" }]
      }
    ]
  };

  const memoryHtml = syncModule.renderManifestMemoryHtml(manifest);
  const chatHtml = syncModule.renderManifestChatSummaryHtml(manifest);
  const chatHtmlViaChatEngine = chatModule.formatSceneRecordForChat(manifest);

  const checks = {
    memoryIncludesPlayerViewPrompt: memoryHtml.includes("Player-view panorama prompt") && memoryHtml.includes("Eye-level view"),
    memoryIncludesTacticalPrompt: memoryHtml.includes("Tactical map prompt") && memoryHtml.includes("Top-down tactical layout"),
    memoryIncludesGmOnlySecret: memoryHtml.includes("loose-stone") && memoryHtml.includes("GM_ONLY"),
    memoryEmbedsManifestJson: memoryHtml.includes("data-manifest-json"),
    chatIncludesSensoryDescription: chatHtml.includes("Dusty bunks line the walls"),
    chatIncludesVisibleClue: chatHtml.includes("Scratched tally marks"),
    chatDoesNotExposeGmOnlySecret: !chatHtml.includes("loose-stone") && !chatHtml.includes("old warning note"),
    chatDoesNotExposeGmNotes: !chatHtml.includes("GM-only note"),
    chatEngineUsesSameRenderer: chatHtmlViaChatEngine === chatHtml
  };

  console.log("[SCENE RECORD EXPORT TEST] Memory HTML:", memoryHtml);
  console.log("[SCENE RECORD EXPORT TEST] Chat HTML:", chatHtml);
  console.table(checks);

  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length) {
    ui.notifications?.warn?.(`Scene Record export test failed: ${failed.join(", ")}`);
    console.warn("[SCENE RECORD EXPORT TEST] Failed checks:", failed);
  } else {
    ui.notifications?.info?.("Scene Record export test passed.");
  }

  return { checks, failed, memoryHtml, chatHtml };
})();
