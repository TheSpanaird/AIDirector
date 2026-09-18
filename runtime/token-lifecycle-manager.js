// modules/ai-director/scripts/runtime/token-lifecycle-manager.js
// EN-18: Detects actor defeat and records it to the event ledger, once per actor.

import {
  EventLedgerManager
}
from "./event-ledger-manager.js";

import {
  CombatStateResolver
}
from "./combat-state-resolver.js";

Hooks.on(
  "updateActor",
  async actor => {

    if (!actor) {
      return;
    }

    if (
      !CombatStateResolver
        .isDefeated(actor)
    ) {
      return;
    }

    const alreadyRecorded =
      actor.getFlag(
        "ai-director",
        "defeatRecorded"
      );

    if (alreadyRecorded) {
      return;
    }

    const token =
      actor.getActiveTokens()?.[0];

    if (!token) {
      return;
    }

    const spawnData =
      token.flags?.["ai-director"]
        ?.tokenSpawn;

    if (!spawnData?.stableId) {
      return;
    }

    await actor.setFlag(
      "ai-director",
      "defeatRecorded",
      true
    );

    await EventLedgerManager.record({
      eventType: "ENTITY_DEFEATED",
      stableId:
        spawnData.stableId,
      sectorId:
        spawnData.sectorId,
      actorVariantId:
        spawnData.actorVariantId,
      identityStableId:
        spawnData.identityStableId
    });

  }
);
