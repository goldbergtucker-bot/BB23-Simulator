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
    if(e.type==="eviction-voting"){d.votes=(e.votes||s.evictionVotes||[]).map(v=>({...v}));d.voterIds=d.votes.map(v=>v.voterId);}
    if(e.type==="eviction"){d.voteCounts={...(e.voteCounts||{})};d.evictedVoteCount=Number(e.evictedVoteCount||0);d.stayVoteCount=Number(e.stayVoteCount||0);d.nomineeIds=ids(e.nomineeIds||s.nominees);}
    if(e.type==="jury-vote")d.votes=(s._juryVotes||[]).map(v=>({...v})),d.voterIds=d.votes.map(v=>v.voterId),d.finalistIds=living(s).map(h=>h.id);
    if(e.type==="final-decision")d.finalistIds=living(s).map(h=>h.id);
    return d;
  }
  function log(s,e){const r={id:s.history.length+1,...e};r.snapshot=snapshot(s);r.data=eventData(s,r);s.history.push(r);}

  function ensureState(s){
    s.bbBucks=s.bbBucks||{};s.powers=Array.isArray(s.powers)?s.powers:[];s.evicted=Array.isArray(s.evicted)?s.evicted:[];s.jury=Array.isArray(s.jury)?s.jury:[];
    s.nominees=s.nominees||[];s.povPlayers=s.povPlayers||[];s.vetoWinners=s.vetoWinners||[];s.evictionVotes=s.evictionVotes||[];s.teams=s.teams||[];s.history=s.history||[];
    s.coinState=s.coinState||null;s._playedHighRollerWeeks=s._playedHighRollerWeeks||{};
    s.houseguests.forEach(h=>{h.gender=h.gender||"";h.teamCaptain=!!h.teamCaptain;h.allianceIds=h.allianceIds||[];h.ratings=h.ratings||{general:50,physical:50,mental:50,social:50,strategic:50};});
  }

  function relationshipScore(s,a,b){const r=s.relationships?.[a.id]?.[b.id]||{friendship:50,trust:50,loyalty:50,respect:50,attraction:0,rivalry:0};return (r.friendship||0)*.30+(r.trust||0)*.25+(r.loyalty||0)*.15+(r.respect||0)*.20+(r.attraction||0)*.10-(r.rivalry||0)*.35;}
  function randomizeRelationships(s){if(s.season.relationshipsRandomized||s.season.relationshipsCustomized)return;s.houseguests.forEach(a=>s.houseguests.forEach(b=>{if(a.id===b.id)return;const r=s.relationships[a.id][b.id];const n=()=>Math.round(Math.random()*40-20);r.friendship=clamp(r.friendship+n(),15,85);r.trust=clamp(r.trust+n(),15,85);r.loyalty=clamp(r.loyalty+n(),15,85);r.respect=clamp(r.respect+n(),15,85);r.rivalry=Math.round(Math.random()*25);r.attraction=Math.round(Math.random()*30);}));s.season.relationshipsRandomized=true;}

  /* ----------------------------- TEAMS -------------------------------- */
  function draftTeams(s){
    // Preserve a complete custom team setup.  The previous version checked
    // whether the teams were complete and then immediately erased memberIds,
    // which made valid saved rosters look empty and prevented Team Safety and
    // Wildcard from running.
    const existing=s.teams.length===4&&s.teams.every(t=>Array.isArray(t.memberIds)&&t.memberIds.length===4&&t.memberIds.every(id=>hg(s,id)));
    if(existing){
      s.teams.forEach((t,i)=>{
        t.name=TEAM_NAMES[i]||t.name;
        t.memberIds=t.memberIds.slice(0,4);
        const members=t.memberIds.map(id=>hg(s,id)).filter(Boolean);
        const cap=hg(s,t.captainId)||members.find(p=>p.teamCaptain)||members.sort((a,b)=>b.ratings.general-a.ratings.general)[0];
        members.forEach(p=>{p.teamId=t.id;p.teamCaptain=false;});
        if(cap){cap.teamCaptain=true;t.captainId=cap.id;}
      });
      log(s,{week:0,phase:"premiere",type:"teams",title:"Move-In — Custom Team Rosters",participants:s.houseguests.map(h=>h.id),lines:s.teams.map(t=>`${t.name}: ${t.memberIds.map(id=>displayName(hg(s,id))).join(", ")} (Captain: ${displayName(hg(s,t.captainId))})`)});
      return;
    }
    s.houseguests.forEach(h=>{h.teamId=null;h.teamCaptain=false;});
    const pool=shuffle(living(s));
    const groups=[];for(let i=0;i<4;i++)groups.push(pool.splice(0,4));
    const captains=[];
    groups.forEach((group,i)=>{
      const comp=C().runCompetition(group,{week:0,type:"team-captain",category:"general",label:`${TEAM_NAMES[i]} Captain Competition`,description:"Four houseguests compete for the right to become a Team Captain.",noiseMin:.9,noiseMax:1.1});
      const cap=comp.winner;captains.push(cap);s.teams[i].captainId=cap.id;s.teams[i].memberIds=[cap.id];cap.teamId=s.teams[i].id;cap.teamCaptain=true;
      log(s,{week:0,phase:"premiere",type:"team-captain",winnerId:cap.id,participants:group.map(p=>p.id),competition:comp,title:`${TEAM_NAMES[i]} Captain Competition`,lines:[`${displayName(cap)} wins the four-person competition and becomes the ${TEAM_NAMES[i]} Captain.`]});
    });
    let remaining=shuffle(living(s).filter(p=>!captains.includes(p)));
    // Captains choose three teammates. A snake order prevents the first captain
    // from receiving all of the strongest available players.
    let round=0;
    while(remaining.length){
      const order=round%2===0?s.teams:s.teams.slice().reverse();
      for(const t of order){
        if(t.memberIds.length>=4)continue;
        const members=t.memberIds.map(id=>hg(s,id));
        const maleCount=members.filter(p=>p.gender==="male").length;
        const femaleCount=members.filter(p=>p.gender==="female").length;
        const preferredGender=maleCount>=2?"female":femaleCount>=2?"male":null;
        const candidates=remaining.filter(p=>preferredGender&&p.gender?p.gender===preferredGender:true);
        const pool=candidates.length?candidates:remaining;
        const captain=hg(s,t.captainId);
        pool.sort((a,b)=>{
          const sa=a.ratings.social*.4+a.ratings.strategic*.3+a.ratings.general*.2+a.ratings.physical*.1+(Math.random()*8-4);
          const sb=b.ratings.social*.4+b.ratings.strategic*.3+b.ratings.general*.2+b.ratings.physical*.1+(Math.random()*8-4);
          return sb-sa;
        });
        const chosen=pool[0];
        t.memberIds.push(chosen.id);chosen.teamId=t.id;remaining=remaining.filter(p=>p.id!==chosen.id);
        log(s,{week:0,phase:"premiere",type:"team-draft",winnerId:chosen.id,participants:[captain.id,chosen.id],title:`${t.name} — Team Captain Draft Pick`,lines:[`${displayName(captain)} selects ${displayName(chosen)} for the ${t.name}.` ]});
      }
      round++;
    }
    log(s,{week:0,phase:"premiere",type:"teams",title:"Teams Complete",participants:s.houseguests.map(h=>h.id),lines:s.teams.map(t=>`${t.name}: ${t.memberIds.map(id=>displayName(hg(s,id))).join(", ")} (Captain: ${displayName(hg(s,t.captainId))})`)});
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
    if(!eligible.length)return;
    const entries=eligible.filter(p=>{const chance=clamp(.25+p.ratings.strategic/200,.25,.75);if(Math.random()>chance)return false;s.bbBucks[p.id]-=50;return true;});
    if(!entries.length)return;
    const scores=entries.map(p=>({p,score:(p.ratings.strategic*.55+p.ratings.physical*.25+p.ratings.mental*.20)+Math.random()*25})).sort((a,b)=>b.score-a.score);
    const qualifiers=scores.slice(0,6).map(x=>x.p);
    const povPlayers=s.povPlayers.map(id=>hg(s,id)).filter(Boolean).slice(0,6);
    const bettable=povPlayers.filter(Boolean);
    const bettor=qualifiers[0];
    const betTarget=pick(bettable);
    const povWinner=hg(s,s.vetoWinners[0]);
    const secondVeto=!!(bettor&&betTarget&&povWinner&&betTarget.id===povWinner.id);
    if(secondVeto)awardPower(s,bettor,"secondVeto",week,{expiresWeek:week,betTargetId:betTarget.id});
    const comp={name:"Veto Derby",label:"Veto Derby",description:"Players spend 50 BB Bucks. The six highest scores qualify to place a bet on one of the six Power of Veto players.",category:"strategic",official:true,week,ranking:scores.map(x=>({id:x.p.id,score:Math.round(x.score*10)/10})),winner:bettor};
    log(s,{week,phase:"high-roller",type:"veto-derby",winnerId:bettor?.id||null,participants:entries.map(p=>p.id),competition:comp,title:"High Roller's Room — Veto Derby",lines:[`${entries.length} houseguests spend 50 BB Bucks to enter Veto Derby.`,`The top six scorers qualify to bet on the six POV players.`,bettor?`${displayName(bettor)} places the featured bet on ${betTarget?displayName(betTarget):"a POV player"}.`:`No bettor is available.`,secondVeto?`${displayName(bettor)} wins a Second Veto because ${displayName(povWinner)} wins the Power of Veto.`:`The featured bet does not produce a Second Veto.`]});
  }

  function runChoppingBlock(s,week){
    awardBucks(s,week);const eligible=living(s).filter(p=>(s.bbBucks[p.id]||0)>=125);if(!eligible.length)return;
    const players=shuffle(eligible).filter(p=>Math.random()<clamp(.2+p.ratings.strategic/180,.2,.75));if(!players.length)return;
    const comp=C().runCompetition(players,{week,type:"high-roller",category:"strategic",label:"Chopping Block Roulette",description:"Players spend 125 BB Bucks. The winner may remove an initial nominee, then roulette determines the replacement nominee."});
    const winner=comp.winner; s.bbBucks[winner.id]-=125;
    const initial=(s.nominees||[]).map(id=>hg(s,id)).filter(Boolean);const removable=initial.length?pick(initial):null;
    let removed=null,replacement=null;
    if(removable){removed=removable;removable.nominated=false;s.nominees=s.nominees.filter(id=>id!==removed.id);removed.safe=true;const pool=living(s).filter(p=>p.id!==s.currentHOH&&!p.safe&&!s.nominees.includes(p.id)&&p.id!==removed.id);replacement=pick(pool);if(replacement){replacement.nominated=true;s.nominees.push(replacement.id);}}
    awardPower(s,winner,"rouletteUsed",week,{expiresWeek:week,removedId:removed?.id||null,replacementId:replacement?.id||null});
    log(s,{week,phase:"high-roller",type:"chopping-block-roulette",winnerId:winner.id,participants:players.map(p=>p.id),competition:comp,removedId:removed?.id||null,replacementId:replacement?.id||null,title:"High Roller's Room — Chopping Block Roulette",lines:[`${displayName(winner)} spends 125 BB Bucks and wins Chopping Block Roulette.`,removed?`${displayName(winner)} removes ${displayName(removed)} from the block. ${displayName(removed)} is safe for the remainder of the week.`:`No initial nominee was available to remove.`,replacement?`The roulette names ${displayName(replacement)} as the replacement nominee.`:`No replacement nominee is required.`]});
  }

  function runCoinOfDestiny(s,week){
    awardBucks(s,week);const eligible=living(s).filter(p=>(s.bbBucks[p.id]||0)>=250);if(!eligible.length)return;
    const entrants=eligible.filter(p=>Math.random()<clamp(.15+p.ratings.strategic/220,.15,.65));if(!entrants.length)return;
    const comp=C().runCompetition(entrants,{week,type:"high-roller",category:"strategic",label:"Coin of Destiny",description:"Players spend 250 BB Bucks for the right to challenge the reigning HOH to a coin toss."});
    const challenger=comp.winner;s.bbBucks[challenger.id]-=250;const sitting=hg(s,s.currentHOH);const call=Math.random()<.5;const coin=Math.random()<.5;const won=call===coin;
    log(s,{week,phase:"high-roller",type:"coin-of-destiny",winnerId:challenger.id,participants:entrants.map(p=>p.id),competition:comp,title:"High Roller's Room — Coin of Destiny",lines:[`${displayName(challenger)} wins the Coin of Destiny challenge and challenges ${displayName(sitting)}.`,`The coin toss is called ${call?"correctly":"incorrectly"}; the coin lands ${coin?"heads":"tails"}.`,won?`${displayName(challenger)} dethrones ${displayName(sitting)} and secretly becomes the new HOH.`:`${displayName(sitting)} remains HOH.`]});
    if(won&&sitting){s.dethronedHOH=sitting.id;s.originalHOH=sitting.id;s.currentHOH=challenger.id;s.secretHOH=challenger.id;s.coinState={week,challengerId:challenger.id,dethronedId:sitting.id,won:true};sitting.safe=true;challenger.safe=false;s.nominees.forEach(id=>{const n=hg(s,id);if(n)n.nominated=false;});s.nominees=[];log(s,{week,phase:"high-roller",type:"coin-renomination",winnerId:challenger.id,hohId:challenger.id,title:"Coin of Destiny — Secret HOH Re-Nomination",lines:[`${displayName(challenger)} anonymously takes over as HOH.`,`The existing nominations are wiped away. The dethroned HOH remains immune and may compete in the next HOH.`]});}
  }

  /* ----------------------------- PREMIERE ------------------------------ */
  function runPremiere(s,config){
    s.week=0;s.phase="premiere";s.season.castSize=s.houseguests.length;s.season.evictionCount=0;randomizeRelationships(s);draftTeams(s);
    const field=living(s);const comp=C().runCompetition(field,{week:1,type:"hoh"});let first=comp.winner;s.currentHOH=first.id;s.originalHOH=first.id;
    log(s,{week:1,phase:"premiere",type:"hoh",winnerId:first.id,participants:field.map(p=>p.id),competition:comp,title:`Premiere HOH — ${comp.label}`,lines:[`${displayName(first)} wins the first Head of Household competition.`]});
    const accept=Math.random()<clamp(.35+first.ratings.strategic/250,.15,.75);
    if(!accept){first.safe=true;log(s,{week:1,phase:"premiere",type:"double-or-nothing",hohId:first.id,title:"Double or Nothing — Declined",lines:[`${displayName(first)} declines Julie's offer. ${teamOf(s,first)?.name||"Their team"} receives safety for Week 1 only.`]});}
    else {
      const gamble=C().runCompetition(field,{week:1,type:"hoh",category:comp.category,label:"Double or Nothing — Gamble"});
      if(gamble.winner.id===first.id){first.safe=true;s._doubleOrNothing={teamId:first.teamId,hohId:first.id};log(s,{week:1,phase:"premiere",type:"double-or-nothing",winnerId:first.id,title:"Double or Nothing — Accepted & Won",lines:[`${displayName(first)} accepts and wins the gamble. ${teamOf(s,first)?.name||"Their team"} is safe for Weeks 1 and 2, and ${displayName(first)} remains HOH for Week 2.`]});}
      else {const newHoh=gamble?.winner||pick(field.filter(p=>p.id!==first.id));s.dethronedHOH=first.id;s.currentHOH=newHoh.id;newHoh.safe=true;log(s,{week:1,phase:"premiere",type:"double-or-nothing",winnerId:newHoh.id,title:"Double or Nothing — Accepted & Lost",lines:[`${displayName(first)} loses the gamble to ${displayName(newHoh)}. ${displayName(first)} is dethroned and ${displayName(newHoh)} becomes HOH.`]});}
    }
  }

  function markTeamSafety(s,hoh,week){
    if(week>4)return;
    const t=teamOf(s,hoh);
    if(!t)return;
    const safeMembers=t.memberIds.map(id=>hg(s,id)).filter(p=>p?.active);
    safeMembers.forEach(p=>{p.safe=true;});
    log(s,{
      week,phase:"team",type:"team-safety",hohId:hoh.id,
      participants:safeMembers.map(p=>p.id),
      teamId:t.id,teamName:t.name,
      safeMemberIds:safeMembers.map(p=>p.id),
      title:"Team Safety",
      lines:[`${t.name} are safe from nomination because ${displayName(hoh)} is HOH.`]
    });
  }

  function runWildcard(s,week){
    if(week>4)return;
    const hoh=hg(s,s.currentHOH);
    const eligibleTeams=s.teams.filter(t=>t.id!==hoh?.teamId);
    const reps=[];
    const teamEntries=[];
    eligibleTeams.forEach(t=>{
      const ms=t.memberIds.map(id=>hg(s,id)).filter(p=>p?.active&&!p.safe);
      if(!ms.length)return;
      const rep=ms.reduce((a,b)=>
        (b.ratings.general+b.ratings.social)>(a.ratings.general+a.ratings.social)?b:a
      );
      reps.push(rep);
      teamEntries.push({teamId:t.id,teamName:t.name,competitorId:rep.id});
    });
    if(reps.length<3)return;
    const competitors=reps.slice(0,3);
    const comp=C().runCompetition(competitors,{week,type:"wildcard"});
    const winner=comp.winner;
    const accepts=Math.random()<.65;
    let punishment="";
    if(accepts){
      winner.safe=true;
      punishment=Math.random()<.25
        ?`${displayName(winner)} accepts safety and is forced to choose a consequence for another team.`
        :`${displayName(winner)} accepts individual safety; their teammates remain vulnerable.`;
    }else{
      punishment=`${displayName(winner)} declines individual safety.`;
    }
    log(s,{
      week,phase:"team",type:"wildcard",winnerId:winner.id,
      participants:competitors.map(p=>p.id),
      competitorIds:competitors.map(p=>p.id),
      eligibleTeamIds:teamEntries.map(x=>x.teamId),
      wildcardTeams:teamEntries,
      safetyAccepted:accepts,
      competition:comp,
      title:`Wildcard Competition — ${comp.label}`,
      lines:[
        `${teamEntries.map(x=>`${x.teamName}: ${displayName(hg(s,x.competitorId))}`).join(" • ")}`,
        `${displayName(winner)} wins the Wildcard.`,
        punishment
      ]
    });
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
    const second=power(s,veto.winner.id,"secondVeto",week);
    const holders=[];
    if(second){const owner=hg(s,second.ownerId);if(owner&&owner.id!==veto.winner.id)holders.push({holder:owner,second:true});}
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
    const noms=s.nominees.map(id=>hg(s,id)).filter(Boolean).slice(0,2);s.nominees=noms.map(n=>n.id);const hoh=hg(s,s.currentHOH);const nomineeIds=new Set(noms.map(n=>n.id));const voters=living(s).filter(p=>p.id!==hoh.id&&!nomineeIds.has(p.id));const counts={[noms[0].id]:0,[noms[1].id]:0};s.evictionVotes=[];voters.forEach(v=>{let out=R().decideVote(s,v,noms[0],noms[1],hoh);if(!(out in counts))out=noms[0].id;counts[out]++;s.evictionVotes.push({voterId:v.id,targetId:out});});
    // Prevent a broken/flat relationship setup from forcing every vote to the
    // same nominee. If two or more people vote, at least one vote should be
    // capable of breaking from the majority. The voter whose decision was
    // closest gets flipped, preserving the normal social-AI result whenever
    // there is already a split vote.
    if(voters.length>=2 && (counts[noms[0].id]===0 || counts[noms[1].id]===0)){
      const fromId=counts[noms[0].id]===0?noms[1].id:noms[0].id;
      const toId=counts[noms[0].id]===0?noms[0].id:noms[1].id;
      const candidateVotes=s.evictionVotes.filter(v=>v.targetId===fromId);
      if(candidateVotes.length){
        const scored=candidateVotes.map(v=>{const voter=hg(s,v.voterId);const a=R().bondScore(s,voter.id,noms[0].id);const b=R().bondScore(s,voter.id,noms[1].id);return {v,margin:Math.abs(a-b)};}).sort((x,y)=>x.margin-y.margin);
        scored[0].v.targetId=toId;counts[fromId]--;counts[toId]++;
      }
    }
    const evictedId=counts[noms[0].id]>=counts[noms[1].id]?noms[0].id:noms[1].id;const evicted=hg(s,evictedId);const stay=noms.find(n=>n.id!==evictedId);log(s,{week,phase:cycle>1?"double-eviction":"standard",type:"eviction-voting",nomineeIds:s.nominees,voterIds:voters.map(v=>v.id),votes:s.evictionVotes,title:`${cycle>1?"Double Eviction — ":""}Eviction Vote`,lines:s.evictionVotes.map(v=>`${displayName(hg(s,v.voterId))} votes to evict ${displayName(hg(s,v.targetId))}.`)});
    evicted.active=false;evicted.evicted=true;s.season.evictionCount++;evicted.placement=s.season.castSize-s.season.evictionCount+1;const juryThreshold=11;if(evicted.placement<=juryThreshold&&!s.jury.includes(evicted.id)){evicted.juryMember=true;s.jury.push(evicted.id);}s.evicted.push(evicted.id);
    log(s,{week,phase:cycle>1?"double-eviction":"standard",type:"eviction",evictedId:evicted.id,voteCounts:counts,evictedVoteCount:counts[evicted.id],stayVoteCount:counts[stay.id],nomineeIds:s.nominees,title:"Eviction",lines:[`By a vote of ${counts[evicted.id]} to ${counts[stay.id]}, ${displayName(evicted)}, you have been evicted.`,evicted.juryMember?`${displayName(evicted)} joins the jury.`:`${displayName(evicted)} finishes in ${ordinal(evicted.placement)} place.`]});
    s.nominees=[];s.povPlayers=[];s.vetoWinners=[];s.evictionVotes=[];return evicted;
  }

  function runCycle(s,config,week,cycle=1){s.week=week;s.phase=cycle>1?"double-eviction":"in-season";s.houseguests.forEach(h=>{h.safe=false;h.nominated=false;});
    let hoh;
    if(week===1)hoh=hg(s,s.currentHOH);else if(week===2&&s._doubleOrNothing){hoh=hg(s,s._doubleOrNothing.hohId);s.currentHOH=hoh.id;s._doubleOrNothing=null;log(s,{week,phase:"team",type:"hoh",winnerId:hoh.id,title:"HOH Holds Power",lines:[`${displayName(hoh)} remains HOH for Week 2 because of Double or Nothing.`]});}else{const prev=hg(s,s.currentHOH);let pool=living(s).filter(p=>p.id!==prev?.id);if(s.coinState&&s.coinState.week===week-1){const dethroned=hg(s,s.coinState.dethronedId);if(dethroned&&dethroned.active&&!pool.includes(dethroned))pool.push(dethroned);}const comp=C().runCompetition(pool,{week,type:cycle>1?"hoh-de":"hoh"});hoh=comp.winner;s.currentHOH=hoh.id;s.originalHOH=hoh.id;log(s,{week,phase:cycle>1?"double-eviction":week<=4?"team":"standard",type:cycle>1?"hoh-de":"hoh",winnerId:hoh.id,participants:pool.map(p=>p.id),competition:comp,title:`Head of Household — ${comp.label}`,lines:[`${displayName(hoh)} wins HOH.`]});}
    if(week<=4)markTeamSafety(s,hoh,week);
    if(week<=4)runWildcard(s,week);
    runNominations(s,week);
    // High Roller's Room powers occur after nominations and before POV.
    if(week>=6&&week<=8){awardBucks(s,week);if(week===7)runChoppingBlock(s,week);if(week===8)runCoinOfDestiny(s,week);}
    hoh=hg(s,s.currentHOH);
    const povPool=selectPOVPlayers(s,week);
    if(week===6)runVetoDerby(s,week);
    const veto=runPOVCompetition(s,week,povPool);applyVeto(s,week,veto);
    evictionCycle(s,week,cycle);
    if(week===9&&cycle===1||week===10&&cycle===1){
      // Start the second cycle immediately. There is no normal inter-week HOH.
      runCycle(s,config,week,2);
    }
  }

  /* ----------------------------- FINALE -------------------------------- */
  function runFinale(s){s.week="Final";s.phase="finale";const three=living(s);if(three.length!==3)return;const p1=C().runCompetition(three,{week:12,type:"final-hoh-1"});log(s,{week:"Final",phase:"finale",type:"final3-part1",winnerId:p1.winner.id,participants:three.map(p=>p.id),competition:p1,title:`Final HOH Part 1 — ${p1.label}`,lines:[`${displayName(p1.winner)} wins Part 1 and advances.`]});const rem=three.filter(p=>p.id!==p1.winner.id);const p2=C().runCompetition(rem,{week:12,type:"final-hoh-2"});log(s,{week:"Final",phase:"finale",type:"final3-part2",winnerId:p2.winner.id,participants:rem.map(p=>p.id),competition:p2,title:`Final HOH Part 2 — ${p2.label}`,lines:[`${displayName(p2.winner)} wins Part 2.`]});const p3=C().runCompetition([p1.winner,p2.winner],{week:12,type:"final-hoh-3"});const finalHoh=p3.winner;const other=three.filter(p=>p.id!==finalHoh.id);const chosen=R().decideFinalTwoPick(s,finalHoh,other);const third=other.find(p=>p.id!==chosen.id);log(s,{week:"Final",phase:"finale",type:"final3-part3",winnerId:finalHoh.id,participants:[p1.winner.id,p2.winner.id],competition:p3,title:`Final HOH Part 3 — ${p3.label}`,lines:[`${displayName(finalHoh)} wins Part 3 and becomes the final HOH.`]});third.active=false;third.evicted=true;third.placement=3;third.juryMember=true;if(!s.jury.includes(third.id))s.jury.push(third.id);s.evicted.push(third.id);s.currentHOH=finalHoh.id;log(s,{week:"Final",phase:"finale",type:"final-decision",hohId:finalHoh.id,thirdPlaceId:third.id,finalistIds:[finalHoh.id,chosen.id],title:"Final HOH's Decision",lines:[`${displayName(finalHoh)} takes ${displayName(chosen)} to the Final 2 and evicts ${displayName(third)}.`,`${displayName(third)} finishes in 3rd place and joins the jury.`]});const finalists=[finalHoh,chosen],jurors=s.jury.map(id=>hg(s,id)).filter(Boolean),tally={[finalists[0].id]:0,[finalists[1].id]:0};s._juryVotes=[];jurors.forEach(j=>{const vote=R().decideJuryVote(s,j,finalists[0],finalists[1]);tally[vote]++;s._juryVotes.push({voterId:j.id,targetId:vote});});log(s,{week:"Final",phase:"finale",type:"jury-vote",votes:s._juryVotes,finalistIds:finalists.map(p=>p.id),title:"The Jury Votes",lines:s._juryVotes.map(v=>`${displayName(hg(s,v.voterId))} votes for ${displayName(hg(s,v.targetId))}.`)});const winnerId=tally[finalists[0].id]>=tally[finalists[1].id]?finalists[0].id:finalists[1].id;const runnerId=winnerId===finalists[0].id?finalists[1].id:finalists[0].id;hg(s,winnerId).placement=1;hg(s,runnerId).placement=2;hg(s,winnerId).active=false;hg(s,runnerId).active=false;s.finale={winnerId,runnerUpId:runnerId,thirdPlaceId:third.id,finalHohId:finalHoh.id,votes:tally,jurySize:jurors.length,prize:750000,runnerUpPrize:75000,americasFavoritePrize:50000};s.phase="complete";log(s,{week:"Final",phase:"finale",type:"winner",winnerId,runnerUpId:runnerId,thirdPlaceId:third.id,finalistIds:[winnerId,runnerId],title:`${displayName(hg(s,winnerId))} Wins Big Brother!`,lines:[`By a vote of ${tally[winnerId]}-${tally[runnerId]}, ${displayName(hg(s,winnerId))} wins Big Brother.`,`Prize structure: Winner $750,000 · Runner-up $75,000 · America's Favorite $50,000.`]});}

  function simulateSeason(s,config){
    ensureState(s);s.history=[];s.jury=[];s.evicted=[];s.evictionVotes=[];s.nominees=[];s.povPlayers=[];s.vetoWinners=[];s.currentHOH=null;s.originalHOH=null;s.secretHOH=null;s.dethronedHOH=null;s.finale=null;s.bbBucks={};s.powers=[];s.coinState=null;s._playedHighRollerWeeks={};s.season.evictionCount=0;s.houseguests.forEach(h=>{h.active=true;h.safe=false;h.nominated=false;h.juryMember=false;h.evicted=false;h.placement=null;h.teamCaptain=!!h.teamCaptain;});
    runPremiere(s,config);let week=1;let guard=0;while(living(s).length>3&&week<=30&&guard<30){runCycle(s,config,week,1);week++;guard++;}runFinale(s);return s;
  }
  window.SeasonEngine={simulateSeason,displayName,ordinal};
})();
