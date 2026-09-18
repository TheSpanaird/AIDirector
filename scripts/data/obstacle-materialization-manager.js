// modules/ai-director/scripts/data/obstacle-materialization-manager.js

import { ThreatMaterializationManager }
from "/modules/ai-director/scripts/data/threat-materialization-manager.js";

export class ObstacleMaterializationManager {

    static inferHazardType(obstacle = "") {
        const text = String(obstacle || "")
            .toLowerCase();

        if (
            text.includes("alarm") ||
            text.includes("ward") ||
            text.includes("rune") ||
            text.includes("glyph")
        ) {
            return "SURVEILLANCE";
        }

        if (
            text.includes("pit") ||
            text.includes("pitfall")
        ) {
            return "TRAP";
        }

        if (
            text.includes("poison") ||
            text.includes("gas") ||
            text.includes("toxic")
        ) {
            return "TOXIC";
        }

        if (
            text.includes("collapse") ||
            text.includes("collapsed") ||
            text.includes("unstable")
        ) {
            return "COLLAPSE";
        }

        if (
            text.includes("turret") ||
            text.includes("automated")
        ) {
            return "AUTOMATED_DEFENSE";
        }

        return "GENERAL_HAZARD";
    }

    static classify(obstacle = "") {

        const text = String(obstacle || "")
            .toLowerCase();

        if (
            text.includes("trap") ||
            text.includes("traps") ||
            text.includes("alarm") ||
            text.includes("rune") ||
            text.includes("glyph") ||
            text.includes("ward")
        ) {
            return "TRAP";
        }

        if (
            text.includes("collapsed") ||
            text.includes("fire") ||
            text.includes("flood") ||
            text.includes("unstable") ||
            text.includes("hazard")
        ) {
            return "HAZARD";
        }

        if (
            text.includes("locked") ||
            text.includes("sealed") ||
            text.includes("barred") ||
            text.includes("security")
        ) {
            return "ACCESS";
        }

        if (
            text.includes("guard") ||
            text.includes("assassin") ||
            text.includes("cult") ||
            text.includes("patrol") ||
            text.includes("soldier") ||
            text.includes("monster")
        ) {
            return "THREAT";
        }

        return "THREAT";
    }

    static materialize(
        obstacle,
        opportunityId,
        sourceRefs = []
    ) {

        const type =
            this.classify(obstacle);

        switch (type) {

            case "TRAP":
                return {
                    target: "traps",
                    entry: {
                        trapId: crypto.randomUUID(),
                        hazardType:
                            this.inferHazardType(obstacle),
                        title: obstacle,
                        description: obstacle,

                        severity: "MEDIUM",
                        visibility: "HIDDEN",

                        hazardState: "UNDISCOVERED",

                        discoveredAt: null,
                        disabledAt: null,
                        triggeredAt: null,
                        resolvedAt: null,

                        sourceOpportunityId:
                            opportunityId
                    }
                };

            case "HAZARD":
                return {
                    target: "traps",
                    entry: {
                        trapId: crypto.randomUUID(),
                        hazardType:
                            this.inferHazardType(obstacle),
                        title: obstacle,
                        description: obstacle,

                        severity: "MEDIUM",
                        visibility: "VISIBLE",

                        hazardState: "UNDISCOVERED",

                        discoveredAt: null,
                        disabledAt: null,
                        triggeredAt: null,
                        resolvedAt: null,

                        sourceOpportunityId:
                            opportunityId
                    }
                };

            case "ACCESS":
                return {
                    target: "interactables",
                    entry: {
                        id: crypto.randomUUID(),
                        title: obstacle,
                        type: "ACCESS_BARRIER",
                        opportunityId
                    }
                };

            default: {
                const threat =
                    ThreatMaterializationManager
                        .materialize(
                            obstacle,
                            opportunityId,
                            sourceRefs
                        );

                if (!threat) {
                    return null;
                }

                return {
                    target: "threats",
                    entry: threat
                };
            }
        }
    }
}

if (typeof window !== "undefined") {

    window.AIDirector =
        window.AIDirector || {};

    window.AIDirector
        .ObstacleMaterializationManager =
            ObstacleMaterializationManager;
}