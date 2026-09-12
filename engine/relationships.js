/*
 * BIG BROTHER SIMULATOR — RELATIONSHIP / ALLIANCE ENGINE
 *
 * Owns pairwise relationship math, alliance formation, and the social
 * "AI" decisions (who to nominate, whether to use the veto, who to
 * evict, who to take to final 2, how jury votes).
 */

(function () {
  const ALLIANCE_NAMES = [
    "The Committee", "Iron Circle", "The Hive", "Backdoor Bandits",
    "The Six", "Loose Cannons", "The Inner Ring", "Final Say",
    "The Wildcards", "Trust Fall", "The Vault", "Common Ground"
  ];

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function rel(state, aId, bId) {
    return state.relationships[aId] ? state.relationships[aId][bId] : null;
  }

  function bondScore(state, aId, bId) {
    const r = rel(state, aId, bId);
    if (!r) return 50;
    return (r.friendship + r.trust + r.loyalty + r.respect - r.rivalry) / 4;
  }

  function adjustPair(state, aId, bId, deltas) {
    [[aId, bId], [bId, aId]].forEach(([x, y]) => {
      const r = rel(state, x, y);
      if (!r) return;
      Object.keys(deltas).forEach(k => {
        if (typeof r[k] !== "number") return;
        r[k] = clamp(r[k] + deltas[k], 0, 100);
      });
    });
  }

  function activeAlliances(state) {
    return state.alliances.filter(a => a.active !== false);
  }

  function alliesOf(state, hgId) {
    return activeAlliances(state).filter(a => a.memberIds.includes(hgId));
  }

  function isAllyOf(state, aId, bId) {
    return activeAlliances(state).some(a => a.memberIds.includes(aId) && a.memberIds.includes(bId));
  }

  function livingHouseguests(state) {
    return state.houseguests.filter(h => h.active);
  }

  /** Occasionally forms a new alliance among houseguests with strong mutual bonds. */
  function formAlliances(state, week) {
    const living = livingHouseguests(state);
    if (living.length < 3) return null;

    const usedNames = new Set(state.alliances.map(a => a.name));
    const pairs = [];
    for (let i = 0; i < living.length; i++) {
      for (let j = i + 1; j < living.length; j++) {
        const a = living[i], b = living[j];
        if (isAllyOf(state, a.id, b.id)) continue;
        const score = bondScore(state, a.id, b.id);
        if (score >= 62) pairs.push({ a, b, score });
      }
    }
    if (!pairs.length) return null;
    pairs.sort((x, y) => y.score - x.score);

    // Seed a new alliance from the strongest pair, then pull in others
    // who bond well with both seed members.
    const seed = pairs[0];
    const memberIds = new Set([seed.a.id, seed.b.id]);
    for (const hg of living) {
      if (memberIds.has(hg.id) || memberIds.size >= 5) continue;
      const scores = [...memberIds].map(id => bondScore(state, hg.id, id));
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg >= 60 && Math.random() < 0.55) memberIds.add(hg.id);
    }
    if (memberIds.size < 2) return null;

    let name = ALLIANCE_NAMES.find(n => !usedNames.has(n));
    if (!name) name = `Alliance ${state.alliances.length + 1}`;

    const alliance = {
      id: `alliance-${state.alliances.length + 1}`,
      name,
      memberIds: [...memberIds],
      formedWeek: week,
      active: true
    };
    state.alliances.push(alliance);
    alliance.memberIds.forEach(id => {
      state.houseguests.find(h => h.id === id).allianceIds.push(alliance.id);
    });

    // Forming an alliance strengthens the bonds inside it.
    alliance.memberIds.forEach(aId => {
      alliance.memberIds.forEach(bId => {
        if (aId !== bId) adjustPair(state, aId, bId, { trust: 10, loyalty: 12, friendship: 6 });
      });
    });

    return alliance;
  }

  /** Marks alliances dead once they no longer have 2+ living members. */
  function pruneAlliances(state) {
    state.alliances.forEach(a => {
      const livingCount = a.memberIds.filter(id => {
        const hg = state.houseguests.find(h => h.id === id);
        return hg && hg.active;
      }).length;
      if (livingCount < 2) a.active = false;
    });
  }

  /** HOH picks `count` nominees from `eligible`, biased toward weakest bonds. */
  function pickNominees(state, hoh, eligible, count) {
    const scored = eligible.map(hg => {
      let score = bondScore(state, hoh.id, hg.id);
      if (isAllyOf(state, hoh.id, hg.id)) score += 30;
      score += Math.random() * 22 - 11;
      return { hg, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, count).map(s => s.hg);
  }

  /** Chooses a replacement nominee after a veto save. */
  function pickReplacement(state, hoh, eligible, avoidIds) {
    const pool = eligible.filter(hg => !avoidIds.includes(hg.id));
    if (!pool.length) return null;
    return pickNominees(state, hoh, pool, 1)[0];
  }

  /** Decides whether a veto winner uses the veto, and on whom. */
  function decideVetoUse(state, vetoWinner, hoh, nominees) {
    if (!nominees || !nominees.length) return { use: false };
    if (vetoWinner.id === hoh.id) return { use: false };

    const isNominee = nominees.some(n => n.id === vetoWinner.id);
    if (isNominee) {
      // Nearly always save yourself.
      return Math.random() < 0.92
        ? { use: true, saveId: vetoWinner.id }
        : { use: false };
    }

    // Non-nominee winner: use it if they're close with a nominee.
    const best = nominees
      .map(n => ({ n, score: bondScore(state, vetoWinner.id, n.id) }))
      .sort((a, b) => b.score - a.score)[0];

    const allyBoost = isAllyOf(state, vetoWinner.id, best.n.id) ? 18 : 0;
    const willingness = (best.score + allyBoost - 45) / 55; // roughly -0.8..1
    if (Math.random() < clamp(willingness, 0.05, 0.85)) {
      return { use: true, saveId: best.n.id };
    }
    return { use: false };
  }

  /** A single voter's eviction pick between two on the block. */
  function decideVote(state, voter, nomineeA, nomineeB, hoh) {
    let scoreA = bondScore(state, voter.id, nomineeA.id);
    let scoreB = bondScore(state, voter.id, nomineeB.id);

    // Vote with your alliance's lean if it has one.
    const myAllies = alliesOf(state, voter.id);
    myAllies.forEach(a => {
      a.memberIds.forEach(mid => {
        if (mid === voter.id) return;
        if (isAllyOf(state, mid, nomineeA.id)) scoreA += 12;
        if (isAllyOf(state, mid, nomineeB.id)) scoreB += 12;
      });
    });

    scoreA += Math.random() * 14 - 7;
    scoreB += Math.random() * 14 - 7;
    // Lower bond = evict. Return the id voted OUT.
    return scoreA <= scoreB ? nomineeA.id : nomineeB.id;
  }

  /** Final HOH decides who to sit next to in the final 2. */
  function decideFinalTwoPick(state, finalHoh, others) {
    // Take whoever you're most likely to beat: favor a lower jury-perceived
    // respect/strategic threat over pure friendship.
    const scored = others.map(hg => {
      const bond = bondScore(state, finalHoh.id, hg.id);
      const threat = hg.ratings.strategic * 0.6 + hg.ratings.social * 0.4;
      return { hg, score: bond * 0.5 - threat * 0.5 + (Math.random() * 10 - 5) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].hg;
  }

  /** A single juror's vote between the two finalists. */
  function decideJuryVote(state, juror, finalistA, finalistB) {
    const bondA = bondScore(state, juror.id, finalistA.id);
    const bondB = bondScore(state, juror.id, finalistB.id);
    const gameA = finalistA.ratings.strategic * 0.65 + finalistA.ratings.mental * 0.35;
    const gameB = finalistB.ratings.strategic * 0.65 + finalistB.ratings.mental * 0.35;

    const scoreA = bondA * 0.45 + gameA * 0.55 + (Math.random() * 12 - 6);
    const scoreB = bondB * 0.45 + gameB * 0.55 + (Math.random() * 12 - 6);
    return scoreA >= scoreB ? finalistA.id : finalistB.id;
  }

  window.RelEngine = {
    bondScore, adjustPair, isAllyOf, alliesOf, activeAlliances,
    formAlliances, pruneAlliances, pickNominees, pickReplacement,
    decideVetoUse, decideVote, decideFinalTwoPick, decideJuryVote,
    livingHouseguests
  };
})();
