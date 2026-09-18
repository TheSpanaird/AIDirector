// modules/ai-director/scripts/memory/archive-retrieval-manager.js

export class ArchiveRetrievalManager {

  static normalizeQuery(query = "") {
    return String(query)
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(t => t.length >= 3);
  }

  static scoreContent(
    content,
    tokens
  ) {
    let score = 0;

    const lower =
      content.toLowerCase();

    for (const token of tokens) {
      const matches =
        lower.match(
          new RegExp(token, "g")
        ) || [];

      score += matches.length;
    }

    return score;
  }

  static buildExcerpt(
    content,
    tokens
  ) {
    const lower =
      content.toLowerCase();

    for (const token of tokens) {
      const index =
        lower.indexOf(token);

      if (index >= 0) {
        const start =
          Math.max(0, index - 150);

        const end =
          Math.min(
            content.length,
            index + 250
          );

        return content
          .slice(start, end)
          .replace(/\n/g, " ")
          .trim();
      }
    }

    return content
      .slice(0, 300)
      .replace(/\n/g, " ");
  }

  static stripHtml(
    content = ""
  ) {
    const div =
      document.createElement(
        "div"
      );

    div.innerHTML =
      content;

    return (
      div.textContent ||
      div.innerText ||
      ""
    );
  }

  static async retrieve(
    query = ""
  ) {
    const tokens =
      this.normalizeQuery(query);

    if (!tokens.length) {
      return [];
    }

    const results = [];

    for (const journal of game.journal.contents) {
      for (
        const page of
        journal.pages.contents
      ) {
        if (
          page.type !== "text"
        ) {
          continue;
        }

        const rawContent =
          page.text?.content || "";

        const content =
          this.stripHtml(
            rawContent
          );

        const score =
          this.scoreContent(
            content,
            tokens
          );

        if (score <= 0) {
          continue;
        }

        results.push({
          folderName:
            journal.folder?.name || "",

          journalName:
            journal.name,

          pageName:
            page.name,

          score,

          excerpt:
            this.buildExcerpt(
              content,
              tokens
            )
        });
      }
    }

    const finalResults =
      results
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .slice(0, 5);

    console.group(
      "[AI Director] Archive Retrieval"
    );

    console.table(
      finalResults.map(r => ({
        page:
          r.pageName,
        score:
          r.score
      }))
    );

    console.groupEnd();

    return finalResults;
  }

}

if (
  typeof window !==
  "undefined"
) {

  window.AIDirector =
    window.AIDirector || {};

  window.AIDirector
    .ArchiveRetrievalManager =
      ArchiveRetrievalManager;

  window.ArchiveRetrievalManager =
    ArchiveRetrievalManager;

}
