// modules/ai-director/scripts/data/map-architect.js

import { LayoutProfileResolver } from "/modules/ai-director/scripts/cartographer/layout-profile-resolver.js";
import { LayoutProfileLibrary } from "/modules/ai-director/scripts/cartographer/layout-profile-library.js";

export class MapArchitect {

  static DEFAULT_SCALE = "MEDIUM";
  static DEFAULT_OCCUPANCY = "OCCUPIED";

  static TRAITS = Object.freeze({
    FORTIFIED: "FORTIFIED",
    TECHNICAL: "TECHNICAL",
    RESIDENTIAL: "RESIDENTIAL",
    COMMERCIAL: "COMMERCIAL",
    COVERT: "COVERT",
    NATURAL: "NATURAL",

    MULTI_LEVEL: "MULTI_LEVEL",
    SINGLE_LEVEL: "SINGLE_LEVEL",

    PUBLIC_SPACES: "PUBLIC_SPACES",
    SERVICE_SPINE: "SERVICE_SPINE",
    DEFENSIVE_PERIMETER: "DEFENSIVE_PERIMETER",
    MODULAR_LAYOUT: "MODULAR_LAYOUT",
    LINEAR_LAYOUT: "LINEAR_LAYOUT",
    COURTYARD_LAYOUT: "COURTYARD_LAYOUT",

    VENTILATION_NETWORK: "VENTILATION_NETWORK",
    ESCAPE_ROUTES: "ESCAPE_ROUTES",
    SERVICE_ACCESS: "SERVICE_ACCESS"
  });

  static plan(narrative = {}, options = {}) {

    const profileResult = LayoutProfileResolver.resolve(
      narrative,
      options
    );

    const profileId = profileResult.profileId;
    const family = profileResult.layoutFamily;
    const profile = LayoutProfileLibrary.get(profileId);

    const floorCount = this._determineFloorCount(
      profileResult,
      narrative,
      options
    );

    return {
      architectVersion: 1,
      architectId: `architect-${Date.now()}`,

      structureType:
        narrative.structureType ||
        profileId,

      layoutProfile: profileId,

      layoutFamily: family,

      architecturalGrammar:
        profile?.grammar ||
        profileId,

      layoutEnvelope:
        profile?.envelope ||
        null,

      occupancyState:
        String(
          narrative.occupancyState ||
          narrative.occupancy ||
          options.occupancyState ||
          this.DEFAULT_OCCUPANCY
        ).toUpperCase(),

      sceneScale:
        String(
          options.sceneScale ||
          narrative.sceneScale ||
          this.DEFAULT_SCALE
        ).toUpperCase(),

      architecturalTraits:
        this._buildTraits(profileResult, floorCount),

      candidateProfiles:
        this.scoreProfiles(narrative)
          .slice(0, 5),

      buildingProgram: {
        floorCount,
        entranceCount:
          profileResult.entranceCount || 1,

        emergencyExitCount:
          profileResult.emergencyExitCount || 0,

        corridorPattern:
          profileResult.corridorPattern,

        sharedWallPreference:
          profileResult.sharedWallPreference === true,

        verticalCoreRequired:
          floorCount > 1,

        secondaryNetworks:
          [...(profileResult.secondaryNetworks || [])]
      },

      roomProgram: {
        required:
          [...(profileResult.requiredPurposes || [])],

        preferred:
          [...(profileResult.preferredPurposes || [])],

        optional: [],

        forbidden: []
      },

      architecture: {
        footprintShape:
          profileResult.footprintShape,

        corridorPattern:
          profileResult.corridorPattern,

        sharedWallPreference:
          profileResult.sharedWallPreference,

        defensivePerimeter:
          profileResult.defensivePerimeter === true,

        courtyardAllowed:
          profileResult.courtyardAllowed === true,

        secondaryNetworks:
          [...(profileResult.secondaryNetworks || [])]
      },

      narrativeContext: {
        title:
          narrative.title ||
          narrative.dungeonTitle ||
          null,

        summary:
          narrative.summary ||
          narrative.premise ||
          null
      }
    };
  }

  static _determineFloorCount(
    profile,
    narrative,
    options
  ) {

    if (Number.isInteger(Number(options.floorCount))) {
      return Number(options.floorCount);
    }

    if (Number.isInteger(Number(narrative.floorCount))) {
      return Number(narrative.floorCount);
    }

    const range = profile.floorRange || [1, 1];

    return Math.max(
      1,
      Number(range[0]) || 1
    );
  }

  static scoreProfiles(narrative = {}) {

    const sourceText = [
      narrative.title,
      narrative.summary,
      narrative.premise,
      narrative.structureType
    ]
      .filter(value => typeof value === "string" && value.trim().length)
      .join(" ")
      .toLowerCase();

    const scores = [];

    for (const profile of Object.values(LayoutProfileLibrary.PROFILES)) {

      let score = 0;

      for (const alias of profile.aliases || []) {
        if (alias && sourceText.includes(String(alias).toLowerCase())) {
          score += 3;
        }
      }

      for (const tag of profile.classificationTags || []) {
        if (tag && sourceText.includes(String(tag).toLowerCase())) {
          score += 2;
        }
      }

      if (profile.description) {
        const descriptionWords = String(profile.description)
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(word => word.length > 3);

        for (const word of descriptionWords) {
          if (sourceText.includes(word)) {
            score += 1;
          }
        }
      }

      for (const sector of profile.requiredSectors || []) {
        const values = [
          sector.purpose,
          sector.name,
          sector.graphRole,
          sector.sectorType
        ];

        for (const value of values) {
          if (!value) continue;

          const term = String(value).toLowerCase();

          if (sourceText.includes(term)) {
            score += 2;
          }
        }
      }

      for (const sector of profile.optionalSectors || []) {
        const values = [
          sector.purpose,
          sector.name
        ];

        for (const value of values) {
          if (!value) continue;

          const term = String(value).toLowerCase();

          if (sourceText.includes(term)) {
            score += 1;
          }
        }
      }

      if (
        profile.family &&
        sourceText.includes(
          profile.family.toLowerCase()
        )
      ) {
        score += 2;
      }

      if (
        profile.grammar &&
        sourceText.includes(
          String(profile.grammar).toLowerCase()
        )
      ) {
        score += 1;
      }

      if (
        profile.envelope &&
        sourceText.includes(
          String(profile.envelope).toLowerCase()
        )
      ) {
        score += 1;
      }

      scores.push({ profileId: profile.id, score });
    }

    scores.sort(
      (a, b) =>
        b.score - a.score ||
        a.profileId.localeCompare(
          b.profileId
        )
    );

    return scores.filter(
      entry => entry.score > 0
    );
  }

  static _buildTraits(profile, floorCount) {

    const traits = [];

    switch (profile.layoutFamily) {

      case "FORTIFIED":
        traits.push(this.TRAITS.FORTIFIED);
        traits.push(this.TRAITS.DEFENSIVE_PERIMETER);
        break;

      case "TECHNICAL":
        traits.push(this.TRAITS.TECHNICAL);
        traits.push(this.TRAITS.SERVICE_SPINE);
        break;

      case "RESIDENTIAL":
        traits.push(this.TRAITS.RESIDENTIAL);
        break;

      case "COMMERCIAL":
        traits.push(this.TRAITS.COMMERCIAL);
        traits.push(this.TRAITS.PUBLIC_SPACES);
        break;

      case "COVERT":
        traits.push(this.TRAITS.COVERT);
        break;

      case "NATURAL":
        traits.push(this.TRAITS.NATURAL);
        break;
    }

    traits.push(
      floorCount > 1
        ? this.TRAITS.MULTI_LEVEL
        : this.TRAITS.SINGLE_LEVEL
    );

    const footprint =
      String(profile.footprintShape || "")
        .toUpperCase();

    if (footprint === "COURTYARD") {
      traits.push(this.TRAITS.COURTYARD_LAYOUT);
    }

    if (footprint === "MODULAR") {
      traits.push(this.TRAITS.MODULAR_LAYOUT);
    }

    if (footprint === "LINEAR") {
      traits.push(this.TRAITS.LINEAR_LAYOUT);
    }

    for (const network of profile.secondaryNetworks || []) {

      if (network === "VENTILATION") {
        traits.push(
          this.TRAITS.VENTILATION_NETWORK
        );
      }

      if (network === "ESCAPE_ROUTE") {
        traits.push(
          this.TRAITS.ESCAPE_ROUTES
        );
      }

      if (network === "SERVICE_ACCESS") {
        traits.push(
          this.TRAITS.SERVICE_ACCESS
        );
      }
    }

    return [...new Set(traits)];
  }
}