Revision Date: August 2026



Core Architectural Constraints



Absolute vs. Contextual Imports: Core initialization, layouts, and templates should refer to the standard manifest root absolute space (/modules/ai-director/). Code scripts running internally within deeply structured subfolders utilize localized relative paths (./, ../) to protect contextual imports across deep directory trees.



Stateless Services: Sub-modules residing in services/ must export pure, stateless functions. They must take context parameters, compute an output, and return it. They are strictly forbidden from self-registering ambient hooks (Hooks.on) or parsing independent UI DOM layers.



Immutable Transaction Contracts: Every asynchronous automated loop must accept, preserve, and forward an explicit transaction tracking key (correlationId via FlagFactory).



The GM Execution Guard: All narrative automation, persistent journal updates, and server LLM backend transactions must clear the active GM check (if (!game.user.isGM) return;) to guarantee computations execute exactly once per game session.



Volume Chronicle Data Storage: Generated content (scene logs, session recaps, dungeon manifests) must never create standalone journal entry files per generation. All journal creations must route through the volume helper (volume-helper.js), which enforces a strict 20-page cap per Master Journal Volume and auto-increments to a new volume (Vol. X) when full to ensure clean database indexing and UI stability.



Foundry VTT V13 Clean Standards: Do not invoke global legacy namespaces. When executing filesystem exploration inside tooling or macro logic, modern implementations must target foundry.applications.apps.FilePicker.implementation to prevent performance warnings and maintain forward compatibility.



Updated File \& Folder Structure Map



modules/ai-director/

├── module.json                 <-- Module Manifest definition file

├── AI-README.md                <-- This operational specification document

│

├── 📁 apps/                     <-- APPLICATION INTERFACE WINDOWS

│   ├── director-actions.js     <-- Panel event dispatch routing (onPulse, onSend, onScene input parsing, map/panorama forge)

│   ├── director-app.js         <-- Main Control Console view (ApplicationV2 framework)

│   ├── faction-edit-dialog.js  <-- Dialog window interface for modifying emergent faction state

│   └── mindset-dialog.js       <-- UI configuration console for adjusting NPC behavioral \& OCEAN traits

│

├── 📁 core/                     <-- ORCHESTRATION LAYER \& SYSTEM DATA CONFLICT BRIDGES

│   ├── director-router.js      <-- Master Command Router; orchestrates modular pipelines

│   ├── flag-factory.js         <-- Unified transaction metadata flag encoder/decoder (SCENE\_PRODUCTION support)

│   └── main-router.js          <-- Legacy initialization router wrapper

│

├── 📁 css/                      <-- Stylesheets and component UI sheets

│

├── 📁 data/                     <-- MODULE STATIC ASSETS

│   └── scene-templates.json    <-- Built-in configuration definitions for map builders

│

├── 📁 lang/                     <-- LOCALIZATION MATRICES

│   └── en.json                 <-- English locale string bindings

│

├── 📁 scripts/                  <-- MODULAR LOGIC SUB-SYSTEMS

│   ├── main.js                 <-- Module core bootstrapper; loads hooks and components (including forge \& spatial listeners)

│   ├── settings.js             <-- Client/World menu configuration registrations

│   │

│   ├── 📁 ai/                   <-- INFERENCE MATRIX \& ENGINE COMPILERS

│   │   ├── companion-runner.js     <-- Dispatches chat sequences to the unified Ollama client for the companion AI

│   │   ├── event-listeners.js      <-- Registers decoupled Foundry hooks (chat parsing, heartbeat loops)

│   │   ├── generation-engine.js    <-- Generates narrative scenes and parses headless NPC roles via LLM

│   │   ├── interruption-engine.js  <-- Evaluates organic pacing to determine if secondary NPCs interject

│   │   ├── journal-compiler.js     <-- Compiles system-agnostic context vectors into persistent timeline journals

│   │   ├── map-forge.js            <-- Handles 16:9 bird's-eye gridless tactical maps, background queueing, \& scene swaps

│   │   ├── memory.js               <-- Maps short-term transactional event queues into summary packets

│   │   ├── npc-profile-builder.js  <-- Analyzes lore to generate numerical personality traits and behavioral laws

│   │   ├── panorama-forge.js       <-- \[SEALED] Handles wide-angle, eye-level cinematic scene artwork

│   │   ├── parser.js               <-- Sanitizes chat streams and evaluates lightweight algorithmic sentiment

│   │   ├── prompt-builder.js       <-- Master prompt factory; classifies intents and routes payload generation

│   │   ├── prompt-recap.js         <-- Builds structural prompts for session recaps and campaign continuity

│   │   ├── prompt-scene.js         <-- Context-to-prompt factory mapping environment layouts, NPC lists, \& Active Horizon slices

│   │   ├── rag-engine.js           <-- Retrieval-Augmented Generation core for fetching vectorized history

│   │   ├── recap-manager.js        <-- Compiles session memory blocks into comprehensive UI recaps

│   │   ├── scene-coordinator.js    <-- Maps grid coordinates and tokens into narrative scene participants

│   │   ├── sector-interruption-engine.js <-- Broadcasts environmental audio/alarm ripples to split party members in adjacent sectors

│   │   ├── short-term-telemetry.js <-- Tracks immediate, transient chat and interaction event queues

│   │   ├── state-manager.js        <-- Master controller for saving AI modifications to entity flags

│   │   ├── state-store.js          <-- Volatile memory cache for active session interactions

│   │   ├── status-updater.js       <-- Broadcasts active AI thinking/processing states to the UI

│   │   └── trust-evaluator.js      <-- Calculates mathematical shifts to NPC relationships based on sentiment

│   │

│   ├── 📁 api/                  <-- EXTERNAL GATEWAYS

│   │   ├── ollama-client.js    <-- Unified gateway controller mapping requests to the local LLM

│   │   └── run-prompt.js       <-- Low-level script interface for raw background inference

│   │

│   ├── 📁 chat/                 <-- CHAT LOG FILTERS \& INJECTORS

│   │   ├── chat-engine.js      <-- Distributes finalized text and multi-speaker bubbles to the VTT Chat

│   │   ├── chat-handler.js     <-- Lightweight utility for posting raw text as the AI Director

│   │   ├── tag-interceptor.js  <-- Cleanses LLM markup and executes database side-effects (plot hooks, trust)

│   │   └── template-store.js   <-- Core template vault ensuring system default behaviors are cached

│   │

│   ├── 📁 data/                 <-- CAMPAIGN HISTORY \& MANIFEST ENGINE COMPILERS

│   │   ├── dungeon-ledger-manager.js <-- Parses, validates, and persists real-time sector inline edits from UI

│   │   ├── dungeon-prompts.js  <-- Prompt factory enforcing Tier A multi-sector JSON manifest generation

│   │   ├── dungeon-schema.js   <-- JSON Schema definition \& structural validator for multi-sector manifests

│   │   ├── dungeon-sync.js     <-- Sync worker saving validated manifests to AI Director Memory volumes

│   │   ├── memory-manager.js   <-- Gathers structured prose summaries for game updates

│   │   ├── scene-manager.js    <-- Manages scene directives, executes manifest \& narrative generation, handles volume sync

│   │   └── sector-tracker.js   <-- Manages token spatial location state flags and split-party sector consensus

│   │

│   ├── 📁 engines/              <-- MECHANICAL MATH EVALUATORS \& SPAWN SYSTEMS

│   │   ├── actor-identity-resolver.js <-- PASS 7B actor resolution planner (world -> compendium -> fallback)

│   │   ├── actor-resolution-applier.js <-- PASS 7C actor identity/mechanical profile application engine

│   │   ├── contested-orchestrator.js <-- Manages initial target assignment and counter-skill resolution pipelines

│   │   ├── mechanical-engine.js    <-- Resolves narrative consequences for isolated mechanical dice outcomes

│   │   ├── mechanics-bridge.js     <-- Injects system rules (D20, Interlock) and renders interactive challenge cards

│   │   ├── npc-generator.js        <-- Headless backend orchestrator that creates Actors, derives variants, and calibrates behavioral stats

│   │   ├── resolution-engine.js    <-- Intercepts chat cards, applies locks, evaluates dice math, and narrativizes outcomes

│   │   ├── sector-entity-collector.js <-- PASS 7A structured monster/NPC collection from Scene Records

│   │   ├── sector-spawn-planner.js <-- PASS 7D actor resolution + token placement planning engine

│   │   └── skill-check-orchestrator.js <-- Decoupled sandbox workflow engine managing state narration math

│   │

│   ├── 📁 hooks/                   <-- EVENT REGISTER HOOK GATEWAYS

│   │   └── skill-check-hooks.js    <-- Pure, stateless bridge intercepting sandbox SKILL\_CHECK\_SEQUENCE rolls

│   │

│   ├── 📁 journal/              <-- JOURNAL LEDGER SYNCHRONIZERS

│   │   ├── journal-hooks.js    <-- Listens for journal creation/updates to trigger semantic chunking

│   │   ├── journal-manager.js  <-- Handles reading and writing structured AI configurations to journals

│   │   └── volume-helper.js    <-- Master chronicle volume engine (caps pages at 20 per volume, auto-increments)

│   │

│   ├── 📁 listeners/            <-- USER INTERACTION CAPTURE HOOKS

│   │   ├── contested-button-listener.js <-- Intercepts layout clicks and automated createChatMessage loops safely

│   │   ├── production-button-listener.js <-- Intercepts SCENE\_PRODUCTION asset clicks via FlagFactory metadata

│   │   └── region-sector-listener.js <-- Intercepts Foundry V13 Scene Region movement to update activeSector states

│   │

│   ├── 📁 modes/                <-- STATE ROUTING PIPELINES

│   │   ├── director-pulse.js   <-- Handles idle game state automated background narrative generation

│   │   ├── gm-modes.js         <-- Executes Game Master logic, rule checks, and cinematic consequence evaluations

│   │   └── npc-chat.js         <-- Executes strict individual identity impersonation and deception filters

│   │

│   ├── 📁 prompt-factory/       <-- INFERENCE MATRICES \& SYSTEM KERNELS

│   │   ├── actor-prompts.js    <-- Assembles strict in-character directives for specific NPC identities

│   │   ├── combat-prompts.js   <-- Generates tactical directives based on active encounters and positioning

│   │   ├── gm-prompts.js       <-- Formats instructions for Game Master tasks (info, narration, mechanics)

│   │   ├── scene-prompts.js    <-- Formats prompts for rich sensory descriptions constrained by Active Horizon spatial slices

│   │   ├── skill-check-prompts.js <-- Text templates tracking standalone skill boundaries

│   │   ├── contested-prompts.js <-- Evaluates opposing skills and processes the strict Precipice Rule for results

│   │   └── system-rules.js     <-- Registry mapping mechanics (CPR, 5e, SW5e) and LLM intent classification

│   │

│   └── 📁 simulation/           <-- DYNAMIC ENVIRONMENT TRACKERS

│       └── faction-manager.js  <-- Controls political tiers, influence metrics, and emergent trust states

│

├── 📁 services/                 <-- STATELESS COMPONENT ENGINES

│   ├── lock-service.js         <-- Handles multi-client race conditions during chat resolution

│   └── roll-service.js         <-- Core system rule math and threshold verification

│

├── 📁 templates/                <-- HANDLEBARS UI MARKUP

│   ├── ai-director-app.hbs     <-- Main Command Center template with Dungeon Ledger tab navigation

│   └── 📁 partials/             <-- Reusable UI markup snippets

│       └── dungeon-ledger.hbs  <-- Safety-blinded tabular inline editor for multi-sector dungeon manifests

│

├── 📁 ui/                       <-- INTERFACE INJECTORS

│   ├── chat-card-renderer.js

│   └── sheet-injector.js

│

└── 📁 workflows/               <-- LOCAL AUTOMATED GENERATION INTERFACES

&#x20;   ├── map-api.json            <-- Generalized system-agnostic 16:9 SDXL Lightning map layout

&#x20;   └── panorama-api.json       <-- Wide-angle panoramic scenery generation parameters



Engineering Feature Loops



🛡️ Feature Loop 1: The Session Recap Pipeline

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/ai/recap-manager.js

Payload Template: /modules/ai-director/scripts/ai/prompt-recap.js

Invariance Rules:

\- Strict Token Headroom: Local Ollama payload parameters enforce num\_predict: 4000 to prevent narrative truncation and protect storytelling detail lengths.

\- Foundry v13 Agnostic Writes: Page layout configurations route through volume-helper.js using direct integer assignment (format: 1) to eliminate multi-version API crashes.

\- Hook Cascade Protection: Journal entry creation explicitly invokes { renderHook: false } to ensure manual UI recaps fully insulate timeline compilations from infinite interceptor loops.



🛡️ Feature Loop 2: Cinematic Scene \& Multi-Sector Infiltration Engine

Status: \[ACTIVE \& SEALED]

Orchestrators: /modules/ai-director/scripts/data/scene-manager.js, /modules/ai-director/scripts/data/dungeon-sync.js, /modules/ai-director/scripts/data/dungeon-ledger-manager.js

Prompt \& Schema Factories: /modules/ai-director/scripts/data/dungeon-prompts.js, /modules/ai-director/scripts/data/dungeon-schema.js

Invariance Rules:

\- Flexible Execution Directives: Intercepts optional user directives from the UI via director-actions.js (onScene). If provided, constructs targeted multi-sector dungeon/facility scenarios; if empty, defaults to procedural scene narration.

\- JSON Schema Enforcement: Multi-sector manifests must strictly validate against dungeon-schema.js (validateDungeonManifest) before saving to persistent storage.

\- Isolated Volume Storage: Validated manifests and GM notes must sync exclusively to AI Director Memory using getOrCreateActiveVolumePage() to guarantee player separation and enforce the 20-page journal volume cap.

\- Blinded GM Playtest Ledger: Renders structured sector cards inside the Dungeon Ledger tab equipped with safety blur filters (masked-secret-blur) toggled via \[🔒 Reveal Master Data], supporting real-time inline database persistence.

\- Active Horizon Prompt Slicer: Slices LLM input payloads strictly to the Current Sector + Immediate Adjacent Exits via SectorTracker and RegionSectorListener, preventing token bloat and MacGuffin hallucination.

\- Background ComfyUI Queueing \& Auto-Swapping: Automatically queues background ComfyUI map generations for adjacent rooms upon sector entry, stores WebP binaries in world storage, and handles VTT Scene creation and activation.

\- Split Party \& Interruption Handling: Supports independent sector tracking for split party configurations via SectorTracker and broadcasts ambient alarm/combat ripples to adjacent sectors via SectorInterruptionEngine.

\- Stream \& Chat Card Mirroring: Output parsing cleanses tags via TagInterceptor and splits content uniformly across active DOM streaming boxes and interactive VTT chat message items.

\- Scene Record Enrichment Contract: Scene Manager must generate a complete Scene Record for each produced scene before Cartographer or panorama generation executes. The Scene Record must include a per-sector content pass that decides which rooms, buildings, or open areas are present, what state each area is in, what the players perceive, whether any NPCs, monsters, clues, traps, or secrets are present, and whether the sector is intentionally mundane. Not every sector requires an encounter, clue, or strong narrative purpose. Empty, ruined, abandoned, ordinary, transitional, storage, service, and atmospheric rooms are valid outputs when appropriate to the scene premise.

\- Living-vs-Abandoned Occupancy Rule: Scene Manager must scale sector content to the premise. A living castle should contain more workers, guards, residents, patrol routes, active stores, light sources, signs of use, and routine activity. An abandoned castle should contain more empty, damaged, collapsed, dusty, looted, overgrown, or sealed rooms, with only selected sectors containing clues, hazards, remnants, monsters, or evidence explaining what happened.

\- Sector Content Schema Requirement: Each sector record must support, at minimum, the following semantic fields before rendering or ledger display: sectorId, displayName, floor, sectorType, areaState, mundaneAllowed, sensoryDescription, playerViewPrompt, tacticalMapPrompt, inhabitants, monsters, traps, secrets, clues, loot, interactables, exits, connectionTypes, and gmNotes. The fields inhabitants, monsters, traps, secrets, clues, and loot may be empty arrays. Empty arrays are valid and should not be backfilled just to make every room eventful.

\- Player-View Prompt Rule: The room or area image prompt shown in the Scene Record should describe the eye-level point of view of what the players see inside the room, building, courtyard, or outdoor area. It should be suitable for Panorama Forge and should avoid top-down language. Tactical overhead map prompts remain separate from player-facing panorama prompts. If the UI currently displays a single "Map Generator Prompt" field for a sector, that field should be split or renamed so that player-facing POV panorama prompts are not confused with Cartographer or Map Forge tactical layout prompts.

\- NPC and Monster Asset Rule: If Scene Manager places inhabitants, NPCs, or monsters in a sector, it must emit structured entries with stable IDs, names or archetypes, count, disposition, role, current activity, visibility, and generation needs. NPC and monster image or actor generation must consume those structured entries rather than inferring actors from prose alone. Mundane sectors may intentionally have no NPC or monster entries.



Scene Manager Implementation Roadmap Status: \[COMPLETE]

Current Progress Snapshot — August 2026

\- Phase 0 baseline preservation: COMPLETE for Keep and Bailey V11 ground compound.

\- Phase 1 sector plan policy: COMPLETE. scene-sector-planner.js provides profile-driven target sector counts, required/optional sector policy, occupancy inference, scale inference, manifest repair, and connection-target validation.

\- Phase 2 schema expansion: COMPLETE for current Scene Record fields and backward-compatible normalization.

\- Phase 3 prompt contract update: COMPLETE for playerViewPrompt vs tacticalMapPrompt separation, mundane sectors, structured inhabitants/monsters, and sparse abandoned-location content.

\- Phase 4 Scene Manager normalization: COMPLETE for enriched sector fields, structured arrays, player-view prompts, tactical map prompts, and safe empty-array defaults.

\- Phase 5 journal and chat export parsing: COMPLETE for structured Scene Record rendering, GM-only memory detail, player-safe chat summary, and separate inhabitants/monsters/traps/secrets/clues/loot/interactables display.

\- Phase 6 Dungeon Ledger editing: COMPLETE for inline sector field persistence independent from Cartographer geometry.

\- Phase 7 NPC and monster generation handoff: COMPLETE. Fully integrated with npc-generator.js, actor resolution, variant derivation, and real-world token spawning gates.



Phase 7 Implementation Status — August 2026

Status: COMPLETE



Validated Milestones:

\- PASS 7A COMPLETE: Structured entity collector implemented. Canonical inputs are sector.monsters\[] and sector.inhabitants\[].

\- PASS 7B COMPLETE: Actor identity resolver implemented (World -> Compendium -> Fallback).

\- PASS 7C COMPLETE: Actor identity and mechanical profile application engine implemented.

\- PASS 7D COMPLETE: Structured sector spawn planner implemented with token preview placement and spawn metadata.

\- PASS 7E COMPLETE: npc-generator.js integrated with structured sector spawning pipeline.

\- PASS 7F COMPLETE: Explicit creation-gate safeguards implemented (dryRun and allow\* authorization flags).

\- PASS 7G COMPLETE: Non-destructive actor resolution review completed.

\- PASS 7H COMPLETE: Controlled real-world validation completed.

\- PASS 7I COMPLETE: Multi-entity encounter spawning, actor reuse across entities, duplicate-import prevention, and token placement stability verified.

\- PASS 7J COMPLETE: Mechanical variant creation, CR/level-specific actor scaling, and OCEAN (1–5) / Trait (1–9) profile normalization and flag preservation verified.



Proven Workflow:

Scene Record -> sector.monsters\[] / sector.inhabitants\[] -> structured spawn requests -> actor resolution -> world actor reuse or compendium actor import -> actor profile application -> token placement planning -> token creation



🛡️ Feature Loop 3: Headless NPC Generation Engine

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/engines/npc-generator.js

Profile Overlay Component: /modules/ai-director/scripts/ai/npc-profile-builder.js

Invariance Rules:

\- Global Anti-Clone Safety Guard: Must aggressively scan game.actors by using precise string trimming mechanics to halt duplication prior to processing asset payloads.

\- Compendium-First Actor Resolution: Standard NPCs, monsters, guards, workers, civilians, and system creatures should resolve from existing world actors or Actor compendiums before invoking AI or importer generation.

\- System-Specific Fallback Routing: If no suitable world or compendium actor exists, D\&D5e may route to the configured statblock importer, SW5e may route to the configured SW5e NPC generator, and Cyberpunk RED may route to the configured CPR NPC generator/importer.

\- Structured Entity Contract: Actor and token workflows must consume sector.monsters\[] and sector.inhabitants\[] first, preserving stableId, sectorId, sourceField, visibility, disposition, currentActivity, role, count, and generationNeeds in ai-director flags where possible.

\- Dynamic System Routing UI: System context detection must positionally map rulesets securely (e.g., triggering modal event loops for cyberpunk-red-core or passing formatted string layouts directly to clipboard engines for dnd5e/sw5e).

\- Immutable Personality Alignment Matrix: Behavioral attribute indexing must systematically calculate and flag behavioral scales combining tactical variables with OCEAN profile traits natively.

\- Profile Scale Normalization \& Variant Derivation (Pass 7J Contract): When scaling actors mechanically for target CRs or levels via deriveMechanicalVariant, the module must preserve identity keys and profile flags intact while normalizing raw inputs into standard UI slider-compatible integer scales (1–5 for OCEAN traits, 1–9 for tactical behavioral traits) inside flags\[MODULE\_ID].profile.



🛡️ Feature Loop 4: Game Master Chat Modes \& Contextual RAG Synchronization

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/modes/gm-modes.js

Payload Template: /modules/ai-director/scripts/ai/prompt-builder.js

Invariance Rules:

\- Strict Separation of Concerns: Interface elements inside /apps/ are forbidden from calling data storage indices directly. Contextual data gathering must run exclusively in the execution/routing matrix tier (gm-modes.js) via pure asynchronous imports.

\- Automated Lore Retrieval: Every runtime execution strategy inside executeGMMode must independently issue a semantic text lookup targeting /scripts/ai/rag-engine.js using getRelevantContext prior to building inference objects.

\- Contextual Fallback Safety Contract: If no matching data strings are generated via the active query, context parameters bound downstream to journalText and memoryText must evaluate to a default string literal of "NO\_MATCHING\_CANON\_DATA\_FOUND" to guarantee the LLM receives structured prompt boundaries.



🛡️ Feature Loop 5: Decoupled Skill Check Orchestration \& Narrative Resolution

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/engines/skill-check-orchestrator.js

Gateway Bridge: /modules/ai-director/scripts/hooks/skill-check-hooks.js

Interactive UI Renderer: /modules/ai-director/scripts/engines/resolution-engine.js

Invariance Rules:

\- Strict Decoupled Boundary Isolation: The interactive UI card click layers (resolution-engine.js) are forbidden from managing background dice intercepts or execution loops. They must only build outbound message expressions stamped with an explicit process type flag matching SKILL\_CHECK\_SEQUENCE and pass a unified correlationId tracking vector via FlagFactory.

\- Single Gateway Channel Enforcement: skill-check-hooks.js maintains the sole, hyper-focused createChatMessage listener allowed to handle sandbox rolls. It must immediately reject any transactions that do not strictly provide a topProcess === "SKILL\_CHECK\_SEQUENCE" token, guaranteeing that legacy evaluation loops remain permanently offline.

\- Double-Generation Circuit Protection: Before yielding execution to the asynchronous LLM narration payload builder, the gateway bridge must evaluate isResolutionProcessing. If true, the execution thread must return immediately to prevent multi-client race conditions and duplicate chat response cards.



🛡️ Feature Loop 6: Contested Roll Infrastructure \& The Precipice Rule

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/engines/contested-orchestrator.js

Listener Gatekeeper: /modules/ai-director/scripts/listeners/contested-button-listener.js

Inference Matrix: /modules/ai-director/scripts/prompt-factory/contested-prompts.js

Invariance Rules:

\- Absolute Fail-Fast Guardrail: To shield third-party system logs or core interactions from cross-contamination, the createChatMessage handler inside contested-button-listener.js must evaluate message.flags instantly. If the message lacks an explicit registration signature mapping back to MODULE\_ID or "ai-director", execution must perform an immediate, silent empty return. Checking sub-properties on completely unflagged core chatter is completely banned.

\- Non-Destructive Key Lookup: Verification of module flags must be handled cleanly via Object.prototype.hasOwnProperty.call(message.flags, MODULE\_ID) rather than direct nested reading, fully insulating objects constructed by external modules lacking unified layouts.

\- The Precipice Rule (Strict Mechanical Enforcement): When writing resolution text blocks via buildContestedOutcomePrompt, the local model is explicitly and non-negotiably forbidden from predicting, fabricating, or finalizing physical combat impacts, mechanical status changes, landing specific blows, or declaring damage allocations.

\- Narrative Boundary Context: The narration output must exclusively summarize shifts in tactical layout, psychological intimidation, positioning, and intent. If the outcome indicates that physical confrontation breaks out, the prose must systematically draw to an abrupt conclusion exactly at the precipice of action (e.g., "...and lunges forward as combat begins."), passing structural execution directly back to native Foundry tracker mechanics.



🛡️ Feature Loop 7: Cinematic Scene Battlemap Generation Engine

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/ai/map-forge.js

Payload Template: /modules/ai-director/workflows/map-api.json

Invariance Rules:

\- Cross-System Genre Adaptability: The prompt factory must dynamically inspect game.system.id at runtime. It must programmatically prepend system-appropriate aesthetic modifiers (e.g., high-fantasy medieval styling for dnd5e, neon-drenched wet asphalt for cpr/cyberpunk-red-core, or space opera gritty textures for sw5e) prior to compiling the context payload.

\- Strict Gridless Perspectives: Prompts pushed to the local image cluster must forcefully embed top-down omniscient perspective, bird-eye view, ground floor layout into the positive prompt block, while pairing it with explicit negative triggers targeting pre-rendered gridlines, hex patterns, isometric distortion to ensure seamless alignment under Foundry's native overhead grids.

\- Low-Latency WebP Compression: Rendered map output objects must be pulled as raw image blobs, translated into system .webp binaries to limit network overhead under 5–8 MB, and systematically uploaded to the absolute world storage array: worlds/${game.world.id}/ai-director-chronicles/maps/.

\- Decoupled Non-Blocking Loop: Map fabrication routines must run asynchronously alongside or immediately following timeline journal generation or adjacent room traversal to insulate text rendering speeds and guarantee that server UI stutter is completely avoided during campaign updates.



🛡️ Feature Loop 8: Deep Horizon Panorama Scenescape Compiler

Status: \[ACTIVE \& SEALED]

Orchestrator: /modules/ai-director/scripts/ai/panorama-forge.js

Payload Template: /modules/ai-director/workflows/panorama-api.json

Invariance Rules:

\- Eye-Level Lens Configuration: Prompt synthesis must strictly prohibit vertical structural camera tilts. It must force an explicit camera perspective string block mapping cinematic horizontal view, low-angle ground level, wide-angle establishing shot directly to the CLIP text node encoder.

\- Anti-Diagram Suppression Matrix: The negative prompt node must programmatically declare war on structural text, top-down overlays, drafting lines, blueprints, cross-sections, and character assets to ensure the image remains a completely pure, immersive background environment asset.

\- Isolated World Path Writing: Completed compilation sequences must deliver WebP assets beneath a hard-capped file size limit into the separate directory branch: worlds/${game.world.id}/ai-director-chronicles/panoramas/.



Scene Record Content Acceptance Criteria

Scene Record generation is considered ready when the following are validated:

\- A scene can produce sectors with no encounters, no clues, and no treasure when the premise calls for mundane or abandoned spaces.

\- A scene can produce populated sectors with NPCs, guards, workers, merchants, residents, monsters, or patrols when the premise calls for active occupancy.

\- Each sector has a sensory description suitable for GM narration.

\- Each sector has a player-view prompt suitable for Panorama Forge.

\- Tactical map prompts and POV panorama prompts are not conflated.

\- Inhabitants, monsters, traps, secrets, clues, loot, and interactables are structured arrays.

\- Generated NPCs or monsters can be passed to npc-generator.js without scraping prose.

\- Dungeon Ledger can display and edit sector content independently from geometry.

\- The manifest remains valid when most sector content arrays are empty.



\---

# AI Director 2.x Memory Architecture

Revision Status: September 2026  
Implementation Status: COMPLETE THROUGH M17

## Memory Architecture Core Philosophy

The objective is not:

Generate Content

The objective is:

Maintain Narrative Continuity

The AI Director memory system should understand:

* Who matters?
* Who matters here?
* Who matters now?
* What changed?
* What remains unresolved?
* What is connected?
* Who controls this location?
* Who occupies this location?
* What is happening here now?

The memory system should answer these questions without requiring archive retrieval when current structured memory already contains the answer.

## Critical Memory Architecture Rules

### One Memory Writer

Automated persistent memory updates must flow through `MemoryApplicationManager`.

Canonical write pipeline:

Narrative  
↓  
Memory Extraction  
↓  
Memory Delta  
↓  
Memory Application  
↓  
Persistent Memory

### Memory First, Archive Second

Structured memory is the primary continuity source.

Archive retrieval is fallback-only and must be used when relevant memory cannot answer the current request.

### Importance Is Not Availability

An important NPC, faction, arc, or location is not automatically present in the current scene.

The context system must distinguish:

* Globally important entities
* Directly matched entities
* Physically present scene entities
* Available entities
* Location-linked entities
* Currently active campaign entities

### Memory Selects, the LLM Presents

Memory selects known narrative ingredients:

* NPCs
* Factions
* Occupants
* Activities
* Threats
* Active arcs
* Active objectives

The LLM determines how those ingredients are presented in the narrative.

### Location Memory Is World State

Do not create a parallel world-state database for location ownership and occupancy.

Location Memory is the canonical persistent source for:

* Controlling faction
* Occupants
* Active activities
* Active threats
* Related NPCs
* Related factions
* Related arcs
* Historical facts
* Historical events

### Structured World Changes Only

Persistent world changes must not depend on:

* Hardcoded faction names
* Hardcoded location names
* Campaign-specific keyword checks
* Regular-expression inference from prose

Narrative output must provide structured `worldStateChanges\[]` records.

### IDs for Persistence, Names for Prompts

Stable IDs are canonical persistence keys.

Human-readable names should be resolved before prompt injection whenever possible.

### Empty Arrays Are Valid

The system must not fabricate content merely to populate empty collections.

Valid empty collections include:

* No NPCs
* No monsters
* No occupants
* No threats
* No activities
* No clues
* No traps
* No loot
* No archive results

## Memory Architecture Roadmap

### Current Status

* ✅ M1 Memory Separation
* ✅ M2 Narrative Memory Schema
* ✅ M3 Arc Registry
* ✅ M4 Memory Extraction
* ✅ M5 Memory Application
* ✅ M5.5 NPC Memory Integration
* ✅ M6 Context Builder
* ✅ M6.5 Retrieval Layer
* ✅ M6.6 Validation
* ✅ M7 Hybrid Narrative Director
* ✅ M8 Narrative Importance System
* ✅ M8.5 Scene and Location Context
* ✅ M9 Context Relevance Engine
* ✅ M10 Narrative Memory Evolution
* ✅ M10.5 Arc Relationship Engine
* ✅ M11 Faction Memory
* ✅ M11.1 Faction Relationship Engine
* ✅ M12 Location Memory
* ✅ M13 Narrative State Evolution
* ✅ M14 Archive Reduction
* ✅ M15 Occupancy Intent Integration
* ✅ M16 Scene Manager Integration
* ✅ M17 Dynamic World Continuity

## M1 Memory Separation

Status: COMPLETE

Discovery:

Narrative Director consumes Memory, not Archives.

## M2 Narrative Memory Schema

Status: COMPLETE

Introduced:

* Arc Memory
* NPC Memory
* Faction Memory foundations
* Location Memory foundations
* Narrative State foundations

## M3 Arc Registry

Status: COMPLETE

Supports:

* Arc creation
* Arc updates
* Resolution
* Failure
* Abandonment
* Aliases
* Facts
* Mysteries
* Objectives
* Threats

## M4 Memory Extraction

Status: COMPLETE

Pipeline:

Narrative  
↓  
Memory Delta

## M5 Memory Application

Status: COMPLETE

Established the Single Memory Writer rule.

Pipeline:

Memory Delta  
↓  
Memory Application  
↓  
Persistent Memory

## M5.5 NPC Memory Integration

Status: COMPLETE

Supports:

* Facts
* Obligations
* Important events
* Known locations
* Importance
* Reference tracking
* Memory search

## M6 Context Builder

Status: COMPLETE

Introduced unified Narrative Context construction.

## M6.5 Retrieval Layer

Status: COMPLETE

Supports:

* `findByFact()`
* `findByObligation()`
* `findByLocation()`
* `findByEvent()`
* `findRelevantNPCs()`

## M6.6 Validation

Status: COMPLETE

Validated:

* Memory write
* Memory read
* Persistence
* Context construction

## M7 Hybrid Narrative Director

Status: COMPLETE

Key discovery:

The problem was not reasoning. The problem was getting the correct memory into the prompt.

## M8 Narrative Importance System

Status: COMPLETE

Supports:

* Importance
* Promotion
* Reference tracking
* Decay
* Recency

Applied initially to:

* NPCs
* Arcs

## M8.5 Scene and Location Context

Status: COMPLETE

Introduced:

* `currentLocation`
* `currentRegion`
* `sceneEntities`

Key discovery:

Importance is not availability.

## M9 Context Relevance Engine

Status: COMPLETE

Introduced:

* Current location
* Current region
* Direct matches
* Scene entities
* Available entities
* Arc matches
* Active arcs
* Important entities
* Player goals

Key discovery:

Who matters is different from who matters here.

## M10 Narrative Memory Evolution

Status: COMPLETE

Narrative extraction creates structured updates for:

* `ARC\_OBJECTIVE`
* `ARC\_MYSTERY`
* `ARC\_THREAT`
* `ARC\_FACT`
* `NARRATIVE\_STATE`
* NPC events

Closed continuity loop:

Narrative  
↓  
Memory Extraction  
↓  
Memory Delta  
↓  
Memory Application  
↓  
Updated Memory  
↓  
Future Narrative

## M10.5 Arc Relationship Engine

Status: COMPLETE

Introduced:

* `relatedArcs\[]`
* Bidirectional relationships
* Relationship candidate discovery

Key rule:

Update Arc, Create Arc, or Link Arc. Do not merge everything.

## M11 Faction Memory

Status: COMPLETE

Supports:

* Faction facts
* Faction goals
* Faction threats
* Faction importance
* Related NPCs
* Related arcs

## M11.1 Faction Relationship Engine

Status: COMPLETE

Introduced:

* `relatedFactions\[]`
* Bidirectional faction relationships

Validated relationship types include explicit relationships such as `ENEMY`.

## M12 Location Memory

Status: COMPLETE

Supports:

* Facts
* Events
* Related NPCs
* Related factions
* Related arcs
* Importance
* Reference tracking

Introduced `importantLocations` into Narrative Context.

## M13 Narrative State Evolution

Status: COMPLETE

Introduced:

* Active objectives
* Active mysteries
* Active threats
* Active factions
* Active locations
* Active arcs
* Player goals
* Current narrative phase

Validated:

* State persistence
* State retrieval
* Duplicate protection
* Campaign phase tracking

## M14 Archive Reduction

Status: COMPLETE

Goal achieved:

Memory First  
↓  
Archive Fallback

Introduced:

* `archiveResults`
* Conditional archive retrieval
* Journal archive lookup

Key learning:

The fallback decision must ask whether memory answered the current query, not merely whether any memory exists.

## M15 Occupancy Intent Integration

Status: COMPLETE

Introduced `locationState`:

* Controlling faction
* Occupants
* Active threats
* Active activities

The Narrative Prompt now understands:

* Who controls the location
* Who occupies the location
* What is happening there
* What threats are active

## M16 Scene Manager Integration

Status: COMPLETE

Introduced `sceneMemory`:

* Selected NPCs
* Selected NPC names
* Selected factions
* Selected occupants
* Selected activities
* Selected threats

Key learning:

Memory selects narrative ingredients. The LLM presents those ingredients.

Location Memory became the scene-selection anchor connecting NPCs, factions, arcs, occupants, threats, and activities.

## M17 Dynamic World Continuity

Status: COMPLETE

Introduced structured `worldStateChanges\[]`.

Canonical pipeline:

Narrative  
↓  
`worldStateChanges\[]`  
↓  
World State Evolution Manager  
↓  
Memory Deltas  
↓  
Memory Application Manager  
↓  
Location Memory  
↓  
Future Narrative Context

Validated:

* Structured world-state extraction
* Location-control deltas
* Location-occupancy deltas
* Delta application
* Persistent Location Memory updates

Key learning:

Location Memory already is the World State. M17 provides the structured mechanism that evolves it.

## Memory Knowledge Graph

NPC  
↕  
Faction  
↕  
Faction  
↕  
Arc  
↕  
Arc  
↕  
Location  
↕  
Occupancy State  
↕  
Scene Memory  
↕  
World State Changes

Plus:

Campaign State

## Final Continuity Pipeline

Memory  
↓  
Narrative Context  
↓  
Narrative Prompt  
↓  
LLM Narrative  
↓  
`worldStateChanges\[]`  
↓  
Memory Extraction  
↓  
Memory Deltas  
↓  
Memory Application  
↓  
Updated World State  
↓  
Future Narrative

# Memory Architecture File Reference

## Core Memory

### narrative-memory-schema.js

Path: `/modules/ai-director/scripts/memory/narrative-memory-schema.js`

Function: Defines canonical memory schemas, constructors, and status constants.

Description: Supplies default Active Narrative State values and the Arc Memory structures required by memory managers.

Responsibilities:

* Define `ARC\_STATUS`
* Create Arc Memory records
* Create Active Narrative State records
* Preserve stored values over defaults

### narrative-memory-manager.js

Path: `/modules/ai-director/scripts/memory/narrative-memory-manager.js`

Function: Reads and writes top-level persistent narrative memory.

Description: Provides access to Active Narrative State and Arc Registry settings.

Responsibilities:

* Load Narrative State
* Save Narrative State
* Load Arc Registry
* Save Arc Registry
* Provide basic Narrative Context access

### memory-delta-schema.js

Path: `/modules/ai-director/scripts/memory/memory-delta-schema.js`

Function: Defines the standardized memory-change contract.

Description: Creates deltas containing type, target identifiers, value, source, importance, and timestamp metadata.

Responsibilities:

* Define delta types
* Create memory deltas
* Preserve `entityId`
* Preserve `arcId`
* Preserve `locationId`
* Support structured world-state changes

Examples:

* `ARC\_OBJECTIVE`
* `NPC\_EVENT`
* `LOCATION\_CONTROL\_CHANGE`
* `LOCATION\_OCCUPANCY\_CHANGE`
* `LOCATION\_ACTIVITY\_CHANGE`
* `LOCATION\_THREAT\_CHANGE`

### memory-extraction-manager.js

Path: `/modules/ai-director/scripts/memory/memory-extraction-manager.js`

Function: Converts normalized Narrative Records into memory deltas.

Description: Extracts arc, NPC, campaign-state, and structured world-state changes.

Responsibilities:

* Extract Arc Facts
* Extract Objectives
* Extract Mysteries
* Extract Threats
* Extract Player Goals
* Extract NPC Events
* Extract `worldStateChanges\[]`

### memory-application-manager.js

Path: `/modules/ai-director/scripts/memory/memory-application-manager.js`

Function: Applies memory deltas to their persistent destination.

Description: Acts as the automated Single Memory Writer.

Responsibilities:

* Apply Arc updates
* Apply NPC updates
* Apply Narrative State updates
* Apply Location Control changes
* Apply Location Occupancy changes
* Apply Location Activity changes
* Apply Location Threat changes
* Support dry-run validation

### memory-aging-manager.js

Path: `/modules/ai-director/scripts/memory/memory-aging-manager.js`

Function: Manages memory importance over time.

Description: Applies recency, promotion, reference, and decay behavior.

Responsibilities:

* Importance aging
* Promotion
* Decay
* Reference tracking

## Arc System

### arc-registry-manager.js

Path: `/modules/ai-director/scripts/memory/arc-registry-manager.js`

Function: Manages the persistent Arc Registry.

Description: Creates, updates, retrieves, and ranks campaign arcs.

Responsibilities:

* Create arcs
* Update arcs
* Return active arcs
* Store facts
* Store mysteries
* Store objectives
* Store threats
* Track importance
* Track references

### arc-resolution-manager.js

Path: `/modules/ai-director/scripts/memory/arc-resolution-manager.js`

Function: Manages arc identity and lifecycle state.

Description: Resolves existing arcs or creates appropriate new arcs while preventing unnecessary duplication.

Responsibilities:

* Resolve or create arcs
* Resolve arcs
* Fail arcs
* Abandon arcs
* Preserve lifecycle state

### arc-relationship-manager.js

Path: `/modules/ai-director/scripts/memory/arc-relationship-manager.js`

Function: Manages the Arc Relationship Graph.

Description: Links related arcs without collapsing them into a single record.

Responsibilities:

* Link arcs
* Retrieve related arcs
* Discover relationship candidates
* Preserve bidirectional relationships

## NPC Memory

### npc-memory-manager.js

Path: `/modules/ai-director/scripts/memory/npc-memory-manager.js`

Function: Manages persistent NPC continuity.

Description: Stores memory within actor profile flags and provides focused retrieval helpers.

Responsibilities:

* Facts
* Obligations
* Important events
* Known locations
* Importance tracking
* Reference tracking
* Deduplication
* NPC memory search

## Faction Memory

### faction-memory-manager.js

Path: `/modules/ai-director/scripts/memory/faction-memory-manager.js`

Function: Manages persistent Faction Memory.

Description: Stores faction knowledge and relationships in the world settings registry.

Responsibilities:

* Facts
* Goals
* Threats
* Related NPCs
* Related arcs
* Related factions
* Bidirectional faction relationships
* Importance tracking

## Location Memory

### location-memory-manager.js

Path: `/modules/ai-director/scripts/memory/location-memory-manager.js`

Function: Manages persistent location history and current world state.

Description: Stores both what happened at a location and what is currently true there.

Responsibilities:

* Facts
* Events
* Related NPCs
* Related factions
* Related arcs
* Controlling faction
* Occupants
* Active activities
* Active threats
* Importance and reference tracking

Invariant:

Location Memory is the canonical persistent world state for location control, occupancy, activities, and threats.

## Narrative State

### narrative-state-manager.js

Path: `/modules/ai-director/scripts/memory/narrative-state-manager.js`

Function: Manages campaign-level active narrative state.

Description: Tracks what matters now, independent of long-term historical memory.

Responsibilities:

* Active objectives
* Active mysteries
* Active threats
* Active arcs
* Active locations
* Active factions
* Player goals
* Narrative phase
* Duplicate prevention

## Archive System

### archive-retrieval-manager.js

Path: `/modules/ai-director/scripts/memory/archive-retrieval-manager.js`

Function: Retrieves historical journals as fallback context.

Description: Searches archive journals only when relevant structured memory is insufficient.

Responsibilities:

* Historical lookup
* Journal-name search
* Archive fallback

Rule:

Memory First. Archive Second.

## Occupancy System

### occupancy-intent-manager.js

Path: `/modules/ai-director/scripts/memory/occupancy-intent-manager.js`

Function: Reads the current active state of a location.

Description: Produces the focused `locationState` used by context and prompt construction.

Responsibilities:

* Controlling faction
* Occupants
* Active activities
* Active threats

## Scene Selection System

### scene-manager-memory-engine.js

Path: `/modules/ai-director/scripts/memory/scene-manager-memory-engine.js`

Function: Selects scene ingredients from memory.

Description: Converts location and related memory into Scene Manager recommendations.

Responsibilities:

* Select NPC IDs
* Resolve selected NPC names
* Select factions
* Select occupants
* Select threats
* Select activities

Introduced:

`sceneMemory`

Key rule:

Memory selects the scene. The LLM presents the scene.

## World-State Evolution System

### world-state-evolution-manager.js

Path: `/modules/ai-director/scripts/memory/world-state-evolution-manager.js`

Function: Converts structured world-state changes into memory deltas.

Description: Processes `worldStateChanges\[]` without keyword-based campaign inference.

Responsibilities:

* Read structured changes
* Create Location Control deltas
* Create Location Occupancy deltas
* Create Location Activity deltas
* Create Location Threat deltas
* Feed Memory Extraction and Application

Key rule:

Do not use hardcoded keyword matching. Use structured `worldStateChanges\[]`.

## Context Construction

### narrative-context-builder.js

Path: `/modules/ai-director/scripts/memory/narrative-context-builder.js`

Function: Builds the complete context consumed by Narrative Director.

Description: Combines scene state and all relevant memory layers into one prompt-ready object.

Responsibilities:

* Current location
* Current region
* Scene entities
* Direct matches
* Available entities
* Relevant arcs
* Related arcs
* Active Arc names
* Important NPCs
* Important factions
* Faction relationships
* Important locations
* Active Narrative State
* Location State
* Scene Memory
* Archive fallback

## Narrative Integration

### narrative-director.js

Path: `/modules/ai-director/scripts/data/narrative-director.js`

Function: Orchestrates narrative generation, validation, persistence, extraction, and application.

Description: Connects Narrative Context, Narrative Prompt, Ollama generation, journal storage, and memory evolution.

Responsibilities:

* Build Narrative Context
* Build Narrative Prompt
* Call the configured local LLM
* Normalize Narrative Records
* Validate Narrative Records
* Save Canon records
* Save Memory records
* Extract Memory Deltas
* Apply Memory Deltas
* Preserve structured `worldStateChanges\[]`

### narrative-prompts.js

Path: `/modules/ai-director/scripts/prompt-factory/narrative-prompts.js`

Function: Constructs the Narrative Director system and user prompts.

Description: Injects all prompt-ready memory and defines the required Narrative Record JSON contract.

Responsibilities:

* Current Location injection
* Current Location State injection
* Scene Entity injection
* Direct Match injection
* Active Arc injection
* Related Arc injection
* Important NPC injection
* Important Faction injection
* Important Location injection
* Archive Fallback injection
* Player Goal injection
* Active Campaign State injection
* Scene Memory recommendations
* Structured `worldStateChanges\[]` output contract
* Valid JSON enforcement

# Canonical Memory Structures

## Active Narrative State

```javascript
{
  activeObjectives: \[],
  activeMysteries: \[],
  activeThreats: \[],
  activeFactions: \[],
  activeLocations: \[],
  activeArcs: \[],
  playerGoals: \[],
  currentNarrativePhase: "INTRODUCTION"
}
```

## Location Memory

```javascript
{
  locationId,
  name,
  facts: \[],
  events: \[],
  occupants: \[],
  controllingFaction: null,
  activeThreats: \[],
  activeActivities: \[],
  relatedNPCs: \[],
  relatedFactions: \[],
  relatedArcs: \[],
  importance: 5,
  lastReferenced: null,
  lastPromoted: null
}
```

## Scene Memory

```javascript
{
  selectedNPCs: \[],
  selectedNPCNames: \[],
  selectedFactions: \[],
  selectedThreats: \[],
  selectedActivities: \[],
  selectedOccupants: \[]
}
```

## World-State Changes

```javascript
{
  type: "LOCATION\_CONTROL\_CHANGE",
  locationId: "location\_id",
  value: "faction\_id"
}
```

```javascript
{
  type: "LOCATION\_OCCUPANCY\_CHANGE",
  locationId: "location\_id",
  value: \[
    "occupant\_id\_or\_archetype"
  ]
}
```

# Memory Architecture Completion Status

* ✅ Memory Separation
* ✅ Narrative Memory Schema
* ✅ Arc Registry
* ✅ Arc Relationships
* ✅ NPC Memory
* ✅ Faction Memory
* ✅ Faction Relationships
* ✅ Location Memory
* ✅ Narrative State
* ✅ Importance and Aging
* ✅ Context Relevance
* ✅ Memory-First Archive Fallback
* ✅ Occupancy Intent
* ✅ Scene Memory Selection
* ✅ Structured World-State Evolution
* ✅ Closed Continuity Loop

The M1-M17 memory architecture is complete.

Future development must extend these established contracts rather than:

* Create parallel memory stores
* Bypass the Memory Delta pipeline
* Reintroduce archive-first retrieval
* Assume important entities are physically present
* Infer persistent world changes from hardcoded campaign text

