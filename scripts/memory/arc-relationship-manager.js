// modules/ai-director/scripts/memory/arc-relationship-manager.js

export class ArcRelationshipManager {

  static async linkArcs(
    sourceArcId,
    targetArcId,
    relationship = "RELATED"
  ) {

    if (
      !sourceArcId ||
      !targetArcId ||
      sourceArcId === targetArcId
    ) {
      return null;
    }

    const source =
      await AIDirector
        .ArcRegistryManager
        .getArcById(
          sourceArcId
        );

    const target =
      await AIDirector
        .ArcRegistryManager
        .getArcById(
          targetArcId
        );

    if (
      !source ||
      !target
    ) {
      return null;
    }

    source.relatedArcs ??= [];
    target.relatedArcs ??= [];

    const sourceExists =
      source.relatedArcs.some(
        relation =>
          relation.arcId ===
          targetArcId
      );

    if (!sourceExists) {

      source.relatedArcs.push({

        arcId:
          targetArcId,

        relationship

      });

      await AIDirector
        .ArcRegistryManager
        .updateArc(
          sourceArcId,
          {
            relatedArcs:
              source.relatedArcs
          }
        );

    }

    const targetExists =
      target.relatedArcs.some(
        relation =>
          relation.arcId ===
          sourceArcId
      );

    if (!targetExists) {

      target.relatedArcs.push({

        arcId:
          sourceArcId,

        relationship

      });

      await AIDirector
        .ArcRegistryManager
        .updateArc(
          targetArcId,
          {
            relatedArcs:
              target.relatedArcs
          }
        );

    }

    return await AIDirector
      .ArcRegistryManager
      .getArcById(
        sourceArcId
      );

  }

  static async getRelatedArcs(
    arcId
  ) {

    const arc =
      await AIDirector
        .ArcRegistryManager
        .getArcById(
          arcId
        );

    if (!arc) {
      return [];
    }

    const output = [];

    for (
      const relation
      of (arc.relatedArcs || [])
    ) {

      const related =
        await AIDirector
          .ArcRegistryManager
          .getArcById(
            relation.arcId
          );

      if (!related) {
        continue;
      }

      output.push({
        relationship:
          relation.relationship,

        arc:
          related
      });

    }

    return output;
  }

  static async findRelationshipCandidates(
    delta
  ) {

    const text =
      String(
        delta.value || ""
      ).toLowerCase();

    const arcs =
      await AIDirector
        .ArcRegistryManager
        .getActiveArcs();

    const matches = [];

    for (
      const arc
      of arcs
    ) {

      let score = 0;

      if (
        text.includes(
          arc.name
            .toLowerCase()
        )
      ) {
        score += 10;
      }

      for (
        const fact
        of (arc.facts || [])
      ) {

        const words =
          fact
            .toLowerCase()
            .split(" ");

        if (
          words.some(
            word =>
              text.includes(
                word
              )
          )
        ) {

          score++;

        }

      }

      if (
        score >= 3
      ) {

        matches.push({
          arcId:
            arc.arcId,

          name:
            arc.name,

          score
        });

      }

    }

    return matches.sort(
      (a, b) =>
        b.score - a.score
    );

  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .ArcRelationshipManager =
      ArcRelationshipManager;

}