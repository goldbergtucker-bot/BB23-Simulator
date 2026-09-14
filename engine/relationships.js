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
      active: true,
      type: "Simulated Alliance"
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

  /**
   * HOH nomination logic.  Nominations are not simply random: the engine
   * weighs personal relationships, alliances, rivalry, strategic threat,
   * competition threat, and the HOH's own ratings.  Allies are heavily
   * protected unless the HOH is desperate or the alliance is already
   * breaking down.
   */
  function pickNominees(state, hoh, eligible, count) {
    const scored = eligible.map(hg => {
      const r = rel(state, hoh.id, hg.id) || {};
      const bond = bondScore(state, hoh.id, hg.id);
      const rival = Number(r.rivalry || 0);
      const alliance = isAllyOf(state, hoh.id, hg.id);
      const strategicThreat = Number(hg.ratings?.strategic || 50);
      const compThreat = (Number(hg.ratings?.physical || 50) + Number(hg.ratings?.mental || 50)) / 2;
      let score = bond * 0.52 + Number(r.respect || 50) * 0.08 - rival * 0.24;
      score -= strategicThreat * 0.16 + compThreat * 0.08;
      if (alliance) score += 34 + Number(r.trust || 50) * 0.12 + Number(r.loyalty || 50) * 0.12;
      if (Number(r.friendship || 50) >= 72 && Number(r.trust || 50) >= 65) score += 18;
      // A weak/socially isolated houseguest is a more believable pawn.
      if (Number(hg.ratings?.social || 50) < 45 && bond >= 48) score += 7;
      score += Math.random() * 24 - 12;
      return { hg, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, count).map(x => x.hg);
  }

  /**
   * Chooses whether a HOH should pursue a backdoor plan. A backdoor is more
   * likely when the target is a strong competitor, outside the HOH's
   * alliance, personally disliked, and unlikely to be selected for POV.
   */
  function planBackdoor(state, hoh, nominees) {
    const nomineeIds = new Set(nominees.map(n => n.id));
    const candidates = livingHouseguests(state).filter(hg => hg.id !== hoh.id && !nomineeIds.has(hg.id) && !hg.safe);
    if (!candidates.length) return { use: false, target: null, reason: "No eligible backdoor target" };

    const ranked = candidates.map(target => {
      const r = rel(state, hoh.id, target.id) || {};
      const bond = bondScore(state, hoh.id, target.id);
      const allianceOpposition = isAllyOf(state, hoh.id, target.id) ? -32 : 16;
      const targetThreat = Number(target.ratings?.strategic || 50) * 0.42 + Number(target.ratings?.physical || 50) * 0.20 + Number(target.ratings?.mental || 50) * 0.14 + Number(target.ratings?.social || 50) * 0.08;
      const rivalry = Number(r.rivalry || 0) * 0.30;
      const isolation = (100 - Number(r.friendship || 50)) * 0.10;
      const score = targetThreat + rivalry + isolation - bond * 0.25 + allianceOpposition + (Math.random() * 10 - 5);
      return { target, score };
    }).sort((a,b)=>b.score-a.score);

    const best = ranked[0];
    const hohStrategic = Number(hoh.ratings?.strategic || 50);
    const threshold = 58 - (hohStrategic - 50) * 0.16;
    const use = best.score >= threshold && Math.random() < (0.28 + Math.max(0, hohStrategic - 45) / 180);
    if (!use) return { use: false, target: null, reason: "HOH chooses not to pursue a backdoor" };

    let reason = "major strategic threat";
    const r = rel(state, hoh.id, best.target.id) || {};
    if (Number(r.rivalry || 0) >= 55) reason = "personal rivalry";
    else if (!isAllyOf(state, hoh.id, best.target.id) && Number(best.target.ratings?.strategic || 50) >= 70) reason = "opposing strategic threat";
    else if (Number(best.target.ratings?.physical || 50) >= 75) reason = "competition threat";
    return { use: true, target: best.target, reason };
  }

  /** HOH breaks an eviction tie based on relationships, alliances and the
   * intended target rather than randomly. */
  function decideTieBreak(state, hoh, nomineeA, nomineeB) {
    const score = nominee => {
      const r = rel(state, hoh.id, nominee.id) || {};
      let v = bondScore(state, hoh.id, nominee.id);
      if (isAllyOf(state, hoh.id, nominee.id)) v += 35;
      v += Number(r.friendship || 50) * 0.12 + Number(r.trust || 50) * 0.12 + Number(r.loyalty || 50) * 0.10;
      v -= Number(r.rivalry || 0) * 0.30;
      if (state.intendedTarget === nominee.id || state.intendedTarget === `${nominee.firstName} ${nominee.lastName}`.trim()) v -= 30;
      if (state.backdoorTargetId === nominee.id) v -= 45;
      return v;
    };
    const a=score(nomineeA), b=score(nomineeB);
    if (Math.abs(a-b)<5) return Math.random()<0.5 ? nomineeA.id : nomineeB.id;
    return a < b ? nomineeA.id : nomineeB.id;
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
    decideVetoUse, decideVote, decideTieBreak, planBackdoor, decideFinalTwoPick, decideJuryVote,
    livingHouseguests
  };
})();
