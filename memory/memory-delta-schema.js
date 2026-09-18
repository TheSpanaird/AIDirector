// modules/ai-director/scripts/memory/memory-delta-schema.js

export const MEMORY_DELTA_TYPES = Object.freeze({
  ENTITY_FACT: "ENTITY_FACT",
  ENTITY_OBLIGATION: "ENTITY_OBLIGATION",
  ENTITY_EVENT: "ENTITY_EVENT",

  NPC_FACT: "NPC_FACT",
  NPC_OBLIGATION: "NPC_OBLIGATION",
  NPC_EVENT: "NPC_EVENT",

  ARC_FACT: "ARC_FACT",
  ARC_MYSTERY: "ARC_MYSTERY",
  ARC_OBJECTIVE: "ARC_OBJECTIVE",
  ARC_THREAT: "ARC_THREAT",

  NARRATIVE_STATE: "NARRATIVE_STATE",

  LOCATION_CONTROL_CHANGE: "LOCATION_CONTROL_CHANGE",
  LOCATION_OCCUPANCY_CHANGE: "LOCATION_OCCUPANCY_CHANGE",
  LOCATION_ACTIVITY_CHANGE: "LOCATION_ACTIVITY_CHANGE",
  LOCATION_THREAT_CHANGE: "LOCATION_THREAT_CHANGE"
});

export function createMemoryDelta(data = {}) {
  return {
    id:
      data.id ||
      foundry.utils.randomID(),

    type: data.type || "",

    entityId: data.entityId ?? null,
    arcId: data.arcId ?? null,
    locationId: data.locationId ?? null,
    locationName: data.locationName ?? "",

    value: data.value || "",

    importance:
      Number(data.importance ?? 5),

    source:
      data.source || "UNKNOWN",

    timestamp:
      data.timestamp ||
      new Date().toISOString()
  };
}