// modules/ai-director/scripts/data/reward-placement-manager.js

const PLACEMENT_TYPES = Object.freeze([
  "OBJECTIVE",
  "CLUE_GATE",
  "OPTIONAL",
  "BONUS",
  "DISCOVERY"
]);

export class RewardPlacementManager {

  static assignRewardsToSectors(
    sectors = [],
    narrativeRecord = null
  ) {

    if (
      !Array.isArray(sectors) ||
      !narrativeRecord
    ) {
      return sectors;
    }

    const rewards =
      (narrativeRecord.opportunities || [])
        .flatMap(
          opportunity =>
            opportunity.rewards || []
        );

    if (!rewards.length) {
      return structuredClone(sectors);
    }

    const output =
      structuredClone(sectors);

    const objectiveSectors =
      output.filter(
        sector =>
          String(
            sector.graphRole || ""
          ).toUpperCase() ===
          "OBJECTIVE"
      );

    const clueSectors =
      output.filter(
        sector =>
          ["CLUE", "DISCOVERY"]
            .includes(
              String(
                sector.narrativeRole || ""
              ).toUpperCase()
            )
      );

    const optionalSectors =
      output.filter(
        sector =>
          String(
            sector.graphRole || ""
          ).toUpperCase() ===
          "OPTIONAL"
      );

    const placeReward = (
      sector,
      reward,
      placementType,
      placementReason
    ) => {

      sector.rewardPlacements ??= [];

      sector.rewardPlacements.push({
        rewardId:
          reward.rewardId,

        placementType,

        placementSectorId:
          sector.sectorId,

        placementReason
      });
    };

    for (const reward of rewards) {

      const alreadyPlaced =
        output.some(
          sector =>
            (sector.rewardPlacements || [])
              .some(
                placement =>
                  placement.rewardId ===
                  reward.rewardId
              )
        );

      if (alreadyPlaced) {
        continue;
      }

      const rewardType =
        String(
          reward.rewardType || ""
        ).toUpperCase();

      let target = null;
      let placementType =
        "OBJECTIVE";

      let placementReason =
        "Fallback placement.";

      switch (rewardType) {

        case "KNOWLEDGE":
        case "LOCATION":

          target =
            clueSectors[0];

          placementType =
            "DISCOVERY";

          placementReason =
            "Knowledge rewards belong in discovery sectors.";

          break;

        case "ACCESS":

          target =
            clueSectors[0];

          placementType =
            "CLUE_GATE";

          placementReason =
            "Access rewards unlock future progress.";

          break;

        case "ITEM":
        case "RESOURCE":

          target =
            optionalSectors[0];

          placementType =
            "OPTIONAL";

          placementReason =
            "Optional exploration reward.";

          break;

        case "ALLY":
        case "ABILITY":
        case "FACTION":
        case "REPUTATION":

          target =
            objectiveSectors[0];

          placementType =
            "OBJECTIVE";

          placementReason =
            "Major narrative reward.";

          break;
      }

      target ??=
        objectiveSectors[0] ??
        clueSectors[0] ??
        optionalSectors[0];

      if (!target) {
        continue;
      }

      placeReward(
        target,
        reward,
        placementType,
        placementReason
      );
    }

    return output;
  }
}

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .RewardPlacementManager =
      RewardPlacementManager;
}