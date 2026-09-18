// modules/ai-director/scripts/data/reward-discovery-manager.js

import { RewardStateManager } from "./reward-state-manager.js";

export class RewardDiscoveryManager {

    static revealReward(
        reward
    ) {

        RewardStateManager
            .discoverReward(
                reward
            );

        return reward;

    }

    static visibleRewards(
        rewards = []
    ) {

        return rewards.filter(
            reward =>
                reward.rewardState !==
                "UNDISCOVERED"
        );

    }

}