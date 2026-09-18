// modules/ai-director/scripts/data/reward-resolution-manager.js

export class RewardResolutionManager {

    static resolve(reward) {

        switch (reward.rewardType) {

            case "ACCESS":
                return {
                    systemType: "ACCESS_UNLOCK",
                    reward
                };

            case "KNOWLEDGE":
                return {
                    systemType: "DISCOVERY",
                    reward
                };

            case "ALLY":
                return {
                    systemType: "NPC_RELATIONSHIP",
                    reward
                };

            case "FACTION":
                return {
                    systemType: "FACTION_RELATIONSHIP",
                    reward
                };

            case "REPUTATION":
                return {
                    systemType: "REPUTATION_CHANGE",
                    reward
                };

            case "LOCATION":
                return {
                    systemType: "LOCATION_UNLOCK",
                    reward
                };

            case "RESOURCE":
                return {
                    systemType: "RESOURCE_GRANT",
                    reward
                };

            case "ITEM":
                return {
                    systemType: "ITEM_GRANT",
                    reward
                };

            case "ABILITY":
                return {
                    systemType: "ABILITY_UNLOCK",
                    reward
                };

            default:
                return {
                    systemType: "NARRATIVE_ONLY",
                    reward
                };

        }

    }

}
