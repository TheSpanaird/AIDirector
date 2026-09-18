import { MODULE_ID } from "../settings.js";
import { SpatialLayoutEngine } from "../engines/spatial-layout-engine.js";
import { buildAndStageSectorScene } from "../data/scene-manager.js";

/**
 * Translates Hermes 3 layout manifests into Dungeon Draw canvas objects, 
 * Foundry Door Walls, and Scene Regions, delegating scene staging to SceneManager.
 */
export class DungeonDrawPipeline {

  /**
   * Main workflow entry point called by external controllers (e.g. production-button-listener.js).
   * Orchestrates validation, spatial calculation, vector rendering, and scene staging.
   * 
   * @param {Object|string} rawManifest - Raw JSON object or JSON string from LLM output.
   * @param {Object} [options={}] - Custom rendering and staging parameters.
   * @returns {Promise<Object|null>} Processed spatial layout result or null if unauthorized.
   */
  static async executeWorkflow(rawManifest, options = {}) {
    // 1. Strict GM Execution Guard (AI-README Core Architectural Constraint)
    if (!game.user.isGM) {
      ui.notifications.warn("AI Director | Only the GM can execute layout generation routines.");
      return null;
    }

    try {
      // 2. Resolve & Validate Manifest
      let manifest = typeof rawManifest === "string" ? JSON.parse(rawManifest) : rawManifest;
      if (manifest && typeof manifest === "object" && manifest.manifest) {
        manifest = manifest.manifest;
      }

      if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.sectors) || manifest.sectors.length === 0) {
        const dungeonTitle = typeof rawManifest === "string" 
          ? rawManifest 
          : (manifest?.dungeonTitle || "Tactical Encounter");
        
        manifest = this._generateProceduralManifest(dungeonTitle);
      }

      ui.notifications.info(`AI Director | Calculating layout for "${manifest.dungeonTitle || "Dungeon"}"...`);

      // 3. Process spatial layout via SpatialLayoutEngine
      const processedLayout = SpatialLayoutEngine.processLayout(manifest, {
        originX: options.originX ?? 1000,
        originY: options.originY ?? 1000,
        gridSize: canvas.grid?.size || 100
      });

      // 4. Dry-Run Bypass
      if (options.dryRun) {
        console.log("AI Director | Dry run layout calculation complete:", processedLayout);
        ui.notifications.info("AI Director | Layout calculation dry-run successful.");
        return processedLayout;
      }

      // 5. Render vector canvas elements using Dungeon Draw API
      if (options.renderVectorMap !== false) {
        const activeFloor = options.targetFloor ?? 1;

      manifest.sectors =
        processedLayout.floors?.[activeFloor]?.sectors ??
        processedLayout.floors?.[activeFloor] ??
        manifest.sectors ??
        [];

        await this.buildSectorMap(manifest, activeFloor);
      }

      // 6. Delegate Scene Staging to SceneManager
      const primarySector = manifest.sectors?.[0];
      if (primarySector && options.stageScene !== false) {
        await buildAndStageSectorScene(
          primarySector,
          options.tileImagePath || null,
          options.visionObjects || []
        );
      }

      return processedLayout;
    } catch (error) {
      console.error("AI Director | Failed to execute dungeon layout workflow:", error);
      ui.notifications.error(`AI Director | Layout generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Builds canvas vector elements onto active scene from processed spatial manifest.
   * @param {Object} manifest - Validated spatial manifest.
   * @param {number} [targetFloor=1] - Active floor to render onto current scene.
   */
  static async buildSectorMap(manifest, targetFloor = 1) {
    if (!game.modules.get("dungeon-draw")?.active) {
      ui.notifications.error("❌ Dungeon Draw module is not active!");
      return;
    }

    const ddApi = game.modules.get("dungeon-draw")?.api;
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.error("❌ No active scene found to draw dungeon onto!");
      return;
    }

    const gridSize = scene.grid?.size || 100;
    const sectorWidthGrid = 10;  // Standard sector width in grid units
    const sectorHeightGrid = 10; // Standard sector height in grid units

    const themeConfig = this._getThemeConfig(manifest.dungeonTitle || "", manifest.theme || game.system.id);
    
    // Filter sectors by requested floor level
    const sectorsToDraw = (manifest.sectors || []).filter(
      s => (s.floor ?? 1) === targetFloor
    );

    ui.notifications.info(`📐 Generating Floor ${targetFloor} layout with Dungeon Draw (${sectorsToDraw.length} sectors)...`);

    for (const sector of sectorsToDraw) {
      // Calculate absolute pixel coordinates from topological gridPosition or bounds
      const col = sector.gridPosition?.col ?? 0;
      const row = sector.gridPosition?.row ?? 0;

      const x = sector.bounds?.x ?? (col * (sectorWidthGrid + 3) * gridSize + 500);
      const y = sector.bounds?.y ?? (row * (sectorHeightGrid + 3) * gridSize + 500);
      const w = sector.bounds?.width ?? (sectorWidthGrid * gridSize);
      const h = sector.bounds?.height ?? (sectorHeightGrid * gridSize);

      // Draw Room Floor & Walls using Dungeon Draw API
      if (ddApi?.createRectangle) {
        await ddApi.createRectangle({
          x: x,
          y: y,
          width: w,
          height: h,
          theme: themeConfig
        });
      }

      // Place Doors at connected wall segments
      if (Array.isArray(sector.connections)) {
        for (const conn of sector.connections) {
          if (["up", "down"].includes(conn.wallSide?.toLowerCase())) continue;

          const doorCoord = this._calculateDoorCoordinates(x, y, w, h, conn.wallSide, gridSize);
          const doorType = this._getDoorType(conn.doorType);
          const doorState = this._getDoorState(conn.doorType);

          await scene.createEmbeddedDocuments("Wall", [{
            c: doorCoord,
            move: CONST.WALL_MOVEMENT_TYPES.NORMAL,
            sense: CONST.WALL_SENSE_TYPES.NORMAL,
            door: doorType,
            ds: doorState,
            flags: { 
              [MODULE_ID]: { 
                isGeneratedDoor: true,
                targetSector: conn.to,
                doorType: conn.doorType || "standard"
              } 
            }
          }]);
        }
      }

      // Create Scene Region matching room purpose (Foundry v13)
      await scene.createEmbeddedDocuments("Region", [{
        name: `${sector.name || "Sector"} (${sector.sectorId})`,
        color: themeConfig.regionColor,
        shapes: [{
          type: "rectangle",
          x: x,
          y: y,
          width: w,
          height: h,
          rotation: 0
        }],
        flags: {
          [MODULE_ID]: {
            sectorId: sector.sectorId,
            floor: sector.floor ?? targetFloor,
            sensoryDescription: sector.sensoryDescription || "",
            trapsAndSecrets: sector.trapsAndSecrets || "",
            isVisionGenerated: false
          }
        }
      }]);

      // Build sub-regions for Terrain Zones
      if (Array.isArray(sector.terrainZones)) {
        for (const zone of sector.terrainZones) {
          const zoneX = x + (zone.bounds?.x || 0);
          const zoneY = y + (zone.bounds?.y || 0);
          const zoneW = zone.bounds?.width || 200;
          const zoneH = zone.bounds?.height || 200;

          await scene.createEmbeddedDocuments("Region", [{
            name: `${sector.name || "Sector"} - ${zone.type}`,
            color: this._getZoneColor(zone.type),
            shapes: [{
              type: "rectangle",
              x: zoneX,
              y: zoneY,
              width: zoneW,
              height: zoneH,
              rotation: 0
            }],
            flags: {
              [MODULE_ID]: {
                isTerrainZone: true,
                zoneType: zone.type,
                modifier: zone.modifier || ""
              }
            }
          }]);
        }
      }
    }

    ui.notifications.info(`✅ Dungeon Draw layout successfully created for Floor ${targetFloor}!`);
  }

  /**
   * Auto-Procedural Room Generator: Generates a multi-room layout when no manifest is active.
   * @private
   */
  static _generateProceduralManifest(title = "Tactical Encounter") {
    const cleanTitle = title.toLowerCase();

    if (cleanTitle.includes("ship") || cleanTitle.includes("station") || cleanTitle.includes("cyber") || cleanTitle.includes("sci-fi") || cleanTitle.includes("vault")) {
      return {
        dungeonTitle: title,
        theme: "scifi",
        sectors: [
          {
            sectorId: "sector_bridge",
            name: "Command Bridge",
            floor: 1,
            gridPosition: { col: 1, row: 0 },
            connections: [{ to: "sector_hub", wallSide: "south", doorType: "security_door" }]
          },
          {
            sectorId: "sector_hub",
            name: "Central Corridor Hub",
            floor: 1,
            gridPosition: { col: 1, row: 1 },
            connections: [
              { to: "sector_bridge", wallSide: "north", doorType: "security_door" },
              { to: "sector_med", wallSide: "west", doorType: "sliding_door" },
              { to: "sector_armory", wallSide: "east", doorType: "blast_door" },
              { to: "sector_engine", wallSide: "south", doorType: "heavy_hatch" }
            ]
          },
          {
            sectorId: "sector_med",
            name: "Medical & Research Bay",
            floor: 1,
            gridPosition: { col: 0, row: 1 },
            connections: [{ to: "sector_hub", wallSide: "east", doorType: "sliding_door" }]
          },
          {
            sectorId: "sector_armory",
            name: "Security & Armory",
            floor: 1,
            gridPosition: { col: 2, row: 1 },
            connections: [{ to: "sector_hub", wallSide: "west", doorType: "blast_door" }]
          },
          {
            sectorId: "sector_engine",
            name: "Engine Room / Reactor",
            floor: 1,
            gridPosition: { col: 1, row: 2 },
            connections: [{ to: "sector_hub", wallSide: "north", doorType: "heavy_hatch" }]
          }
        ]
      };
    }

    if (cleanTitle.includes("castle") || cleanTitle.includes("prison") || cleanTitle.includes("dungeon") || cleanTitle.includes("keep") || cleanTitle.includes("tower")) {
      return {
        dungeonTitle: title,
        theme: "castle",
        sectors: [
          {
            sectorId: "sector_entry",
            name: "Gatehouse & Courtyard",
            floor: 1,
            gridPosition: { col: 0, row: 0 },
            connections: [{ to: "sector_hall", wallSide: "east", doorType: "iron_grate" }]
          },
          {
            sectorId: "sector_hall",
            name: "Great Guard Hall",
            floor: 1,
            gridPosition: { col: 1, row: 0 },
            connections: [
              { to: "sector_entry", wallSide: "west", doorType: "iron_grate" },
              { to: "sector_prison", wallSide: "south", doorType: "reinforced_door" }
            ]
          },
          {
            sectorId: "sector_prison",
            name: "Prison Block & Cells",
            floor: 1,
            gridPosition: { col: 1, row: 1 },
            connections: [
              { to: "sector_hall", wallSide: "north", doorType: "reinforced_door" },
              { to: "sector_vault", wallSide: "east", doorType: "locked_heavy_door" }
            ]
          },
          {
            sectorId: "sector_vault",
            name: "Warden Vault",
            floor: 1,
            gridPosition: { col: 2, row: 1 },
            connections: [{ to: "sector_prison", wallSide: "west", doorType: "locked_heavy_door" }]
          }
        ]
      };
    }

    return {
      dungeonTitle: title,
      theme: "dungeon",
      sectors: [
        {
          sectorId: "sector_01",
          name: "Entrance Antechamber",
          floor: 1,
          gridPosition: { col: 0, row: 0 },
          connections: [{ to: "sector_02", wallSide: "east", doorType: "wooden_door" }]
        },
        {
          sectorId: "sector_02",
          name: "Main Chamber",
          floor: 1,
          gridPosition: { col: 1, row: 0 },
          connections: [
            { to: "sector_01", wallSide: "west", doorType: "wooden_door" },
            { to: "sector_03", wallSide: "south", doorType: "iron_door" }
          ]
        },
        {
          sectorId: "sector_03",
          name: "Inner Sanctum",
          floor: 1,
          gridPosition: { col: 1, row: 1 },
          connections: [{ to: "sector_02", wallSide: "north", doorType: "iron_door" }]
        }
      ]
    };
  }

  /**
   * Maps system genre, explicit themes, or title keywords to Dungeon Draw visual themes.
   * @private
   */
  static _getThemeConfig(title = "", explicitTheme = "") {
    const t = (title + " " + explicitTheme + " " + game.system.id).toLowerCase();

    if (t.includes("cpr") || t.includes("cyber") || t.includes("sw5e") || t.includes("starwars") || t.includes("scifi") || t.includes("ship")) {
      return {
        wallColor: "#111827",
        floorColor: "#1f2937",
        regionColor: "#00aeff"
      };
    }

    if (t.includes("ice") || t.includes("snow") || t.includes("frost") || t.includes("arctic")) {
      return {
        wallColor: "#1e293b",
        floorColor: "#334155",
        regionColor: "#38bdf8"
      };
    }

    if (t.includes("tavern") || t.includes("inn") || t.includes("wood") || t.includes("cabin")) {
      return {
        wallColor: "#292524",
        floorColor: "#44403c",
        regionColor: "#a16207"
      };
    }

    return {
      wallColor: "#4a3b32",
      floorColor: "#2d2a26",
      regionColor: "#ff9900"
    };
  }

  /**
   * Maps terrain zone type to visual region highlight colors.
   * @private
   */
  static _getZoneColor(zoneType = "") {
    switch (zoneType) {
      case "waterZone":
      case "water": 
        return "#0066ff";
      case "hazardZone":
      case "hazard": 
        return "#ff0033";
      case "coverZone":
      case "cover": 
        return "#888888";
      case "roadZone":
      case "difficultTerrain": 
        return "#aaaa55";
      default: 
        return "#ffff00";
    }
  }

  /**
   * Maps door specs/types to Foundry door wall types (Standard vs Secret).
   * @private
   */
  static _getDoorType(doorType = "") {
    const type = (doorType || "").toLowerCase();
    if (type.includes("secret") || type.includes("hidden") || type.includes("concealed")) {
      return CONST.WALL_DOOR_TYPES.SECRET;
    }
    return CONST.WALL_DOOR_TYPES.DOOR;
  }

  /**
   * Maps door specs/types to initial Foundry door states.
   * @private
   */
  static _getDoorState(doorType = "") {
    const type = (doorType || "").toLowerCase();
    if (type.includes("locked") || type.includes("iron") || type.includes("security") || type.includes("blast")) {
      return CONST.WALL_DOOR_STATES.LOCKED;
    }
    return CONST.WALL_DOOR_STATES.CLOSED;
  }

  /**
   * Calculates wall segment coordinates centered along a sector wall.
   * @private
   */
  static _calculateDoorCoordinates(x, y, w, h, wallSide, gridSize) {
    const side = (wallSide || "").toLowerCase();
    const halfDoor = gridSize;

    switch (side) {
      case "north":
        return [x + (w / 2) - halfDoor, y, x + (w / 2) + halfDoor, y];
      case "south":
        return [x + (w / 2) - halfDoor, y + h, x + (w / 2) + halfDoor, y + h];
      case "east":
        return [x + w, y + (h / 2) - halfDoor, x + w, y + (h / 2) + halfDoor];
      case "west":
        return [x, y + (h / 2) - halfDoor, x, y + (h / 2) + halfDoor];
      default:
        return [x, y, x + (gridSize * 2), y];
    }
  }
}