// modules/ai-director/scripts/cartographer/cartographer-ui-controller.js
// AI Director Cartographer Phase 4.5
// Controller for generation, synchronization, and genre-aware floor presentation.

import { CartographerEngine }
  from "/modules/ai-director/scripts/cartographer/cartographer-engine.js";
import { CartographerLedgerSync }
  from "/modules/ai-director/scripts/cartographer/cartographer-ledger-sync.js";
import { CartographerMetadata }
  from "/modules/ai-director/scripts/cartographer/cartographer-metadata.js";
import { CartographerFloorLibrary }
  from "/modules/ai-director/scripts/cartographer/cartographer-floor-library.js";
import { FloorStyleResolver }
  from "/modules/ai-director/scripts/cartographer/floor-style-resolver.js";
import { CartographerFloorLayer }
  from "/modules/ai-director/scripts/cartographer/cartographer-floor-layer.js";
import { LayoutProfileLibrary }
  from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";
import { LayoutProfileResolver }
  from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { DungeonLedgerManager }
  from "/modules/ai-director/scripts/data/dungeon-ledger-manager.js";

export class CartographerUIController {
  static DEFAULTS = Object.freeze({
    floor: 1,
    gridSize: 100,
    corridorWidth: 200,
    doorWidth: 200,
    doorSpacing: 200,
    sharedTrunkLength: 400,
    approachLength: 200,
    persistSceneMetadata: true,
    includeDoorState: false,
    includeBoundaryFeatures: true,
    includeVentilation: true,
    renderVentilation: true,
    detectAddedRooms: true,
    detectDeletedRooms: true,
    detectAddedDoors: true,
    detectDeletedDoors: true,
    validateGraph: true,
    genre: "auto",
    floorPreset: "auto",
    textureScale: 1,
    outlineEnabled: true,
    outlineColor: "#4a4a4a",
    outlineWidth: 3,
    showAllFloors: false,
    assignmentMode: "AUTOMATIC",
    layoutProfile: "auto",
    architecturalScale: "auto"
  });

  static #state = new WeakMap();

  static getState(app) {
    if (!app || (typeof app !== "object" && typeof app !== "function")) {
      return this._createState();
    }

    if (!this.#state.has(app)) {
      this.#state.set(app, this._createState());
    }

    return this.#state.get(app);
  }

  static clearState(app) {
    if (app) this.#state.delete(app);
  }

  static prepareContext(app, baseContext = {}) {
    const state = this.getState(app);
    const scene = globalThis.canvas?.scene || null;
    const manifest = this._getActiveManifest(false);
    const metadata = CartographerMetadata.getSceneMetadata?.(scene) ||
      scene?.flags?.[CartographerMetadata.NAMESPACE]?.cartographer ||
      null;

    const previewLayoutProfile = LayoutProfileResolver.resolve(
      manifest || {},
      {
        layoutProfile:
          state.options.layoutProfile === "auto"
            ? null
            : state.options.layoutProfile,
        architecturalScale:
          state.options.architecturalScale === "auto"
            ? null
            : state.options.architecturalScale
      }
    );
    const resolvedFloorStyle = FloorStyleResolver.resolve({
      scene,
      gridSize: state.options.gridSize,
      layoutProfile: previewLayoutProfile.profileId,
      ...this._floorStyleOptions(state.options)
    });

    const displayedGenre = state.options.genre === "auto"
      ? resolvedFloorStyle.genre
      : state.options.genre;

    const floorTiles = FloorStyleResolver.listPresets({
      genre: displayedGenre,
      showAll: state.options.showAllFloors,
      minimumScore: state.options.showAllFloors ? 0 : 1
    });

    const floorPresetOptions = [
      {
        value: "auto",
        label: `Automatic (${resolvedFloorStyle.preset})`,
        selected: state.options.floorPreset === "auto"
      },
      {
        value: "plain",
        label: "Plain Color",
        selected: state.options.floorPreset === "plain"
      },
      ...floorTiles.map(tile => ({
        value: tile.id,
        label: tile.recommended
          ? `${tile.label} (Recommended)`
          : tile.label,
        selected: state.options.floorPreset === tile.id,
        score: tile.score,
        recommended: tile.recommended
      }))
    ];

    const genreOptions = [
      ["auto", `Automatic (${resolvedFloorStyle.systemGenre})`],
      ["fantasy", "Fantasy"],
      ["scifi", "Science Fiction"],
      ["cyberpunk", "Cyberpunk"],
      ["universal", "Universal"]
    ].map(([value, label]) => ({
      value,
      label,
      selected: state.options.genre === value
    }));

    const assignmentModeOptions = [
      ["AUTOMATIC", "Automatic by Room"],
      ["UNIFORM", "Uniform Map Floor"],
      ["MANUAL", "Manual Room Overrides"]
    ].map(([value, label]) => ({
      value,
      label,
      selected: state.options.assignmentMode === value
    }));

    const resolvedLayoutProfile = previewLayoutProfile;
    const layoutProfileOptions = [
      {
        value: "auto",
        label: `Automatic (${resolvedLayoutProfile.profileId})`,
        selected: state.options.layoutProfile === "auto"
      },
      ...LayoutProfileLibrary.list().map(profile => ({
        value: profile.id,
        label: `${this._titleCase(profile.id)} · ${this._titleCase(profile.family)}`,
        selected: state.options.layoutProfile === profile.id
      }))
    ];

    const architecturalScaleOptions = [
      ["auto", `Automatic (${resolvedLayoutProfile.architecturalScale || "STANDARD"})`],
      ["SMALL", "Small"],
      ["STANDARD", "Standard"],
      ["LARGE", "Large"],
      ["GRAND", "Grand"]
    ].map(([value, label]) => ({
      value,
      label,
      selected: state.options.architecturalScale === value
    }));

    const roomFloorAssignments = (manifest?.sectors || [])
      .filter(sector => Number(sector.floor ?? 1) === Number(state.options.floor))
      .map(sector => {
        const style = FloorStyleResolver.resolveRoomStyle(
          sector,
          resolvedFloorStyle,
          {
            scene,
            gridSize: state.options.gridSize,
            assignmentMode: state.options.assignmentMode,
            layoutProfile: resolvedLayoutProfile.profileId
          }
        );
        return {
          sectorId: sector.sectorId,
          name: sector.name || sector.sectorId,
          graphRole: sector.graphRole || "OPTIONAL",
          preset: style.preset,
          source: style.source,
          locked: style.locked === true
        };
      });

    return {
      ...baseContext,
      cartographer: {
        isGM: Boolean(globalThis.game?.user?.isGM),
        hasScene: Boolean(scene),
        hasManifest: Boolean(manifest?.sectors?.length),
        sceneId: scene?.id || null,
        sceneName: scene?.name || "No active scene",
        dungeonTitle: manifest?.dungeonTitle || "No active manifest",
        manifestId:
          metadata?.manifestId ||
          (manifest ? CartographerMetadata.getManifestId(manifest) : null),
        generationId: metadata?.generationId || null,
        floorNumber: metadata?.floorNumber || state.options.floor,
        options: { ...state.options },
        genreOptions,
        floorPresetOptions,
        assignmentModeOptions,
        layoutProfileOptions,
        architecturalScaleOptions,
        resolvedLayoutProfile: {
          ...LayoutProfileResolver.toMetadata(resolvedLayoutProfile),
          architecturalScale:
            resolvedLayoutProfile.architecturalScale ||
            state.options.architecturalScale ||
            "auto",
          description: resolvedLayoutProfile.description
        },
        roomFloorAssignments,
        resolvedFloorStyle:
          FloorStyleResolver.toMetadata(resolvedFloorStyle),
        busy: state.busy,
        activeOperation: state.activeOperation,
        status: state.status,
        statusType: state.statusType,
        preview: state.preview,
        previewSummary: state.previewSummary,
        lastResult: state.lastResult,
        lastError: state.lastError,
        sceneSummary: metadata?.summary || null,
        canGenerate: Boolean(
          globalThis.game?.user?.isGM && scene && manifest?.sectors?.length
        ),
        canPreview: Boolean(
          globalThis.game?.user?.isGM && scene && manifest?.sectors?.length
        ),
        canSync: Boolean(
          globalThis.game?.user?.isGM &&
          scene &&
          manifest?.sectors?.length &&
          state.preview?.changed
        ),
        canRebuild: Boolean(
          globalThis.game?.user?.isGM && scene && manifest?.sectors?.length
        )
      }
    };
  }

  static async generate(app, source = null) {
    const capturedOptions = this._readOptions(
      source,
      this.getState(app).options
    );
    return this._run(app, "generate", async state => {
      this._assertGM();
      const scene = this._getScene();
      const manifest = this._getActiveManifest();
      const options = capturedOptions;

      const confirmed = await this._confirm(
        "Generate Dungeon",
        "Generate the active Dungeon Manifest on the current scene? Existing Cartographer geometry will be replaced."
      );

      if (!confirmed) return null;

      const result = await CartographerEngine.generate(
        manifest,
        this._generationOptions(scene, options)
      );

      state.options = options;
      state.preview = null;
      state.previewSummary = null;
      state.lastResult = this._generationSummary(result);
      state.status = "Dungeon generated from the active manifest.";
      state.statusType = "success";
      return result;
    });
  }

  static async previewChanges(app, source = null) {
    const capturedOptions = this._readOptions(
      source,
      this.getState(app).options
    );
    return this._run(app, "preview", async state => {
      this._assertGM();
      const scene = this._getScene();
      const manifest = this._getActiveManifest();
      const options = capturedOptions;
      const syncOptions = this._syncOptions(options, false);
      const sceneState = CartographerLedgerSync.readScene(scene, syncOptions);
      const changes = CartographerLedgerSync.diff(
        manifest,
        sceneState,
        syncOptions
      );

      state.options = options;
      state.preview = changes;
      state.previewSummary = this.summarizeChanges(changes);
      state.lastResult = state.previewSummary;
      state.status = changes.changed
        ? "Scene changes detected. Review the summary before synchronizing."
        : "No scene changes detected.";
      state.statusType = changes.changed ? "warning" : "success";
      return { manifest, sceneState, changes };
    });
  }

  static async synchronize(app, source = null) {
    const capturedOptions = this._readOptions(
      source,
      this.getState(app).options
    );
    return this._run(app, "sync", async state => {
      this._assertGM();
      const scene = this._getScene();
      const manifest = this._getActiveManifest();
      const options = capturedOptions;
      const syncOptions = this._syncOptions(options, true);
      const sceneState = CartographerLedgerSync.readScene(scene, syncOptions);
      const changes = CartographerLedgerSync.diff(
        manifest,
        sceneState,
        syncOptions
      );

      if (!changes.changed) {
        state.options = options;
        state.preview = changes;
        state.previewSummary = this.summarizeChanges(changes);
        state.status = "No scene changes detected.";
        state.statusType = "success";
        return { manifest, sceneState, changes, persisted: false };
      }

      const summary = this.summarizeChanges(changes);
      const destructiveCount = summary.roomsDeleted + summary.doorsDeleted;
      const message = destructiveCount > 0
        ? `Synchronize ${summary.total} detected changes? This includes ${destructiveCount} deletion(s).`
        : `Synchronize ${summary.total} detected changes to AI Director Memory?`;

      const confirmed = await this._confirm(
        "Synchronize Scene to Ledger",
        message
      );

      if (!confirmed) return null;

      const result = await CartographerLedgerSync.sync(
        scene,
        manifest,
        syncOptions
      );

      state.options = options;
      state.preview = result?.changes || changes;
      state.previewSummary = this.summarizeChanges(state.preview);
      state.lastResult = {
        ...state.previewSummary,
        persisted: Boolean(result?.persisted)
      };
      state.status = result?.persisted
        ? "Scene changes synchronized to the Dungeon Ledger."
        : "Changes were applied, but no persistent Ledger page was returned.";
      state.statusType = result?.persisted ? "success" : "warning";
      return result;
    });
  }

  static async rebuild(app, source = null) {
    const capturedOptions = this._readOptions(
      source,
      this.getState(app).options
    );
    return this._run(app, "rebuild", async state => {
      this._assertGM();
      const scene = this._getScene();
      const manifest = this._getActiveManifest();
      const options = capturedOptions;

      const confirmed = await this._confirm(
        "Rebuild Scene",
        "Rebuild the current scene from the active Dungeon Manifest? Existing Cartographer geometry will be replaced."
      );

      if (!confirmed) return null;

      const result = await CartographerEngine.generate(
        manifest,
        this._generationOptions(scene, options)
      );

      state.options = options;
      state.preview = null;
      state.previewSummary = null;
      state.lastResult = this._generationSummary(result);
      state.status = "Scene rebuilt from the active Dungeon Manifest.";
      state.statusType = "success";
      return result;
    });
  }

  static async applyFloorStyleChange(app, source = null) {
    this._assertGM();

    const scene = this._getScene();
    const state = this.getState(app);
    const options = this._readOptions(source, state.options);
    const manifest = this._getActiveManifest(false) || {};
    const layoutProfile = LayoutProfileResolver.resolve(
      manifest,
      {
        layoutProfile:
          options.layoutProfile === "auto"
            ? null
            : options.layoutProfile,
        architecturalScale:
          options.architecturalScale === "auto"
            ? null
            : options.architecturalScale
      }
    );
    const floorStyle = FloorStyleResolver.resolve({
      scene,
      gridSize: options.gridSize,
      layoutProfile: layoutProfile.profileId,
      ...this._floorStyleOptions(options)
    });

    const validation =
      FloorStyleResolver.validateResolvedStyle(floorStyle);

    if (!validation.valid) {
      throw new Error(
        `Invalid floor style: ${validation.problems.join(" ")}`
      );
    }

    state.options = options;

    await Promise.all([
      this._setSetting("cartographerGenre", options.genre),
      this._setSetting("cartographerFloorPreset", options.floorPreset),
      this._setSetting("cartographerTextureScale", options.textureScale),
      this._setSetting("cartographerRoomOutline", options.outlineEnabled),
      this._setSetting("cartographerOutlineColor", options.outlineColor),
      this._setSetting("cartographerOutlineWidth", options.outlineWidth)
    ]);

    await CartographerMetadata.setSceneFloorStyle(
      scene,
      FloorStyleResolver.toMetadata(floorStyle)
    );

    const geometry =
      CartographerFloorLayer.collectSceneGeometry(scene);

    if (geometry.length) {
      await CartographerFloorLayer.render(scene, {
        floorStyle,
        gridSize: options.gridSize
      });
    }

    state.status = geometry.length
      ? "Floor style saved and refreshed."
      : "Floor style saved. Generate or rebuild the scene to render it.";
    state.statusType = "success";
    state.lastError = null;

    await this._render(app);

    return {
      options: structuredClone(options),
      floorStyle: FloorStyleResolver.toMetadata(floorStyle),
      geometryCount: geometry.length
    };
  }

  static async refresh(app) {
    const state = this.getState(app);
    state.preview = null;
    state.previewSummary = null;
    state.lastError = null;
    state.status = "Cartographer status refreshed.";
    state.statusType = "info";
    await this._render(app);
    return this.prepareContext(app);
  }

  static summarizeChanges(changes = {}) {
    const summary = {
      roomEdits: changes.rooms?.length || 0,
      roomsAdded: changes.roomsAdded?.length || 0,
      roomsDeleted: changes.roomsDeleted?.length || 0,
      doorEdits: changes.doors?.length || 0,
      doorsAdded: changes.doorsAdded?.length || 0,
      doorsDeleted: changes.doorsDeleted?.length || 0,
      boundaryFeatures: changes.boundaryFeatures?.length || 0,
      roomFloorStyles: changes.roomFloorStyles?.length || 0,
      ventilation: changes.ventilation ? 1 : 0,
      missingSectors: changes.missingSectors?.length || 0
    };

    summary.total =
      summary.roomEdits +
      summary.roomsAdded +
      summary.roomsDeleted +
      summary.doorEdits +
      summary.doorsAdded +
      summary.doorsDeleted +
      summary.boundaryFeatures +
      summary.roomFloorStyles +
      summary.ventilation;
    summary.changed = Boolean(changes.changed || summary.total);
    return summary;
  }

  static _createState() {
    const options = {
      ...this.DEFAULTS,
      genre: this._setting("cartographerGenre", this.DEFAULTS.genre),
      floorPreset: this._setting(
        "cartographerFloorPreset",
        this.DEFAULTS.floorPreset
      ),
      textureScale: this._setting(
        "cartographerTextureScale",
        this.DEFAULTS.textureScale
      ),
      outlineEnabled: this._setting(
        "cartographerRoomOutline",
        this.DEFAULTS.outlineEnabled
      ),
      outlineColor: this._setting(
        "cartographerOutlineColor",
        this.DEFAULTS.outlineColor
      ),
      outlineWidth: this._setting(
        "cartographerOutlineWidth",
        this.DEFAULTS.outlineWidth
      )
    };

    return {
      options,
      busy: false,
      activeOperation: null,
      status: "Ready.",
      statusType: "info",
      preview: null,
      previewSummary: null,
      lastResult: null,
      lastError: null
    };
  }

  static async _run(app, operation, callback) {
    const state = this.getState(app);

    if (state.busy) {
      globalThis.ui?.notifications?.warn(
        "Cartographer is already processing another operation."
      );
      return null;
    }

    state.busy = true;
    state.activeOperation = operation;
    state.status = `${this._operationLabel(operation)} in progress...`;
    state.statusType = "working";
    state.lastError = null;
    await this._render(app);

    try {
      return await callback(state);
    } catch (error) {
      console.error(`ai-director | Cartographer ${operation} failed.`, error);
      state.lastError = error?.message || String(error);
      state.status = state.lastError;
      state.statusType = "error";
      globalThis.ui?.notifications?.error(
        `Cartographer: ${state.lastError}`
      );
      throw error;
    } finally {
      state.busy = false;
      state.activeOperation = null;
      await this._render(app);
    }
  }

  static _readOptions(source, fallback = this.DEFAULTS) {
    const root = source?.currentTarget?.closest?.("form") ||
      source?.target?.closest?.("form") ||
      source?.closest?.("form") ||
      source?.element ||
      source ||
      null;

    const read = (name, defaultValue) => {
      const element = root?.querySelector?.(`[name="${name}"]`);
      if (!element) return defaultValue;
      if (element.type === "checkbox") return element.checked;
      return element.value;
    };

    return {
      ...this.DEFAULTS,
      ...fallback,
      floor: this._positiveNumber(read("cartographerFloor", fallback.floor), 1),
      gridSize: this._positiveNumber(
        read("cartographerGridSize", fallback.gridSize),
        100
      ),
      corridorWidth: this._positiveNumber(
        read("cartographerCorridorWidth", fallback.corridorWidth),
        200
      ),
      doorWidth: this._positiveNumber(
        read("cartographerDoorWidth", fallback.doorWidth),
        200
      ),
      doorSpacing: this._positiveNumber(
        read("cartographerDoorSpacing", fallback.doorSpacing),
        200
      ),
      sharedTrunkLength: this._positiveNumber(
        read("cartographerSharedTrunkLength", fallback.sharedTrunkLength),
        400
      ),
      approachLength: this._positiveNumber(
        read("cartographerApproachLength", fallback.approachLength),
        200
      ),
      includeDoorState: Boolean(
        read("cartographerIncludeDoorState", fallback.includeDoorState)
      ),
      includeBoundaryFeatures: Boolean(
        read("cartographerIncludeBoundaryFeatures", fallback.includeBoundaryFeatures)
      ),
      includeVentilation: Boolean(
        read("cartographerIncludeVentilation", fallback.includeVentilation)
      ),
      renderVentilation: Boolean(
        read("cartographerRenderVentilation", fallback.renderVentilation)
      ),
      validateGraph: Boolean(
        read("cartographerValidateGraph", fallback.validateGraph)
      ),
      genre: String(
        read("cartographerGenre", fallback.genre || "auto")
      ),
      floorPreset: String(
        read(
          "cartographerFloorPreset",
          fallback.floorPreset || "auto"
        )
      ),
      textureScale: this._positiveNumber(
        read("cartographerTextureScale", fallback.textureScale),
        1
      ),
      outlineEnabled: Boolean(
        read("cartographerOutlineEnabled", fallback.outlineEnabled)
      ),
      outlineColor: this._color(
        read("cartographerOutlineColor", fallback.outlineColor),
        "#4a4a4a"
      ),
      outlineWidth: this._nonNegativeNumber(
        read("cartographerOutlineWidth", fallback.outlineWidth),
        3
      ),
      showAllFloors: Boolean(
        read("cartographerShowAllFloors", fallback.showAllFloors)
      ),
      assignmentMode: FloorStyleResolver.normalizeAssignmentMode(
        read(
          "cartographerAssignmentMode",
          fallback.assignmentMode || "AUTOMATIC"
        )
      ),
      layoutProfile: this._layoutProfileValue(
        read(
          "cartographerLayoutProfile",
          fallback.layoutProfile || "auto"
        )
      ),
      architecturalScale: this._architecturalScaleValue(
        read(
          "cartographerArchitecturalScale",
          fallback.architecturalScale || "auto"
        )
      )
    };
  }

  static _generationOptions(scene, options) {
    return {
      scene,
      floor: options.floor,
      gridSize: options.gridSize,
      corridorWidth: options.corridorWidth,
      doorWidth: options.doorWidth,
      doorSpacing: options.doorSpacing,
      sharedTrunkLength: options.sharedTrunkLength,
      approachLength: options.approachLength,
      clearExisting: true,
      renderFloorLayer: true,
      renderVentilation: options.renderVentilation,
      persistSceneMetadata: true,
      layoutProfile:
        options.layoutProfile === "auto"
          ? null
          : options.layoutProfile,
      architecturalScale:
        options.architecturalScale === "auto"
          ? null
          : options.architecturalScale,
      floorStyle: this._floorStyleOptions(options)
    };
  }

  static _floorStyleOptions(options) {
    return {
      genre: options.genre,
      preset: options.floorPreset,
      mode: options.floorPreset === "plain" ? "PLAIN" : "TEXTURE",
      layoutProfile:
        options.layoutProfile === "auto"
          ? null
          : options.layoutProfile,
      textureScale: options.textureScale,
      outlineEnabled: options.outlineEnabled,
      outlineColor: options.outlineColor,
      outlineWidth: options.outlineWidth,
      assignmentMode: FloorStyleResolver.normalizeAssignmentMode(
        options.assignmentMode
      )
    };
  }

  static _syncOptions(options, persist) {
    return {
      gridSize: options.gridSize,
      persist,
      validateGraph: options.validateGraph,
      includeDoorState: options.includeDoorState,
      includeBoundaryFeatures: options.includeBoundaryFeatures,
      includeVentilation: options.includeVentilation,
      detectAddedRooms: true,
      detectDeletedRooms: true,
      detectAddedDoors: true,
      detectDeletedDoors: true
    };
  }

  static _getScene() {
    const scene = globalThis.canvas?.scene;
    if (!scene) throw new Error("Cartographer requires an active scene.");
    return scene;
  }

  static _getActiveManifest(required = true) {
    const manifest = DungeonLedgerManager.getActiveManifest();
    if (required && (!manifest || !Array.isArray(manifest.sectors))) {
      throw new Error(
        "Cartographer could not resolve an active Dungeon Manifest."
      );
    }
    return manifest;
  }

  static _assertGM() {
    if (!globalThis.game?.user?.isGM) {
      throw new Error("Cartographer controls require an active GM.");
    }
  }

  static async _confirm(title, content) {
    const DialogV2 = globalThis.foundry?.applications?.api?.DialogV2;

    if (DialogV2?.confirm) {
      return DialogV2.confirm({
        window: { title },
        content: `<p>${this._escapeHtml(content)}</p>`,
        modal: true
      });
    }

    if (globalThis.Dialog?.confirm) {
      return Dialog.confirm({
        title,
        content: `<p>${this._escapeHtml(content)}</p>`
      });
    }

    return globalThis.confirm?.(`${title}\n\n${content}`) ?? false;
  }

  static async _render(app) {
    if (app?.render) await app.render(false);
  }

  static _generationSummary(result) {
    return result?.summary ? structuredClone(result.summary) : null;
  }

  static _setting(key, fallback) {
    try {
      return globalThis.game?.settings?.get("ai-director", key) ?? fallback;
    } catch (_error) {
      return fallback;
    }
  }

  static async _setSetting(key, value) {
    try {
      if (!globalThis.game?.settings?.set) return value;
      return await globalThis.game.settings.set(
        "ai-director",
        key,
        value
      );
    } catch (error) {
      console.warn(
        `ai-director | Could not persist setting ${key}.`,
        error
      );
      return value;
    }
  }

  static _layoutProfileValue(value) {
    const normalized = String(value || "auto").trim().toUpperCase();
    if (normalized === "AUTO") return "auto";
    return LayoutProfileLibrary.has(normalized)
      ? normalized
      : "auto";
  }

  static _architecturalScaleValue(value) {
    const normalized = String(value || "auto").trim().toUpperCase();
    return ["SMALL", "STANDARD", "LARGE", "GRAND"].includes(normalized)
      ? normalized
      : "auto";
  }

  static _titleCase(value) {
    return String(value || "")
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\w/g, character => character.toUpperCase());
  }

  static _positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  static _nonNegativeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  static _color(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  static _operationLabel(operation) {
    return {
      generate: "Generation",
      preview: "Change preview",
      sync: "Ledger synchronization",
      rebuild: "Scene rebuild"
    }[operation] || "Cartographer operation";
  }

  static _escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

export const CartographerUI = CartographerUIController;
