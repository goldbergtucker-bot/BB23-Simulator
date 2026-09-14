/*
 * BIG BROTHER 23 CUSTOM SIMULATOR — V16 UNIFIED SEASON ENGINE
 *
 * One source of truth for the complete season simulation.
 * Implements:
 *   1. Four-team opening + captains + 90-second-style draft
 *   2. Team safety for Weeks 1-4
 *   3. Wildcard before nominations
 *   4. Premiere Double or Nothing
 *   5. High Roller's Room / BB Bucks Weeks 6-8
 *   6. Veto Derby second-Veto betting mechanic
 *   7. Chopping Block Roulette
 *   8. Coin of Destiny HOH takeover + re-nomination
 *   9. Full integration: double evictions, jury, Final 3, finale
 *
 * The engine pre-simulates the season into state.history. The UI reveals
 * those records one at a time, preserving the BrantSteele-style chain.
 */
(function(){
  const C=()=>window.Competitions;
  const R=()=>window.RelEngine;
  const TEAM_NAMES=["Jokers","Aces","Kings","Queens"];

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const living=s=>s.houseguests.filter(h=>h.active);
  const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const pick=a=>a&&a.length?a[Math.floor(Math.random()*a.length)]:null;
  const hg=(s,id)=>s.houseguests.find(h=>h.id===id)||null;
  const displayName=h=>{const n=`${h?.firstName||""} ${h?.lastName||""}`.trim();return n||`Houseguest ${h?.slot||""}`;};
  const teamOf=(s,h)=>s.teams.find(t=>t.id===h?.teamId)||null;
  const ordinal=n=>{const v=n%100;const suf=v>=11&&v<=13?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return `${n}${suf}`;};

  function snapshot(s){return {
    phase:s.phase,week:s.week,currentHOH:s.currentHOH,originalHOH:s.originalHOH||null,secretHOH:s.secretHOH||null,dethronedHOH:s.dethronedHOH||null,
    nominees:(s.nominees||[]).slice(),intendedTarget:s.intendedTarget||null,targetHistory:(s.targetHistory||[]).slice(),backdoorTargetId:s.backdoorTargetId||null,
    povPlayers:(s.povPlayers||[]).slice(),vetoWinners:(s.vetoWinners||[]).slice(),evictionVotes:(s.evictionVotes||[]).slice(),evicted:(s.evicted||[]).slice(),jury:(s.jury||[]).slice(),
    bbBucks:{...(s.bbBucks||{})},powers:JSON.parse(JSON.stringify(s.powers||[])),teams:JSON.parse(JSON.stringify(s.teams||[])),
    houseguests:s.houseguests.map(h=>({id:h.id,slot:h.slot,firstName:h.firstName,lastName:h.lastName,portraitUrl:h.portraitUrl,gender:h.gender||"",teamId:h.teamId,active:h.active,safe:h.safe,nominated:h.nominated,juryMember:h.juryMember,evicted:h.evicted,placement:h.placement,teamCaptain:!!h.teamCaptain})),
    finale:s.finale?JSON.parse(JSON.stringify(s.finale)):null
  };}

  function eventData(s,e){
    const ids=a=>Array.isArray(a)?a.slice():[];
    const d={...(e.data||{})};
    d.competition=e.competition?JSON.parse(JSON.stringify(e.competition)):d.competition||null;
    d.participants=ids(e.participants||d.participants);d.nomineeIds=ids(e.nomineeIds||d.nomineeIds||s.nominees);d.povPlayers=ids(e.povPlayers||d.povPlayers||s.povPlayers);
    d.winnerId=e.winnerId||d.winnerId||null;d.hohId=e.hohId||d.hohId||s.currentHOH||null;d.evictedId=e.evictedId||d.evictedId||null;
    if(e.type==="teams")d.teams=JSON.parse(JSON.stringify(s.teams));
    if(e.type==="eviction-voting")d.votes=(s.evictionVotes||[]).map(v=>({...v})),d.voterIds=d.votes.map(v=>v.voterId);
    if(e.type==="eviction") {
      // Preserve the actual vote tally on the event record.  The engine already
      // calculates these counts correctly, but the UI reads event.data rather
      // than the top-level event object.  Without copying them here, the UI
      // falls back to 0/0 even when the individual votes were split correctly.
      d.voteCounts={...(e.voteCounts||d.voteCounts||{})};
      d.evictedVoteCount=Number(e.evictedVoteCount ?? d.evictedVoteCount ?? 0);
      d.stayVoteCount=Number(e.stayVoteCount ?? d.stayVoteCount ?? 0);
    }
    if(e.type==="jury-vote")d.votes=(s._juryVotes||[]).map(v=>({...v})),d.voterIds=d.votes.map(v=>v.voterId),d.finalistIds=living(s).map(h=>h.id);
    if(e.type==="final-decision")d.finalistIds=living(s).map(h=>h.id);
    if(e.type==="winner"){d.runnerUpId=e.runnerUpId||d.runnerUpId||s.finale?.runnerUpId||null;d.afpId=e.afpId||d.afpId||s.finale?.americasFavoriteId||null;d.afpVotes=e.afpVotes||d.afpVotes||s.finale?.americasFavoriteVotes||{};d.thirdPlaceId=e.thirdPlaceId||d.thirdPlaceId||s.finale?.thirdPlaceId||null;}
    return d;
  }
  function log(s,e){const r={id:s.history.length+1,...e};r.snapshot=snapshot(s);r.data=eventData(s,r);s.history.push(r);}

  function ensureState(s){
    s.bbBucks=s.bbBucks||{};s.powers=Array.isArray(s.powers)?s.powers:[];s.evicted=Array.isArray(s.evicted)?s.evicted:[];s.jury=Array.isArray(s.jury)?s.jury:[];
    s.nominees=s.nominees||[];s.povPlayers=s.povPlayers||[];s.vetoWinners=s.vetoWinners||[];s.evictionVotes=s.evictionVotes||[];s.teams=s.teams||[];s.history=s.history||[];
    s.coinState=s.coinState||null;s._playedHighRollerWeeks=s._playedHighRollerWeeks||{};s._wildcardPlayed=s._wildcardPlayed||{};s._week2BonusTeamSafety=s._week2BonusTeamSafety||null;s._week8EnvelopesAwarded=!!s._week8EnvelopesAwarded;
    s.houseguests.forEach(h=>{h.gender=h.gender||"";h.teamCaptain=!!h.teamCaptain;h.allianceIds=h.allianceIds||[];h.ratings=h.ratings||{general:50,physical:50,mental:50,social:50,strategic:50};});
  }

  function relationshipScore(s,a,b){const r=s.relationships?.[a.id]?.[b.id]||{friendship:50,trust:50,loyalty:50,respect:50,attraction:0,rivalry:0};return (r.friendship||0)*.30+(r.trust||0)*.25+(r.loyalty||0)*.15+(r.respect||0)*.20+(r.attraction||0)*.10-(r.rivalry||0)*.35;}
  function randomizeRelationships(s){if(s.season.relationshipsRandomized||s.season.relationshipsCustomized)return;s.houseguests.forEach(a=>s.houseguests.forEach(b=>{if(a.id===b.id)return;const r=s.relationships[a.id][b.id];const n=()=>Math.round(Math.random()*40-20);r.friendship=clamp(r.friendship+n(),15,85);r.trust=clamp(r.trust+n(),15,85);r.loyalty=clamp(r.loyalty+n(),15,85);r.respect=clamp(r.respect+n(),15,85);r.rivalry=Math.round(Math.random()*25);r.attraction=Math.round(Math.random()*30);}));s.season.relationshipsRandomized=true;}

  /* ----------------------------- TEAMS -------------------------------- */
  function draftTeams(s){
    /*
     * BB23 TEAM CAPTAINS / MOVE-IN TWIST
     *
     * The 16 houseguests move in as four groups of four:
     *   - Group 1: four men
     *   - Group 2: four men
     *   - Group 3: four women
     *   - Group 4: four women
     *
     * One winner from each group becomes a Team Captain.  That guarantees
     * two male captains and two female captains.  Captains then draft three
     * teammates, with the draft constrained so every finished team has
     * exactly two men and two women.
     *
     * This is intentionally rebuilt on every simulation/resimulation.  A
     * previous season's team assignments must never be reused as the opening
     * move-in groups or final rosters.
     */
    s.teams=TEAM_NAMES.map((name,i)=>({
      id: s.teams?.[i]?.id || name.toLowerCase(),
      name,
      colorClass: s.teams?.[i]?.colorClass || name.toLowerCase(),
      captainId:null,
      memberIds:[]
    }));
    s.houseguests.forEach(h=>{h.teamId=null;h.teamCaptain=false;h.wildcardSafetyUntilWeek=0;h.safe=false;});

    const men=shuffle(living(s).filter(p=>String(p.gender||'').toLowerCase()==='male')); 
    const women=shuffle(living(s).filter(p=>String(p.gender||'').toLowerCase()==='female')); 
    if(men.length!==8||women.length!==8){
      throw new Error(`BB23 Team Captains requires exactly 8 male and 8 female houseguests. Found ${men.length} male and ${women.length} female.`);
    }

    const groups=[men.slice(0,4),men.slice(4,8),women.slice(0,4),women.slice(4,8)];
    const groupLabels=["Move-In Group 1 — Men","Move-In Group 2 — Men","Move-In Group 3 — Women","Move-In Group 4 — Women"];
    const captains=[];

    groups.forEach((group,i)=>{
      const comp=C().runCompetition(group,{
        week:0,
        type:"team-captain",
        category:"general",
        label:`${TEAM_NAMES[i]} Captain Competition`,
        description:`${groupLabels[i]}: four ${i<2?'men':'women'} compete for the right to become the ${TEAM_NAMES[i]} Team Captain.`,
        noiseMin:.9,
        noiseMax:1.1
      });
      const cap=comp.winner;
      captains.push(cap);
      s.teams[i].captainId=cap.id;
      s.teams[i].memberIds=[cap.id];
      cap.teamId=s.teams[i].id;
      cap.teamCaptain=true;
      log(s,{
        week:0,
        phase:"premiere",
        type:"team-captain",
        winnerId:cap.id,
        participants:group.map(p=>p.id),
        moveInGroup:i+1,
        moveInGroupLabel:groupLabels[i],
        competition:comp,
        title:`${groupLabels[i]} — ${TEAM_NAMES[i]} Captain Competition`,
        lines:[`${displayName(cap)} wins the ${groupLabels[i].toLowerCase()} competition and becomes the ${TEAM_NAMES[i]} Team Captain.`]
      });
    });

    /*
     * Draft exactly the genders each team needs.  Captains do not count as
     * picks, so the two male-captain teams each need 1 woman + 2 men, while
     * the two female-captain teams each need 1 man + 2 women.
     */
    const remaining=shuffle(living(s).filter(p=>!captains.some(c=>c.id===p.id)));
    let round=0;
    while(remaining.length){
      const order=round%2===0?s.teams:s.teams.slice().reverse();
      for(const t of order){
        if(t.memberIds.length>=4)continue;
        const members=t.memberIds.map(id=>hg(s,id));
        const maleCount=members.filter(p=>String(p.gender||'').toLowerCase()==='male').length;
        const femaleCount=members.filter(p=>String(p.gender||'').toLowerCase()==='female').length;
        const needsGender=maleCount<2?'male':femaleCount<2?'female':null;
        const candidates=remaining.filter(p=>needsGender===null||String(p.gender||'').toLowerCase()===needsGender);
        if(!candidates.length)throw new Error(`Unable to complete ${t.name} as a 2-man/2-woman team.`);

        const captain=hg(s,t.captainId);
        candidates.sort((a,b)=>{
          const score=(p)=>relationshipScore(s,captain,p)+p.ratings.social*.25+p.ratings.strategic*.20+p.ratings.general*.10+(Math.random()*8-4);
          return score(b)-score(a);
        });
        const chosen=candidates[0];
        t.memberIds.push(chosen.id);
        chosen.teamId=t.id;
        const idx=remaining.findIndex(p=>p.id===chosen.id);
        if(idx>=0)remaining.splice(idx,1);
        log(s,{
          week:0,
          phase:"premiere",
          type:"team-draft",
          winnerId:chosen.id,
          participants:[captain.id,chosen.id],
          teamId:t.id,
          teamName:t.name,
          title:`${t.name} — Team Captain Draft Pick`,
          lines:[`${displayName(captain)} selects ${displayName(chosen)} for the ${t.name}.`]
        });
      }
      round++;
    }

    /* Final safety check: every BB23 team must be exactly 2 men + 2 women. */
    s.teams.forEach(t=>{
      const members=t.memberIds.map(id=>hg(s,id));
      const m=members.filter(p=>String(p.gender||'').toLowerCase()==='male').length;
      const f=members.filter(p=>String(p.gender||'').toLowerCase()==='female').length;
      if(m!==2||f!==2)throw new Error(`${t.name} did not finish 2 men and 2 women.`);
    });

    log(s,{
      week:0,
      phase:"premiere",
      type:"teams",
      participants:s.houseguests.map(h=>h.id),
      title:"Teams Complete — BB23 Move-In",
      lines:s.teams.map(t=>`${t.name}: ${t.memberIds.map(id=>displayName(hg(s,id))).join(", ")} (Captain: ${displayName(hg(s,t.captainId))})`)
    });
  }

  /* ------------------------ HIGH ROLLER ECONOMY ------------------------- */
  function awardBucks(s,week){
    // America awards a fresh tier of BB Bucks each High Roller's Room week.
    // Players keep any unspent bucks, so the balances can be saved for the
    // more expensive powers in later weeks.
    if(Number(week)<6||Number(week)>8||s._playedHighRollerWeeks[week])return;
    const players=living(s),ranked=shuffle(players).sort((a,b)=>((b.ratings.social*.6+b.ratings.general*.4)+Math.random()*20)-((a.ratings.social*.6+a.ratings.general*.4)+Math.random()*20));
    ranked.forEach((p,i)=>{const amount=i<3?100:i<6?75:50;s.bbBucks[p.id]=(s.bbBucks[p.id]||0)+amount;});
    s._playedHighRollerWeeks[week]=true;
    log(s,{week,phase:"high-roller",type:"bb-bucks",title:"America Votes — BB Bucks",participants:ranked.map(p=>p.id),lines:["Top 3 receive $100 BB Bucks; next 3 receive $75; remaining eligible players receive $50.",...ranked.map((p,i)=>`${i+1}. ${displayName(p)} receives ${i<3?100:i<6?75:50} BB Bucks (banked total: ${s.bbBucks[p.id]}).`)]});
  }
  function awardPower(s,owner,type,week,extra={}){const p={id:`power-${s.powers.length+1}`,ownerId:owner.id,type,wonWeek:week,expiresWeek:week,used:false,...extra};s.powers.push(p);return p;}
  function power(s,id,type,week){return s.powers.find(p=>p.ownerId===id&&p.type===type&&!p.used&&Number(p.expiresWeek)>=week);}

  function runVetoDerby(s,week){
    const eligible=living(s).filter(p=>(s.bbBucks[p.id]||0)>=50);
    if(!eligible.length)return null;
    let entries=eligible.filter(p=>{const chance=clamp(.25+p.ratings.strategic/200,.25,.80);if(Math.random()>chance)return false;s.bbBucks[p.id]-=50;return true;});
    if(!entries.length&&eligible.length){const forced=eligible.slice().sort((a,b)=>b.ratings.strategic-a.ratings.strategic)[0];s.bbBucks[forced.id]-=50;entries=[forced];}
    if(!entries.length)return null;
    const scores=entries.map(p=>({p,score:(p.ratings.strategic*.55+p.ratings.physical*.25+p.ratings.mental*.20)+Math.random()*25})).sort((a,b)=>b.score-a.score);
    const qualifiers=scores.slice(0,Math.min(6,scores.length)).map(x=>x.p);
    const povPlayers=s.povPlayers.map(id=>hg(s,id)).filter(Boolean).slice(0,6);
    const available=povPlayers.slice();
    const bets=[];
    qualifiers.forEach(bettor=>{
      if(!available.length)return;
      available.sort((a,b)=>((b.ratings.physical+b.ratings.mental+b.ratings.general)/3+Math.random()*15)-((a.ratings.physical+a.ratings.mental+a.ratings.general)/3+Math.random()*15));
      const target=available.shift();
      bets.push({bettorId:bettor.id,targetId:target.id});
    });
    const comp={name:"Veto Derby",label:"Veto Derby",description:"Houseguests may spend 50 BB Bucks. The highest finishers earn the right to bet on a POV player; a correct bet earns a second Power of Veto.",category:"strategic",official:true,week,ranking:scores.map(x=>({id:x.p.id,score:Math.round(x.score*10)/10})),winner:qualifiers[0]||null};
    log(s,{week,phase:"high-roller",type:"veto-derby",winnerId:qualifiers[0]?.id||null,participants:entries.map(p=>p.id),competition:comp,data:{bets},title:"High Roller's Room — Veto Derby",lines:[`${entries.length} houseguests spend 50 BB Bucks to enter Veto Derby.`,`${qualifiers.length} houseguest${qualifiers.length===1?"":"s"} earn the right to place a POV bet.`,...bets.map(b=>`${displayName(hg(s,b.bettorId))} bets on ${displayName(hg(s,b.targetId))} to win the Power of Veto.`)]});
    return {bets,qualifiers};
  }

  function resolveVetoDerby(s,week,derby,povWinner){
    if(!derby||!povWinner)return;
    const hit=derby.bets.find(b=>b.targetId===povWinner.id);
    if(!hit)return;
    const bettor=hg(s,hit.bettorId);
    if(!bettor?.active)return;
    awardPower(s,bettor,"secondVeto",week,{expiresWeek:week,betTargetId:povWinner.id});
    log(s,{week,phase:"high-roller",type:"veto-derby-result",winnerId:bettor.id,participants:[bettor.id,povWinner.id],title:"Veto Derby — Second Veto Won",lines:[`${displayName(povWinner)} wins the Power of Veto, so ${displayName(bettor)}'s Veto Derby bet pays off.`,`${displayName(bettor)} receives the second Power of Veto for the week.`]});
  }

  function runChoppingBlock(s,week){
    awardBucks(s,week);const eligible=living(s).filter(p=>(s.bbBucks[p.id]||0)>=125);if(!eligible.length)return;
    let players=shuffle(eligible).filter(p=>Math.random()<clamp(.2+p.ratings.strategic/180,.2,.75));if(!players.length&&eligible.length)players=[eligible.slice().sort((a,b)=>b.ratings.strategic-a.ratings.strategic)[0]];if(!players.length){log(s,{week,phase:"high-roller",type:"chopping-block-roulette",title:"High Roller's Room — Chopping Block Roulette",lines:["No remaining houseguest has enough BB Bucks to enter Chopping Block Roulette."]});return;}
    const comp=C().runCompetition(players,{week,type:"high-roller",category:"strategic",label:"Chopping Block Roulette",description:"Players spend 125 BB Bucks. The winner may remove an initial nominee, then roulette determines the replacement nominee."});
    const winner=comp.winner; s.bbBucks[winner.id]-=125; winner.safe=true;
    const initial=(s.nominees||[]).map(id=>hg(s,id)).filter(Boolean);const removable=initial.length?pick(initial):null;
    let removed=null,replacement=null;
    if(removable){removed=removable;removable.nominated=false;s.nominees=s.nominees.filter(id=>id!==removed.id);removed.safe=true;const pool=living(s).filter(p=>p.id!==s.currentHOH&&!p.safe&&!s.nominees.includes(p.id)&&p.id!==removed.id);replacement=pick(pool);if(replacement){replacement.nominated=true;s.nominees.push(replacement.id);}}
    awardPower(s,winner,"rouletteUsed",week,{expiresWeek:week,removedId:removed?.id||null,replacementId:replacement?.id||null});
    log(s,{week,phase:"high-roller",type:"chopping-block-roulette",winnerId:winner.id,participants:players.map(p=>p.id),competition:comp,removedId:removed?.id||null,replacementId:replacement?.id||null,title:"High Roller's Room — Chopping Block Roulette",lines:[`${displayName(winner)} spends 125 BB Bucks and wins Chopping Block Roulette.`,removed?`${displayName(winner)} removes ${displayName(removed)} from the block. ${displayName(removed)} is safe for the remainder of the week.`:`No initial nominee was available to remove.`,replacement?`The roulette names ${displayName(replacement)} as the replacement nominee.`:`No replacement nominee is required.`]});
  }

  function runCoinOfDestiny(s,week){
    awardBucks(s,week);const eligible=living(s).filter(p=>(s.bbBucks[p.id]||0)>=250);if(!eligible.length)return;
    let entrants=eligible.filter(p=>Math.random()<clamp(.15+p.ratings.strategic/220,.15,.65));if(!entrants.length&&eligible.length)entrants=[eligible.slice().sort((a,b)=>b.ratings.strategic-a.ratings.strategic)[0]];if(!entrants.length){log(s,{week,phase:"high-roller",type:"coin-of-destiny",title:"High Roller's Room — Coin of Destiny",lines:["No remaining houseguest has enough BB Bucks to enter the Coin of Destiny competition."]});return;}
    const comp=C().runCompetition(entrants,{week,type:"high-roller",category:"strategic",label:"Coin of Destiny",description:"Players spend 250 BB Bucks for the right to challenge the reigning HOH to a coin toss."});
    const challenger=comp.winner;s.bbBucks[challenger.id]-=250;const sitting=hg(s,s.currentHOH);const call=Math.random()<.5;const coin=Math.random()<.5;const won=call===coin;
    log(s,{week,phase:"high-roller",type:"coin-of-destiny",winnerId:challenger.id,participants:entrants.map(p=>p.id),competition:comp,title:"High Roller's Room — Coin of Destiny",lines:[`${displayName(challenger)} wins the Coin of Destiny challenge and challenges ${displayName(sitting)}.`,`The coin toss is called ${call?"correctly":"incorrectly"}; the coin lands ${coin?"heads":"tails"}.`,won?`${displayName(challenger)} dethrones ${displayName(sitting)} and secretly becomes the new HOH.`:`${displayName(sitting)} remains HOH.`]});
    if(won&&sitting){s.dethronedHOH=sitting.id;s.originalHOH=sitting.id;s.currentHOH=challenger.id;s.secretHOH=challenger.id;s.coinState={week,challengerId:challenger.id,dethronedId:sitting.id,won:true};sitting.safe=true;challenger.safe=true;s.nominees.forEach(id=>{const n=hg(s,id);if(n)n.nominated=false;});s.nominees=[];log(s,{week,phase:"high-roller",type:"coin-renomination",winnerId:challenger.id,hohId:challenger.id,title:"Coin of Destiny — Secret HOH Re-Nomination",lines:[`${displayName(challenger)} anonymously takes over as HOH.`,`The existing nominations are wiped away. The dethroned HOH remains immune and may compete in the next HOH.`]});}
  }

  function awardWeek8Envelopes(s,week){
    if(week!==8||s._week8EnvelopesAwarded)return;
    s._week8EnvelopesAwarded=true;
    const players=living(s);
    const awards=[];
    players.forEach(p=>{const amount=Math.random()<.5?50:100;s.bbBucks[p.id]=(s.bbBucks[p.id]||0)+amount;awards.push({id:p.id,amount,total:s.bbBucks[p.id]});});
    log(s,{week,phase:"high-roller",type:"bb-bucks-envelopes",participants:players.map(p=>p.id),title:"High Roller's Room — BB Bucks Envelopes",lines:["Each remaining houseguest opens a bonus BB Bucks envelope before the final High Roller's Room game.",...awards.map(a=>`${displayName(hg(s,a.id))} receives an extra $${a.amount} BB Bucks (total: $${a.total}).`)]});
  }

  /* ----------------------------- PREMIERE ------------------------------ */
  function runPremiere(s,config){
    s.week=0;s.phase="premiere";s.season.castSize=s.houseguests.length;s.season.evictionCount=0;randomizeRelationships(s);draftTeams(s);
    const captains=s.teams.map(t=>hg(s,t.captainId)).filter(Boolean);
    const comp=C().runCompetition(captains,{week:1,type:"hoh"});
    const first=comp.winner;
    s.currentHOH=first.id;s.originalHOH=first.id;
    log(s,{week:1,phase:"premiere",type:"hoh",winnerId:first.id,participants:captains.map(p=>p.id),competition:comp,title:`Premiere HOH — ${comp.label}`,lines:[`The four Team Captains compete for the first HOH. ${displayName(first)} wins Head of Household.`]});

    const accept=Math.random()<clamp(.30+first.ratings.strategic/250,.20,.70);
    if(!accept){
      log(s,{week:1,phase:"premiere",type:"double-or-nothing",hohId:first.id,title:"Double or Nothing — Declined",lines:[`${displayName(first)} declines Julie's Double or Nothing offer.`,`${teamOf(s,first)?.name||"Their team"} keeps its Week 1 safety, and ${displayName(first)} remains the Week 1 HOH.`]});
      return;
    }

    const skill=(first.ratings.physical+first.ratings.mental+first.ratings.general)/3;
    const won=(skill*(.80+Math.random()*.40))>=55;
    if(won){
      s._week2BonusTeamSafety=first.teamId;
      log(s,{week:1,phase:"premiere",type:"double-or-nothing",winnerId:first.id,hohId:first.id,title:"Double or Nothing — Accepted & Won",lines:[`${displayName(first)} accepts the gamble and succeeds.`,`${teamOf(s,first)?.name||"Their team"} is safe for both Week 1 and Week 2. ${displayName(first)} remains HOH for Week 1 only.`]});
    }else{
      const runnerId=comp.ranking.find(x=>x.id!==first.id)?.id;
      const newHoh=hg(s,runnerId)||pick(captains.filter(p=>p.id!==first.id));
      s.dethronedHOH=first.id;s.currentHOH=newHoh.id;s.originalHOH=newHoh.id;
      log(s,{week:1,phase:"premiere",type:"double-or-nothing",winnerId:newHoh.id,hohId:newHoh.id,title:"Double or Nothing — Accepted & Lost",lines:[`${displayName(first)} accepts the gamble but fails.`,`${displayName(first)} is dethroned and ${displayName(newHoh)}, captain of the second-place team, becomes the Week 1 HOH. ${teamOf(s,first)?.name||"The former HOH's team"} loses its safety.`]});
    }
  }

  function markTeamSafety(s,hoh,week){
    if(week>4)return;
    const protectedTeams=[];
    const t=teamOf(s,hoh);
    if(t)protectedTeams.push(t);
    if(week===2&&s._week2BonusTeamSafety){
      const bonus=s.teams.find(x=>x.id===s._week2BonusTeamSafety);
      if(bonus&&!protectedTeams.some(x=>x.id===bonus.id))protectedTeams.push(bonus);
    }
    protectedTeams.forEach(team=>{
      const safeMembers=team.memberIds.map(id=>hg(s,id)).filter(p=>p?.active);
      safeMembers.forEach(p=>{p.safe=true;});
      log(s,{week,phase:"team",type:"team-safety",hohId:hoh.id,participants:safeMembers.map(p=>p.id),teamId:team.id,teamName:team.name,safeMemberIds:safeMembers.map(p=>p.id),title:week===2&&team.id===s._week2BonusTeamSafety&&team.id!==hoh.teamId?"Double or Nothing — Bonus Team Safety":"Team Safety",lines:[week===2&&team.id===s._week2BonusTeamSafety&&team.id!==hoh.teamId?`${team.name} remain safe for Week 2 because their captain won Double or Nothing on premiere night.`:`${team.name} are safe from nomination because ${displayName(hoh)} is HOH.`]});
    });
  }

  function wildcardEligibleMember(s,t){
    const active=t.memberIds.map(id=>hg(s,id)).filter(p=>p?.active);
    let available=active.filter(p=>!s._wildcardPlayed[p.id]);
    if(!available.length)available=active;
    if(!available.length)return null;
    return available.slice().sort((a,b)=>((b.ratings.general+b.ratings.social+b.ratings.strategic)+Math.random()*25)-((a.ratings.general+a.ratings.social+a.ratings.strategic)+Math.random()*25))[0];
  }

  function runWildcard(s,week){
    if(week>4)return;
    const hoh=hg(s,s.currentHOH);
    const eligibleTeams=s.teams.filter(t=>t.id!==hoh?.teamId);
    const teamEntries=[];
    eligibleTeams.forEach(t=>{const rep=wildcardEligibleMember(s,t);if(rep){s._wildcardPlayed[rep.id]=true;teamEntries.push({teamId:t.id,teamName:t.name,competitorId:rep.id});}});
    if(teamEntries.length<3)return;
    const competitors=teamEntries.map(x=>hg(s,x.competitorId));
    const comp=C().runCompetition(competitors,{week,type:"wildcard"});
    const winner=comp.winner;
    let accepts=true,decisionLines=[];

    if(week===1){
      accepts=Math.random()<.90;
      if(accepts){
        winner.safe=true;
        const teammates=shuffle(teamOf(s,winner).memberIds.map(id=>hg(s,id)).filter(p=>p?.active&&p.id!==winner.id));
        const n=1+Math.floor(Math.random()*3);
        const saved=teammates.slice(0,Math.min(n,teammates.length));saved.forEach(p=>p.safe=true);
        decisionLines=[`${displayName(winner)} accepts individual safety and spins the Wildcard wheel.`,`The wheel grants safety to ${saved.length} teammate${saved.length===1?"":"s"}: ${saved.map(displayName).join(", ")}.`];
      }else decisionLines=[`${displayName(winner)} declines the Week 1 Wildcard safety offer.`];
    }else if(week===2){
      accepts=Math.random()<clamp(.35+winner.ratings.strategic/250,.25,.75);
      if(accepts){
        const oldTeam=teamOf(s,winner),hohTeam=teamOf(s,hoh);
        const swapPool=hohTeam.memberIds.map(id=>hg(s,id)).filter(p=>p?.active&&p.id!==hoh.id&&String(p.gender||'').toLowerCase()===String(winner.gender||'').toLowerCase());
        const swapped=pick(swapPool);
        if(swapped){
          oldTeam.memberIds=oldTeam.memberIds.filter(id=>id!==winner.id);hohTeam.memberIds=hohTeam.memberIds.filter(id=>id!==swapped.id);
          oldTeam.memberIds.push(swapped.id);hohTeam.memberIds.push(winner.id);swapped.teamId=oldTeam.id;winner.teamId=hohTeam.id;
          winner.safe=true;swapped.safe=false;
          decisionLines=[`${displayName(winner)} accepts safety and must switch teams.`,`${displayName(winner)} joins the ${hohTeam.name}; ${displayName(swapped)} moves to the ${oldTeam.name} and loses the HOH-team immunity.`];
        }else{winner.safe=true;decisionLines=[`${displayName(winner)} accepts the Week 2 Wildcard safety.`];}
      }else decisionLines=[`${displayName(winner)} declines the offer and stays on the ${teamOf(s,winner)?.name}.`];
    }else if(week===3){
      accepts=Math.random()<.55;
      if(accepts){
        winner.safe=true;
        const otherTeams=s.teams.filter(t=>t.id!==winner.teamId&&t.id!==hoh.teamId);
        const extra=[];otherTeams.forEach(t=>{const p=pick(t.memberIds.map(id=>hg(s,id)).filter(x=>x?.active&&!x.safe));if(p){p.safe=true;extra.push(p);}});
        decisionLines=[`${displayName(winner)} accepts safety.`,`As the Week 3 consequence, ${extra.length?extra.map(displayName).join(" and ")+" also receive":"no additional houseguests receive"} immunity through the game of chance.`];
      }else decisionLines=[`${displayName(winner)} declines safety, preventing the other vulnerable teams from gaining bonus immunity.`];
    }else{
      const team=teamOf(s,winner);
      const chooseLong=winner.ratings.strategic>=winner.ratings.social||Math.random()<.55;
      winner.safe=true;
      if(chooseLong){winner.wildcardSafetyUntilWeek=5;decisionLines=[`${displayName(winner)} chooses individual safety through the start of jury.`,`This protects ${displayName(winner)} in Week 4 and Week 5.`];}
      else{const ms=team.memberIds.map(id=>hg(s,id)).filter(p=>p?.active);ms.forEach(p=>p.safe=true);decisionLines=[`${displayName(winner)} chooses safety for the entire ${team.name} for Week 4.`,`${ms.map(displayName).join(", ")} are immune.`];}
    }
    log(s,{week,phase:"team",type:"wildcard",winnerId:winner.id,participants:competitors.map(p=>p.id),competitorIds:competitors.map(p=>p.id),eligibleTeamIds:teamEntries.map(x=>x.teamId),wildcardTeams:teamEntries,safetyAccepted:accepts,competition:comp,title:`Wildcard Competition — ${comp.label}`,lines:[`${teamEntries.map(x=>`${x.teamName}: ${displayName(hg(s,x.competitorId))}`).join(" • ")}`,`${displayName(winner)} wins the Wildcard.`,...decisionLines]});
  }


  /* ---------------------------- NOMINATIONS ---------------------------- */
  function chooseNominees(s,hoh){let pool=living(s).filter(p=>p.id!==hoh.id&&!p.safe);if(pool.length<2)pool=living(s).filter(p=>p.id!==hoh.id);return (R()?.pickNominees?safePickNominees():shuffle(pool).slice(0,2));function safePickNominees(){try{return R().pickNominees(s,hoh,pool,Math.min(2,pool.length));}catch(e){return shuffle(pool).slice(0,2);}}}
  function planTarget(s,hoh,noms){const ranked=noms.map(p=>({p,score:relationshipScore(s,hoh,p)})).sort((a,b)=>a.score-b.score);const target=ranked[0]?.p;const back= living(s).filter(p=>p.id!==hoh.id&&!noms.includes(p)&&!p.safe).sort((a,b)=>relationshipScore(s,hoh,a)-relationshipScore(s,hoh,b))[0];return {text:target?displayName(target):null,back};}
  function runNominations(s,week){const hoh=hg(s,s.currentHOH);let noms=chooseNominees(s,hoh);noms.forEach(n=>n.nominated=true);s.nominees=noms.map(n=>n.id);const plan=planTarget(s,hoh,noms);s.intendedTarget=plan.text;s.backdoorTargetId=plan.back?.id||null;s.targetHistory=[{text:plan.text,reason:"Initial target"}];log(s,{week,phase:"standard",type:"nominations",hohId:hoh.id,nomineeIds:s.nominees,intendedTarget:s.intendedTarget,backdoorTargetId:s.backdoorTargetId,targetHistory:s.targetHistory,title:"Nomination Ceremony",lines:[`${displayName(hoh)} nominates ${noms.map(displayName).join(" and ")} for eviction.`]});}

  function selectPOVPlayers(s,week){
    const noms=s.nominees.map(id=>hg(s,id)).filter(Boolean),hoh=hg(s,s.currentHOH);
    const pool=[hoh,...noms,...shuffle(living(s).filter(p=>!noms.includes(p)&&p.id!==hoh.id)).slice(0,Math.max(0,6-1-noms.length))];
    s.povPlayers=pool.map(p=>p.id);
    log(s,{week,phase:"standard",type:"pov-players",hohId:hoh.id,nomineeIds:s.nominees,povPlayers:s.povPlayers,participants:s.povPlayers,title:"POV Picked Players",lines:[`${displayName(hoh)} and the nominees are automatically selected; the remaining slots are randomly drawn.`]});
    return pool;
  }
  function runPOVCompetition(s,week,pool){
    const comp=C().runCompetition(pool,{week,type:"pov"}),winner=comp.winner;s.vetoWinners=[winner.id];
    log(s,{week,phase:"standard",type:"veto",winnerId:winner.id,participants:pool.map(p=>p.id),competition:comp,title:`Power of Veto — ${comp.label}`,lines:[`${displayName(winner)} wins the Power of Veto.`]});
    return {pool,winner};
  }

  function applyVeto(s,week,veto){
    let noms=s.nominees.map(id=>hg(s,id)).filter(Boolean);
    const hoh=hg(s,s.currentHOH);
    const actions=[];
    const second=s.powers.find(p=>p.type==="secondVeto"&&!p.used&&Number(p.expiresWeek)>=week);
    const holders=[];
    if(second){const owner=hg(s,second.ownerId);if(owner)holders.push({holder:owner,second:true});}
    holders.push({holder:veto.winner,second:false});
    for(const x of holders){
      const decision=R().decideVetoUse?R().decideVetoUse(s,x.holder,hoh,noms):{use:Math.random()<.4,saveId:noms[0]?.id};
      if(!decision.use||!decision.saveId)continue;
      const saved=hg(s,decision.saveId);if(!saved)continue;
      saved.nominated=false;noms=noms.filter(n=>n.id!==saved.id);
      const pool=living(s).filter(p=>p.id!==hoh.id&&!p.safe&&!noms.includes(p)&&p.id!==saved.id);
      const replacement=pick(pool);
      if(replacement){replacement.nominated=true;noms.push(replacement);}
      if(x.second){second.used=true;actions.push(`${displayName(x.holder)} uses the Second Veto on ${displayName(saved)}${replacement?`; ${displayName(hoh)} names ${displayName(replacement)} as the replacement nominee.`:"."}`);}
      else actions.push(`${displayName(x.holder)} uses the Power of Veto on ${displayName(saved)}${replacement?`; ${displayName(hoh)} names ${displayName(replacement)} as the replacement nominee.`:"."}`);
    }
    s.nominees=noms.map(n=>n.id);
    log(s,{week,phase:"standard",type:"veto-ceremony",hohId:hoh.id,winnerId:veto.winner.id,nomineeIds:s.nominees,finalNomineeIds:s.nominees,vetoUsed:actions.length>0,participants:[hoh.id,veto.winner.id,...s.nominees],title:actions.length?"Veto Ceremony — Used":"Veto Ceremony — Not Used",lines:actions.length?actions:[`${displayName(veto.winner)} does not use the Power of Veto.`]});
  }
  function evictionCycle(s,week,cycle=1){
    if(s.nominees.length<2){const hoh=hg(s,s.currentHOH);const fill=living(s).filter(p=>p.id!==hoh.id&&!p.safe&&!s.nominees.includes(p.id));while(s.nominees.length<2&&fill.length){const p=fill.shift();p.nominated=true;s.nominees.push(p.id);}}
    const noms=s.nominees.map(id=>hg(s,id)).filter(Boolean).slice(0,2);s.nominees=noms.map(n=>n.id);const hoh=hg(s,s.currentHOH);const nomineeIds=new Set(noms.map(n=>n.id));const voters=living(s).filter(p=>p.id!==hoh.id&&!nomineeIds.has(p.id));const counts={[noms[0].id]:0,[noms[1].id]:0};s.evictionVotes=[];voters.forEach(v=>{let out=R().decideVote(s,v,noms[0],noms[1],hoh);if(!(out in counts))out=noms[0].id;counts[out]++;s.evictionVotes.push({voterId:v.id,targetId:out});});if(voters.length>=2&&(counts[noms[0].id]===0||counts[noms[1].id]===0)){const losingId=counts[noms[0].id]===0?noms[0].id:noms[1].id;const otherId=losingId===noms[0].id?noms[1].id:noms[0].id;const flip=voters.slice().sort((a,b)=>{const da=R().decideVote(s,a,noms[0],noms[1],hoh)===losingId?0:1;const db=R().decideVote(s,b,noms[0],noms[1],hoh)===losingId?0:1;return da-db;})[0];if(flip){const vote=s.evictionVotes.find(v=>v.voterId===flip.id);if(vote){vote.targetId=losingId;counts[otherId]--;counts[losingId]++;}}}const evictedId=counts[noms[0].id]>=counts[noms[1].id]?noms[0].id:noms[1].id;const evicted=hg(s,evictedId);const stay=noms.find(n=>n.id!==evictedId);log(s,{week,phase:cycle>1?"double-eviction":"standard",type:"eviction-voting",nomineeIds:s.nominees,voterIds:voters.map(v=>v.id),votes:s.evictionVotes,title:`${cycle>1?"Double Eviction — ":""}Eviction Vote`,lines:s.evictionVotes.map(v=>`${displayName(hg(s,v.voterId))} votes to evict ${displayName(hg(s,v.targetId))}.`)});
    evicted.active=false;evicted.evicted=true;s.season.evictionCount++;evicted.placement=s.season.castSize-s.season.evictionCount+1;const juryThreshold=11;if(evicted.placement<=juryThreshold&&!s.jury.includes(evicted.id)){evicted.juryMember=true;s.jury.push(evicted.id);}s.evicted.push(evicted.id);
    log(s,{week,phase:cycle>1?"double-eviction":"standard",type:"eviction",evictedId:evicted.id,voteCounts:counts,evictedVoteCount:counts[evicted.id],stayVoteCount:counts[stay.id],nomineeIds:s.nominees,title:"Eviction",lines:[`By a vote of ${counts[evicted.id]} to ${counts[stay.id]}, ${displayName(evicted)}, you have been evicted.`,evicted.juryMember?`${displayName(evicted)} joins the jury.`:`${displayName(evicted)} finishes in ${ordinal(evicted.placement)} place.`]});
    s.nominees=[];s.povPlayers=[];s.vetoWinners=[];s.evictionVotes=[];return evicted;
  }

  function runCycle(s,config,week,cycle=1){s.week=week;s.phase=cycle>1?"double-eviction":"in-season";s.houseguests.forEach(h=>{h.safe=Number(h.wildcardSafetyUntilWeek||0)>=Number(week);h.nominated=false;});
    let hoh;
    if(week===1)hoh=hg(s,s.currentHOH);else{const prev=hg(s,s.currentHOH);let pool=living(s).filter(p=>p.id!==prev?.id);if(s.coinState&&s.coinState.week===week-1){const dethroned=hg(s,s.coinState.dethronedId);if(dethroned&&dethroned.active&&!pool.includes(dethroned))pool.push(dethroned);}const comp=C().runCompetition(pool,{week,type:cycle>1?"hoh-de":"hoh"});hoh=comp.winner;s.currentHOH=hoh.id;s.originalHOH=hoh.id;log(s,{week,phase:cycle>1?"double-eviction":week<=4?"team":"standard",type:cycle>1?"hoh-de":"hoh",winnerId:hoh.id,participants:pool.map(p=>p.id),competition:comp,title:`Head of Household — ${comp.label}`,lines:[`${displayName(hoh)} wins HOH.`]});}
    if(week<=4)markTeamSafety(s,hoh,week);
    if(week<=4)runWildcard(s,week);
    runNominations(s,week);
    // High Roller's Room powers occur after nominations and before POV.
    if(week>=6&&week<=8){awardBucks(s,week);if(week===7)runChoppingBlock(s,week);if(week===8){awardWeek8Envelopes(s,week);runCoinOfDestiny(s,week);}}
    hoh=hg(s,s.currentHOH);
    if(week===8&&s.coinState?.week===week&&s.coinState.won&&s.nominees.length<2)runNominations(s,week);
    const povPool=selectPOVPlayers(s,week);
    const derby=week===6?runVetoDerby(s,week):null;
    const veto=runPOVCompetition(s,week,povPool);
    if(week===6)resolveVetoDerby(s,week,derby,veto.winner);
    applyVeto(s,week,veto);
    evictionCycle(s,week,cycle);
    if(week===9&&cycle===1||week===10&&cycle===1){
      // Start the second cycle immediately. There is no normal inter-week HOH.
      runCycle(s,config,week,2);
    }
  }

  /* ----------------------------- FINALE -------------------------------- */
  function runFinale(s){s.week="Final";s.phase="finale";const three=living(s);if(three.length!==3)return;const p1=C().runCompetition(three,{week:12,type:"final-hoh-1"});log(s,{week:"Final",phase:"finale",type:"final3-part1",winnerId:p1.winner.id,participants:three.map(p=>p.id),competition:p1,title:`Final HOH Part 1 — ${p1.label}`,lines:[`${displayName(p1.winner)} wins Part 1 and advances.`]});const rem=three.filter(p=>p.id!==p1.winner.id);const p2=C().runCompetition(rem,{week:12,type:"final-hoh-2"});log(s,{week:"Final",phase:"finale",type:"final3-part2",winnerId:p2.winner.id,participants:rem.map(p=>p.id),competition:p2,title:`Final HOH Part 2 — ${p2.label}`,lines:[`${displayName(p2.winner)} wins Part 2.`]});const p3=C().runCompetition([p1.winner,p2.winner],{week:12,type:"final-hoh-3"});const finalHoh=p3.winner;const other=three.filter(p=>p.id!==finalHoh.id);const chosen=R().decideFinalTwoPick(s,finalHoh,other);const third=other.find(p=>p.id!==chosen.id);log(s,{week:"Final",phase:"finale",type:"final3-part3",winnerId:finalHoh.id,participants:[p1.winner.id,p2.winner.id],competition:p3,title:`Final HOH Part 3 — ${p3.label}`,lines:[`${displayName(finalHoh)} wins Part 3 and becomes the final HOH.`]});third.active=false;third.evicted=true;third.placement=3;third.juryMember=true;if(!s.jury.includes(third.id))s.jury.push(third.id);s.evicted.push(third.id);s.currentHOH=finalHoh.id;log(s,{week:"Final",phase:"finale",type:"final-decision",hohId:finalHoh.id,thirdPlaceId:third.id,finalistIds:[finalHoh.id,chosen.id],title:"Final HOH's Decision",lines:[`${displayName(finalHoh)} takes ${displayName(chosen)} to the Final 2 and evicts ${displayName(third)}.`,`${displayName(third)} finishes in 3rd place and joins the jury.`]});const finalists=[finalHoh,chosen],jurors=s.jury.map(id=>hg(s,id)).filter(Boolean),tally={[finalists[0].id]:0,[finalists[1].id]:0};s._juryVotes=[];jurors.forEach(j=>{const vote=R().decideJuryVote(s,j,finalists[0],finalists[1]);tally[vote]++;s._juryVotes.push({voterId:j.id,targetId:vote});});log(s,{week:"Final",phase:"finale",type:"jury-vote",votes:s._juryVotes,finalistIds:finalists.map(p=>p.id),title:"The Jury Votes",lines:s._juryVotes.map(v=>`${displayName(hg(s,v.voterId))} votes for ${displayName(hg(s,v.targetId))}.`)});const winnerId=tally[finalists[0].id]>=tally[finalists[1].id]?finalists[0].id:finalists[1].id;const runnerId=winnerId===finalists[0].id?finalists[1].id:finalists[0].id;hg(s,winnerId).placement=1;hg(s,runnerId).placement=2;hg(s,winnerId).active=false;hg(s,runnerId).active=false;
    const afpCandidates=s.houseguests.slice();
    const afpScores=afpCandidates.map(h=>{const others=afpCandidates.filter(x=>x.id!==h.id);const social=Number(h.ratings?.social||50),general=Number(h.ratings?.general||50);const avgRel=others.length?others.reduce((sum,o)=>sum+relationshipScore(s,h,o),0)/others.length:50;return {id:h.id,score:social*.45+general*.20+avgRel*.20+Math.random()*15};}).sort((a,b)=>b.score-a.score);
    const afpId=afpScores[0]?.id||winnerId;const raw={};afpScores.forEach(x=>raw[x.id]=Math.max(.5,x.score));const total=Object.values(raw).reduce((a,b)=>a+b,0)||1;const afpVotes={};Object.keys(raw).forEach(id=>afpVotes[id]=Math.max(1,Math.round(raw[id]/total*100000)));const voteTotal=Object.values(afpVotes).reduce((a,b)=>a+b,0);afpVotes[afpId]+=(100000-voteTotal);
    s.finale={winnerId,runnerUpId:runnerId,thirdPlaceId:third.id,finalHohId:finalHoh.id,votes:tally,jurySize:jurors.length,prize:750000,runnerUpPrize:75000,americasFavoritePrize:50000,americasFavoriteId:afpId,americasFavoriteVotes:afpVotes};s.phase="complete";log(s,{week:"Final",phase:"finale",type:"winner",winnerId,runnerUpId:runnerId,thirdPlaceId:third.id,finalistIds:[winnerId,runnerId],afpId,afpVotes,title:`${displayName(hg(s,winnerId))} Wins Big Brother!`,lines:[`By a vote of ${tally[winnerId]}-${tally[runnerId]}, ${displayName(hg(s,winnerId))} wins Big Brother.`,`${displayName(hg(s,runnerId))} finishes as the Runner-Up and receives $75,000.`,`America's Favorite Player: ${displayName(hg(s,afpId))} wins $50,000.`]});}
  function simulateSeason(s,config){
    ensureState(s);s.history=[];s.jury=[];s.evicted=[];s.evictionVotes=[];s.nominees=[];s.povPlayers=[];s.vetoWinners=[];s.currentHOH=null;s.originalHOH=null;s.secretHOH=null;s.dethronedHOH=null;s.finale=null;s.bbBucks={};s.powers=[];s.coinState=null;s._playedHighRollerWeeks={};s._wildcardPlayed={};s._week2BonusTeamSafety=null;s._week8EnvelopesAwarded=false;s.season.evictionCount=0;s.teams=config.teams.map(t=>({id:t.id,name:t.name,colorClass:t.colorClass||t.id,captainId:null,memberIds:[]}));s.houseguests.forEach(h=>{h.active=true;h.safe=false;h.nominated=false;h.juryMember=false;h.evicted=false;h.placement=null;h.teamId=null;h.teamCaptain=false;h.wildcardSafetyUntilWeek=0;});
    runPremiere(s,config);let week=1;let guard=0;while(living(s).length>3&&week<=30&&guard<30){runCycle(s,config,week,1);week++;guard++;}runFinale(s);if(window.LiveFeeds?.addToSeason)window.LiveFeeds.addToSeason(s);return s;
  }
  window.SeasonEngine={simulateSeason,displayName,ordinal};
})();
