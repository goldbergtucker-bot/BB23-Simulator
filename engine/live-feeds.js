/*
 * BIG BROTHER 23 CUSTOM SIMULATOR — DETAILED DAILY LIVE FEEDS (V22)
 *
 * Optional presentation/story layer. It never changes competitions, nominees,
 * veto decisions, eviction votes, powers, placements, or the winner.
 * When enabled, it inserts ONE complete live-feed page for each day.
 */
(function(){
  const LiveFeeds={};
  const name=p=>`${p?.firstName||""} ${p?.lastName||""}`.trim()||`Houseguest ${p?.slot||""}`;
  const byId=(s,id)=>s.houseguests.find(p=>p.id===id)||null;
  const pick=a=>a&&a.length?a[Math.floor(Math.random()*a.length)]:null;
  const shuffle=a=>{a=(a||[]).slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const timeLabel=minute=>{const h=Math.floor(minute/60),m=minute%60,ap=h>=12?'PM':'AM',hr=h%12||12;return `${hr}:${String(m).padStart(2,'0')} ${ap} BBT`;};

  function rel(s,a,b){return s.relationships?.[a?.id]?.[b?.id]||{friendship:50,trust:50,loyalty:50,respect:50,attraction:0,rivalry:0,type:'Unspecified'};}
  function socialScore(s,a,b){const r=rel(s,a,b);return (r.friendship||0)*.28+(r.trust||0)*.25+(r.loyalty||0)*.16+(r.respect||0)*.16+(r.attraction||0)*.12-(r.rivalry||0)*.35;}
  function active(s){return s.houseguests.filter(p=>p.active);}
  function closest(s,p,exclude=[]){return active(s).filter(x=>x.id!==p?.id&&!exclude.includes(x.id)).sort((a,b)=>socialScore(s,p,b)-socialScore(s,p,a))[0]||null;}
  function rival(s,p,exclude=[]){return active(s).filter(x=>x.id!==p?.id&&!exclude.includes(x.id)).sort((a,b)=>socialScore(s,p,a)-socialScore(s,p,b))[0]||null;}
  function allianceMate(s,p){const ids=p?.allianceIds||[];return pick(active(s).filter(x=>x.id!==p?.id&&(x.allianceIds||[]).some(id=>ids.includes(id))));}
  function nominees(s){return (s.nominees||[]).map(id=>byId(s,id)).filter(Boolean);}
  function contextProfile(s){return s.season?.liveFeedProfile||{};}
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function contextLines(s){
    const p=contextProfile(s);
    return [
      ['Backstory',p.backstories],['Prior relationship history',p.priorRelationships],['Personality notes',p.personalities],
      ['Conflict / romance context',p.conflictsAndRomance],['Recurring personal topics',p.recurringTopics],['Feed direction',p.feedInstructions]
    ].filter(([,v])=>clean(v)).map(([label,v])=>({label,text:clean(v)}));
  }
  function relevantContext(s,people){
    const names=(people||[]).filter(Boolean).flatMap(p=>[p.firstName,p.lastName]).filter(Boolean).map(x=>x.toLowerCase());
    const pieces=contextLines(s).flatMap(c=>c.text.split(/(?<=[.!?])\s+|\n+/).map(text=>({label:c.label,text:clean(text)})).filter(x=>x.text));
    const specific=pieces.filter(c=>names.some(n=>n.length>2&&c.text.toLowerCase().includes(n)));
    return (specific.length?specific:pieces).slice(0,2);
  }
  function relationshipPhrase(s,a,b){
    const r=rel(s,a,b),t=r.type&&r.type!=='Unspecified'?r.type:null;
    if(t)return `Their configured relationship is ${t.toLowerCase()}, which colors the conversation.`;
    if((r.rivalry||0)>=65)return `There is obvious tension between them, and neither fully relaxes during the conversation.`;
    if((r.trust||0)>=75)return `They speak more openly than they do with most of the house.`;
    if((r.attraction||0)>=65)return `There is noticeable personal chemistry underneath the game talk.`;
    if((r.friendship||0)>=70)return `The conversation has the easy rhythm of two people who genuinely enjoy each other.`;
    return `They keep the conversation measured, mixing personal talk with careful game language.`;
  }
  function ctxSentence(s,people){const c=relevantContext(s,people)[0];return c?` The feed context notes also matter here: ${c.text}`:'';}
  function strategyText(s,a,b,topic){
    const n=nominees(s),hoh=byId(s,s.currentHOH),ally=allianceMate(s,a),enemy=rival(s,a,[b?.id]);
    const A=name(a),B=name(b);
    const base={
      nominations:`${A} and ${B} go over the nomination plan in detail. They compare who has promised safety, who has been unusually quiet, and whether the HOH's stated target matches the conversations happening elsewhere in the house.`,
      veto:`${A} and ${B} break down the Power of Veto possibilities. They talk through who benefits if the nominations stay the same, who could become a replacement nominee, and which outcome creates the least blood for their side.`,
      campaign:`${A} checks in with ${B} about the vote and asks for a completely honest read. The conversation moves through likely votes one by one, including who may be lying, who could be pressured, and what argument might actually change someone's mind.`,
      alliance:`${A} and ${B} compare notes from separate conversations. They discuss whether their alliance is still aligned, who is leaking information, and which relationships outside the group may become useful later.`,
      paranoia:`${A} tells ${B} that the house feels less settled than people are pretending. They compare contradictory stories, question who is covering for whom, and wonder whether a side deal is forming without them.`,
      personal:`${A} and ${B} settle into a long personal conversation away from the main group. The discussion starts casually, moves through life outside the house, and eventually circles back to how those experiences shape the way they trust people in the game.`
    }[topic]||`${A} and ${B} have a long strategy conversation about the week.`;
    let extra=` ${relationshipPhrase(s,a,b)}`;
    if(ally&&ally.id!==b?.id)extra+=` ${A} mentions wanting to compare this conversation later with ${name(ally)}.`;
    if(enemy&&socialScore(s,a,enemy)<35)extra+=` ${name(enemy)} remains one of ${A}'s biggest concerns.`;
    if(n.length===2&&topic!=='personal')extra+=` The names ${name(n[0])} and ${name(n[1])} keep coming up as they count possible outcomes.`;
    if(hoh&&topic!=='personal')extra+=` They are careful about how much of this gets back to HOH ${name(hoh)}.`;
    return base+extra+ctxSentence(s,[a,b]);
  }

  function makeUpdate(s,minute,text,people=[],kind='conversation'){return {time:timeLabel(minute),minute,text,participants:people.filter(Boolean).map(p=>p.id),kind};}
  function pair(s,topic,exclude=[]){const people=active(s).filter(p=>!exclude.includes(p.id));const a=pick(people),b=closest(s,a,exclude)||pick(people.filter(x=>x.id!==a?.id));return [a,b,strategyText(s,a,b,topic)];}
  function pushPair(out,s,minute,topic,exclude=[]){const [a,b,t]=pair(s,topic,exclude);if(a&&b)out.push(makeUpdate(s,minute,t,[a,b],topic));}

  function generateDay(s,day){
    const people=active(s),out=[]; if(people.length<2)return out;
    const n=nominees(s),hoh=byId(s,s.currentHOH),pov=byId(s,(s.vetoWinners||[]).slice(-1)[0]);
    const add=(m,t,ps=[],k='conversation')=>out.push(makeUpdate(s,m,t,ps,k));
    const introCtx=contextLines(s);

    if(day==='Thursday'){
      if(hoh){const confidant=closest(s,hoh);add(17*60+12,`${name(hoh)} comes down from the HOH win still energized. ${name(confidant)} joins them for the first serious one-on-one of the new week. ${name(hoh)} says the immediate goal is to listen before locking anything in, but already starts sorting the house into people who feel safe, people who feel useful, and people who could become problems.${ctxSentence(s,[hoh,confidant])}`,[hoh,confidant],'hoh');}
      pushPair(out,s,17*60+44,'personal',[hoh?.id]); pushPair(out,s,18*60+21,'alliance'); pushPair(out,s,18*60+58,'paranoia');
      pushPair(out,s,19*60+34,'personal'); pushPair(out,s,20*60+9,'nominations'); pushPair(out,s,20*60+47,'alliance');
      pushPair(out,s,21*60+23,'paranoia'); pushPair(out,s,22*60+4,'personal'); pushPair(out,s,22*60+41,'nominations');
      pushPair(out,s,23*60+18,'alliance'); pushPair(out,s,23*60+51,'personal');
      if(hoh){const r=rival(s,hoh);if(r)add(24*60-2,`${name(r)} has a late-night whisper session about ${name(hoh)}. They worry the new HOH is making too many people feel comfortable and say that the real nominations may reveal which promises were genuine. The conversation ends without a firm plan, but the distrust is clearly growing.`,[r,closest(s,r)],'paranoia');}
    } else if(day==='Friday'){
      pushPair(out,s,8*60+42,'personal');
      if(hoh){const a=closest(s,hoh);add(9*60+18,`${name(hoh)} begins the morning with another HOH-room conversation with ${name(a)}. They revisit the nomination possibilities, discuss who would react calmly versus emotionally, and consider whether nominating a pawn could become more dangerous than simply putting up two clear targets. ${relationshipPhrase(s,hoh,a)}${ctxSentence(s,[hoh,a])}`,[hoh,a],'nominations');}
      pushPair(out,s,10*60+3,'nominations'); pushPair(out,s,11*60+26,'paranoia'); pushPair(out,s,12*60+14,'personal');
      if(n.length){add(14*60+7,`Feeds return around the nomination ceremony fallout. ${name(n[0])}${n[1]?` and ${name(n[1])}`:''} are now dealing with being on the block. Conversations split quickly between reassurance, information gathering, and quiet vote counting. The nominees try to determine whether the public target matches the real target and whether a backdoor plan could still change the week.`,n,'ceremony');}
      pushPair(out,s,14*60+39,'campaign'); pushPair(out,s,15*60+22,'alliance'); pushPair(out,s,16*60+11,'paranoia'); pushPair(out,s,17*60+5,'personal');
      if(n[0]){const b=closest(s,n[0]);add(18*60+17,`${name(n[0])} has a long one-on-one with ${name(b)}. Rather than making a frantic pitch, ${name(n[0])} asks what people are really saying and tries to separate comforting words from actual commitments. They discuss the veto draw, possible replacement nominees, and how aggressively to campaign before Saturday. ${relationshipPhrase(s,n[0],b)}${ctxSentence(s,[n[0],b])}`,[n[0],b],'campaign');}
      pushPair(out,s,19*60+31,'alliance'); pushPair(out,s,20*60+46,'personal'); pushPair(out,s,22*60+2,'paranoia'); pushPair(out,s,23*60+15,'campaign');
    } else if(day==='Saturday'){
      add(8*60+36,`The house is up early for veto day. Breakfast conversations repeatedly drift back to the player draw, the likely competition type, and which competitors might actually use the Power of Veto if they win.`,shuffle(people).slice(0,4),'veto');
      pushPair(out,s,9*60+12,'veto'); pushPair(out,s,10*60+4,'campaign'); pushPair(out,s,11*60+17,'alliance'); pushPair(out,s,12*60+2,'personal');
      add(13*60+38,`The mood changes as the house prepares for the Power of Veto competition. Players change clothes, compare last-minute guesses about the comp, and stop some strategy talks mid-sentence when production preparations begin.`,(s.povPlayers||[]).map(id=>byId(s,id)).filter(Boolean),'veto');
      add(14*60+15,`LIVE FEEDS BREAK — The Power of Veto competition is in progress.`,(s.povPlayers||[]).map(id=>byId(s,id)).filter(Boolean),'feed-break');
      if(pov)add(17*60+46,`LIVE FEEDS RETURN — ${name(pov)} has won the Power of Veto. The house immediately starts gaming out the ceremony. Some conversations are celebratory, others become noticeably guarded, and the nominees begin figuring out exactly what they need to ask from ${name(pov)} before Monday.`,[pov,...n],'veto');
      pushPair(out,s,18*60+13,'veto'); pushPair(out,s,18*60+54,'paranoia'); pushPair(out,s,19*60+37,'alliance');
      if(pov){const b=closest(s,pov);add(20*60+22,`${name(pov)} sits down with ${name(b)} for a detailed veto talk. They review the nominations, replacement possibilities, personal promises, and how using or not using the veto could affect next week's HOH. ${name(pov)} avoids making an absolute commitment but clearly tests how ${name(b)} would react to each option. ${relationshipPhrase(s,pov,b)}${ctxSentence(s,[pov,b])}`,[pov,b],'veto');}
      pushPair(out,s,21*60+11,'personal'); pushPair(out,s,22*60+6,'campaign'); pushPair(out,s,23*60+9,'paranoia');
    } else if(day==='Sunday'){
      pushPair(out,s,9*60+8,'personal');
      if(n[0])add(10*60+14,`${name(n[0])} starts an organized round of campaigning. Instead of only asking for safety, ${name(n[0])} talks through what their presence could mean for other people's games, who they would target next, and why keeping them may provide a shield.`,[n[0],closest(s,n[0])],'campaign');
      if(n[1])add(11*60+2,`${name(n[1])} conducts a separate vote check and tries a different approach, focusing on trust, future protection, and the danger of letting the other nominee stay. The pitch is tailored to the listener rather than repeated word-for-word.`,[n[1],closest(s,n[1])],'campaign');
      pushPair(out,s,12*60+18,'alliance'); pushPair(out,s,13*60+7,'personal'); pushPair(out,s,14*60+11,'paranoia'); pushPair(out,s,15*60+26,'campaign');
      if(pov){const b=n.find(x=>x.id!==pov.id)||closest(s,pov);add(16*60+32,`${name(pov)} has another veto conversation with ${name(b)}. They talk through the emotional side of the decision as well as the strategic side, including whether a promise was made earlier in the week and how breaking it would be explained afterward.${ctxSentence(s,[pov,b])}`,[pov,b],'veto');}
      pushPair(out,s,17*60+21,'alliance'); pushPair(out,s,18*60+46,'personal'); pushPair(out,s,20*60+3,'paranoia'); pushPair(out,s,21*60+19,'campaign'); pushPair(out,s,22*60+31,'personal'); pushPair(out,s,23*60+22,'alliance');
    } else if(day==='Monday'){
      pushPair(out,s,8*60+51,'personal');
      if(pov){const b=closest(s,pov);add(9*60+36,`${name(pov)} has a final pre-ceremony check-in with ${name(b)}. They go over the consequences one more time and discuss how the house will interpret the decision regardless of what happens.`,[pov,b],'veto');}
      pushPair(out,s,10*60+27,'veto');
      add(12*60+5,`The house settles in around the Veto Ceremony. Afterward, the strategic map of the week becomes clearer and the campaign phase begins in earnest. Houseguests immediately compare what the ceremony means for Thursday's vote.`,n,'ceremony');
      pushPair(out,s,12*60+47,'campaign'); pushPair(out,s,13*60+38,'alliance'); pushPair(out,s,14*60+54,'paranoia'); pushPair(out,s,16*60+13,'campaign'); pushPair(out,s,17*60+24,'personal'); pushPair(out,s,18*60+36,'alliance'); pushPair(out,s,19*60+52,'paranoia'); pushPair(out,s,21*60+6,'campaign'); pushPair(out,s,22*60+17,'personal'); pushPair(out,s,23*60+11,'alliance');
    } else if(day==='Tuesday'){
      pushPair(out,s,9*60+4,'personal'); pushPair(out,s,10*60+16,'campaign'); pushPair(out,s,11*60+29,'alliance'); pushPair(out,s,12*60+41,'paranoia');
      if(n[0]){const b=closest(s,n[0]);add(13*60+22,`${name(n[0])} sits with ${name(b)} for one of the day's longest vote conversations. They count the house from multiple angles, distinguish firm votes from soft promises, and discuss what kind of last-minute development could flip someone. ${relationshipPhrase(s,n[0],b)}${ctxSentence(s,[n[0],b])}`,[n[0],b],'campaign');}
      pushPair(out,s,14*60+33,'personal'); pushPair(out,s,15*60+48,'alliance'); pushPair(out,s,17*60+3,'campaign'); pushPair(out,s,18*60+11,'paranoia'); pushPair(out,s,19*60+27,'personal'); pushPair(out,s,20*60+39,'campaign'); pushPair(out,s,21*60+54,'alliance'); pushPair(out,s,23*60+2,'paranoia');
    } else if(day==='Wednesday'){
      pushPair(out,s,8*60+57,'personal'); pushPair(out,s,10*60+8,'campaign'); pushPair(out,s,11*60+19,'alliance'); pushPair(out,s,12*60+31,'paranoia'); pushPair(out,s,13*60+44,'personal');
      if(n[1]){const b=closest(s,n[1]);add(15*60+2,`${name(n[1])} makes a late-stage pitch to ${name(b)} and asks for a direct answer rather than reassurance. The conversation gets specific: who is voting where, whether anyone is considering a sympathy vote, and whether keeping ${name(n[1])} would create a better target structure next week.${ctxSentence(s,[n[1],b])}`,[n[1],b],'campaign');}
      pushPair(out,s,16*60+14,'alliance'); pushPair(out,s,17*60+26,'paranoia'); pushPair(out,s,18*60+43,'campaign'); pushPair(out,s,19*60+58,'personal'); pushPair(out,s,21*60+13,'alliance'); pushPair(out,s,22*60+29,'campaign'); pushPair(out,s,23*60+37,'paranoia');
    } else if(day==='Thursday-pre-eviction'){
      pushPair(out,s,8*60+34,'personal');
      if(n[0])add(9*60+11,`${name(n[0])} begins final eviction-day campaigning, checking in with ${name(closest(s,n[0]))} and asking whether anything changed overnight. The pitch is shorter now, but every word is aimed at confirming a real vote rather than collecting another vague promise.`,[n[0],closest(s,n[0])],'campaign');
      if(n[1])add(9*60+52,`${name(n[1])} makes a final private appeal to ${name(closest(s,n[1]))}. They emphasize the consequences of the vote for the next HOH and ask the listener to think beyond this single eviction.`,[n[1],closest(s,n[1])],'campaign');
      pushPair(out,s,10*60+31,'alliance'); pushPair(out,s,11*60+6,'paranoia'); pushPair(out,s,11*60+49,'campaign'); pushPair(out,s,12*60+22,'personal');
      add(13*60+3,`The house starts getting ready for the live show. Strategy conversations become shorter and more coded as people move between bedrooms, the bathroom area and the kitchen. Several houseguests say they are ready for the week to be over, but small check-ins continue.`,shuffle(people).slice(0,5),'eviction');
      pushPair(out,s,13*60+37,'campaign'); pushPair(out,s,14*60+9,'alliance');
      add(14*60+46,`FINAL PRE-EVICTION FEED UPDATE — Houseguests finish last-minute conversations and prepare for the live eviction. The nominees have made their final pitches, voting blocs believe they know where the numbers stand, and attention begins shifting toward the next HOH competition.`,people,'eviction');
    }
    return out.sort((a,b)=>a.minute-b.minute);
  }

  function dailyRecord(s,week,day,anchor){
    const temp={...s,houseguests:(anchor?.snapshot?.houseguests||s.houseguests).map(h=>({...h})),nominees:(anchor?.snapshot?.nominees||s.nominees||[]).slice(),currentHOH:anchor?.snapshot?.currentHOH||s.currentHOH,povPlayers:(anchor?.snapshot?.povPlayers||s.povPlayers||[]).slice(),vetoWinners:(anchor?.snapshot?.vetoWinners||s.vetoWinners||[]).slice(),relationships:s.relationships};
    const items=generateDay(temp,day);
    const displayDay=day==='Thursday-pre-eviction'?'Thursday — Eviction Day':day==='Thursday'?'Thursday Night':day;
    const context=contextLines(s);
    return {week,phase:'live-feeds',type:'live-feed-day',day,title:`Live Feeds — ${displayDay}`,snapshot:anchor?.snapshot?JSON.parse(JSON.stringify(anchor.snapshot)):null,lines:[],data:{day:displayDay,feedItems:items,participants:[...new Set(items.flatMap(x=>x.participants||[]))],contextNotes:context}};
  }

  LiveFeeds.addToSeason=function(s){
    if(!s?.season?.liveFeedsEnabled){s.liveFeeds={enabled:false,version:2};return s;}
    if(!Array.isArray(s.history)||s.history.some(e=>e.type==='live-feed-day'))return s;
    const original=s.history.slice(),out=[];
    const weeks=[...new Set(original.map(e=>e.week).filter(w=>typeof w==='number'&&w>=1))].sort((a,b)=>a-b);
    const opening=original.filter(e=>e.week===0),finale=original.filter(e=>e.week==='Final');
    opening.forEach(e=>out.push(e));
    weeks.forEach(week=>{
      const evs=original.filter(e=>e.week===week);
      const hoh=evs.find(e=>e.type==='hoh');
      const noms=evs.find(e=>e.type==='nominations');
      const picked=evs.find(e=>e.type==='pov-players');
      const pov=evs.find(e=>e.type==='veto');
      const veto=evs.find(e=>e.type==='veto-ceremony');
      let thursdayAdded=false,fridayAdded=false,saturdayAdded=false,postVetoDaysAdded=false;
      evs.forEach(e=>{
        out.push(e);
        if(e===hoh&&!thursdayAdded){out.push(dailyRecord(s,week,'Thursday',hoh));thursdayAdded=true;}
        if(e===noms&&!fridayAdded){out.push(dailyRecord(s,week,'Friday',noms));fridayAdded=true;}
        if(e===pov&&!saturdayAdded){out.push(dailyRecord(s,week,'Saturday',pov));out.push(dailyRecord(s,week,'Sunday',pov));saturdayAdded=true;}
        if(e===veto&&!postVetoDaysAdded){['Monday','Tuesday','Wednesday','Thursday-pre-eviction'].forEach(day=>out.push(dailyRecord(s,week,day,veto)));postVetoDaysAdded=true;}
      });
      const anchor=pov||picked||noms||hoh;
      if(!saturdayAdded&&anchor){out.push(dailyRecord(s,week,'Saturday',anchor));out.push(dailyRecord(s,week,'Sunday',anchor));}
      if(!postVetoDaysAdded&&anchor){['Monday','Tuesday','Wednesday','Thursday-pre-eviction'].forEach(day=>out.push(dailyRecord(s,week,day,anchor)));}
    });
    finale.forEach(e=>out.push(e));
    s.history=out;
    s.history.forEach((e,i)=>e.id=i+1);
    s.liveFeeds={enabled:true,weekModel:'Thursday-to-Thursday',timezone:'BBT',dailyPageMode:true,version:2};
    return s;
  };
  window.LiveFeeds=LiveFeeds;
})();
