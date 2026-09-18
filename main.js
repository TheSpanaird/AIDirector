// modules/ai-director/scripts/main.js

import "/modules/ai-director/ui/sheet-injector.js";
import "/modules/ai-director/scripts/data/narrative-director.js";
import "/modules/ai-director/scripts/runtime/token-lifecycle-manager.js";
import "/modules/ai-director/scripts/runtime/world-event-processor.js";
import "/modules/ai-director/scripts/ai/sector-interruption-engine.js";
import { registerAutomationHooks } from "/modules/ai-director/scripts/journal/journal-hooks.js";
import { registerSettings } from "/modules/ai-director/scripts/settings.js";
import { MainRouter } from "/modules/ai-director/core/main-router.js";
import { activateChatListeners } from "/modules/ai-director/ui/chat-card-renderer.js";
import { ResolutionEngine } from "/modules/ai-director/scripts/engines/resolution-engine.js";
import "/modules/ai-director/scripts/ai/sector-interruption-engine.js";
import { SkillCheckHooks } from "/modules/ai-director/scripts/hooks/skill-check-hooks.js";
import { ContestedButtonListener } from "/modules/ai-director/scripts/listeners/contested-button-listener.js";
import { FlagFactory } from "../core/flag-factory.js";
import { registerAIListeners } from "/modules/ai-director/scripts/ai/event-listeners.js";
import { AIDirectorApp } from "../apps/director-app.js";
import { registerProductionButtonListener } from "./listeners/production-button-listener.js";
import { RegionSectorListener } from "/modules/ai-director/scripts/listeners/region-sector-listener.js";
import { SightInspectorListener } from "/modules/ai-director/scripts/listeners/sight-inspector-listener.js";
import { VisionParser } from "/modules/ai-director/scripts/api/vision-parser.js";
import { VisionWallPlacer } from "/modules/ai-director/scripts/engines/vision-wall-placer.js";
import { SpatialAnchorEngine } from "/modules/ai-director/scripts/engines/spatial-anchor-engine.js";
import { AtmosphereEngine } from "/modules/ai-director/scripts/engines/atmosphere-engine.js";
import { ComfyMapPipeline } from "/modules/ai-director/scripts/pipelines/comfy-map-pipeline.js";
import { ScenePrepPipeline } from "/modules/ai-director/scripts/pipelines/scene-prep-pipeline.js";
import { SpatialLayoutEngine } from "/modules/ai-director/scripts/engines/spatial-layout-engine.js";
import { CartographerDebugRenderer } from "/modules/ai-director/scripts/cartographer/debug-renderer.js";
import { CartographerWallRenderer } from "/modules/ai-director/scripts/cartographer/wall-renderer.js";
import { CartographerRoomRenderer } from "/modules/ai-director/scripts/cartographer/room-renderer.js";
import { CartographerConnectionRenderer } from "/modules/ai-director/scripts/cartographer/connection-renderer.js";
import { CorridorRouterEngine } from "/modules/ai-director/scripts/cartographer/corridor-router-engine.js";
import { CorridorRenderer } from "/modules/ai-director/scripts/cartographer/corridor-renderer.js";
import { ShapePrimitiveGenerator } from "/modules/ai-director/scripts/cartographer/shape-primitive-generator.js";
import { RoomLabelRenderer } from "/modules/ai-director/scripts/cartographer/room-label-renderer.js";
import { DoorwayPlacementEngine } from "/modules/ai-director/scripts/cartographer/doorway-placement-engine.js";
import { TopologyEngine } from "/modules/ai-director/scripts/cartographer/topology-engine.js";
import { TopologyNormalizer } from "/modules/ai-director/scripts/cartographer/topology-normalizer.js";
import { CartographerEngine } from "/modules/ai-director/scripts/cartographer/cartographer-engine.js";
import { MapForge, AIDirectorMapForge } from "/modules/ai-director/scripts/ai/map-forge.js";
import { BoundaryFeaturePlanner } from "/modules/ai-director/scripts/cartographer/boundary-feature-planner.js";
import { CartographerLedgerSync } from "/modules/ai-director/scripts/cartographer/cartographer-ledger-sync.js";
import { CartographerUIController } from "/modules/ai-director/scripts/cartographer/cartographer-ui-controller.js";
import { CartographerFloorLibrary } from "/modules/ai-director/scripts/cartographer/cartographer-floor-library.js";
import { FloorStyleResolver } from "/modules/ai-director/scripts/cartographer/floor-style-resolver.js";
import { CartographerFloorLayer } from "/modules/ai-director/scripts/cartographer/cartographer-floor-layer.js";
import { LayoutProfileLibrary } from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";
import { DungeonLedgerManager } from "/modules/ai-director/scripts/data/dungeon-ledger-manager.js";
import { LayoutProfileResolver } from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { ArchitecturalPacker } from "/modules/ai-director/scripts/cartographer/architectural-packer.js";
import { VentilationNetworkPlanner } from "/modules/ai-director/scripts/cartographer/ventilation-network-planner.js";
import { VentilationRenderer } from "/modules/ai-director/scripts/cartographer/ventilation-renderer.js";
import { CirculationSpacePlanner } from "/modules/ai-director/scripts/cartographer/circulation-space-planner.js";
import { DynamicFootprintComposer } from "/modules/ai-director/scripts/cartographer/dynamic-footprint-composer.js";
import { FootprintDesignLibrary } from "/modules/ai-director/scripts/cartographer/footprint-design-library.js";
import { FootprintDesignEngine } from "/modules/ai-director/scripts/cartographer/footprint-design-engine.js";
import { BuildingProgramPlanner } from "/modules/ai-director/scripts/cartographer/building-program-planner.js";
import { HybridConnectionPlanner } from "/modules/ai-director/scripts/cartographer/hybrid-connection-planner.js";
import { SightInspectorHUD } from "/modules/ai-director/scripts/data/sight-inspector-hud.js";
import { MapArchitect } from "/modules/ai-director/scripts/data/map-architect.js";
import { SceneSectorPlanner } from "/modules/ai-director/scripts/data/scene-sector-planner.js";
import { NarrativeMemoryManager } from "/modules/ai-director/scripts/memory/narrative-memory-manager.js";
import { ArcRegistryManager } from "/modules/ai-director/scripts/memory/arc-registry-manager.js";
import { ArcResolutionManager } from "/modules/ai-director/scripts/memory/arc-resolution-manager.js";
import { NPCMemoryManager } from "/modules/ai-director/scripts/memory/npc-memory-manager.js";
import { MemoryExtractionManager } from "/modules/ai-director/scripts/memory/memory-extraction-manager.js";
import { MemoryApplicationManager } from "/modules/ai-director/scripts/memory/memory-application-manager.js";
import { NarrativeContextBuilder } from "/modules/ai-director/scripts/memory/narrative-context-builder.js";
import { MemoryAgingManager } from "/modules/ai-director/scripts/memory/memory-aging-manager.js";
import { ArcRelationshipManager } from "/modules/ai-director/scripts/memory/arc-relationship-manager.js";
import { FactionMemoryManager } from "/modules/ai-director/scripts/memory/faction-memory-manager.js";
import {  LocationMemoryManager } from "/modules/ai-director/scripts/memory/location-memory-manager.js";
import {  NarrativeStateManager } from "/modules/ai-director/scripts/memory/narrative-state-manager.js";
import {  ArchiveRetrievalManager } from "/modules/ai-director/scripts/memory/archive-retrieval-manager.js";
import {  OccupancyIntentManager } from "/modules/ai-director/scripts/memory/occupancy-intent-manager.js";
import {  SceneManagerMemoryEngine } from "/modules/ai-director/scripts/memory/scene-manager-memory-engine.js";
import {  WorldStateEvolutionManager } from "/modules/ai-director/scripts/memory/world-state-evolution-manager.js";
import { ObstacleMaterializationManager } from "/modules/ai-director/scripts/data/obstacle-materialization-manager.js";

CartographerFloorLayer.registerHooks();

globalThis.AIDirectorApp = AIDirectorApp;
globalThis.getFilePicker = () =>
  foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;

Hooks.once("init", async () => {
  console.log("ai-director | Initializing Core & Master Traffic Controller Pattern...");

  Object.assign(window, {
    VisionParser,
    VisionWallPlacer,
    SpatialAnchorEngine,
    SpatialLayoutEngine,
    AtmosphereEngine,
    ComfyMapPipeline,
    ScenePrepPipeline,
    CartographerDebugRenderer,
    CartographerWallRenderer,
    CartographerRoomRenderer,
    CartographerConnectionRenderer,
    CorridorRouterEngine,
    CorridorRenderer,
    ShapePrimitiveGenerator,
    RoomLabelRenderer,
    DoorwayPlacementEngine,
    TopologyEngine,
    TopologyNormalizer,
    CartographerEngine,
    MapForge,
    AIDirectorMapForge,
    BoundaryFeaturePlanner,
    CartographerLedgerSync,
    CartographerUIController,
    CartographerFloorLibrary,
    FloorStyleResolver,
    CartographerFloorLayer,
    CirculationSpacePlanner,
    DynamicFootprintComposer,
    FootprintDesignLibrary,
    FootprintDesignEngine,
    BuildingProgramPlanner,
    HybridConnectionPlanner,
    LayoutProfileLibrary,
    LayoutProfileResolver,
    DungeonLedgerManager,
    ArchitecturalPacker,
    VentilationNetworkPlanner,
    VentilationRenderer,
    SightInspectorHUD,
    SceneSectorPlanner,
    MapArchitect,
    NarrativeMemoryManager,
    ArcRegistryManager,
    ArcResolutionManager,
    NPCMemoryManager,
    MemoryExtractionManager,
    MemoryApplicationManager,
    NarrativeContextBuilder,
    ArcRelationshipManager,
    FactionMemoryManager,
    LocationMemoryManager,
    NarrativeStateManager,
    ArchiveRetrievalManager,
    OccupancyIntentManager,
    SceneManagerMemoryEngine,
    WorldStateEvolutionManager,
    ObstacleMaterializationManager,
    MemoryAgingManager
  });

  Handlebars.registerHelper("isObject", value =>
    value !== null && typeof value === "object" && !Array.isArray(value)
  );

  registerSettings();
  console.log("ai-director | Settings registered.");

  registerAIListeners();
  ResolutionEngine.init();
  SkillCheckHooks.register();
  ContestedButtonListener.activateListeners();
  RegionSectorListener.register();
  MainRouter.init();

  await foundry.applications.handlebars.loadTemplates([
    "modules/ai-director/templates/ai-director-app.hbs",
    "modules/ai-director/templates/partials/core-dashboard.hbs",
    "modules/ai-director/templates/partials/dungeon-ledger.hbs",
    "modules/ai-director/templates/partials/cartographer-panel.hbs",
    "modules/ai-director/templates/partials/persona-engine.hbs",
    "modules/ai-director/templates/partials/relation-hub.hbs",
    "modules/ai-director/templates/partials/rag-library.hbs",
    "modules/ai-director/templates/partials/chaos-matrix.hbs",
    "modules/ai-director/templates/partials/combat-tension.hbs",
    "modules/ai-director/templates/partials/journal-log.hbs"
  ]);

  Handlebars.registerPartial("core-dashboard", `{{> modules/ai-director/templates/partials/core-dashboard.hbs}}`);
  Handlebars.registerPartial("dungeon-ledger", `{{> modules/ai-director/templates/partials/dungeon-ledger.hbs}}`);
  Handlebars.registerPartial("cartographer-panel", `{{> modules/ai-director/templates/partials/cartographer-panel.hbs}}`);
  Handlebars.registerPartial("persona-engine", `{{> modules/ai-director/templates/partials/persona-engine.hbs}}`);
  Handlebars.registerPartial("relation-hub", `{{> modules/ai-director/templates/partials/relation-hub.hbs}}`);
  Handlebars.registerPartial("rag-library", `{{> modules/ai-director/templates/partials/rag-library.hbs}}`);
  Handlebars.registerPartial("chaos-matrix", `{{> modules/ai-director/templates/partials/chaos-matrix.hbs}}`);
  Handlebars.registerPartial("combat-tension", `{{> modules/ai-director/templates/partials/combat-tension.hbs}}`);
  Handlebars.registerPartial("journal-log", `{{> modules/ai-director/templates/partials/journal-log.hbs}}`);

  console.log("ai-director | Sidebar partial templates preloaded and keys mapped.");
});

Hooks.once("ready", async () => {
  console.log("ai-director | Ready Hook Triggered");

  registerAutomationHooks?.();
  registerProductionButtonListener();

  document.addEventListener("click", event => {
    const button = event.target.closest(".ai-director-popout-btn");
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const source = button.dataset.src;
    if (!source) return;

    const imagePopout = new foundry.applications.apps.ImagePopout({
      src: source,
      window: { title: "Cinematic Preview Canvas" }
    });
    imagePopout.render(true);
  });

  const module = game.modules.get("ai-director");
  if (!module) {
    console.error("ai-director | CRITICAL ERROR: Could not find active module instance.");
    return;
  }

  module.api = {
    open: async () => {
      const openWindow = Object.values(foundry.applications.instances)
        .find(windowInstance => windowInstance instanceof AIDirectorApp);
      return openWindow
        ? openWindow.render(true)
        : new AIDirectorApp().render(true);
    },

    openMindset: async actor => {
      if (!actor) {
        return ui.notifications.warn(
          "No valid target actor profile entity specified."
        );
      }
      const { renderMindsetDialog } = await import("./engines/mindset-dialog.js");
      return renderMindsetDialog(actor);
    },

    toggleStreamPanel: () => {
      const app = Object.values(foundry.applications.instances)
        .find(windowInstance => windowInstance.id === "ai-director-app");
      if (app) app.close();
      else new AIDirectorApp().render(true);
    },

    refreshCartographerFloor: options =>
      CartographerFloorLayer.refresh(options),

    clearCartographerFloor: () =>
      CartographerFloorLayer.clear()
  };

  if (game.user.isGM) {
    const folderName = "AI Director: Configuration";
    const journalName = "AI-Director-World-Seed";

    let folder = game.folders.contents.find(
      entry => entry.name === folderName && entry.type === "JournalEntry"
    );

    if (!folder) {
      folder = await Folder.create({
        name: folderName,
        type: "JournalEntry",
        color: "#2a4d7c"
      });
    }

    let seedJournal = game.journal.contents.find(
      journal => journal.name === journalName && journal.folder?.id === folder.id
    );

    if (!seedJournal) {
      const defaultSeedContent = `
        <h2>AI Director World Seed Profile</h2>
        <p>Modify the parameters below to anchor your local AI model's world logic.</p>
        <hr />
        <p><strong>Genre Profile:</strong> Generic Sandbox / Cyberpunk / Grim Fantasy / Space Opera</p>
        <p><strong>Regional Scope:</strong> The Whispering Woods / Night City / Outer Rim</p>
        <p><strong>World Tone:</strong> Gritty, low-resource, high-stakes sandbox simulation.</p>
        <h3>Archetype Anchors</h3>
        <ul>
          <li><strong>Authority:</strong> Corporate Security, Corrupt City Guard, Galactic Empire</li>
          <li><strong>Underworld:</strong> Fixers, Smugglers, The Shadow Hand Collective</li>
          <li><strong>Fringe:</strong> Nomads, Outcasts, Wasteland Scavengers</li>
        </ul>
      `;

      await JournalEntry.create({
        name: journalName,
        folder: folder.id,
        pages: [{
          name: "World Configuration Seed",
          type: "text",
          text: { content: defaultSeedContent, format: 1 }
        }]
      });
    }

    game.socket.on("module.ai-director", async data => {
      if (data.action === "unlockHookJournal") {
        const journalEntry = game.journal.get(data.journalId);
        if (journalEntry) {
          const { performDatabaseUnlock } = await import("./chat/tag-interceptor.js");
          await performDatabaseUnlock(journalEntry);
        }
      }

      if (data.action === "compileJournalEvent") {
        const { compileNarrativeEvent } = await import("../journal/journal-compiler.js");
        await compileNarrativeEvent(data.hookId, data.actorName, data.cleanText);
      }

      if (data.action === "initializeChronicle") {
        const { compileNarrativeEvent } = await import("../journal/journal-compiler.js");
        await compileNarrativeEvent(
          "INITIALIZE_TIMELINE",
          "System Engine",
          "Campaign ledger pipeline active."
        );
      }

      if (data.action === "registerEmergentFaction") {
        const { FactionManager } = await import("./simulation/faction-manager.js");
        await FactionManager.registerFaction(data.id, data.name, data.data);
      }
    });
  }
});

Hooks.on("createChatMessage", async messageDocument => {
  if (game.user !== game.users.activeGM) return;
  const flags = FlagFactory.getFlags(messageDocument);
  const targetProcess =
    flags.routing?.process || flags.process || flags.processType;
  void targetProcess;
});

Hooks.on("updateActor", (actor, changes) => {
  if (!changes.flags?.["ai-director"]) return;
  const app = Object.values(foundry.applications.instances)
    .find(windowInstance => windowInstance.id === "ai-director-app");
  if (app) app.render();
});

Hooks.on("renderChatLog", (app, html) => {
  activateChatListeners(html);
});

Hooks.on("getSceneControlButtons", controls => {
  if (!game.user.isGM || !Array.isArray(controls)) return;

  const tokenControls = controls.find(control => control.name === "token");
  if (!tokenControls) return;

  tokenControls.tools.push({
    name: "ai-director-room",
    title: "AI Director Situation Room",
    icon: "fas fa-brain",
    visible: true,
    onClick: () =>
      game.modules.get("ai-director").api.toggleStreamPanel(),
    button: true
  });
});