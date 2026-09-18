// modules/ai-director/scripts/data/reward-schema.js

export const REWARD_TYPES = Object.freeze([
  "ACCESS",
  "KNOWLEDGE",
  "ALLY",
  "FACTION",
  "REPUTATION",
  "LOCATION",
  "RESOURCE",
  "ITEM",
  "ABILITY"
]);

export const REWARD_STATES = Object.freeze([
  "UNDISCOVERED",
  "DISCOVERED",
  "CLAIMED",
  "RESOLVED"
]);

export function createReward() {
  return {
    rewardId: crypto.randomUUID(),

    rewardType: "KNOWLEDGE",

    title: "",
    description: "",

    valueTier: "MINOR",

    placementType: null,
    placementSectorId: null,
    placementReason: null,

    rewardState: "UNDISCOVERED",

    revealed: false,
    claimed: false,

    discoveredAt: null,
    claimedAt: null,
    resolvedAt: null,

    sourceOpportunityId: null
  };
}