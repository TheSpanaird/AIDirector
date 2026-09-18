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
  narrativeContext = {},
  opportunities = []
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

RELEVANT ARCS
${
  narrativeContext.relevantArcs?.length
    ? narrativeContext.relevantArcs
        .map(arc => `- ${arc.name}`)
        .join("\n")
    : "None"
}

RELEVANT NPCS
${
  narrativeContext.relevantNPCs?.length
    ? narrativeContext.relevantNPCs
        .map(
          npc =>
            `- ${npc.actor?.name}`
        )
        .join("\n")
    : "None"
}

RELEVANT FACTIONS

${
  narrativeContext.relevantFactions?.length
    ? narrativeContext.relevantFactions
        .map(
          faction =>
            `- ${faction.factionId}`
        )
        .join("\n")
    : "None"
}

RELEVANT LOCATIONS

${
  narrativeContext.relevantLocations?.length
    ? narrativeContext.relevantLocations
        .map(
          location =>
            `- ${location.name}`
        )
        .join("\n")
    : "None"
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
    ? narrativeContext.archiveResults
        .map(
          result => `
SOURCE:
${result.pageName}

EXCERPT:
${result.excerpt}
`
        )
        .join("\n")
    : "None"
}

NARRATIVE OPPORTUNITIES

${
  opportunities.length
    ? JSON.stringify(
        opportunities,
        null,
        2
      )
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
  When control, occupancy, activities, or threats
  change at a location, populate worldStateChanges.

  NARRATIVE OPPORTUNITIES
  represent the highest-priority
  adventure candidates.

  Prefer advancing these opportunities
  before inventing unrelated content.

  Preserve supplied opportunityId and sourceRefs exactly.

  Do not invent sourceRefs.

  The highest-priority supplied opportunity must remain the primary opportunity.

  Expand clues, obstacles, rewards, and consequences without replacing the established objective.

  CRITICAL OPPORTUNITY REWARD RULES

  Every opportunity MUST contain at least one reward.

  Opportunity rewards are the canonical rewards used by downstream systems.

  Top-level narrative rewards are campaign-level summaries.

  Opportunity rewards represent the specific outcomes earned by completing that opportunity.

  Do NOT leave opportunity.rewards empty.

  Every reward MUST use the following schema:

  {
  "rewardId": "unique_reward_id",
  "title": "reward title",
  "rewardType": "KNOWLEDGE|LOCATION|ACCESS|ITEM|RESOURCE|ALLY|ABILITY|FACTION|REPUTATION",
  "description": "reward description"
  }

  Examples:

  {
  "rewardId": "reward_prince_support",
  "title": "Prince Aldric's Gratitude",
  "rewardType": "ALLY",
  "description": "Prince Aldric becomes an ally of the party."
  }

  {
  "rewardId": "reward_cult_records",
  "title": "Cult Funding Records",
  "rewardType": "KNOWLEDGE",
  "description": "Evidence identifying the Cult's financiers."
  }

  Rewards are benefits granted to players.

  Consequences are changes to the world.

  Never place rewards inside consequences.

  Never place consequences inside rewards.

  Return no more than three opportunities.

  ONLY the following worldStateChanges
  types are valid:

  LOCATION_CONTROL_CHANGE
  LOCATION_OCCUPANCY_CHANGE
  LOCATION_ACTIVITY_CHANGE
  LOCATION_THREAT_CHANGE

  Do not generate any other type.
  Do not generate FACTION_RELATIONSHIP_CHANGE.
  Do not generate custom change types.

  Use the "value" field only.

  Do not use:
  change
  newValue
  controllingFaction
  newFaction
  stateChange

  All world state updates must use the
  "value" field.

  WORLD STATE CHANGE VALUE RULES

  LOCATION_CONTROL_CHANGE
  "value" must be a string.

  Example:
  "value": "riverfall_watch"

  LOCATION_OCCUPANCY_CHANGE
  "value" must be an array.

  Example:
  "value": [
    "cultists",
    "miners"
  ]

  LOCATION_ACTIVITY_CHANGE
  "value" must be an array.

  Example:
  "value": [
    "rituals",
    "excavation"
  ]

  LOCATION_THREAT_CHANGE
  "value" must be an array.

  Example:
  "value": [
    "cult_agents",
    "cave_in"
  ]

  Example:

  {
    "type": "LOCATION_CONTROL_CHANGE",
    "locationId": "abandoned_mines",
    "locationName": "Abandoned Mines",
    "value": "riverfall_watch"
  }
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
    "opportunities": [
      {
        "opportunityId": "",
        "title": "",
        "objective": "",
        "clues": [],
        "obstacles": [],
        "rewards": [
          {
            "rewardId": "",
            "title": "",
            "rewardType": "",
            "description": ""
          }
        ],
        "consequences": [],
        "sourceRefs": [],
        "priority": 0,
        "priorityReasons": [],
        "isPrimary": false
      }
    ],
    "worldStateChanges": [
      {
        "type": "LOCATION_CONTROL_CHANGE",
        "locationId": "",
        "locationName": "",
        "value": "riverfall_watch"
      }
    ],
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
  Output ONLY valid JSON.
  `;

  return {
    systemDirective: systemDirective.trim(),
    userPayload: userPayload.trim()
  };
}