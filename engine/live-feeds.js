/*
 * BIG BROTHER 23 CUSTOM SIMULATOR — LIVE FEEDS ENGINE
 *
 * Presentation/story layer for the weekly live feeds. It does not decide
 * competitions, nominations, vetoes, powers, or evictions. It reads the
 * already-simulated game state and creates a seven-day feed timeline between
 * Thursday HOH nights.
 */
(function(){
  const LiveFeeds={};
  const name=p=>`${p?.firstName||""} ${p?.lastName||""}`.trim()||`Houseguest ${p?.slot||""}`;
  const living=s=>s.houseguests.filter(p=>p.active);
  const byId=(s,id)=>s.houseguests.find(p=>p.id===id)||null;
  const pick=(a)=>a&&a.length?a[Math.floor(Math.random()*a.length)]:null;
  const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const hh=(n)=>String(n).padStart(2,"0");
  const timeLabel=(minute)=>{const h=Math.floor(minute/60),m=minute%60,ap=h>=12?'PM':'AM',hhour=h%12||12;return `${String(hhour).padStart(2,"0")}:${hh(m)} ${ap} BBT`;};

  function relationships(s,a,b){
    return s.relationships?.[a?.id]?.[b?.id]||{friendship:50,trust:50,loyalty:50,respect:50,attraction:0,rivalry:0};
  }
  function score(s,a,b){
    if(!a||!b)return 50;
    const r=relationships(s,a,b);
    return (r.friendship||0)*.30+(r.trust||0)*.25+(r.loyalty||0)*.15+(r.respect||0)*.20+(r.attraction||0)*.10-(r.rivalry||0)*.35;
  }
  function closest(s,p,exclude=[]){
    return living(s).filter(x=>x.id!==p?.id&&!exclude.includes(x.id)).sort((a,b)=>score(s,p,b)-score(s,p,a))[0]||null;
  }
  function rivals(s,p,exclude=[]){
    return living(s).filter(x=>x.id!==p?.id&&!exclude.includes(x.id)).sort((a,b)=>score(s,p,a)-score(s,p,b))[0]||null;
  }
  function allianceMate(s,p){
    const ids=p?.allianceIds||[];
    const pool=living(s).filter(x=>x.id!==p?.id&&(x.allianceIds||[]).some(id=>ids.includes(id)));
    return pool.length?pick(pool):null;
  }
  function nominees(s){return (s.nominees||[]).map(id=>byId(s,id)).filter(Boolean);}
  function povWinner(s){const ids=s.vetoWinners||[];return byId(s,ids[ids.length-1]);}

  function conversation(s,a,b,topic){
    if(!a||!b)return null;
    const A=name(a),B=name(b);
    const n=nominees(s), target=n[0]&&n[1]? (s.intendedTarget?byId(s,s.intendedTarget):null):null;
    if(topic==='nom') return `${A} talks with ${B} about the nominations and tries to figure out whether the target is really ${target?name(target):"one of the nominees"}.`;
    if(topic==='campaign') return `${A} talks with ${B} about the vote. ${A} says they want to keep their options open and asks where ${B} stands.`;
    if(topic==='pov') return `${A} and ${B} discuss the Power of Veto and what could happen if it is used.`;
    if(topic==='alliance') return `${A} checks in with ${B} about the alliance. They compare notes on who they trust and who may be playing both sides.`;
    if(topic==='paranoia') return `${A} admits to ${B} that they are worried people are saying different things in different rooms.`;
    if(topic==='social') return `${A} and ${B} talk casually about the house and then drift into strategy.`;
    return `${A} and ${B} have a private strategy conversation about the current week.`;
  }

  function generateDay(s,day,anchor){
    const people=living(s); if(people.length<2)return [];
    const n=nominees(s), pov=povWinner(s), hoh=byId(s,s.currentHOH);
    const items=[];
    const used=new Set();
    const add=(minute,text,participants=[],kind='conversation')=>{
      if(!text)return;items.push({time:timeLabel(minute),minute,text,participants:participants.filter(Boolean).map(p=>p.id),kind});
    };
    const pair=(topic,exclude=[])=>{
      let a=pick(people.filter(p=>!exclude.includes(p.id)));
      let b=closest(s,a,exclude);
      if(!b)b=pick(people.filter(p=>p.id!==a?.id&&!exclude.includes(p.id)));
      return [a,b,conversation(s,a,b,topic)];
    };

    if(day==='Thursday'){
      const a=hoh||pick(people), b=closest(s,a)||pick(people.filter(x=>x.id!==a?.id));
      add(17*60+18,`${name(a)} celebrates the HOH win with ${name(b)} and talks about who might be safe this week.`,[a,b],'hoh');
      const c=closest(s,a,[b?.id]);
      if(c)add(17*60+47,`${name(a)} privately tells ${name(c)} that the first conversations will be important before nominations.`,[a,c],'hoh');
      const [x,y,t]=pair('social',[a?.id]); add(18*60+22,t,[x,y]);
      const r=rivals(s,a,[b?.id,c?.id]); if(r)add(19*60+11,`${name(r)} tells ${name(pick([b,c].filter(Boolean))||r)} that ${name(a)} may be making promises to too many people.`,[r,b||c],'paranoia');
    } else if(day==='Friday'){
      if(!n.length){
        const a=hoh||pick(people), b=closest(s,a);
        if(a&&b)add(9*60+14,`${name(a)} talks with ${name(b)} about the first nominations and says they want to avoid making the week more complicated than it needs to be.`,[a,b],'nom');
        const [x,y,t]=pair('social',[a?.id]); add(11*60+36,t,[x,y]);
        add(13*60+5,`The houseguests gather before the nomination ceremony and compare early reads on the week.`,people.slice(0,Math.min(5,people.length)),'nom');
      } else {
        const a=n[0],b=n[1]||null;
        add(10*60+14,`${name(a)} talks about the possibility of being nominated and says they need to stay calm.`,[a],'nom');
        if(b)add(11*60+36,`${name(b)} compares notes with ${name(hoh||pick(people))} and tries to understand the HOH's plan.`,[b,hoh||people[0]],'nom');
        add(13*60+5,`${name(hoh||people[0])} has a private conversation about whether the nominations will stay the same.`,[hoh||people[0],closest(s,hoh||people[0])],'nom');
          const [x,y,t]=pair('nom',[hoh?.id]); add(15*60+42,t,[x,y]);
      }
    } else if(day==='Saturday'){
      const eligible=people.slice();
      add(9*60+18,`The houseguests discuss the Power of Veto draw and who they hope will be selected.`,eligible.slice(0,Math.min(4,eligible.length)),'pov');
      const a=pov||pick(people), b=closest(s,a); if(a&&b)add(15*60+16,`${name(a)} and ${name(b)} discuss the veto competition and whether the winner should use the power.`,[a,b],'pov');
      add(16*60+30,`LIVE FEEDS BREAK — The Power of Veto Competition is in progress.`,s.povPlayers?.map(id=>byId(s,id)).filter(Boolean),'feed-break');
      if(pov)add(18*60+12,`LIVE FEEDS RETURN — ${name(pov)} has won the Power of Veto. Houseguests immediately begin discussing what ${name(pov)} might do.`,[pov,...n].filter(Boolean),'pov');
      const [x,y,t]=pair('pov',[pov?.id]); add(19*60+4,t,[x,y]);
    } else if(day==='Sunday'){
      const a=n[0],b=n[1];
      if(a){add(11*60+15,`${name(a)} campaigns for safety and tells ${name(closest(s,a)||people[0])} why they believe they should stay.`,[a,closest(s,a)],'campaign');}
      if(b){add(12*60+8,`${name(b)} campaigns separately and worries that the vote could change if the Veto is used.`,[b,closest(s,b)],'campaign');}
      const [x,y,t]=pair('alliance'); add(14*60+27,t,[x,y]);
      const [u,v,t2]=pair('paranoia'); add(16*60+41,t2,[u,v]);
      const [q,w,t3]=pair('social'); add(18*60+19,t3,[q,w]);
      if(pov&&n.length)add(20*60+6,`${name(pov)} tells ${name(closest(s,pov)||people[0])} that the veto decision is not final yet.`,[pov,closest(s,pov)],'pov');
    } else if(day==='Monday'){
      if(pov&&n.length){
        const a=closest(s,pov)||n[0];
        add(10*60+21,`${name(pov)} meets privately with ${name(a)} before the Veto Ceremony and explains the decision they are considering.`,[pov,a],'pov');
      }
      const current=nominees(s);
      if(current.length){const [x,y,t]=pair('campaign');add(15*60+18,t,[x,y]);}
      const [u,v,t2]=pair('alliance');add(18*60+33,t2,[u,v]);
    } else if(day==='Tuesday'){
      const a=pick(n.length? n:people), b=closest(s,a); if(a&&b)add(11*60+7,`${name(a)} asks ${name(b)} whether they have enough votes to stay.`,[a,b],'campaign');
      const [x,y,t]=pair('alliance');add(14*60+55,t,[x,y]);
      const [u,v,t2]=pair('paranoia');add(17*60+12,t2,[u,v]);
      const [q,w,t3]=pair('social');add(20*60+25,t3,[q,w]);
    } else if(day==='Wednesday'){
      const a=pick(n.length?n:people), b=closest(s,a); if(a&&b)add(10*60+44,`${name(a)} makes one last round of conversations and asks ${name(b)} for an honest read on the vote.`,[a,b],'campaign');
      const [x,y,t]=pair('alliance');add(13*60+39,t,[x,y]);
      const [u,v,t2]=pair('paranoia');add(16*60+48,t2,[u,v]);
      if(hoh){const r=rivals(s,hoh);if(r)add(20*60+3,`${name(r)} tells ${name(closest(s,r)||people[0])} that they are no longer sure they can trust ${name(hoh)}.`,[r,closest(s,r)],'paranoia');}
    } else if(day==='Thursday-pre-eviction'){
      const current=nominees(s);
      if(current[0])add(9*60+12,`${name(current[0])} gives a final pitch to ${name(closest(s,current[0])||people[0])} and asks for their vote.`,[current[0],closest(s,current[0])],'campaign');
      if(current[1])add(10*60+5,`${name(current[1])} makes a final campaign and says they believe the house is closer than people realize.`,[current[1],closest(s,current[1])],'campaign');
      const [x,y,t]=pair('alliance');add(11*60+26,t,[x,y]);
      add(13*60+48,`The houseguests prepare for the live eviction. The expected vote is discussed one last time.`,people,'eviction');
    }
    return items.sort((a,b)=>a.minute-b.minute);
  }

  function insertAfter(history,index,events){history.splice(index+1,0,...events);}

  LiveFeeds.addToSeason=function(s){
    if(!Array.isArray(s.history)||s.history.some(e=>e.type==='live-feed'))return;
    const original=s.history.slice();
    const out=[];
    const weeks=[...new Set(original.map(e=>e.week).filter(w=>typeof w==='number'&&w>=1))].sort((a,b)=>a-b);
    const makeTemp=anchor=>({
      ...s,
      houseguests:(anchor?.snapshot?.houseguests||s.houseguests).map(h=>({...h})),
      nominees:(anchor?.snapshot?.nominees||s.nominees||[]).slice(),
      currentHOH:anchor?.snapshot?.currentHOH||s.currentHOH,
      povPlayers:(anchor?.snapshot?.povPlayers||s.povPlayers||[]).slice(),
      vetoWinners:(anchor?.snapshot?.vetoWinners||s.vetoWinners||[]).slice(),
      relationships:s.relationships
    });
    const feedRecords=(week,day,anchor)=>{
      const temp=makeTemp(anchor);
      return generateDay(temp,day,anchor).map(x=>({
        week,phase:'live-feeds',type:'live-feed',day,time:x.time,minute:x.minute,feedKind:x.kind,
        participants:x.participants,title:`Live Feeds — ${day==='Thursday-pre-eviction'?'Thursday (Eviction Day)':day==='Thursday'?'Thursday Night':day}`,
        snapshot:anchor?.snapshot?JSON.parse(JSON.stringify(anchor.snapshot)):null,
        lines:[x.text],data:{feedItems:[x],participants:x.participants,day,time:x.time}
      }));
    };
    const addOriginal=e=>{if(e)out.push(e);};
    weeks.forEach(week=>{
      const evs=original.filter(e=>e.week===week);
      const hoh=evs.find(e=>e.type==='hoh');
      const noms=evs.find(e=>e.type==='nominations');
      const picked=evs.find(e=>e.type==='pov-players');
      const pov=evs.find(e=>e.type==='veto');
      const veto=evs.find(e=>e.type==='veto-ceremony');
      const eviction=evs.find(e=>e.type==='eviction');
      evs.forEach(e=>{
        if(e===noms) feedRecords(week,'Friday',hoh).forEach(x=>out.push(x));
        addOriginal(e);
        if(e===hoh) feedRecords(week,'Thursday',hoh).forEach(x=>out.push(x));
        if(e===picked) feedRecords(week,'Saturday',picked).forEach(x=>out.push(x));
        if(e===pov){
          feedRecords(week,'Saturday',pov).forEach(x=>out.push(x));
          feedRecords(week,'Sunday',pov).forEach(x=>out.push(x));
        }
        if(e===veto){
          feedRecords(week,'Monday',veto).forEach(x=>out.push(x));
          feedRecords(week,'Tuesday',veto).forEach(x=>out.push(x));
          feedRecords(week,'Wednesday',veto).forEach(x=>out.push(x));
          feedRecords(week,'Thursday-pre-eviction',veto).forEach(x=>out.push(x));
        }
      });
      // In unusual weeks without a standard veto ceremony, still provide the
      // feed days before eviction rather than silently dropping the timeline.
      if(!veto){
        const anchor=pov||picked||noms||hoh;
        ['Sunday','Monday','Tuesday','Wednesday','Thursday-pre-eviction'].forEach(day=>feedRecords(week,day,anchor).forEach(x=>out.push(x)));
      }
    });
    // Week 0 move-in/team events and any finale records remain in their original
    // positions relative to the weekly records. This also preserves special
    // High Roller's Room and double-eviction events.
    const usedIds=new Set(out.filter(e=>e.id!=null).map(e=>e.id));
    original.forEach(e=>{if(!usedIds.has(e.id))out.push(e);});
    // The week loop already contains every numbered weekly event. The fallback
    // above only catches week 0/finale records, so restore the original global
    // order for those records without disturbing feed records.
    const opening=original.filter(e=>e.week===0).filter(e=>out.includes(e));
    const weekly=out.filter(e=>e.week!==0&&e.week!=='Final');
    const finale=original.filter(e=>e.week==='Final').filter(e=>out.includes(e));
    s.history=[...opening,...weekly,...finale];
    s.history.forEach((e,i)=>{e.id=i+1;});
    s.liveFeeds={enabled:true,weekModel:'Thursday-to-Thursday',timezone:'BBT',schedule:[
      'Thursday night — HOH + feeds begin',
      'Friday — nomination ceremony',
      'Saturday morning — POV players picked',
      'Saturday late afternoon — POV competition / feed break',
      'Saturday evening — feeds return after POV',
      'Sunday — live feeds',
      'Monday — veto ceremony',
      'Tuesday — live feeds',
      'Wednesday — live feeds',
      'Thursday afternoon — final feeds + live eviction'
    ],version:1};
    return s;
  };
  window.LiveFeeds=LiveFeeds;
})();
