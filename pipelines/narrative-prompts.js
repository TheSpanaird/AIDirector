/*
* AI Director 2.0
* Narrative Prompt Factory
*
* PURPOSE
* -------
* Generates prompts used exclusively by Narrative Director.
*
* // modules/ai-director/scripts/prompt-factory/narrative-prompts.js
*
* INPUTS
* ------
* - Player Directive
* - Canon Lore
* - Memory Lore
* - Active Scene Context
*
* OUTPUT
* ------
* Narrative Record JSON
*
* FORBIDDEN OUTPUT
* ----------------
* - Rooms
* - Sectors
* - Maps
* - Geometry
* - NPC Placement
* - Token Placement
*/
function normalize(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export function buildNarrativePrompt({
  playerDirective = "",
  canonLore = "",
  memoryLore = "",
  sourceScene = null,
  narrativeContext = {}
} = {}) {
  const sceneName = sourceScene?.name || "Unknown Location";

  const contextBlock = `
ACTIVE NARRATIVE CONTEXT

CURRENT LOCATION

Scene:
${
  narrativeContext.currentLocation
    ?.sceneName || "Unknown"
}

Region:
${
  narrativeContext.currentRegion
    || "Unknown"
}

CURRENT LOCATION STATE

Controlling Faction:

${
  narrativeContext
    .locationState
    ?.controllingFaction
    || "Unknown"
}

Occupants:

${
  narrativeContext
    .locationState
    ?.occupants?.length

    ? narrativeContext
        .locationState
        .occupants
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "Unknown"
}

Active Threats:

${
  narrativeContext
    .locationState
    ?.activeThreats?.length

    ? narrativeContext
        .locationState
        .activeThreats
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

Active Activities:

${
  narrativeContext
    .locationState
    ?.activeActivities?.length

    ? narrativeContext
        .locationState
        .activeActivities
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

SCENE MEMORY RECOMMENDATIONS

Selected NPCs:

${
  narrativeContext
    .sceneMemory
    ?.selectedNPCNames?.length

    ? narrativeContext
        .sceneMemory
        .selectedNPCNames
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

Selected Occupants:

${
  narrativeContext
    .sceneMemory
    ?.selectedOccupants?.length

    ? narrativeContext
        .sceneMemory
        .selectedOccupants
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

Selected Activities:

${
  narrativeContext
    .sceneMemory
    ?.selectedActivities?.length

    ? narrativeContext
        .sceneMemory
        .selectedActivities
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

Selected Threats:

${
  narrativeContext
    .sceneMemory
    ?.selectedThreats?.length

    ? narrativeContext
        .sceneMemory
        .selectedThreats
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

Selected Factions:

${
  narrativeContext
    .sceneMemory
    ?.selectedFactions?.length

    ? narrativeContext
        .sceneMemory
        .selectedFactions
        .map(
          item =>
            `- ${item}`
        )
        .join("\n")

    : "None"
}

SCENE ENTITIES

${
  narrativeContext.sceneEntities
    ?.length
    ? narrativeContext.sceneEntities
        .map(
          entity =>
            `- ${entity.name}`
        )
        .join("\n")
    : "None"
}

AVAILABLE ENTITIES

${
  narrativeContext.availableEntities
    ?.length
    ? narrativeContext.availableEntities
        .map(
          entity =>
            `- ${entity.name}`
        )
        .join("\n")
    : "None"
}

DIRECT MATCHES

${
  narrativeContext.directMatches
    ?.length
    ? narrativeContext.directMatches
        .map(
          entity =>
            `- ${entity.name}`
        )
        .join("\n")
    : "None"
}

ARC MATCHES

${
  narrativeContext.arcMatches
    ?.length
    ? narrativeContext.arcMatches
        .map(
          arc =>
            `- ${arc.name}`
        )
        .join("\n")
    : "None"
}

CONTEXT PRIORITY

1. Direct Matches are highest priority.
2. Scene Entities are physically present.
3. Available Entities can participate immediately.
4. Arc Matches are directly related to the current request.
5. Active Arcs provide campaign continuity.
6. Important NPCs provide long-term continuity.
7. Do not assume Important NPCs are present unless they appear in Scene Entities, Available Entities, or Direct Matches.

ACTIVE ARCS
${
  narrativeContext.activeArcs?.length
    ? narrativeContext.activeArcs.map(arc => `
NAME:
${arc.name}

FACTS:
${
  arc.facts?.length
    ? arc.facts.map(f => `- ${f}`).join("\n")
    : "- None"
}

MYSTERIES:
${
  arc.mysteries?.length
    ? arc.mysteries.map(m => `- ${m}`).join("\n")
    : "- None"
}

OBJECTIVES:
${
  arc.objectives?.length
    ? arc.objectives.map(o => `- ${o}`).join("\n")
    : "- None"
}

THREATS:
${
  arc.threats?.length
    ? arc.threats.map(t => `- ${t}`).join("\n")
    : "- None"
}
`).join("\n")
    : "None"
}

IMPORTANT NPCS
${
  narrativeContext.importantEntities?.length
    ? narrativeContext.importantEntities
        .map(entity => `
- ${entity.name}

FACTS:
${
  entity.facts?.length
    ? entity.facts
        .map(f => `  • ${f}`)
        .join("\n")
    : "  • None"
}
`)
        .join("\n")
    : "None"
}

IMPORTANT FACTIONS

${
  (
    narrativeContext
      .importantFactions || []
  )
    .map(faction =>

`- ${faction.factionId}
(Importance:
${faction.importance})`
    )
    .join("\n")
}

IMPORTANT LOCATIONS

${
  (
    narrativeContext
      .importantLocations || []
  )
    .map(location =>

`- ${location.name || location.locationId}

  Facts:
  ${
    location.facts?.join(", ")
      || "None"
  }

  Events:
  ${
    location.events?.join(", ")
      || "None"
  }`

    )
    .join("\n\n")
}

FACTION RELATIONSHIPS

${
  (
    narrativeContext
      .factionRelationships || []
  )
    .map(rel =>

`- ${rel.sourceFaction}
  -> ${rel.targetFaction}
  (${rel.relationship})`

    )
    .join("\n")
}

ARCHIVE FALLBACK

${
  narrativeContext
    .archiveResults?.length
    ? narrativeContext
        .archiveResults
        .map(
          journal =>
            `- ${journal.name}`
        )
        .join("\n")
    : "None"
}

PLAYER GOALS
${
  narrativeContext.activeNarrativeState
    ?.playerGoals?.length
    ? narrativeContext.activeNarrativeState.playerGoals
        .map(goal => `- ${goal}`)
        .join("\n")
    : "None"
}

ACTIVE CAMPAIGN STATE

WORLD STATE

Current Location:

${
  narrativeContext
    .importantLocations?.[0]
    ?.locationId
    || "Unknown"
}

Controlling Faction:

${
  narrativeContext
    .locationState
    ?.controllingFaction
    || "Unknown"
}

Occupants:

${
  narrativeContext
    .locationState
    ?.occupants?.length

    ? narrativeContext
        .locationState
        .occupants
        .map(
          item => `- ${item}`
        )
        .join("\n")

    : "None"
}

Activities:

${
  narrativeContext
    .locationState
    ?.activeActivities?.length

    ? narrativeContext
        .locationState
        .activeActivities
        .map(
          item => `- ${item}`
        )
        .join("\n")

    : "None"
}

Threats:

${
  narrativeContext
    .locationState
    ?.activeThreats?.length

    ? narrativeContext
        .locationState
        .activeThreats
        .map(
          item => `- ${item}`
        )
        .join("\n")

    : "None"
}

PRIORITY ORDER

1. Active Objectives
2. Active Mysteries
3. Active Threats
4. Active Arcs
5. Active Factions
6. Active Locations
7. Historical Memory

Current Phase:
${
  narrativeContext
    .activeNarrativeState
    ?.currentNarrativePhase || ""
}

Objectives:
${
  narrativeContext
    .activeNarrativeState
    ?.activeObjectives?.length
    ? narrativeContext
        .activeNarrativeState
        .activeObjectives
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}

Mysteries:
${
  narrativeContext
    .activeNarrativeState
    ?.activeMysteries?.length
    ? narrativeContext
        .activeNarrativeState
        .activeMysteries
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}

Threats:
${
  narrativeContext
    .activeNarrativeState
    ?.activeThreats?.length
    ? narrativeContext
        .activeNarrativeState
        .activeThreats
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}

Active Factions:
${
  narrativeContext
    .activeNarrativeState
    ?.activeFactions?.length
    ? narrativeContext
        .activeNarrativeState
        .activeFactions
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}

Active Locations:
${
  narrativeContext
    .activeNarrativeState
    ?.activeLocations?.length
    ? narrativeContext
        .activeNarrativeState
        .activeLocations
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}

Active Arcs:
${
  narrativeContext
    .activeArcNames?.length
    ? narrativeContext
        .activeArcNames
        .map(item => `- ${item}`)
        .join("\n")
    : "None"
}
`;
  
  const systemDirective = `
  You are the AI Director Narrative Engine.
  Your task is to determine the story context
  surrounding a player-directed destination,
  investigation, hideout, dungeon, settlement,
  facility, ruin, wilderness region, or objective.
  Generate narrative truth only.
  You may determine:
  - Historical background
  - Current situation
  - Occupancy state
  - Key factions
  - Threats
  - Mysteries
  - Player goals
  - Narrative objectives
  - Narrative obstacles
  - Narrative rewards
  - Narrative revelations
  - Story hooks
  - Initial player observations
  - Genre, theme, and tone
  You may NOT determine:
  - Rooms
  - Sectors
  - Geography
  - Maps
  - Layouts
  - Building programs
  - Architectural topology
  - NPC placement
  - Monster placement
  - Trap placement
  - Token locations
  - Clue locations
  - Reward locations
  sceneIntroduction is what the players perceive before exploration begins.
  openingDescription may include:
  - sights
  - sounds
  - smells
  - weather
  - atmosphere
  - environmental impressions
  openingDescription must NOT include:
  - hidden information
  - unexplored rooms
  - objectives behind doors
  - map connectivity
  - sector descriptions
  - secret locations
  - future discoveries
  Output ONLY valid JSON.
  {
    "title": "",
    "premise": "",
    "history": "",
    "currentSituation": "",
    "occupancyState": "",
    "genreProfile": "",
    "themeProfile": "",
    "toneProfile": "",
    "sceneIntroduction": {
      "openingDescription": "",
      "atmosphere": "",
      "observableDetails": []
    },
    "factions": [],
    "dangers": [],
    "mysteries": [],
    "objectives": [],
    "obstacles": [],
    "revelations": [],
    "rewards": [],
    "storyHooks": [],
    "playerGoals": [],
    "worldStateChanges": [],
    "tags": []
  }
  `;

  const userPayload = `
  ACTIVE SCENE
  ${sceneName}
  ${contextBlock}
  MEMORY USAGE REQUIREMENTS

  - Active Arcs should influence scene generation.
  - Important NPCs should be considered even when not explicitly named.
  - Prefer continuity over introducing unrelated new storylines.
  - Prefer advancing existing mysteries before inventing new ones.
  - Prefer advancing existing objectives before replacing them.
  - Use Memory first.
  - Use Archive information only
  when memory context is insufficient.
  - Prefer established memory
  over archive discovery.
  - If faction control, occupancy, activities, threats, or NPC locations change, populate worldStateChanges.
  WORLD CANON
  ${normalize(canonLore, "NO CANON AVAILABLE")}
  WORLD MEMORY
  ${normalize(memoryLore, "NO MEMORY AVAILABLE")}
  PLAYER DIRECTIVE
  ${normalize(playerDirective, "No directive provided.")}
  TASK
  Determine what story is occurring.
  Player agency is the highest priority.
  Examples:
  If the player says:
  "We return to our hideout"
  Determine:
  What is happening at the hideout.
  Do NOT determine:
  What rooms exist in the hideout.
  If the player says:
  "We investigate the lighthouse"
  Determine:
  Why the lighthouse matters.
  Do NOT determine:
  The lighthouse floorplan.
  worldStateChanges format:

  [
    {
      "type": "LOCATION_CONTROL_CHANGE",
      "locationId": "",
      "value": ""
    },

    {
      "type": "LOCATION_OCCUPANCY_CHANGE",
      "locationId": "",
      "value": []
    },

    {
      "type": "LOCATION_ACTIVITY_CHANGE",
      "locationId": "",
      "value": []
    },

    {
      "type": "LOCATION_THREAT_CHANGE",
      "locationId": "",
      "value": []
    }
  ]
  Output ONLY valid JSON.
  `;

  return {
    systemDirective: systemDirective.trim(),
    userPayload: userPayload.trim()
  };
}