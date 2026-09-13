/*
 * BIG BROTHER SIMULATOR — SEASON ENGINE
 *
 * Orchestrates an entire season using Competitions + RelEngine:
 *   Premiere (teams + Double or Nothing HOH twist)
 *   Weeks 1-4   -> Team Safety + Wildcard Competition
 *   Weeks 5-8   -> High Roller's Room (BB Bucks + powers)
 *   Weeks 9+    -> Standard HOH / Noms / Veto / Eviction
 *   Final 3     -> three-part competition, Final HOH's choice
 *   Finale      -> jury vote
 *
 * The whole season is simulated up front into state.history, an
 * ordered list of log entries the UI reveals progressively.
 */

(function () {
  const C = () => window.Competitions;
  const R = () => window.RelEngine;

  function viewSnapshot(state) {
    return {
      phase: state.phase, week: state.week,
      currentHOH: state.currentHOH,
      originalHOH: state.originalHOH || null,
      secretHOH: state.secretHOH || null,
      dethronedHOH: state.dethronedHOH || null,
      nominees: Array.isArray(state.nominees) ? state.nominees.slice() : [],
      povPlayers: Array.isArray(state.povPlayers) ? state.povPlayers.slice() : [],
      vetoWinners: Array.isArray(state.vetoWinners) ? state.vetoWinners.slice() : [],
      evictionVotes: Array.isArray(state.evictionVotes) ? state.evictionVotes.slice() : [],
      evicted: Array.isArray(state.evicted) ? state.evicted.slice() : [],
      jury: Array.isArray(state.jury) ? state.jury.slice() : [],
      houseguests: state.houseguests.map(h => ({
        id:h.id, slot:h.slot, firstName:h.firstName, lastName:h.lastName,
        portraitUrl:h.portraitUrl, teamId:h.teamId, active:h.active, safe:h.safe,
        nominated:h.nominated, juryMember:h.juryMember, evicted:h.evicted, placement:h.placement
      })),
      finale: state.finale ? JSON.parse(JSON.stringify(state.finale)) : null
    };
  }

  function competitionInfo(entry) {
    const cfg = window.BB23_CONFIG?.competitionSchedule || [];
    let type = entry.competitionType || null;
    if (!type) {
      if (entry.type === "hoh") type = "hoh";
      else if (entry.type === "veto") type = entry.week === 9 && entry.title?.includes("Logo") ? "pov-de" : entry.week === 10 && entry.title?.includes("What") ? "pov-de" : "pov";
      else if (entry.type === "wildcard") type = "wildcard";
      else if (entry.type === "final3-part1") type = "final-hoh-1";
      else if (entry.type === "final3-part2") type = "final-hoh-2";
      else if (entry.type === "final3-part3") type = "final-hoh-3";
    }
    if (!type) return null;
    const exact = cfg.find(c => c.week === entry.week && c.type === type);
    return exact ? { name: exact.name, description: exact.description, type: exact.type } : null;
  }

  function log(state, entry) {
    const record = Object.assign({ id: state.history.length + 1 }, entry);
    const comp = competitionInfo(record);
    if (comp) {
      record.competitionName = comp.name;
      record.competitionDescription = comp.description;
    }
    record.snapshot = viewSnapshot(state);
    record.data = buildEventData(state, record);
    state.history.push(record);
  }

  function buildEventData(state, entry) {
    const ids = a => Array.isArray(a) ? a.slice() : [];
    const base = { participants: [], nomineeIds: ids(state.nominees), povPlayers: ids(state.povPlayers), winnerId: entry.winnerId || null, hohId: entry.hohId || state.currentHOH || null, evictedId: entry.evictedId || null, competitionName: entry.competitionName || null, competitionDescription: entry.competitionDescription || null };
    if (entry.type === "hoh") { base.winnerId = entry.winnerId || state.currentHOH || null; base.participants = living(state).map(h => h.id); }
    if (entry.type === "wildcard") base.winnerId = (state.history.length && state.history[state.history.length-1]?.winnerId) || null;
    if (entry.type === "veto") { base.winnerId = entry.winnerId || state.vetoWinners?.[0] || null; base.participants = ids(state.povPlayers); }
    if (entry.type === "nominations" || entry.type === "veto-ceremony" || entry.type === "eviction") base.participants = ids(state.nominees);
    if (entry.type === "eviction-voting") { base.nomineeIds = ids(state.nominees); base.voterIds = (state.evictionVotes||[]).map(v=>v.voterId); base.votes = (state.evictionVotes||[]).map(v=>({voterId:v.voterId,targetId:v.targetId})); }
    if (entry.type === "eviction") { const id=(state.evicted||[]).slice(-1)[0]; base.evictedId=id||null; }
    if (entry.type === "final3-part1" || entry.type === "final3-part2" || entry.type === "final3-part3") base.participants = living(state).map(h=>h.id);
    if (entry.type === "final-decision") { base.hohId=state.currentHOH; base.thirdPlaceId=(state.evicted||[]).slice(-1)[0] || null; base.finalistIds=living(state).map(h=>h.id); }
    if (entry.type === "jury-vote") { base.votes=(state._juryVotes||[]).map(v=>({voterId:v.voterId,targetId:v.targetId})); base.voterIds=base.votes.map(v=>v.voterId); base.finalistIds=living(state).map(h=>h.id); }
    if (entry.type === "winner") { base.winnerId=state.finale?.winnerId||null; base.runnerUpId=state.finale?.runnerUpId||null; base.thirdPlaceId=state.finale?.thirdPlaceId||null; base.finalistIds=[base.winnerId,base.runnerUpId].filter(Boolean); }
    return base;
  }

  function living(state) {
    return state.houseguests.filter(h => h.active);
  }

  function clearWeeklyFlags(state) {
    state.houseguests.forEach(h => { h.safe = false; h.nominated = false; });
  }

  function shuffledCopy(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function assignTeamsIfNeeded(state, config) {
    const needsAssignment = state.houseguests.some(h => !h.teamId);
    if (!needsAssignment) return;
    state.teams.forEach(t => (t.memberIds = []));
    const order = shuffledCopy(state.houseguests);
    order.forEach((hg, i) => {
      const team = state.teams[i % state.teams.length];
      hg.teamId = team.id;
      team.memberIds.push(hg.id);
    });
  }

  function randomizeStartingRelationships(state) {
    if (state.season.relationshipsRandomized) return;
    const ids = state.houseguests.map(h => h.id);
    ids.forEach(a => {
      ids.forEach(b => {
        if (a === b) return;
        const r = state.relationships[a][b];
        const noise = () => Math.round((Math.random() * 40) - 20);
        r.friendship = clamp(r.friendship + noise(), 15, 85);
        r.trust = clamp(r.trust + noise(), 15, 85);
        r.loyalty = clamp(r.loyalty + noise(), 15, 85);
        r.respect = clamp(r.respect + noise(), 15, 85);
        r.rivalry = clamp(Math.round(Math.random() * 25), 0, 40);
        r.attraction = clamp(Math.round(Math.random() * 30), 0, 60);
      });
    });
    state.season.relationshipsRandomized = true;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function teamOf(state, hg) {
    return state.teams.find(t => t.id === hg.teamId);
  }

  function placementForEvictionIndex(state, evictionIndex) {
    return state.season.castSize - evictionIndex + 1;
  }

  // ---------------------------------------------------------------------
  // PREMIERE
  // ---------------------------------------------------------------------

  function runPremiere(state, config) {
    state.week = 0;
    state.season.castSize = state.houseguests.length;
    state.season.evictionCount = 0;
    randomizeStartingRelationships(state);
    assignTeamsIfNeeded(state, config);

    log(state, {
      week: 0, phase: "premiere", type: "teams",
      title: "Move-In Day",
      lines: state.teams.map(t => {
        const names = t.memberIds
          .map(id => state.houseguests.find(h => h.id === id))
          .map(displayName).join(", ");
        return `${t.name}: ${names}`;
      })
    });

    const field = living(state);
    const hohComp = C().runCompetition(field,{week:1,type:"hoh"});
    let hohWinner = hohComp.winner;
    state.currentHOH = hohWinner.id;

    log(state, {
      week: 1, phase: "premiere", type: "hoh", winnerId: hohWinner.id,
      title: `Premiere HOH — ${hohComp.label}`,
      competitionType: "hoh",
      lines: [`${displayName(hohWinner)} wins the first Head of Household competition, ${hohComp.label}.`]
    });

    // Double or Nothing twist
    const gambleChance = clamp(0.35 + hohWinner.ratings.strategic / 250, 0.15, 0.75);
    const accepts = Math.random() < gambleChance;
    let doubleOrNothing = null;

    if (accepts) {
      const decider = C().runCompetition(field, { week:1,type:"hoh", category: hohComp.category });
      if (decider.winner.id === hohWinner.id) {
        doubleOrNothing = { teamId: hohWinner.teamId, hohId: hohWinner.id, extraWeek: true };
        log(state, {
          week: 1, phase: "premiere", type: "twist",
          title: "Double or Nothing — Accepted & Won",
          lines: [
            `${displayName(hohWinner)} accepts Julie's Double or Nothing offer and wins again!`,
            `${teamOf(state, hohWinner).name} are safe for two full weeks, and ${displayName(hohWinner)} stays HOH for Week 2 as well.`
          ]
        });
      } else {
        const newHoh = decider.winner;
        log(state, {
          week: 1, phase: "premiere", type: "twist",
          title: "Double or Nothing — Accepted & Lost",
          lines: [
            `${displayName(hohWinner)} accepts the gamble... and loses to ${displayName(newHoh)}.`,
            `${displayName(hohWinner)} is dethroned. ${teamOf(state, hohWinner).name} lose their safety, and the HOH passes to ${displayName(newHoh)} of ${teamOf(state, newHoh).name}.`
          ]
        });
        hohWinner = newHoh;
      }
    } else {
      log(state, {
        week: 1, phase: "premiere", type: "twist",
        title: "Double or Nothing — Declined",
        lines: [`${displayName(hohWinner)} plays it safe and declines the gamble. ${teamOf(state, hohWinner).name} are safe this week only.`]
      });
    }

    state.currentHOH = hohWinner.id;
    state._doubleOrNothing = doubleOrNothing;
    state.phase = "in-season";
  }

  function displayName(hg) {
    const name = `${hg.firstName} ${hg.lastName}`.trim();
    return name || `Houseguest ${hg.slot}`;
  }

  // ---------------------------------------------------------------------
  // WEEKLY FLOW
  // ---------------------------------------------------------------------

  function runWeek(state, config, week) {
    state.week = week;
    clearWeeklyFlags(state);
    const teamPhase = week <= config.teamWeeks;
    const highRollerPhase = week >= (config.highRollerStartWeek || 6) && week < (config.highRollerStartWeek || 6) + config.highRollerWeeks;

    // --- HOH ---
    let hoh;
    if (week === 1) {
      hoh = state.houseguests.find(h => h.id === state.currentHOH);
    } else if (state._doubleOrNothing && week === 2) {
      hoh = state.houseguests.find(h => h.id === state._doubleOrNothing.hohId);
      log(state, {
        week, phase: "team", type: "hoh",
        title: "HOH Holds Power",
        lines: [`${displayName(hoh)} remains HOH thanks to Double or Nothing.`]
      });
      state._doubleOrNothing = null;
    } else {
      const prevHohId = state.currentHOH;
      const pool = living(state).filter(h => h.id !== prevHohId);
      const comp = C().runCompetition(pool,{week,type:"hoh"});
      hoh = comp.winner;
      state.currentHOH = hoh.id;
      log(state, {
        week, phase: teamPhase ? "team" : highRollerPhase ? "high-roller" : "standard", type: "hoh",
        title: `Head of Household — ${comp.label}`,
        competitionType: "hoh",
        lines: [`${displayName(hoh)} wins HOH (${comp.label}).`]
      });
    }

    let individualSafe = [];

    if (teamPhase) {
      const hohTeam = teamOf(state, hoh);
      hohTeam.memberIds.forEach(id => {
        const m = state.houseguests.find(h => h.id === id);
        if (m.active) m.safe = true;
      });
      log(state, {
        week, phase: "team", type: "team-safety",
        title: "Team Safety",
        lines: [`${hohTeam.name} are safe from nomination this week.`]
      });

      const otherTeams = state.teams.filter(t => t.id !== hohTeam.id);
      const reps = otherTeams.map(t => {
        const members = t.memberIds.map(id => state.houseguests.find(h => h.id === id)).filter(h => h.active);
        if (!members.length) return null;
        return members.reduce((best, m) => {
          const score = m.ratings.physical + m.ratings.mental;
          const bestScore = best.ratings.physical + best.ratings.mental;
          return score > bestScore ? m : best;
        });
      }).filter(Boolean);

      if (reps.length) {
        const wc = C().runCompetition(reps,{week,type:"wildcard"});
        wc.winner.safe = true;
        individualSafe.push(wc.winner.id);
        log(state, {
          week, phase: "team", type: "wildcard",
          title: `Wildcard Competition — ${wc.label}`,
          competitionType: "wildcard",
          lines: [`${displayName(wc.winner)} wins the Wildcard and is individually safe this week — a target now sits on their back.`]
        });
      }
    }

    if (highRollerPhase) {
      runHighRollerRoom(state, week);
    }

    // --- Nominations ---
    const eligible = living(state).filter(h => h.id !== hoh.id && !h.safe);
    const nomineeCount = Math.min(2, eligible.length);
    let nominees = R().pickNominees(state, hoh, eligible, nomineeCount);
    nominees.forEach(n => (n.nominated = true));
    state.nominees = nominees.map(n => n.id);

    log(state, {
      week, phase: teamPhase ? "team" : highRollerPhase ? "high-roller" : "standard", type: "nominations",
      title: "Nomination Ceremony",
      lines: [`${displayName(hoh)} nominates ${nominees.map(displayName).join(" and ")} for eviction.`]
    });

    // --- Self-removal powers (Block Buster) resolved before veto comp ---
    for (let i = nominees.length - 1; i >= 0; i--) {
      const n = nominees[i];
      const power = activePower(state, n.id, "selfRemoval", week);
      if (!power || Math.random() >= 0.7) continue;

      power.used = true;
      n.nominated = false;
      nominees.splice(i, 1);
      log(state, {
        week, phase: "high-roller", type: "power",
        title: "Power Used",
        lines: [`${displayName(n)} secretly uses their Block Buster power to remove themselves from the block!`]
      });

      const avoidIds = nominees.map(x => x.id).concat(n.id, hoh.id);
      const pool = living(state).filter(h => !h.safe && !avoidIds.includes(h.id));
      const replacement = R().pickReplacement(state, hoh, pool, avoidIds);
      if (replacement) {
        replacement.nominated = true;
        nominees.push(replacement);
        state.nominees = nominees.map(n => n.id);
        log(state, {
          week, phase: "standard", type: "nominations",
          title: "Replacement Nominee",
          lines: [`${displayName(hoh)} names ${displayName(replacement)} as the replacement nominee.`]
        });
      }
    }

    // --- Veto players + competition ---
    const povPool = [hoh, ...nominees];
    const others = shuffledCopy(living(state).filter(h => !povPool.includes(h)));
    povPool.push(...others.slice(0, Math.max(0, 6 - povPool.length)));
    state.povPlayers = povPool.map(h => h.id);

    const povComp = C().runCompetition(povPool,{week,type: week>=9&&week%1===0 ? (week===9||week===10 ? "pov" : "pov") : "pov"});
    const vetoWinner = povComp.winner;
    state.vetoWinners = [vetoWinner.id];
    log(state, {
      week, phase: "standard", type: "veto", winnerId: vetoWinner.id,
      title: `Power of Veto — ${povComp.label}`,
      competitionType: (week === 9 ? "pov" : week === 10 ? "pov" : "pov"),
      lines: [`${displayName(vetoWinner)} wins the Power of Veto (${povComp.category}).`]
    });

    const vetoHolders = [vetoWinner];
    const bonusVetoHolder = living(state).find(h => activePower(state, h.id, "bonusVeto", week) && h.id !== vetoWinner.id);
    if (bonusVetoHolder) vetoHolders.push(bonusVetoHolder);

    let saved = null;
    for (const holder of vetoHolders) {
      const decision = R().decideVetoUse(state, holder, hoh, nominees);
      if (decision.use) {
        saved = { holder, savedId: decision.saveId };
        const power = activePower(state, holder.id, "bonusVeto", week);
        if (power) power.used = true;
        break;
      }
    }

    if (saved) {
      const savedHg = nominees.find(n => n.id === saved.savedId);
      savedHg.nominated = false;
      nominees = nominees.filter(n => n.id !== saved.savedId);
      log(state, {
        week, phase: "standard", type: "veto-ceremony",
        title: "Veto Ceremony — Used",
        lines: [`${displayName(saved.holder)} uses the Power of Veto on ${displayName(savedHg)}.`]
      });
      const replacementPool = living(state).filter(h => h.id !== hoh.id && !h.safe && !nominees.includes(h) && h.id !== savedHg.id);
      const replacement = R().pickReplacement(state, hoh, replacementPool, nominees.map(n => n.id));
      if (replacement) {
        replacement.nominated = true;
        nominees.push(replacement);
        state.nominees = nominees.map(n => n.id);
        state.nominees = nominees.map(n => n.id);
        log(state, {
          week, phase: "standard", type: "nominations",
          title: "Replacement Nominee",
          lines: [`${displayName(hoh)} names ${displayName(replacement)} as the replacement nominee.`]
        });
      }
    } else {
      log(state, {
        week, phase: "standard", type: "veto-ceremony",
        title: "Veto Ceremony — Not Used",
        lines: [`The Power of Veto is not used. Nominations remain the same.`]
      });
    }

    // --- Eviction ---
    // Safety net: living(state) is always >= 4 here, so 2 non-HOH nominees
    // must exist even if earlier steps (self-removal, veto) left us short.
    if (nominees.length < 2) {
      const fillPool = living(state).filter(h => h.id !== hoh.id && !nominees.includes(h));
      shuffledCopy(fillPool).slice(0, 2 - nominees.length).forEach(h => {
        h.nominated = true;
        nominees.push(h);
      });
    }
    const finalNoms = nominees.slice(0, 2);
    state.nominees = finalNoms.map(n => n.id);
    const voters = living(state).filter(h => h.id !== hoh.id && !finalNoms.includes(h));
    const votesToEvict = { [finalNoms[0].id]: 0, [finalNoms[1].id]: 0 };
    const voteLog = [];
    state.evictionVotes = [];

    voters.forEach(voter => {
      const votedOutId = R().decideVote(state, voter, finalNoms[0], finalNoms[1], hoh);
      votesToEvict[votedOutId]++;
      state.evictionVotes.push({ voterId: voter.id, targetId: votedOutId });
      voteLog.push(`${displayName(voter)} votes to evict ${displayName(state.houseguests.find(h => h.id === votedOutId))}.`);
    });

    let evictedId = votesToEvict[finalNoms[0].id] >= votesToEvict[finalNoms[1].id] ? finalNoms[0].id : finalNoms[1].id;

    const flipHolder = living(state).find(h => activePower(state, h.id, "voteFlip", week) && !finalNoms.some(n => n.id === h.id));
    if (flipHolder && Math.random() < 0.3) {
      const power = activePower(state, flipHolder.id, "voteFlip", week);
      power.used = true;
      evictedId = evictedId === finalNoms[0].id ? finalNoms[1].id : finalNoms[0].id;
      voteLog.push(`${displayName(flipHolder)} secretly uses their Power Shift to flip the result!`);
    }

    const evicted = state.houseguests.find(h => h.id === evictedId);
    const stays = finalNoms.find(n => n.id !== evictedId);

    evicted.active = false;
    state.season.evictionCount++;
    evicted.placement = placementForEvictionIndex(state, state.season.evictionCount);

    const juryThreshold = config.juryThresholdPlacement || 9;
    if (evicted.placement <= juryThreshold) {
      evicted.juryMember = true;
      state.jury.push(evicted.id);
    }
    state.evicted.push(evicted.id);
    state.nominees = finalNoms.map(n => n.id);

    log(state, {
      week, phase: teamPhase ? "team" : highRollerPhase ? "high-roller" : "standard", type: "eviction-voting",
      title: `Eviction Vote (${finalNoms.map(displayName).join(" vs ")})`,
      lines: voteLog
    });

    log(state, {
      week, phase: teamPhase ? "team" : highRollerPhase ? "high-roller" : "standard", type: "eviction",
      title: "Eviction",
      lines: [
        `By a vote of ${votesToEvict[evictedId]}-${votesToEvict[stays.id]}, ${displayName(evicted)} is evicted from the Big Brother house.`,
        evicted.juryMember ? `${displayName(evicted)} will join the jury.` : `${displayName(evicted)}'s journey ends here — finishing in ${ordinal(evicted.placement)} place.`
      ]
    });

    if (Math.random() < 0.55) {
      const alliance = R().formAlliances(state, week);
      if (alliance) {
        log(state, {
          week, phase: "standard", type: "alliance",
          title: "An Alliance Forms",
          lines: [`${alliance.memberIds.map(id => displayName(state.houseguests.find(h => h.id === id))).join(", ")} quietly form "${alliance.name}."`]
        });
      }
    }
    R().pruneAlliances(state);
  }

  function activePower(state, hgId, type, week) {
    return state.powers.find(p => p.ownerId === hgId && p.type === type && !p.used && p.expiresWeek >= week);
  }

  // ---------------------------------------------------------------------
  // HIGH ROLLER'S ROOM
  // ---------------------------------------------------------------------

  const HIGH_ROLLER_GAMES = [
    { week:6, type:"bonusVeto", name:"Veto Derby", cost:50, winChance:0.5 },
    { week:7, type:"selfRemoval", name:"Chopping Block Roulette", cost:125, winChance:0.45 },
    { week:8, type:"voteFlip", name:"Coin of Destiny", cost:250, winChance:0.35 }
  ];

  function runHighRollerRoom(state, week) {
    const players = living(state);
    const ranked = players.map(hg => ({
      hg, score: (hg.ratings.social * 0.6 + hg.ratings.general * 0.4) + Math.random() * 20
    })).sort((a, b) => b.score - a.score);

    ranked.forEach((r, i) => {
      const amount = i < 3 ? 100 : i < 6 ? 75 : 50;
      state.bbBucks[r.hg.id] = (state.bbBucks[r.hg.id] || 0) + amount;
    });

    log(state, {
      week, phase: "high-roller", type: "bb-bucks",
      title: "America Votes — BB Bucks Awarded",
      lines: ranked.map(r => `${displayName(r.hg)} earns ${state.bbBucks[r.hg.id]} lifetime BB Bucks (America's vote).`).slice(0, 6)
    });

    const plays = [];
    players.forEach(hg => {
      const bucks = state.bbBucks[hg.id] || 0;
      const game = HIGH_ROLLER_GAMES.find(g => g.week === week);
      if (!game || game.cost > bucks) return;
      const willPlay = Math.random() < clamp(0.25 + hg.ratings.strategic / 200, 0.15, 0.7);
      if (!willPlay) return;
      state.bbBucks[hg.id] -= game.cost;
      const won = Math.random() < game.winChance;
      if (won) {
        state.powers.push({
          id: `power-${state.powers.length + 1}`,
          ownerId: hg.id, type: game.type, wonWeek: week, expiresWeek: week + 1, used: false
        });
      }
      plays.push(`${displayName(hg)} spends ${game.cost} BB Bucks on ${game.name} — ${won ? "and wins the power!" : "but comes up short."}`);
    });

    if (plays.length) {
      log(state, {
        week, phase: "high-roller", type: "high-roller-room",
        competitionType: "high-roller",
        competitionName: HIGH_ROLLER_GAMES.find(g => g.week === week)?.name || "High Roller's Room",
        competitionDescription: (window.BB23_CONFIG?.competitionSchedule || []).find(c => c.week === week && c.type === "high-roller")?.description || "A BB23 High Roller's Room competition for a special power.",
        title: `High Roller's Room — ${HIGH_ROLLER_GAMES.find(g => g.week === week)?.name || "Competition"}`,
        lines: plays
      });
    }
  }

  // ---------------------------------------------------------------------
  // FINAL 3 + FINALE
  // ---------------------------------------------------------------------

  function runFinale(state, config) {
    state.week = "Final";
    const finalThree = living(state);
    if (finalThree.length !== 3) return;

    const part1 = C().runCompetition(finalThree,{week:12,type:"final-hoh-1"});
    const part1Winner = part1.winner;
    const remaining = finalThree.filter(h => h.id !== part1Winner.id);

    const part2 = C().runCompetition(remaining,{week:12,type:"final-hoh-2",category:part1.category==="physical"?"mental":"physical"});
    const part2Winner = part2.winner;
    const part2Loser = remaining.find(h => h.id !== part2Winner.id);

    log(state, {
      week: "Final", phase: "finale", type: "final3-part1", winnerId: part1Winner.id,
      title: `Final 3 — Part 1 (${part1.label})`,
      competitionType: "final-hoh-1",
      lines: [`${displayName(part1Winner)} wins Part 1 and advances directly to Part 3.`]
    });
    log(state, {
      week: "Final", phase: "finale", type: "final3-part2", winnerId: part2Winner.id,
      title: `Final 3 — Part 2 (${part2.label})`,
      competitionType: "final-hoh-2",
      lines: [`${displayName(part2Winner)} defeats ${displayName(part2Loser)} to advance to Part 3.`]
    });

    const part3 = C().runCompetition([part1Winner, part2Winner],{week:12,type:"final-hoh-3"});
    const finalHoh = part3.winner;
    const part3Loser = part1Winner.id === finalHoh.id ? part2Winner : part1Winner;

    log(state, {
      week: "Final", phase: "finale", type: "final3-part3", winnerId: finalHoh.id,
      title: `Final 3 — Part 3: Final HOH (${part3.label})`,
      competitionType: "final-hoh-3",
      lines: [`${displayName(finalHoh)} wins the final Head of Household and controls the final decision.`]
    });

    const choiceCandidates = [part2Loser, part3Loser];
    const takenToFinal2 = R().decideFinalTwoPick(state, finalHoh, choiceCandidates);
    const evictedThird = choiceCandidates.find(h => h.id !== takenToFinal2.id);

    evictedThird.active = false;
    evictedThird.juryMember = true;
    evictedThird.placement = 3;
    state.jury.push(evictedThird.id);
    state.evicted.push(evictedThird.id);

    log(state, {
      week: "Final", phase: "finale", type: "final-decision",
      title: "Final HOH's Decision",
      lines: [`${displayName(finalHoh)} chooses to evict ${displayName(evictedThird)}, taking ${displayName(takenToFinal2)} to the Final 2.`,
        `${displayName(evictedThird)} finishes in 3rd place and joins the jury.`]
    });

    const finalists = [finalHoh, takenToFinal2];
    const jurors = state.jury.map(id => state.houseguests.find(h => h.id === id)).filter(Boolean);
    const tally = { [finalists[0].id]: 0, [finalists[1].id]: 0 };
    state._juryVotes = [];
    const juryLines = jurors.map(juror => {
      const vote = R().decideJuryVote(state, juror, finalists[0], finalists[1]);
      tally[vote]++;
      state._juryVotes.push({voterId: juror.id, targetId: vote});
      return `${displayName(juror)} votes for ${displayName(state.houseguests.find(h => h.id === vote))}.`;
    });

    log(state, {
      week: "Final", phase: "finale", type: "jury-vote",
      title: "The Jury Votes",
      lines: juryLines
    });

    const winnerId = tally[finalists[0].id] >= tally[finalists[1].id] ? finalists[0].id : finalists[1].id;
    const runnerUpId = winnerId === finalists[0].id ? finalists[1].id : finalists[0].id;
    const winner = state.houseguests.find(h => h.id === winnerId);
    const runnerUp = state.houseguests.find(h => h.id === runnerUpId);
    winner.placement = 1;
    runnerUp.placement = 2;
    winner.active = false;
    runnerUp.active = false;

    state.finale = {
      votes: tally,
      winnerId, runnerUpId, thirdPlaceId: evictedThird.id,
      finalHohId: finalHoh.id
    };
    state.phase = "complete";

    log(state, {
      week: "Final", phase: "finale", type: "winner",
      title: `${displayName(winner)} Wins Big Brother!`,
      lines: [`By a vote of ${tally[winnerId]}-${tally[runnerUpId]}, ${displayName(winner)} is crowned the winner of Big Brother over ${displayName(runnerUp)}.`]
    });
  }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ---------------------------------------------------------------------
  // ENTRY POINT
  // ---------------------------------------------------------------------

  function simulateSeason(state, config) {
    state.history = [];
    state.jury = [];
    state.evicted = [];
    state.evictionVotes = [];
    state.nominees = [];
    state.povPlayers = [];
    state.vetoWinners = [];
    state.currentHOH = null;
    state.originalHOH = null;
    state.secretHOH = null;
    state.dethronedHOH = null;
    state.finale = null;
    state.week = 0;
    state.phase = "premiere";
    state.houseguests.forEach(h => {
      h.active = true; h.safe = false; h.nominated = false;
      h.juryMember = false; h.evicted = false; h.placement = null;
    });

    runPremiere(state, config);

    let week = 1;
    let safety = 0;
    while (living(state).length > 3 && safety < 60) {
      runWeek(state, config, week);
      week++;
      safety++;
    }
    runFinale(state, config);
    return state;
  }

  window.SeasonEngine = { simulateSeason, displayName, ordinal };
})();
