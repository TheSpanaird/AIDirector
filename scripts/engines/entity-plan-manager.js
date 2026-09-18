// modules/ai-director/scripts/engines/entity-plan-manager.js
// EN-15: Converts structured sector threats into EntityPlan[] before actor resolution.

export function buildEntityPlans(
    sectors = []
) {

    const plans = [];

    for (const sector of sectors) {

        //
        // THREATS
        //
        for (const threat of (sector.threats || [])) {

            plans.push({
                entityPlanId: crypto.randomUUID(),
                sectorId: sector.sectorId,

                stableId:
                    threat.threatId ||
                    threat.stableId,

                category: "NPC_GROUP",

                archetype:
                    threat.name,

                disposition: "HOSTILE",

                targetCR:
                    threat.severity || "MEDIUM",

                count:
                    threat.count || 1,

                sourceType: "THREAT",

                generationNeeds: [
                    "ACTOR",
                    "TOKEN"
                ]
            });
        }

        //
        // STORY NPCS
        //
        for (const npc of (sector.npcs || [])) {

            plans.push({
                entityPlanId: crypto.randomUUID(),
                sectorId: sector.sectorId,

                stableId:
                    npc.stableId ||
                    npc.id,

                category: "NPC",

                archetype:
                    npc.name,

                disposition:
                    npc.disposition ||
                    "NEUTRAL",

                sourceType: "NPC",

                count: 1,

                generationNeeds: [
                    "ACTOR",
                    "TOKEN"
                ]
            });
        }

        //
        // INHABITANTS
        //
        for (const inhabitant of (sector.inhabitants || [])) {

            plans.push({
                entityPlanId: crypto.randomUUID(),
                sectorId: sector.sectorId,

                stableId:
                    inhabitant.stableId ||
                    inhabitant.id,

                category: "INHABITANT",

                archetype:
                    inhabitant.name,

                disposition:
                    inhabitant.disposition ||
                    "NEUTRAL",

                sourceType:
                    "INHABITANT",

                count:
                    inhabitant.count || 1,

                generationNeeds: [
                    "ACTOR",
                    "TOKEN"
                ]
            });
        }
    }

    return plans;
}

export const EntityPlanManager = Object.freeze({
  buildEntityPlans
});

if (typeof window !== "undefined") {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .EntityPlanManager =
      EntityPlanManager;
}
