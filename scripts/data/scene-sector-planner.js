// modules/ai-director/scripts/data/scene-sector-planner.js
// PASS 5.5: Profile-driven sector planning policy.
// Scene Manager calls this module for sector expectations instead of hardcoding map types.

import { LayoutProfileResolver } from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { LayoutProfileLibrary } from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";
import { RewardResolutionManager }
    from "/modules/ai-director/scripts/data/reward-resolution-manager.js";
import { ObstacleMaterializationManager }
    from "/modules/ai-director/scripts/data/obstacle-materialization-manager.js";
import { ClueMaterializationManager }
    from "/modules/ai-director/scripts/data/clue-materialization-manager.js";
import { SecretMaterializationManager }
    from "/modules/ai-director/scripts/data/secret-materialization-manager.js";
import { EntityPlanManager }
    from "/modules/ai-director/scripts/engines/entity-plan-manager.js";

const SCALE_TARGETS = Object.freeze({
    TINY: 3,
    SMALL: 5,
    MEDIUM: 8,
    LARGE: 12,
    HUGE: 16
});

const GENERIC_PURPOSES = Object.freeze([
    { purpose: "ENTRY", name: "Entry Area", graphRole: "ENTRY", sectorType: "ROOM", hierarchyLevel: 3 },
    { purpose: "HUB", name: "Central Hub", graphRole: "HUB", sectorType: "ROOM", hierarchyLevel: 2 },
    { purpose: "OBJECTIVE", name: "Objective Area", graphRole: "OBJECTIVE", sectorType: "ROOM", hierarchyLevel: 1 },
    { purpose: "STORAGE", name: "Storage Area", graphRole: "OPTIONAL", sectorType: "ROOM", hierarchyLevel: 2 },
    { purpose: "UTILITY", name: "Utility Area", graphRole: "OPTIONAL", sectorType: "ROOM", hierarchyLevel: 2 },
    { purpose: "TRANSIT", name: "Connecting Passage", graphRole: "OPTIONAL", sectorType: "TRANSITION", hierarchyLevel: 3 }
]);

const NARRATIVE_ROLES = Object.freeze([
    "ATMOSPHERE",
    "DISCOVERY",
    "CLUE",
    "OBSTACLE",
    "REWARD",
    "OBJECTIVE",
    "OPTIONAL"
]);

export class SceneSectorPlanner {
    static _resolveNormalizedProfileKey(input) {
        let resolvedProfileId = null;
        if (typeof input === "object" && input !== null) {
            const resolution = LayoutProfileResolver.resolve(input);
            resolvedProfileId = resolution?.profileId;
        } else if (typeof input === "string") {
            const resolution = LayoutProfileResolver.resolve({ context: input, dungeonTitle: input });
            resolvedProfileId = resolution?.profileId;
        }
        const key = String(resolvedProfileId || "FACILITY").toUpperCase().trim();
        return LayoutProfileLibrary.has(key) ? key : "FACILITY";
    }

    static plan(input = {}, options = {}) {
        const isManifest = typeof input === "object" && input !== null && Array.isArray(input.sectors);
        const profileKey = this._resolveNormalizedProfileKey(input);
        const scale = (options.scale || (typeof input === "object" && input?.scale) || "MEDIUM").toUpperCase();
        const profile = LayoutProfileLibrary.get(profileKey);
        const policyDefinition = {}; // Assuming no default policy definition for simplicity
        const targetSectorCount = profile?.targetSectorCounts?.[scale] || SCALE_TARGETS[scale] || 8;
        const requiredPurposes = Array.isArray(profile?.requiredSectors) && profile.requiredSectors.length && typeof profile.requiredSectors[0] === "object" ? profile.requiredSectors : GENERIC_PURPOSES.slice(0, 3);
        const optionalPurposes = Array.isArray(profile?.optionalSectors) && profile.optionalSectors.length && typeof profile.optionalSectors[0] === "object" ? profile.optionalSectors : GENERIC_PURPOSES.slice(3);
        const sectorSpecs = [...requiredPurposes];
        let specIndex = 0;
        while (sectorSpecs.length < targetSectorCount && optionalPurposes.length > 0) {
            sectorSpecs.push(optionalPurposes[specIndex % optionalPurposes.length]);
            specIndex++;
        }
        return {
            layoutProfile: profileKey,
            scale,
            targetSectorCount,
            minRequiredSectors: requiredPurposes.length,
            requiredPurposes: requiredPurposes.map(r => r.purpose),
            sectorSpecs: sectorSpecs.map((spec, idx) => ({
                sectorId: `${spec.purpose.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${idx + 1}`,
                name: spec.name,
                purpose: spec.purpose,
                graphRole: spec.graphRole || "OPTIONAL",
                sectorType: spec.sectorType || "ROOM",
                hierarchyLevel: spec.hierarchyLevel || 2,
                floor: 1
            }))
        };
    }

    static repairManifest(manifest, policy = null) {
        if (!manifest || !Array.isArray(manifest.sectors)) return manifest;
        const activePolicy = policy || this.plan(manifest);
        const manifestCopy = structuredClone(manifest);
        manifestCopy.layoutProfile = manifestCopy.layoutProfile || activePolicy.layoutProfile;
        manifestCopy.structureType = manifestCopy.structureType || activePolicy.layoutProfile;

        if (manifestCopy.sectors.length < activePolicy.minRequiredSectors) {
            const existingPurposes = new Set(manifestCopy.sectors.map(s => String(s.purpose || "").toUpperCase()));
            for (const spec of activePolicy.sectorSpecs) {
                if (manifestCopy.sectors.length >= activePolicy.minRequiredSectors) break;
                if (!existingPurposes.has(spec.purpose.toUpperCase())) {
                    manifestCopy.sectors.push({
                        sectorId: spec.sectorId,
                        name: spec.name,
                        purpose: spec.purpose,
                        graphRole: spec.graphRole,
                        sectorType: spec.sectorType,
                        hierarchyLevel: spec.hierarchyLevel,
                        floor: spec.floor || 1,
                        gridPos: { x: manifestCopy.sectors.length * 2, y: 0 },
                        exits: [],
                        sensory: "Auto-generated structural sector."
                    });
                    existingPurposes.add(spec.purpose.toUpperCase());
                }
            }
        }

        manifestCopy.sectors =
            this.enforceMandatoryRoles(
                manifestCopy.sectors
            );

        manifestCopy.sectors =
            this.alignSectorRoles(
                manifestCopy.sectors
            );

        manifestCopy.sectors = this.assignNarrativeRoles(manifestCopy.sectors);

        console.table(
            manifestCopy.sectors.map(s => ({
                name: s.name,
                purpose: s.purpose,
                graphRole: s.graphRole,
                narrativeRole: s.narrativeRole
            }))
        );
        const entryIdentifiers = new Set(["ENTRY", "GATE", "GATEHOUSE", "OUTER_GATE", "AIRLOCK", "FOYER", "RECEIVING", "CAVERN_MOUTH", "DOCKING_BAY"]);
        const objectiveIdentifiers = new Set(["OBJECTIVE", "KEEP", "INNER_KEEP", "COMMAND", "COMMAND_SANCTUM", "BRIDGE", "CONTROL_ROOM", "STATION_CONTROL", "DEEP_SANCTUM", "MASTER_BEDROOM"]);
        const hasEntryRole = manifestCopy.sectors.some(s => String(s.graphRole).toUpperCase() === "ENTRY");
        const hasObjectiveRole = manifestCopy.sectors.some(s => String(s.graphRole).toUpperCase() === "OBJECTIVE");

        manifestCopy.sectors.forEach((sector, index) => {
            const currentPurpose = String(sector.purpose || "").toUpperCase();
            const currentName = String(sector.name || "").toUpperCase();
            if (!sector.graphRole) {
                if (entryIdentifiers.has(currentPurpose) || entryIdentifiers.has(currentName)) {
                    sector.graphRole = "ENTRY";
                } else if (objectiveIdentifiers.has(currentPurpose) || objectiveIdentifiers.has(currentName)) {
                    sector.graphRole = "OBJECTIVE";
                } else if (!hasEntryRole && index === 0) {
                    sector.graphRole = "ENTRY";
                } else if (!hasObjectiveRole && index === manifestCopy.sectors.length - 1) {
                    sector.graphRole = "OBJECTIVE";
                } else {
                    sector.graphRole = "OPTIONAL";
                }
            }
            if (!sector.purpose) {
                sector.purpose = sector.graphRole === "ENTRY" ? "ENTRY" : (sector.graphRole === "OBJECTIVE" ? "OBJECTIVE" : "ROOM");
            }
            if (!sector.sectorType) {
                sector.sectorType = "ROOM";
            }
            sector.narrativeRole = sector.narrativeRole || "OPTIONAL";
            sector.narrativeOpportunities = Array.isArray(sector.narrativeOpportunities) ? sector.narrativeOpportunities : [];
        });

        for (
            let i = 0;
            i < manifestCopy.sectors.length - 1;
            i++
        ) {
            const current =
                manifestCopy.sectors[i];

            const next =
                manifestCopy.sectors[i + 1];

            current.exits =
                Array.isArray(current.exits)
                    ? current.exits
                    : [];

            next.exits =
                Array.isArray(next.exits)
                    ? next.exits
                    : [];

            current.connections =
                Array.isArray(current.connections)
                    ? current.connections
                    : [];

            next.connections =
                Array.isArray(next.connections)
                    ? next.connections
                    : [];

            const hasExitLink =
                current.exits.some(
                    exit =>
                        exit.targetSectorId ===
                        next.sectorId
                );

            const hasConnectionLink =
                current.connections.some(
                    connection =>
                        (
                            typeof connection === "string"
                                ? connection
                                : connection?.to
                        ) === next.sectorId
                );

            if (
                !hasExitLink &&
                !hasConnectionLink
            ) {
                current.connections.push({
                    to:
                        next.sectorId,
                    connectionType:
                        "DIRECT"
                });

                next.connections.push({
                    to:
                        current.sectorId,
                    connectionType:
                        "DIRECT"
                });
            }
        }
        return manifestCopy;
    }

    static assignNarrativeRoles(
        sectors = []
    ) {
        if (!Array.isArray(sectors)) {
            return sectors;
        }

        const total =
            sectors.length;

        if (total === 5) {
            const roleMap = [
                "ATMOSPHERE",
                "DISCOVERY",
                "OBSTACLE",
                "REWARD",
                "OBJECTIVE"
            ];
            return sectors.map(
                (sector, index) => ({
                    ...sector,
                    narrativeRole:
                        roleMap[index] ||
                        "OPTIONAL"
                })
            );
        }

        return sectors.map(
            (sector, index) => {
                const purpose =
                    String(
                        sector.purpose || ""
                    ).toUpperCase();

                const graphRole =
                    String(
                        sector.graphRole || ""
                    ).toUpperCase();

                let narrativeRole =
                    String(
                        sector.narrativeRole || ""
                    ).toUpperCase();

                if (
                    graphRole === "OBJECTIVE" ||
                    purpose === "OBJECTIVE"
                ) {
                    narrativeRole =
                        "OBJECTIVE";
                } else if (
                    graphRole === "ENTRY" ||
                    purpose === "ENTRY"
                ) {
                    narrativeRole =
                        "ATMOSPHERE";
                } else if (
                    purpose.includes("CLUE") ||
                    purpose.includes("ARCHIVE") ||
                    purpose.includes("EVIDENCE")
                ) {
                    narrativeRole =
                        "CLUE";
                } else if (
                    purpose.includes("SECURITY") ||
                    purpose.includes("GUARD") ||
                    purpose.includes("HAZARD")
                ) {
                    narrativeRole =
                        "OBSTACLE";
                } else if (
                    purpose.includes("REWARD") ||
                    purpose.includes("TREASURE") ||
                    purpose.includes("VAULT")
                ) {
                    narrativeRole =
                        "REWARD";
                } else if (
                    !NARRATIVE_ROLES.includes(
                        narrativeRole
                    ) ||
                    narrativeRole === "OPTIONAL"
                ) {
                    if (index === 0) {
                        narrativeRole =
                            "ATMOSPHERE";
                    } else if (index === 1) {
                        narrativeRole =
                            "DISCOVERY";
                    } else if (index === 2) {
                        narrativeRole =
                            "CLUE";
                    } else if (
                        index === total - 3
                    ) {
                        narrativeRole =
                            "OBSTACLE";
                    } else if (
                        index === total - 2
                    ) {
                        narrativeRole =
                            "REWARD";
                    } else if (
                        index === total - 1
                    ) {
                        narrativeRole =
                            "OBJECTIVE";
                    } else {
                        narrativeRole =
                            "OPTIONAL";
                    }
                }

                return {
                    ...sector,
                    narrativeRole
                };
            }
        );
    }

    static enforceMandatoryRoles(sectors = []) {
        if (!Array.isArray(sectors) || sectors.length === 0) {
            return sectors;
        }

        const roleExists = role =>
            sectors.some(
                sector =>
                    String(
                        sector.graphRole || ""
                    ).toUpperCase() === role
            );

        if (!roleExists("ENTRY")) {
            sectors[0].graphRole = "ENTRY";
            sectors[0].purpose = "ENTRY";
        }

        if (!roleExists("OBJECTIVE")) {
            const lastIndex = sectors.length - 1;

            sectors[lastIndex].graphRole = "OBJECTIVE";
            sectors[lastIndex].purpose = "OBJECTIVE";
        }

        if (!roleExists("HUB")) {
            const middleIndex =
                Math.floor(sectors.length / 2);

            const middleSector =
                sectors[middleIndex];

            if (
                middleSector &&
                !["ENTRY", "OBJECTIVE"].includes(
                    String(
                        middleSector.graphRole || ""
                    ).toUpperCase()
                )
            ) {
                middleSector.graphRole = "HUB";
                middleSector.purpose = "HUB";
            }
        }

        return sectors;
    }

    static alignSectorRoles(sectors = []) {
        return sectors.map(sector => {
            const graphRole =
                String(sector.graphRole || "")
                    .toUpperCase();

            if (graphRole === "ENTRY") {
                sector.purpose = "ENTRY";
                sector.narrativeRole = "ATMOSPHERE";
            }

            if (graphRole === "HUB") {
                sector.purpose = "HUB";
                sector.narrativeRole = "DISCOVERY";
            }

            if (graphRole === "OBJECTIVE") {
                sector.purpose = "OBJECTIVE";
                sector.narrativeRole = "OBJECTIVE";
            }

            return sector;
        });
    }

    static distributeNarrativeOpportunities(
        sectors = [],
        narrative = {}
    ) {
        if (!Array.isArray(sectors)) {
            return sectors;
        }

        const opportunities =
            Array.isArray(
                narrative.opportunities
            )
                ? narrative.opportunities
                : [];

        if (!opportunities.length) {
            return sectors;
        }

        const primary =
            opportunities.find(
                opportunity =>
                    opportunity.isPrimary
            ) ||
            opportunities[0];

        const supporting =
            opportunities.filter(
                opportunity =>
                    opportunity.opportunityId !==
                    primary.opportunityId
            );

        let clueIndex = 0;
        let obstacleIndex = 0;
        let rewardIndex = 0;

        return sectors.map(sector => {
            const output = {
                ...sector,
                opportunityRefs: [],
                narrativeOpportunities:
                    Array.isArray(
                        sector.narrativeOpportunities
                    )
                        ? [
                            ...sector
                                .narrativeOpportunities
                        ]
                        : []
            };

            const attach = (
                opportunity,
                type,
                description
            ) => {
                if (
                    !opportunity ||
                    !description
                ) {
                    return;
                }

                if (
                    !output.opportunityRefs
                        .includes(
                            opportunity.opportunityId
                        )
                ) {
                    output.opportunityRefs.push(
                        opportunity.opportunityId
                    );
                }

                output
                    .narrativeOpportunities
                    .push({
                        opportunityId:
                            opportunity.opportunityId,
                        type,
                        description,
                        sourceRefs:
                            opportunity.sourceRefs || [],
                        priority:
                            opportunity.priority || 0,
                        isPrimary:
                            opportunity.isPrimary === true
                    });
            };

            switch (
                String(
                    sector.narrativeRole ||
                    ""
                ).toUpperCase()
            ) {
                case "OBJECTIVE":
                    attach(
                        primary,
                        "OBJECTIVE",
                        primary.objective
                    );
                    break;

                case "DISCOVERY":
                case "CLUE": {
                    const opportunity =
                        supporting[clueIndex] ||
                        primary;

                    const clue =
                        opportunity.clues?.[
                            clueIndex %
                            Math.max(
                                opportunity.clues?.length || 1,
                                1
                            )
                        ];

                    attach(
                        opportunity,
                        "CLUE",
                        clue
                    );

                    clueIndex++;
                    break;
                }

                case "OBSTACLE": {
                    const opportunity =
                        supporting[obstacleIndex] ||
                        primary;

                    const obstacle =
                        opportunity.obstacles?.[
                            obstacleIndex %
                            Math.max(
                                opportunity.obstacles
                                    ?.length || 1,
                                1
                            )
                        ];

                    attach(
                        opportunity,
                        "OBSTACLE",
                        obstacle
                    );

                    obstacleIndex++;
                    break;
                }

                case "REWARD": {
                    const reward =
                        primary.rewards?.[
                            rewardIndex %
                            Math.max(
                                primary.rewards?.length || 1,
                                1
                            )
                        ];

                    attach(
                        primary,
                        "REWARD",
                        reward?.title
                    );

                    rewardIndex++;
                    break;
                }
            }

            return output;
        });
    }

    static enrichSectorsFromOpportunities(
        sectors = [],
        narrativeRecord = null
    ) {
        if (
            !Array.isArray(sectors) ||
            !narrativeRecord
        ) {
            return sectors;
        }

        console.group(
            "ENRICHMENT DEBUG"
        );

        console.log(
            "Narrative Opportunities",
            narrativeRecord?.opportunities
        );

        console.table(
            sectors.map(s => ({
                name: s.name,
                refs: s.opportunityRefs
            }))
        );

        console.groupEnd();

        const opportunityMap = new Map(
            (narrativeRecord.opportunities || [])
                .map(opportunity => [
                    opportunity.opportunityId,
                    opportunity
                ])
        );

        const opportunityDistribution =
            new Map();

        for (const sector of sectors) {
            const refs =
                (sector.opportunityRefs || [])
                    .filter(ref =>
                        opportunityMap.has(ref)
                    );

            sector.clues ??= [];
            sector.secrets ??= [];
            sector.traps ??= [];
            sector.loot ??= [];
            sector.rewards ??= [];
            sector.monsters ??= [];
            sector.threats ??= [];
            sector.interactables ??= [];
            sector.npcs ??= [];

            for (const ref of refs) {
                const opportunity =
                    opportunityMap.get(ref);

                console.log(
                    "LOOKUP",
                    ref,
                    opportunity
                );

                if (!opportunity) {
                    continue;
                }

                const objectiveText = [
                    opportunity?.title,
                    opportunity?.objective,
                    opportunity?.description
                ]
                    .join(" ")
                    .toLowerCase();

                if (
                    objectiveText.includes("prince aldric")
                ) {

                    const exists =
                        sector.npcs.some(
                            npc => npc.stableId === "prince-aldric"
                        );

                    if (!exists) {

                        sector.npcs.push({
                            stableId: "prince-aldric",

                            name: "Prince Aldric",

                            role: "QUEST_NPC",

                            disposition: "FRIENDLY",

                            generationNeeds: [
                                "ACTOR",
                                "TOKEN"
                            ]
                        });
                    }
                }

                const distribution =
                    opportunityDistribution.get(ref) || {
                        clueIndex: 0,
                        secretIndex: 0,
                        mysteryIndex: 0,
                        revelationIndex: 0,
                        obstacleIndex: 0,
                        rewardIndex: 0
                    };

                let clue = null;

                if (
                    opportunity.type === "CLUE"
                ) {
                    clue =
                        opportunity.description;
                }
                else {
                    const opportunityClues =
                        Array.isArray(opportunity.clues)
                            ? opportunity.clues
                            : [];

                    clue =
                        opportunityClues.length
                            ? opportunityClues[
                                distribution.clueIndex %
                                opportunityClues.length
                            ]
                            : null;
                }

                if (clue) {
                    const materializedClue =
                        ClueMaterializationManager
                            .materialize(
                                clue,
                                opportunity.opportunityId,
                                opportunity.sourceRefs || []
                            );

                    if (materializedClue) {
                        const duplicateClue =
                            sector.clues.some(entry =>
                                entry?.sourceOpportunityId ===
                                materializedClue
                                    .sourceOpportunityId &&
                                entry?.description ===
                                materializedClue.description
                            );

                        if (!duplicateClue) {
                            sector.clues.push(
                                materializedClue
                            );

                            console.log(
                                "[EN14 CLUE]",
                                materializedClue
                            );
                        }
                    }

                    const shouldCreateSecret =
                        SecretMaterializationManager
                            .shouldMaterializeClue(
                                clue,
                                distribution.secretIndex
                            );

                    if (shouldCreateSecret) {
                        const materializedSecret =
                            SecretMaterializationManager
                                .materialize(
                                    clue,
                                    {
                                        sourceType: "CLUE",

                                        opportunityId:
                                            opportunity
                                                .opportunityId,

                                        sourceRefs:
                                            opportunity
                                                .sourceRefs || []
                                    }
                                );

                        if (materializedSecret) {
                            const duplicateSecret =
                                sector.secrets.some(entry =>
                                    entry?.sourceOpportunityId ===
                                    materializedSecret
                                        .sourceOpportunityId &&
                                    entry?.sourceType ===
                                    materializedSecret
                                        .sourceType &&
                                    entry?.description ===
                                    materializedSecret
                                        .description
                                );

                            if (!duplicateSecret) {
                                sector.secrets.push(
                                    materializedSecret
                                );

                                console.log(
                                    "[EN14 SECRET]",
                                    materializedSecret
                                );
                            }
                        }
                    }
                    distribution.clueIndex++;
                    distribution.secretIndex++;
                }

                const sectorRole =
                    String(
                        sector.narrativeRole || ""
                    ).toUpperCase();

                const canReceiveDiscoverySecret =
                    [
                        "DISCOVERY",
                        "CLUE",
                        "OBJECTIVE"
                    ].includes(sectorRole);

                if (canReceiveDiscoverySecret) {
                    const mysteries =
                        Array.isArray(
                            narrativeRecord.mysteries
                        )
                            ? narrativeRecord.mysteries
                            : [];

                    const revelations =
                        Array.isArray(
                            narrativeRecord.revelations
                        )
                            ? narrativeRecord.revelations
                            : [];

                    if (
                        mysteries.length &&
                        distribution.mysteryIndex <
                        mysteries.length
                    ) {
                        const mystery = mysteries[
                            distribution.mysteryIndex
                        ];

                        const materializedMystery =
                            SecretMaterializationManager
                                .materialize(
                                    mystery,
                                    {
                                        sourceType: "MYSTERY",

                                        opportunityId:
                                            opportunity
                                                .opportunityId,

                                        sourceRefs:
                                            opportunity
                                                .sourceRefs || []
                                    }
                                );

                        if (materializedMystery) {
                            const duplicateMystery =
                                sector.secrets.some(entry =>
                                    entry?.sourceType ===
                                    "MYSTERY" &&
                                    entry?.description ===
                                    materializedMystery
                                        .description
                                );

                            if (!duplicateMystery) {
                                sector.secrets.push(
                                    materializedMystery
                                );
                            }
                        }
                        distribution.mysteryIndex++;
                    }

                    if (
                        revelations.length &&
                        distribution.revelationIndex <
                        revelations.length
                    ) {
                        const revelation =
                            revelations[
                                distribution
                                    .revelationIndex
                            ];

                        const materializedRevelation =
                            SecretMaterializationManager
                                .materialize(
                                    revelation,
                                    {
                                        sourceType:
                                            "REVELATION",

                                        opportunityId:
                                            opportunity
                                                .opportunityId,

                                        sourceRefs:
                                            opportunity
                                                .sourceRefs || []
                                    }
                                );

                        if (materializedRevelation) {
                            const duplicateRevelation =
                                sector.secrets.some(entry =>
                                    entry?.sourceType ===
                                    "REVELATION" &&
                                    entry?.description ===
                                    materializedRevelation
                                        .description
                                );
                            if (!duplicateRevelation) {
                                sector.secrets.push(
                                    materializedRevelation
                                );
                            }
                        }

                        distribution.revelationIndex++;
                    }
                }

                let obstacle = null;

                if (
                    opportunity.type === "OBSTACLE"
                ) {
                    obstacle =
                        opportunity.description;
                }
                else {
                    const opportunityObstacles =
                        Array.isArray(
                            opportunity.obstacles
                        )
                            ? opportunity.obstacles
                            : [];

                    obstacle =
                        opportunityObstacles.length
                            ? opportunityObstacles[
                                distribution.obstacleIndex %
                                opportunityObstacles.length
                            ]
                            : null;
                }

                if (obstacle) {
                    const result =
                        ObstacleMaterializationManager
                            .materialize(
                                obstacle,
                                opportunity.opportunityId,
                                opportunity.sourceRefs || []
                            );

                    if (
                        result &&
                        result.entry &&
                        Array.isArray(
                            sector[result.target]
                        )
                    ) {
                        const entryDescription =
                            result.entry.description ||
                            result.entry.name ||
                            result.entry.title ||
                            "";

                        const duplicateEntry =
                            sector[result.target]
                                .some(existing => {
                                    const existingDescription =
                                        existing?.description ||
                                        existing?.name ||
                                        existing?.title ||
                                        "";

                                    const existingSource =
                                        existing
                                            ?.sourceOpportunityId ||
                                        existing
                                            ?.opportunityId ||
                                        null;

                                    return (
                                        existingDescription ===
                                        entryDescription &&
                                        existingSource ===
                                        opportunity
                                            .opportunityId
                                    );
                                });

                        if (!duplicateEntry) {
                            sector[result.target]
                                .push(result.entry);

                            console.log(
                                "[EN14 ROUTED]",
                                result.target,
                                result.entry
                            );
                        }
                    }
                    distribution.obstacleIndex++;
                }

                const placements =
                    sector.rewardPlacements || [];

                for (const reward of (opportunity.rewards || [])) {

                    const placement =
                        placements.find(
                            p =>
                                p.rewardId ===
                                reward.rewardId
                        );

                    if (!placement) {
                        continue;
                    }

                    sector.rewards.push({

                        ...RewardResolutionManager.resolve(
                            reward
                        ),

                        revealed: false,

                        discoveredAt: null,

                        sourceOpportunityId:
                            opportunity.opportunityId,

                        placementType:
                            placement
                                ?.placementType ?? null,

                        placementSectorId:
                            placement
                                ?.placementSectorId ??
                            null,

                        placementReason:
                            placement
                                ?.placementReason ?? null

                    });
                }

                const interactableTitle =
                    String(
                        opportunity.title ||
                        opportunity.objective ||
                        opportunity.description ||
                        ""
                    ).trim();

                if (interactableTitle) {
                    const duplicateInteractable =
                        sector.interactables.some(entry =>
                            entry?.sourceOpportunityId ===
                            opportunity.opportunityId &&
                            entry?.title ===
                            interactableTitle
                        );

                    if (!duplicateInteractable) {
                        sector.interactables.push({
                            id: crypto.randomUUID(),

                            title:
                                interactableTitle,

                            description:
                                String(
                                    opportunity.objective ||
                                    opportunity.title ||
                                    ""
                                ).trim(),

                            type:
                                "NARRATIVE_INTERACTION",

                            visibility:
                                "VISIBLE",

                            sourceOpportunityId:
                                opportunity
                                    .opportunityId,

                            sourceRefs:
                                Array.isArray(
                                    opportunity.sourceRefs
                                )
                                    ? [
                                        ...opportunity
                                            .sourceRefs
                                    ]
                                    : []
                        });
                    }
                }

                opportunityDistribution.set(
                    ref,
                    distribution
                );
            }
        }

        console.table(
            sectors.map(s => ({
                name: s.name,
                clues: s.clues?.length || 0,
                secrets: s.secrets?.length || 0,
                traps: s.traps?.length || 0,
                threats: s.threats?.length || 0,
                loot: s.loot?.length || 0,
                rewards: s.rewards?.length || 0,
                interactables:
                    s.interactables?.length || 0
            }))
        );

        /*
         * EN-15 HANDOFF
         */
        const entityPlans =
            EntityPlanManager.buildEntityPlans(
                sectors
            );

        console.log(
            "[EN15] Entity Plans",
            entityPlans
        );

        sectors.entityPlans =
            entityPlans;

        return sectors;
    }

    static validateManifestAgainstPolicy(manifest, policy) {
        const problems = [];

        if (!manifest || !Array.isArray(manifest.sectors)) {
            return {
                valid: false,
                problems: [
                    "Manifest contains no valid sectors array."
                ]
            };
        }

        if (policy && policy.minRequiredSectors && manifest.sectors.length < policy.minRequiredSectors) {
            problems.push(
                `Sector count (${manifest.sectors.length}) is below policy minimum threshold (${policy.minRequiredSectors}).`
            );
        }

        const presentPurposes = new Set(
            manifest.sectors.flatMap(s => [
                String(
                    s.purpose || ""
                ).toUpperCase(),
                String(
                    s.graphRole || ""
                ).toUpperCase()
            ])
        );

        for (const requiredPurpose of (policy?.requiredPurposes || [])) {
            if (!presentPurposes.has(requiredPurpose.toUpperCase())) {
                problems.push(
                    `Missing mandatory sector purpose required by layout policy: ${requiredPurpose}`
                );
            }
        }

        const objectiveCount = manifest.sectors.filter(
            s => s.graphRole === "OBJECTIVE"
        ).length;

        if (objectiveCount === 0) {
            problems.push(
                "Manifest contains no OBJECTIVE sector."
            );
        }

        const clueCount =
            manifest.sectors.reduce(
                (count, sector) =>
                    count +
                    (sector.narrativeOpportunities || [])
                        .filter(
                            o =>
                                o.type === "CLUE" ||
                                o.type === "REVELATION"
                        ).length,
                0
            );

        if (clueCount === 0) {
            problems.push(
                "Manifest contains no narrative clues."
            );
        }

        if (
            manifest.primaryOpportunityId
        ) {
            const hasPrimaryCoverage =
                manifest.sectors.some(
                    sector =>
                        sector.graphRole ===
                        "OBJECTIVE" &&
                        (
                            sector.opportunityRefs || []
                        ).includes(
                            manifest.primaryOpportunityId
                        )
                );

            if (!hasPrimaryCoverage) {
                problems.push(
                    "Primary narrative opportunity is not assigned to an OBJECTIVE sector."
                );
            }
        }

        for (const sector of manifest.sectors) {

            const hasOpportunityRefs =
                (sector.opportunityRefs?.length || 0) > 0;

            const hasContent =
                (sector.clues?.length || 0) > 0 ||
                (sector.threats?.length || 0) > 0 ||
                (sector.traps?.length || 0) > 0 ||
                (sector.secrets?.length || 0) > 0 ||
                (sector.loot?.length || 0) > 0 ||
                (sector.rewardPlacements?.length || 0) > 0 ||
                (sector.rewards?.length || 0) > 0 ||
                (sector.interactables?.length || 0) > 0;

            if (
                hasOpportunityRefs &&
                !hasContent
            ) {
                problems.push(
                    `${sector.name} has opportunity references but no materialized content.`
                );
            }
        }

        return {
            valid: problems.length === 0,
            problems
        };
    }
}
if (typeof window !== "undefined") {
    window.AIDirector =
        window.AIDirector || {};

    window.AIDirector.SceneSectorPlanner =
        SceneSectorPlanner;
}