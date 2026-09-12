/*
 * BIG BROTHER SIMULATOR — COMPETITION ENGINE
 *
 * Resolves any competition among a set of houseguests. Winners are
 * decided by rating + randomness ("weighted lottery"), not pure stats
 * and not pure coin flip, so favorites usually do well but upsets
 * happen.
 */

(function () {
  const CATEGORY_WEIGHTS = [
    { key: "physical", weight: 0.35 },
    { key: "mental", weight: 0.30 },
    { key: "social", weight: 0.15 },
    { key: "strategic", weight: 0.20 }
  ];

  const LABELS = {
    physical: ["Endurance Hang", "Obstacle Course Rush", "Balance Beam Blowout", "Slip-and-Slide Showdown", "Wrecking Ball Wipeout"],
    mental: ["Memory Wall", "Trivia Takedown", "Puzzle Pieces", "Pattern Recall", "Numbers Game"],
    social: ["Know Your House", "Read the Room", "Social Circuit", "Who Said It?"],
    strategic: ["Strategy Grid", "Risk Ledger", "Odds Are...", "The Long Game"]
  };

  function pickCategory() {
    const r = Math.random();
    let acc = 0;
    for (const c of CATEGORY_WEIGHTS) {
      acc += c.weight;
      if (r <= acc) return c.key;
    }
    return CATEGORY_WEIGHTS[0].key;
  }

  function competitionLabel(category) {
    const arr = LABELS[category] || LABELS.physical;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Runs a competition among `candidates` (array of houseguest objects).
   * Returns { category, label, winner, ranking } where ranking is sorted
   * best-to-worst with the raw scores used.
   */
  function runCompetition(candidates, opts = {}) {
    opts = Object.assign({ category: null, noiseMin: 0.55, noiseMax: 1.55 }, opts);
    if (!candidates.length) return null;
    const category = opts.category || pickCategory();

    const scored = candidates.map(hg => {
      const base = hg.ratings[category] * 0.7 + hg.ratings.general * 0.3;
      const noise = opts.noiseMin + Math.random() * (opts.noiseMax - opts.noiseMin);
      return { hg, score: base * noise };
    });
    scored.sort((a, b) => b.score - a.score);

    return {
      category,
      label: competitionLabel(category),
      winner: scored[0].hg,
      ranking: scored.map(s => ({ id: s.hg.id, score: Math.round(s.score * 10) / 10 }))
    };
  }

  window.Competitions = { runCompetition, pickCategory, competitionLabel };
})();
