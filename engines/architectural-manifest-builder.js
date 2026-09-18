// modules/ai-director/scripts/engines/architectural-manifest-builder.js

import { normalizeSectorSceneRecord } from "../data/scene-record-builder.js";
export class ArchitecturalManifestBuilder {
static build(data) {
if (!data || typeof data !== "object") return null;
// Multi-sector generation MUST return a manifest, not a sector.
let sectors = Array.isArray(data.sectors)
? data.sectors
: Array.isArray(data.sectorList)
? data.sectorList
: null;
if (!sectors && (
data.sectorId ||
data.sensoryDescription ||
data.tacticalMapPrompt
)) {
console.error(
"[AI Director] INVALID MULTI-SECTOR RESPONSE - Hermes returned a sector instead of a manifest.",
data
);
return null;
}
if (!sectors || sectors.length === 0) return null;
const normalizeId = value => String(value || "")
.trim()
.toLowerCase()
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "");
const normalizePurposeList = value => [
...new Set(
(Array.isArray(value) ? value : [])
.map(item => String(item || "").trim().toUpperCase())
.filter(Boolean)
)
];
const normalizeSpecialFeatures = value => [
...new Set(
(Array.isArray(value) ? value : [])
.map(item => String(item || "").trim().toUpperCase())
.filter(Boolean)
)
];
const normalizeOpportunity = (
opportunity = {},
index = 0
) => ({
opportunityId:
normalizeId(
opportunity.opportunityId ||
`opportunity-${index + 1}`
),
title:
String(
opportunity.title ||
opportunity.objective ||
`Opportunity ${index + 1}`
).trim(),
objective:
String(
opportunity.objective ||
opportunity.title ||
""
).trim(),
clues:
Array.isArray(
opportunity.clues
)
? [...opportunity.clues]
: [],
obstacles:
Array.isArray(
opportunity.obstacles
)
? [...opportunity.obstacles]
: [],
rewards:
Array.isArray(
opportunity.rewards
)
? structuredClone(
opportunity.rewards
)
: [],
consequences:
Array.isArray(
opportunity.consequences
)
? [...opportunity.consequences]
: [],
sourceRefs:
Array.isArray(
opportunity.sourceRefs
)
? [...new Set(
opportunity.sourceRefs
.map(String)
.filter(Boolean)
)]
: [],
priority:
Number(
opportunity.priority
) || 0,
priorityReasons:
Array.isArray(
opportunity.priorityReasons
)
? [...opportunity.priorityReasons]
: [],
isPrimary:
opportunity.isPrimary === true
});
const normalizeVentilation = value => {
if (!value || typeof value !== "object") return null;
const output = structuredClone(value);
output.enabled = output.enabled === true;
output.networkType = String(output.networkType || "AIR_DUCT").trim().toUpperCase();
output.visibility = String(output.visibility || "HIDDEN").trim().toUpperCase();
output.elevationBottom = Number(output.elevationBottom ?? 10);
output.elevationTop = Number(output.elevationTop ?? 15);
output.grateWidth = Number(output.grateWidth ?? 100);
output.connections = Array.isArray(output.connections)
? output.connections.map(connection => ({
...structuredClone(connection),
from: normalizeId(connection.from),
to: normalizeId(connection.to),
accessType: String(connection.accessType || "VENT_GRATE").trim().toUpperCase(),
size: String(connection.size || "SMALL").trim().toUpperCase()
}))
: [];
return output;
};
const inferredStructureType = String(data.structureType || data.layoutProfile || "").trim().toUpperCase();
const inferredSceneArchetype = String(data.sceneArchetype || data.structureSubtype || "").trim().toUpperCase();
const skydockScene = inferredStructureType === "SKYDOCK_HANGAR" ||
inferredStructureType === "FLOOR_12_SKYDOCK" ||
inferredSceneArchetype === "STOLEN_SHIPMENT_SKYDOCK";
const specialFeatures = normalizeSpecialFeatures(data.specialFeatures);
if (inferredSceneArchetype === "STOLEN_SHIPMENT_SKYDOCK") {
for (const feature of [
"SECURE_HOLDING_ROOM",
"ACCESS_FEED_VENTILATION",
"DUCT_CAMERAS",
"DUCT_BEND_TURRETS",
"SECURITY_CAMERAS"
]) {
if (!specialFeatures.includes(feature)) specialFeatures.push(feature);
}
}
const sourceProgram =
data.roomProgram && typeof data.roomProgram === "object"
? data.roomProgram
: {};
const roomProgram = {
required: normalizePurposeList(sourceProgram.required),
preferred: normalizePurposeList(sourceProgram.preferred),
optional: normalizePurposeList(sourceProgram.optional),
forbidden: normalizePurposeList(sourceProgram.forbidden)
};
const floorPresentation = String(
data.floorPresentation || "STACKED_CANVAS"
).trim().toUpperCase();
const declaredFloors = Array.isArray(data.floors)
? data.floors.map(floor => ({
...structuredClone(floor),
floor: Number(floor.floor),
name: String(floor.name || `Floor ${floor.floor}`),
role: String(floor.role || "GENERAL").trim().toUpperCase()
}))
: [];
const narrativeOpportunities =
Array.isArray(
data.narrativeOpportunities
)
? data.narrativeOpportunities
.map(
normalizeOpportunity
)
: Array.isArray(
data.narrativeRecord
?.opportunities
)
? data.narrativeRecord
.opportunities
.map(
normalizeOpportunity
)
: [];

const primaryOpportunity =
narrativeOpportunities.find(
opportunity =>
opportunity.isPrimary
) ||
narrativeOpportunities[0] ||
null;

const primaryOpportunityId =
normalizeId(
data.primaryOpportunityId ||
primaryOpportunity
?.opportunityId
) || null;

const normalizedSectors = sectors.map((sector, index) => {
const purpose = String(sector.purpose || "GENERAL").trim().toUpperCase();
const fallbackId = `${purpose.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`;
const sectorId = normalizeId(sector.sectorId) || fallbackId;
const cleanName = String(sector.name || sector.displayName || `Sector ${index + 1}`)
.replace(/^Sector\s*\d+[:-]?\s*/i, "")
.replace(/Title\s*\(Entry\)/i, "")
.trim() || `Sector ${index + 1}`;
const normalizedBase = {
...structuredClone(sector),
sectorId,
name: cleanName,
purpose,
graphRole: String(sector.graphRole || "OPTIONAL").trim().toUpperCase(),
narrativeRole: String(sector.narrativeRole || "OPTIONAL").trim().toUpperCase(),
opportunityRefs: Array.isArray(sector.opportunityRefs)
? [
...new Set(
sector.opportunityRefs
.map(normalizeId)
.filter(Boolean)
)
]
: [],
narrativeOpportunities: Array.isArray(sector.narrativeOpportunities)
? structuredClone(sector.narrativeOpportunities)
: [],
floor: Number.isFinite(Number(sector.floor)) ? Number(sector.floor) : 1,
importance: Math.max(1, Math.min(5, Number(sector.importance) || 3)),
trafficLevel: Math.max(1, Math.min(5, Number(sector.trafficLevel) || 2)),
connections: Array.isArray(sector.connections)
? structuredClone(sector.connections)
: [],
encounters: Array.isArray(sector.encounters) ? [...sector.encounters] : [],
npcs: Array.isArray(sector.npcs) ? structuredClone(sector.npcs) : [],
sensoryDescription: String(sector.sensoryDescription || ""),
trapsAndSecrets: String(sector.trapsAndSecrets || "None"),
mapPrompt: String(sector.mapPrompt || sector.tacticalMapPrompt || "")
};
return normalizeSectorSceneRecord(normalizedBase, { manifestData: data });
});
const derivedFloorIds = [
...new Set(normalizedSectors.map(sector => Number(sector.floor)))
].sort((a, b) => a - b);
const floors = declaredFloors.length
? declaredFloors
: derivedFloorIds.map(floor => ({
floor,
name: `Floor ${floor}`,
role: "GENERAL"
}));
const normalizeEndpoint = endpoint => ({
sectorId: String(endpoint?.sectorId || "").trim().toLowerCase(),
floor: Number(endpoint?.floor),
anchorId: String(endpoint?.anchorId || "").trim().toLowerCase()
});
const verticalConnections = (Array.isArray(data.verticalConnections)
? data.verticalConnections
: []).map(connection => ({
...structuredClone(connection),
connectionId: String(connection.connectionId || "").trim().toLowerCase(),
connectionType: String(connection.connectionType || "STAIR").trim().toUpperCase(),
accessPolicy: String(connection.accessPolicy || "OPEN").trim().toUpperCase(),
from: normalizeEndpoint(connection.from),
to: normalizeEndpoint(connection.to)
}));
if (!roomProgram.required.length) {
roomProgram.required = [
...new Set(
normalizedSectors
.filter(sector => ["ENTRY", "HUB", "OBJECTIVE"].includes(sector.graphRole))
.map(sector => sector.purpose)
)
];
}
return {
...structuredClone(data),
manifestId: data.manifestId || `manifest-${Date.now()}`,
dungeonTitle: data.dungeonTitle || data.title || data.name || data.displayName || "Generated Sector",
overallGoal: data.overallGoal || data.goal || data.gmNotes || "Explore the sector.",
primaryOpportunityId,
narrativeOpportunities,
totalSectors: normalizedSectors.length,
layoutProfile: data.layoutProfile || (skydockScene ? "SKYDOCK_HANGAR" : null),
layoutFamily: data.layoutFamily || (skydockScene ? "TECHNICAL" : null),
structureType: inferredStructureType || (skydockScene ? "SKYDOCK_HANGAR" : null),
sceneArchetype: inferredSceneArchetype || (skydockScene ? "STOLEN_SHIPMENT_SKYDOCK" : null),
missionContext: String(data.missionContext || "").trim().toUpperCase() || null,
occupancy: String(data.occupancy || "").trim().toUpperCase() || null,
occupancyState: String(data.occupancyState || data.occupancy || "").trim().toUpperCase() || null,
sceneScale: String(data.sceneScale || "").trim().toUpperCase() || null,
sectorPlan: data.sectorPlan && typeof data.sectorPlan === "object" ? structuredClone(data.sectorPlan) : null,
roomProgram,
specialFeatures,
floorCount: Number.isInteger(Number(data.floorCount))
? Number(data.floorCount)
: floors.length,
floorPresentation,
floors,
verticalConnections,
genre: data.genre || null,
genreProfile: data.genreProfile || null,
themeProfile: data.themeProfile || null,
toneProfile: data.toneProfile || null,
sceneIntroduction: data.sceneIntroduction ? structuredClone(data.sceneIntroduction) : null,
occupancyIntent: data.occupancyIntent
? structuredClone(
data.occupancyIntent
)
: null,
narrativeRecord: data.narrativeRecord && typeof data.narrativeRecord === "object" ? structuredClone(data.narrativeRecord) : null,
layoutSeed: data.layoutSeed || null,
architecturalScale: data.architecturalScale || data.buildingScale || null,
architecture: data.architecture && typeof data.architecture === "object"
? structuredClone(data.architecture)
: (skydockScene ? { secondaryNetworks: ["VENTILATION"] } : null),
ventilation: normalizeVentilation(data.ventilation),
sectors: normalizedSectors
};
}
static validate(manifest = {}) {
const problems = [];
if (!Array.isArray(manifest.sectors)) {
problems.push(
"Manifest contains no sectors."
);
}
const objectiveCount =
 (manifest.sectors || [])
 .filter(
 sector =>
 String(
 sector.graphRole || ""
 ).toUpperCase() ===
 "OBJECTIVE"
 )
 .length;
if (objectiveCount === 0) {
problems.push(
"Manifest contains no OBJECTIVE sector."
);
}
if (!manifest.occupancyIntent) {
problems.push(
"Manifest contains no occupancyIntent."
);
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

  window.AIDirector.ArchitecturalManifestBuilder =
    ArchitecturalManifestBuilder;
}