// modules/ai-director/scripts/data/reward-state-manager.js

import { REWARD_STATES } from "./reward-schema.js";

export const REWARD_EVENTS = Object.freeze({
  DISCOVERED: "AI_DIRECTOR_REWARD_DISCOVERED",
  CLAIMED: "AI_DIRECTOR_REWARD_CLAIMED",
  RESOLVED: "AI_DIRECTOR_REWARD_RESOLVED"
});

export class RewardStateManager {

  static emitLifecycleEvent(
    eventName,
    reward
  ) {
    if (typeof Hooks !== "undefined") {
      Hooks.callAll(
        eventName,
        structuredClone(reward)
      );
    }
  }

  static validateTransition(
    reward,
    nextState
  ) {

    const current =
      reward.rewardState ||
      "UNDISCOVERED";

    const allowed = {

      UNDISCOVERED:
        ["DISCOVERED"],

      DISCOVERED:
        [
          "DISCOVERED",
          "CLAIMED"
        ],

      CLAIMED:
        [
          "CLAIMED",
          "RESOLVED"
        ],

      RESOLVED:
        [
          "RESOLVED"
        ]
    };

    return (
      allowed[current] || []
    ).includes(nextState);
  }

  static discoverReward(
    reward
  ) {

    if (
      reward.rewardState ===
      "DISCOVERED"
    ) {
      return reward;
    }

    if (
      !this.validateTransition(
        reward,
        "DISCOVERED"
      )
    ) {
      return reward;
    }

    reward.rewardState =
      "DISCOVERED";

    reward.revealed =
      true;

    reward.discoveredAt ??=
      new Date().toISOString();

    this.emitLifecycleEvent(
      REWARD_EVENTS.DISCOVERED,
      reward
    );

    return reward;
  }

  static claimReward(
    reward
  ) {

    if (
      reward.rewardState ===
      "CLAIMED"
    ) {
      return reward;
    }

    if (
      reward.rewardState ===
      "UNDISCOVERED"
    ) {

      this.discoverReward(
        reward
      );
    }

    if (
      !this.validateTransition(
        reward,
        "CLAIMED"
      )
    ) {
      return reward;
    }

    reward.rewardState =
      "CLAIMED";

    reward.revealed =
      true;

    reward.claimed =
      true;

    reward.claimedAt ??=
      new Date().toISOString();

    this.emitLifecycleEvent(
      REWARD_EVENTS.CLAIMED,
      reward
    );

    return reward;
  }

  static resolveReward(
    reward
  ) {

    if (
      reward.rewardState ===
      "RESOLVED"
    ) {
      return reward;
    }

    if (
      reward.rewardState !==
      "CLAIMED"
    ) {
      return reward;
    }

    reward.rewardState =
      "RESOLVED";

    reward.resolvedAt ??=
      new Date().toISOString();

    this.emitLifecycleEvent(
      REWARD_EVENTS.RESOLVED,
      reward
    );

    return reward;
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .RewardStateManager =
      RewardStateManager;

  window.AIDirector
    .REWARD_EVENTS =
      REWARD_EVENTS;
}