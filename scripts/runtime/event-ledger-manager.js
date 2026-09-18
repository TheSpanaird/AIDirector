// modules/ai-director/scripts/runtime/event-ledger-manager.js
// EN-18A: Append-only world event ledger.

export const EVENT_TYPES =
  Object.freeze({

    ENTITY_DEFEATED:
      "ENTITY_DEFEATED",

    ENTITY_ESCAPED:
      "ENTITY_ESCAPED",

    CLUE_DISCOVERED:
      "CLUE_DISCOVERED",

    SECRET_REVEALED:
      "SECRET_REVEALED",

    REWARD_DISCOVERED:
      "REWARD_DISCOVERED",

    REWARD_CLAIMED:
      "REWARD_CLAIMED",

    OBJECTIVE_COMPLETED:
      "OBJECTIVE_COMPLETED",

    FACTION_REPUTATION_CHANGED:
      "FACTION_REPUTATION_CHANGED",

    LOCATION_UNLOCKED:
      "LOCATION_UNLOCKED",

    AREA_CLEARED:
      "AREA_CLEARED"
  });

export class EventLedgerManager {

  static async record(event) {
    const events =
      game.settings.get(
        "ai-director",
        "eventLedger"
      ) || [];

    events.push({
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event
    });

    await game.settings.set(
      "ai-director",
      "eventLedger",
      events
    );

    return event;
  }

  static getAll() {
    return (
      game.settings.get(
        "ai-director",
        "eventLedger"
      ) || []
    );
  }

}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector.EVENT_TYPES =
    EVENT_TYPES;

  window.AIDirector
    .EventLedgerManager =
      EventLedgerManager;
}
