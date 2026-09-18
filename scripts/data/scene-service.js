// modules/ai-director/scripts/data/scene-service.js

import { MODULE_ID } from "/modules/ai-director/scripts/settings.js";
import { AtmosphereEngine } from "/modules/ai-director/scripts/engines/atmosphere-engine.js";
import { spawnSectorContents } from "/modules/ai-director/scripts/engines/npc-generator.js";

function normalizeSceneMapTitle(value) {
  const clean = String(value || "Generated Map")
    .replace(/^(?:\[(?:Map\vert{}Scene)\]\s*)+/gi, "")
    .trim();
  return `[Map] ${clean || "Generated Map"}`;
}

function getSceneGenerationKey(manifest = {}) {
  return String(
    manifest.manifestId ||
    manifest.layoutSeed ||
    manifest.dungeonTitle ||
    "generated-map"
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "generated-map";
}

async function resolveCartographerDestinationScene(manifest, sourceScene, options = {}) {
  const generationKey = getSceneGenerationKey(manifest);
  const sceneName = normalizeSceneMapTitle(manifest.dungeonTitle);
  const flaggedMatches = game.scenes.contents.filter(scene =>
    scene.getFlag(MODULE_ID, "sceneGenerationKey") === generationKey
  );
  const namedMatches = game.scenes.contents.filter(scene =>
    normalizeSceneMapTitle(scene.name) === sceneName
  );
  const candidates = [...new Map(
    [...flaggedMatches, ...namedMatches].map(scene => [scene.id, scene])
  ).values()];
  const destinationScene =
    candidates.find(scene => scene.id === canvas.scene?.id) ||
    candidates.find(scene =>
      scene.drawings.contents.some(document =>
        document.flags?.[MODULE_ID]?.cartographer
      ) ||
      scene.walls.contents.some(document =>
        document.flags?.[MODULE_ID]?.cartographer
      )
    ) ||
    candidates[0] ||
    await Scene.create({
      name: sceneName,
      width: Math.max(2048, Number(sourceScene?.width) || 2048),
      height: Math.max(2048, Number(sourceScene?.height) || 2048),
      padding: Number(sourceScene?.padding ?? 0.25),
      grid: {
        size: Number(options.gridSize) || Number(sourceScene?.grid?.size) || 100,
        type: Number(sourceScene?.grid?.type) || 1
      },
      flags: {
        [MODULE_ID]: {
          sceneGenerationKey: generationKey,
          sceneGenerationOwner: "cartographer",
          manifestTitle: manifest.dungeonTitle || sceneName,
          manifestId:
            manifest.manifestId,
          manifest:
            foundry.utils.deepClone(
              manifest
            )
        }
      }
    });

  const updates = {};
  if (destinationScene.name !== sceneName) updates.name = sceneName;
  if (destinationScene.getFlag(MODULE_ID, "sceneGenerationKey") !== generationKey) {
    updates[`flags.${MODULE_ID}.sceneGenerationKey`] = generationKey;
  }
  updates[`flags.${MODULE_ID}.sceneGenerationOwner`] = "cartographer";
  updates[`flags.${MODULE_ID}.manifestTitle`] = manifest.dungeonTitle || sceneName;

  updates[
    `flags.${MODULE_ID}.manifestId`
  ] =
    manifest.manifestId || null;

  updates[
    `flags.${MODULE_ID}.manifest`
  ] =
    foundry.utils.deepClone(
      manifest
    );

  await destinationScene.update(updates);

  for (const duplicate of candidates) {
    if (duplicate.id === destinationScene.id) continue;
    await duplicate.update({
      [`flags.${MODULE_ID}.duplicateOfSceneId`]: destinationScene.id,
      [`flags.${MODULE_ID}.sceneGenerationOwner`]: "duplicate"
    });
  }

  return destinationScene;
}

async function activateGeneratedScene(scene) {
  if (!scene) return null;
  if (canvas.scene?.id !== scene.id) {
    await scene.activate();
    await scene.view();
  } else if (!scene.active) {
    await scene.activate();
  }
  return scene;
}

/**
 * Builds or retrieves a Scene for a manifest sector, configures atmosphere, and stages tokens.
 */
async function buildAndStageSectorScene(sector, tileImagePath = null, visionObjects = []) {
  if (!sector) return null;

  const sceneName = `${sector.floor ? `F${sector.floor} - ` : ""}${sector.name}`;
  
  let scene = game.scenes.find(s => s.name === sceneName || s.flags?.[MODULE_ID]?.sectorId === sector.sectorId);

  if (!scene) {
    console.log(`[AI Director] Constructing new sector scene: "${sceneName}"`);
    scene = await Scene.create({
      name: sceneName,
      grid: { size: 100, type: 1 },
      width: 2000,
      height: 2000,
      padding: 0.25,
      flags: {
        [MODULE_ID]: {
          sectorId: sector.sectorId,
          floor: sector.floor
        }
      }
    });
  }

  console.log(`[AI Director] Calibrating atmosphere for sector: [${sector.sectorId}]`);
  await AtmosphereEngine.applyAtmosphereToScene(scene, sector);

  if (tileImagePath) {
    await scene.update({ background: { src: tileImagePath } });
  }

  await spawnSectorContents(sector, sector.npcs || [], visionObjects);

  return scene;
}

export async function updateExistingSceneManifest(manifest) {
  if (!manifest) {
    return false;
  }

  const generationKey = getSceneGenerationKey(manifest);

  const scene = game.scenes.contents.find(
    s => s.getFlag(MODULE_ID, "sceneGenerationKey") === generationKey
  );

  if (!scene) {
    return false;
  }

  await scene.update({
    [`flags.${MODULE_ID}.manifest`]: foundry.utils.deepClone(manifest),
    [`flags.${MODULE_ID}.manifestId`]: manifest.manifestId ?? null,
    [`flags.${MODULE_ID}.manifestTitle`]: manifest.dungeonTitle ?? ""
  });

  return true;
}

export {
  buildAndStageSectorScene,
  activateGeneratedScene,
  resolveCartographerDestinationScene
};