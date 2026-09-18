/*
 * CARTOGRAPHER ARCHITECTURE REBUILD BOUNDARY
 * Status: ACTIVE REBUILD: structure templates and archetype resolution.
 * Frozen infrastructure must not be modified to compensate for this file.
 * Source of truth: AI-README-CARTOGRAPHER.md, Architecture Rebuild Freeze Boundary.
 */
// footprint-design-library.js
// Resolves known footprint templates and prioritizes custom dynamic designs.
import { DynamicFootprintComposer }
  from "/modules/ai-director/scripts/cartographer/dynamic-footprint-composer.js";

export class FootprintDesignLibrary {
  static DESIGNS = Object.freeze({
    HOUSE: {
      archetype: "RESIDENTIAL_BLOCK",
      circulation: "SHORT_HALL",
      enclosure: "CONTINUOUS"
    },
    MANOR: {
      archetype: "COURTYARD_HOUSE",
      circulation: "GALLERY_RING",
      enclosure: "CONTINUOUS"
    },
    BARN: {
      archetype: "AISLE_BUILDING",
      circulation: "CENTRAL_AISLE",
      enclosure: "CONTINUOUS"
    },
    BAR: {
      archetype: "PUBLIC_SERVICE_BUILDING",
      circulation: "PUBLIC_SERVICE_SPINE",
      enclosure: "CONTINUOUS"
    },
    CLUB: {
      archetype: "PUBLIC_SERVICE_BUILDING",
      circulation: "PUBLIC_SERVICE_SPINE",
      enclosure: "CONTINUOUS"
    },
    TAVERN: {
      archetype: "PUBLIC_SERVICE_BUILDING",
      circulation: "PUBLIC_SERVICE_SPINE",
      enclosure: "CONTINUOUS"
    },
    CASTLE: {
      archetype: "FORTIFIED_COURTYARD",
      circulation: "COURTYARD_RING",
      enclosure: "FORTIFIED"
    },
    FORT: {
      archetype: "FORTIFIED_COURTYARD",
      circulation: "COURTYARD_RING",
      enclosure: "FORTIFIED"
    },
    FORTRESS: {
      archetype: "LAYERED_FORTRESS",
      circulation: "LAYERED_RING",
      enclosure: "FORTIFIED"
    },
    FACILITY: {
      archetype: "MODULAR_BLOCK",
      circulation: "ORTHOGONAL_SPINE",
      enclosure: "CONTINUOUS"
    },
    SECRET_BASE: {
      archetype: "MODULAR_BLOCK",
      circulation: "SECURITY_SPINE",
      enclosure: "CONTINUOUS"
    },
    SPACESHIP: {
      archetype: "LINEAR_HULL",
      circulation: "DECK_SPINE",
      enclosure: "HULL"
    },
    SPACE_STATION: {
      archetype: "MODULAR_HUB",
      circulation: "RADIAL_HUB",
      enclosure: "HULL"
    },
    MINE: {
      archetype: "NATURAL_BRANCHING",
      circulation: "BRANCHING_PASSAGES",
      enclosure: "NATURAL"
    },
    CAVE: {
      archetype: "NATURAL_BRANCHING",
      circulation: "BRANCHING_PASSAGES",
      enclosure: "NATURAL"
    }
  });

  static resolve(
    profile = {},
    manifest = {},
    sectors = []
  ) {
    const customType = this._customType(
      profile,
      manifest
    );

    if (customType) {
      const customTemplate =
        this.DESIGNS[customType];

      if (customTemplate) {
        return {
          id: customType,
          requestedType: customType,
          source: "CUSTOM_TEMPLATE",
          dynamic: true,
          ...customTemplate,
          zones:
            DynamicFootprintComposer
              .compose(
                {
                  ...manifest,
                  customFootprintType:
                    customType
                },
                sectors,
                profile
              )
              .zones
        };
      }

      return DynamicFootprintComposer.compose(
        {
          ...manifest,
          customFootprintType: customType,
          designType: customType,
          buildingType: customType
        },
        sectors,
        {
          ...profile,
          customFootprintType: customType
        }
      );
    }

    const profileId = String(
      profile.profileId ||
      profile.id ||
      manifest.layoutProfile ||
      ""
    ).toUpperCase();

    const known = this.DESIGNS[profileId];

    if (known) {
      return {
        id: profileId,
        source: "PROFILE_TEMPLATE",
        dynamic: false,
        ...known,
        zones:
          DynamicFootprintComposer
            .compose(
              manifest,
              sectors,
              profile
            )
            .zones
      };
    }

    return DynamicFootprintComposer.compose(
      manifest,
      sectors,
      profile
    );
  }

  static _customType(profile, manifest) {
    const value =
      profile.customFootprintType ||
      manifest.customFootprintType ||
      manifest.designType ||
      manifest.buildingType ||
      manifest.architecture
        ?.customFootprintType ||
      manifest.architecture?.designType ||
      manifest.architecture?.buildingType ||
      null;

    if (!value) {
      return null;
    }

    return String(value)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
}
