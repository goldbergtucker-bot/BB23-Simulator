/*
 * BIG BROTHER 23 CUSTOM SIMULATOR — V7
 * BrantSteele-style presentation + custom social setup.
 * V7 adds:
 *   - official BB23 competition names/descriptions
 *   - editable starting relationships
 *   - editable custom alliances
 *   - separate Teams and Alliances
 */
(() => {
  const STORAGE_KEY = "bb23CustomSimulatorBrantsteeleV16";
  const LEGACY_STORAGE_KEYS = ["bb23CustomSimulatorBrantsteeleV14","bb23CustomSimulatorBrantsteeleV13","bb23CustomSimulatorBrantsteeleV12","bb23CustomSimulatorBrantsteeleV11","bb23CustomSimulatorBrantsteeleV10","bb23CustomSimulatorBrantsteeleV9","bb23CustomSimulatorBrantsteeleV8","bb23CustomSimulatorBrantsteeleV7"];
  const REVEAL_KEY = "bb23CustomSimulatorBrantsteeleV16Index";
  let state = GameState.createInitialState(BB23_CONFIG);
  let history = [];
  let pointer = -1;
  let activeTab = "event";

  const $ = id => document.getElementById(id);
  const castGrid = $("castGrid"), teamsGrid = $("teamsGrid"), validity = $("validity"), toast = $("toast");
  const setupView = $("setupView"), seasonView = $("seasonView");
  const seasonHeading = $("seasonHeading"), seasonStatusLine = $("seasonStatusLine");
  const eventPanel = $("eventPanel"), eventTitle = $("eventTitle"), eventKicker = $("eventKicker"), eventBody = $("eventBody");
  const eventCounter = $("eventCounter"), timeline = $("timeline"), memoryWall = $("memoryWall"), tabContent = $("tabContent");
  const previousBtn = $("previousBtn"), nextBtn = $("nextBtn"), revealWeekBtn = $("revealWeekBtn"), revealSeasonBtn = $("revealSeasonBtn");
  const relationshipsGrid = $("relationshipsGrid"), allianceSetup = $("allianceSetup");
  const liveFeedsToggle=$("liveFeedsToggle"), liveFeedPromptPanel=$("liveFeedPromptPanel");
  const demoNames = [["Tucker","Player"],["Grace","Player"],["Antonio","Player"],["Riley","Player"],["Aly","Player"],["Stephanie","Player"],["Jordan","Player"],["Morgan","Player"],["Cameron","Player"],["Taylor","Player"],["Alex","Player"],["Casey","Player"],["Drew","Player"],["Jamie","Player"],["Logan","Player"],["Parker","Player"]];
  const REL_KEYS = ["friendship","trust","loyalty","rivalry","respect","attraction"];
  const REL_LABELS = {friendship:"Friendship",trust:"Trust",loyalty:"Loyalty",rivalry:"Rivalry",respect:"Respect",attraction:"Attraction"};
  const REL_TYPES = ["Unspecified","Showmance","Bromance","Best Friends","Close Friends","Allies","Rivalry","Mentor / Mentee","Family","Frenemies","Secret Pair","Other"];
  const ALLIANCE_TYPES = ["Majority Alliance","Core Alliance","Final Two","Final Three","Girls' Alliance","Guys' Alliance","Secret Alliance","Side Alliance","Team","Custom"];

  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const name = h => `${h?.firstName||""} ${h?.lastName||""}`.trim() || `Houseguest ${h?.slot||""}`;
  const byId = (view,id) => view?.houseguests?.find(h=>h.id===id) || state.houseguests.find(h=>h.id===id);
  const ordinal = n => SeasonEngine.ordinal(n);
  const weekLabel = w => w === "Final" ? "FINALE" : w === 0 ? "MOVE-IN" : `WEEK ${w}`;
  const toastMsg = m => { toast.textContent=m; toast.classList.add("show"); clearTimeout(toastMsg.t); toastMsg.t=setTimeout(()=>toast.classList.remove("show"),2200); };

  function portrait(h, cls="event-portrait") {
    if (!h) return `<div class="${cls} placeholder-portrait">?</div>`;
    return h.portraitUrl ? `<img class="${cls}" src="${esc(h.portraitUrl)}" alt="${esc(name(h))}" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} placeholder-portrait',textContent:'?'}))">` : `<div class="${cls} placeholder-portrait">?</div>`;
  }
  function playerCard(h, role="") { return `<div class="player-card"><div class="portrait-box">${portrait(h)}</div><strong>${esc(name(h))}</strong>${role?`<span>${esc(role)}</span>`:""}</div>`; }

  function findPlayers(entry, view) {
    const d = entry.data || {};
    const ids = [];
    [d.participants,d.nomineeIds,d.voterIds,d.finalistIds].forEach(a=>(a||[]).forEach(id=>ids.push(id)));
    if(d.winnerId) ids.push(d.winnerId); if(d.hohId) ids.push(d.hohId); if(d.evictedId) ids.push(d.evictedId); if(d.runnerUpId) ids.push(d.runnerUpId); if(d.thirdPlaceId) ids.push(d.thirdPlaceId);
    return [...new Set(ids)].map(id=>byId(view,id)).filter(Boolean);
  }

  function competitionCard(entry) {
    // Always resolve the official competition directly from the BB23 schedule
    // as a fallback. This makes the description independent of which event
    // renderer created the history record.
    const c = entry.competition || {};
    const official = BB23_CONFIG.competitionSchedule?.find(x => Number(x.week) === Number(entry.week) && x.type === entry.type);
    const nameValue = c.name || c.label || official?.name;
    if(!nameValue) return "";
    const description = c.description || official?.description || "";
    const category = c.category || official?.category || "general";
    const type = entry.type === "veto" ? "POWER OF VETO" : entry.type?.includes("hoh") ? "HEAD OF HOUSEHOLD" : entry.type === "wildcard" ? "WILDCARD" : entry.type?.includes("final-hoh") ? "FINAL HOH" : "COMPETITION";
    return `<section class="competition-card">
      <div class="competition-top"><span class="competition-kicker">${esc(type)}</span><span class="official-badge">REAL BB23 COMPETITION</span></div>
      <h3>${esc(nameValue)}</h3>
      <div class="competition-meta"><span>${esc(String(category).toUpperCase())}</span><span>WEEK ${esc(entry.week)}</span></div>
      <p>${esc(description)}</p>
    </section>`;
  }

  function targetPanel(d, view) {
    const target = d.intendedTarget || view?.intendedTarget;
    const backdoor = byId(view, d.backdoorTargetId || view?.backdoorTargetId);
    if (!target && !backdoor) return "";
    return `<section class="target-panel">
      ${target ? `<div><span>HOH'S INTENDED TARGET</span><strong>${esc(target)}</strong></div>` : ""}
      ${backdoor ? `<div><span>POTENTIAL BACKDOOR TARGET</span><strong>${esc(name(backdoor))}</strong></div>` : ""}
    </section>`;
  }

  function liveFeedCard(entry) {
    const d=entry.data||{}, items=d.feedItems||[], context=d.contextNotes||[];
    const participantIds=[...new Set(items.flatMap(x=>x.participants||[]))];
    const pics=participantIds.map(id=>byId(entry.snapshot,id)).filter(Boolean);
    return `<section class="daily-feed-page">
      <div class="daily-feed-header"><div><span>BIG BROTHER LIVE FEEDS</span><h3>${esc(d.day||entry.day||"")}</h3><p>Week ${esc(entry.week)} · Complete daily feed</p></div><div class="feed-count">${items.length}<small>updates</small></div></div>
      ${context.length?`<details class="feed-context"><summary>Story context used for this day's feeds</summary>${context.map(c=>`<p><strong>${esc(c.label)}:</strong> ${esc(c.text)}</p>`).join("")}</details>`:""}
      <div class="daily-feed-cast">${pics.slice(0,12).map(p=>`<div class="daily-feed-person">${portrait(p,"daily-feed-portrait")}<span>${esc(name(p))}</span></div>`).join("")}</div>
      <div class="daily-feed-updates">${items.map(x=>`<article class="feed-update ${x.kind==='feed-break'?'feed-break':''}"><time>${esc(x.time)}</time><div><p>${esc(x.text)}</p>${(x.participants||[]).length?`<small>${(x.participants||[]).map(id=>byId(entry.snapshot,id)).filter(Boolean).map(p=>esc(name(p))).join(" · ")}</small>`:""}</div></article>`).join("")}</div>
    </section>`;
  }

  function eventData(entry, view) {
    const d = entry.data || {};
    // Every competition, including POV, gets its official competition card
    // and description. The POV event still shows only the winner portrait
    // beneath the card, rather than the full POV field.
    let body = competitionCard(entry);
    if (["nominations","pov-players","veto-ceremony"].includes(entry.type)) body += targetPanel(d, view);
    if (entry.type === "team-safety") {
      const ids = d.safeMemberIds || d.participants || [];
      const members = ids.map(id=>byId(view,id)).filter(Boolean);
      body += `<section class="team-safety-panel">
        <div class="team-safety-heading">
          <span class="ceremony-label">TEAM SAFETY</span>
          <h3>${esc(d.teamName || "Team")} — ALL REMAINING MEMBERS SAFE</h3>
          <p>${esc((entry.lines||[])[0] || "Every remaining member of the HOH's team is safe from nomination.")}</p>
        </div>
        <div class="team-safety-members">${members.map(h=>playerCard(h,"SAFE")).join("")}</div>
      </section>`;
      return body;
    }
    if (entry.type === "wildcard") {
      const winnerId = d.winnerId || entry.winnerId || entry.competition?.winner?.id;
      const winner = byId(view, winnerId);
      const teams = d.wildcardTeams || [];
      body += `<section class="wildcard-panel">
        <div class="wildcard-heading">
          <span class="ceremony-label">WILDCARD COMPETITION</span>
          <p>Three teams not protected by Team Safety each send one Houseguest to compete for individual safety.</p>
        </div>
        <div class="wildcard-competitors">${teams.map(t=>{
          const h=byId(view,t.competitorId);
          return h ? `<div class="wildcard-team"><div class="wildcard-team-name">${esc(t.teamName)}</div>${playerCard(h,"COMPETITOR")}</div>` : "";
        }).join("")}</div>
        ${winner ? `<div class="wildcard-result"><div class="ceremony-label">WILDCARD WINNER</div>${playerCard(winner,d.safetyAccepted?"SAFE":"WINNER")}</div>` : ""}
        <div class="wildcard-decision">${esc((entry.lines||[]).slice(2).join(" ") || (d.safetyAccepted ? "Individual safety accepted." : "Individual safety declined."))}</div>
      </section>`;
      return body;
    }
    if (entry.type === "teams" || entry.type === "team-draft") {
      const teams = d.teams || view?.teams || [];
      if (entry.type === "teams") {
        body += `<div class="teams-sim-grid">${teams.map(t=>`<section class="team-sim-card"><h3>${esc(t.name)}</h3><div class="team-sim-captain">${t.captainId?playerCard(byId(view,t.captainId),"TEAM CAPTAIN"):""}</div><div class="team-sim-members">${(t.memberIds||[]).map(id=>playerCard(byId(view,id),id===t.captainId?"CAPTAIN":"TEAMMATE")).join("")}</div></section>`).join("")}</div>`;
      } else {
        const cap=byId(view,d.winnerId);
        body += `<div class="hero-players">${cap?playerCard(cap,"TEAM CAPTAIN"):""}</div>`;
      }
      return body;
    }
    if (["bb-bucks","veto-derby","chopping-block-roulette","coin-of-destiny","coin-renomination"].includes(entry.type)) {
      const winner=byId(view,d.winnerId);
      if (entry.type === "bb-bucks") {
        const rows=(d.participants||[]).map((id,i)=>{const h=byId(view,id);const award=i<3?100:i<6?75:50;return `<div class="bucks-row">${portrait(h,"vote-portrait")}<strong>${esc(name(h))}</strong><span>+${award} BB Bucks</span></div>`}).join("");
        body += `<div class="bucks-list">${rows}</div>`;
      } else if (winner) {
        body += `<div class="hero-players">${playerCard(winner, entry.type==="coin-destiny"?"COIN HOLDER":"POWER WINNER")}</div>`;
      }
      return body;
    }
    if (entry.type === "eviction-voting") {
      const votes = d.votes || view?.evictionVotes || [];
      body += `<div class="vote-list">${votes.map(v=>{const voter=byId(view,v.voterId),target=byId(view,v.targetId);return `<div class="vote-row"><div class="vote-person">${portrait(voter,"vote-portrait")}<strong>${esc(name(voter))}</strong></div><div class="vote-arrow">VOTES TO EVICT</div><div class="vote-person target">${portrait(target,"vote-portrait")}<strong>${esc(name(target))}</strong></div></div>`}).join("")}</div>`;
      return body;
    }
    if (entry.type === "jury-vote") {
      const votes = d.votes || [];
      body += `<div class="vote-list jury-votes">${votes.map(v=>{const juror=byId(view,v.voterId),target=byId(view,v.targetId);return `<div class="vote-row"><div class="vote-person">${portrait(juror,"vote-portrait")}<strong>${esc(name(juror))}</strong></div><div class="vote-arrow">VOTES FOR</div><div class="vote-person target">${portrait(target,"vote-portrait")}<strong>${esc(name(target))}</strong></div></div>`}).join("")}</div>`;
      return body;
    }
    if (entry.type === "eviction") {
      const evicted = byId(view, d.evictedId);
      const rawVotes = d.votes || view?.evictionVotes || [];
      let a = Number(d.evictedVoteCount ?? NaN);
      let b = Number(d.stayVoteCount ?? NaN);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        const counts = {};
        rawVotes.forEach(v => { counts[v.targetId] = (counts[v.targetId] || 0) + 1; });
        a = evicted ? Number(counts[evicted.id] || 0) : 0;
        const nomineeIds = d.nomineeIds || view?.nominees || [];
        const stayId = nomineeIds.find(id => id !== evicted?.id);
        b = stayId ? Number(counts[stayId] || 0) : 0;
      }
      body += `<div class="eviction-result">${evicted ? playerCard(evicted,"EVICTED") : ""}<div class="eviction-vote-count">By a vote of <strong>${a} to ${b}</strong>, ${esc(name(evicted))}, you have been evicted.</div></div>`;
      return body;
    }
    const players = findPlayers(entry,view);
    if (entry.type === "nominations") {
      const hoh = byId(view, d.hohId);
      const nomineeIds = d.nomineeIds || view?.nominees || [];
      const nominees = nomineeIds.map(id => byId(view, id)).filter(Boolean);
      body += `<div class="ceremony-layout">
        <div class="ceremony-role-section">
          <div class="ceremony-label">HEAD OF HOUSEHOLD</div>
          <div class="ceremony-hoh">${playerCard(hoh, "HOH")}</div>
        </div>
        <div class="ceremony-arrow">▼</div>
        <div class="ceremony-role-section">
          <div class="ceremony-label">NOMINEES</div>
          <div class="ceremony-players">${nominees.map(h=>playerCard(h,"NOMINEE")).join("")}</div>
        </div>
      </div>`;
    } else if (entry.type === "veto-ceremony") {
      const hoh = byId(view, d.hohId);
      const holder = byId(view, d.winnerId);
      const nomineeIds = d.finalNomineeIds || d.nomineeIds || view?.nominees || [];
      const nominees = nomineeIds.map(id => byId(view, id)).filter(Boolean);
      const combinedTop = holder && hoh && holder.id === hoh.id;
      body += `<div class="ceremony-layout veto-ceremony-layout">
        <div class="ceremony-role-section">
          <div class="ceremony-label">${combinedTop ? "HEAD OF HOUSEHOLD / POV HOLDER" : "HEAD OF HOUSEHOLD"}</div>
          <div class="ceremony-hoh">${playerCard(hoh, combinedTop ? "HOH / POV HOLDER" : "HOH")}</div>
        </div>
        ${combinedTop ? "" : `<div class="ceremony-arrow">▼</div><div class="ceremony-role-section"><div class="ceremony-label">NOMINEES</div><div class="ceremony-players">${nominees.map(h=>playerCard(h,"NOMINEE")).join("")}</div></div><div class="ceremony-arrow">▼</div><div class="ceremony-role-section"><div class="ceremony-label">POV HOLDER</div><div class="ceremony-players">${playerCard(holder,"POV HOLDER")}</div></div>`}
        ${combinedTop ? `<div class="ceremony-arrow">▼</div>` : ""}
        <div class="ceremony-role-section"><div class="ceremony-label">${combinedTop ? "FINAL NOMINEES" : (d.vetoUsed ? "FINAL NOMINEES" : "NOMINEES")}</div><div class="ceremony-players">${nominees.map(h=>playerCard(h,"NOMINEE")).join("")}</div></div>
      </div>`;
    } else if (entry.type === "pov-players") {
      const hoh = byId(view, d.hohId);
      const nomineeIds = d.nomineeIds || [];
      const nominees = nomineeIds.map(id=>byId(view,id)).filter(Boolean);
      const picked = (d.povPlayers || []).map(id=>byId(view,id)).filter(h=>h && h.id!==d.hohId && !nomineeIds.includes(h.id));
      body += `<div class="pov-picked-layout">
        <div class="ceremony-role-section">
          <div class="ceremony-label">AUTOMATIC PLAYERS</div>
          <div class="ceremony-players">${playerCard(hoh,"HOH")} ${nominees.map(h=>playerCard(h,"NOMINEE")).join("")}</div>
        </div>
        <div class="ceremony-arrow">+</div>
        <div class="ceremony-role-section">
          <div class="ceremony-label">POV PICKED PLAYERS</div>
          <div class="ceremony-players">${picked.map(h=>playerCard(h,"PICKED")).join("")}</div>
        </div>
      </div>`;
    } else if (entry.type === "veto") {
      const winnerId = d.winnerId || entry.winnerId || entry.competition?.winner?.id;
      const winner = byId(view, winnerId);
      if (winner) body += `<div class="hero-players veto-winner-only">${playerCard(winner,"POV WINNER")}</div>`;
    } else if (entry.type === "wildcard") {
      const winnerId = d.winnerId || entry.winnerId || entry.competition?.winner?.id;
      const winner = byId(view, winnerId);
      if (winner) body += `<div class="hero-players wildcard-winner-only">${playerCard(winner,"WILDCARD WINNER")}</div>`;
    } else if (players.length) {
      // HOH competitions must display every eligible houseguest. Older versions
      // limited the generic event renderer to eight cards, which incorrectly
      // hid half the cast in a 16-person season.
      const displayPlayers = entry.type === "hoh" ? players : players;
      body += `<div class="hero-players ${entry.type === "hoh" ? "hoh-competition-players" : ""}">${displayPlayers.map(h=>playerCard(h,h.id===d.winnerId?"WINNER":"")).join("")}</div>`;
    }
    return body;
  }

  function eventText(entry) {
    const lines=(entry.lines||[]).map(x=>`<li>${esc(x)}</li>`).join("");
    return lines ? `<ul class="event-lines">${lines}</ul>` : "";
  }
  function renderEvent(index) {
    if(index < 0 || !history[index]) {
      eventKicker.textContent="READY TO SIMULATE"; eventTitle.textContent="Your season is ready";
      eventBody.innerHTML=`<div class="empty-event"><div class="empty-icon">BB</div><h2>Click Simulate Season</h2><p>Events will appear here one at a time in classic BrantSteele-style order.</p></div>`;
      eventCounter.textContent="0 / 0"; return;
    }
    const e=history[index], view=e.snapshot;
    eventKicker.textContent=`${weekLabel(e.week)}  •  ${(e.phase||"EVENT").replaceAll("-"," ").toUpperCase()}`;
    eventTitle.textContent=e.title;
    eventBody.innerHTML=(e.type==="live-feed"||e.type==="live-feed-day") ? liveFeedCard(e) : `${eventData(e,view)}${eventText(e)}`;
    eventCounter.textContent=`${index+1} / ${history.length}`;
  }
  function statusBadge(h,view){
    if(!h.active){if(h.placement===1)return `<span class="pill winner">WINNER</span>`;if(h.placement===2)return `<span class="pill runner">RUNNER-UP</span>`;if(h.juryMember)return `<span class="pill jury">JURY · ${ordinal(h.placement)}</span>`;return `<span class="pill out">${ordinal(h.placement)}</span>`;}
    if(view?.currentHOH===h.id)return `<span class="pill hoh">HOH</span>`;
    if(view?.nominees?.includes(h.id))return `<span class="pill nom">NOMINATED</span>`;
    if(view?.povPlayers?.includes(h.id))return `<span class="pill pov">POV</span>`;
    return `<span class="pill in">IN HOUSE</span>`;
  }
  function renderMemory(view=history[pointer]?.snapshot || null){
    const source=view?.houseguests||history[0]?.snapshot?.houseguests||state.houseguests.map(h=>({...h,active:true,evicted:false,juryMember:false,placement:null}));
    const active=source.filter(h=>h.active), out=source.filter(h=>!h.active).sort((a,b)=>(a.placement||99)-(b.placement||99));
    memoryWall.innerHTML=`<div class="wall-section"><h3>IN THE HOUSE · ${active.length}</h3><div class="memory-grid">${active.map(h=>`<div class="memory-card">${portrait(h,"memory-portrait")}<div>${esc(name(h))}</div>${statusBadge(h,view)}</div>`).join("")}</div></div><div class="wall-section"><h3>ELIMINATED</h3><div class="memory-grid eliminated">${out.map(h=>`<div class="memory-card">${portrait(h,"memory-portrait")}<div>${esc(name(h))}</div>${statusBadge(h,view)}</div>`).join("")}</div></div>`;
  }
  function renderTimeline(){timeline.innerHTML=history.map((e,i)=>{const revealed=i<=pointer;const title=revealed?e.title:"Locked Event";const week=revealed?weekLabel(e.week):"UNREVEALED";return `<button class="timeline-item ${i===pointer?"selected":""} ${revealed?"revealed":"locked"}" data-index="${i}"><span>${i+1}</span><div><strong>${esc(title)}</strong><small>${esc(week)}</small></div></button>`;}).join("");}
  function resultsUnlocked(){return pointer>=0&&pointer===history.length-1&&history[pointer]?.type==="winner";}
  function renderStats(){
    if(!resultsUnlocked()){
      tabContent.innerHTML=`<div class="tab-panel results-locked"><div class="results-lock-icon">🔒</div><h2>Season Results Locked</h2><p>The final placements and winner stay hidden until you actually reach the final winner reveal.</p></div>`;
      return;
    }
    const final=state.houseguests.slice().sort((a,b)=>(a.placement||99)-(b.placement||99));
    tabContent.innerHTML=`<div class="tab-panel"><h2>Season Results</h2><div class="results-grid">${final.map(h=>`<div class="result-card"><b>${h.placement?ordinal(h.placement):"—"}</b>${portrait(h,"result-portrait")}<strong>${esc(name(h))}</strong>${h.juryMember?"<small>Jury</small>":""}</div>`).join("")}</div></div>`;
  }
  function renderAlliances(){
    const a=state.alliances||[];
    const relationshipNote=state.season.relationshipsCustomized?"Custom starting relationships are active.":"Starting relationships are randomized when you simulate.";
    tabContent.innerHTML=`<div class="tab-panel"><h2>Alliances & Relationships</h2><p class="muted-note">${relationshipNote}</p>${a.length?a.map(x=>`<div class="alliance-card"><div class="alliance-heading"><div><h3>${esc(x.name)}</h3><small>${esc(x.type|| (x.custom?"Custom":"Simulated"))}</small></div><span>${x.memberIds.length} members</span></div><div class="alliance-members">${x.memberIds.map(id=>{const h=byId(null,id);return playerCard(h)}).join("")}</div></div>`).join(""):"<p>No alliances have formed yet.</p>"}</div>`;
  }
  function renderTab(){
    if(activeTab==="stats")renderStats(); else if(activeTab==="alliances")renderAlliances(); else {tabContent.innerHTML="";tabContent.classList.add("hidden");return;} tabContent.classList.remove("hidden");
  }
  function updateSeasonUI(){
    const complete=resultsUnlocked();
    seasonHeading.textContent=state.season.name||"Big Brother 23";
    seasonStatusLine.textContent=complete?"SEASON COMPLETE":pointer<0?"READY":`${weekLabel(history[pointer]?.week)} · ${history[pointer]?.title||""}`;
    previousBtn.disabled=pointer<0; nextBtn.disabled=pointer>=history.length-1; revealWeekBtn.disabled=pointer<0||pointer>=history.length-1; revealSeasonBtn.disabled=pointer>=history.length-1;
    renderEvent(pointer);renderTimeline();renderMemory(history[pointer]?.snapshot||null);renderTab();
  }
  function revealTo(i){pointer=Math.max(-1,Math.min(i,history.length-1));localStorage.setItem(REVEAL_KEY,String(pointer));updateSeasonUI();}
  function next(){if(pointer<history.length-1)revealTo(pointer+1)}
  function previous(){if(pointer>=0)revealTo(pointer-1)}
  function revealWeek(){if(pointer<0)return;const w=history[pointer].week;let i=pointer;while(i+1<history.length&&history[i+1].week===w)i++;revealTo(i)}

  function startSeason(){
    const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim());
    if(missing.length){toastMsg("Every houseguest needs a first and last name.");return;}
    const maleCount=state.houseguests.filter(h=>String(h.gender||"").toLowerCase()==="male").length;
    const femaleCount=state.houseguests.filter(h=>String(h.gender||"").toLowerCase()==="female").length;
    if(maleCount!==8||femaleCount!==8){toastMsg(`BB23 Team Captains requires 8 men and 8 women. Currently: ${maleCount} men, ${femaleCount} women.`);return;}
    syncLiveFeedSetupToState();
    const cast=JSON.parse(JSON.stringify(state));
    state=GameState.createInitialState(BB23_CONFIG);
    state.season={...state.season,...cast.season,liveFeedProfile:{...state.season.liveFeedProfile,...(cast.season?.liveFeedProfile||{})}};state.houseguests=cast.houseguests.map(h=>({...h,ratings:{general:50,physical:50,mental:50,social:50,strategic:50,...(h.ratings||{})}}));state.teams=cast.teams;state.relationships=cast.relationships;state.alliances=cast.alliances||[];
    SeasonEngine.simulateSeason(state,BB23_CONFIG);
    history=state.history||[];pointer=-1;localStorage.setItem(REVEAL_KEY,"-1");
    setupView.classList.add("hidden");seasonView.classList.remove("hidden");updateSeasonUI();
  }
  function resetSetup(){setupView.classList.remove("hidden");seasonView.classList.add("hidden");activeTab="event";}

  function ratingControl(h,k){return `<label><span class="rating-label"><span>${esc(k)}</span><b>${h.ratings[k]}</b></span><input type="range" min="0" max="100" value="${h.ratings[k]}" data-id="${h.id}" data-rating="${k}"></label>`;}
  function renderCast(){
    castGrid.innerHTML=state.houseguests.map(h=>`<article class="cast-card"><div class="setup-portrait">${portrait(h,"setup-img")}</div><div class="cast-body"><div class="cast-number">HOUSEGUEST ${String(h.slot).padStart(2,"0")}</div><div class="cast-name">${esc(name(h))}</div><label>First Name<input data-id="${h.id}" data-field="firstName" value="${esc(h.firstName)}"></label><label>Last Name<input data-id="${h.id}" data-field="lastName" value="${esc(h.lastName)}"></label><label>Gender<select data-id="${h.id}" data-field="gender"><option value="" ${!h.gender?"selected":""}>Not specified</option><option value="male" ${h.gender==="male"?"selected":""}>Male</option><option value="female" ${h.gender==="female"?"selected":""}>Female</option></select></label><label>Portrait URL<input data-id="${h.id}" data-field="portraitUrl" value="${esc(h.portraitUrl)}" placeholder="https://..."></label><div class="portrait-tools"><label class="upload-portrait">Upload Picture<input type="file" accept="image/*" data-id="${h.id}" data-portrait-upload></label>${h.portraitUrl?`<button type="button" class="clear-portrait" data-clear-portrait="${h.id}">Remove Picture</button>`:""}</div><small class="portrait-help">Use a URL or upload a JPG, PNG, WEBP, or GIF. Uploaded pictures are saved with the cast.</small><div class="rating-grid">${BB23_CONFIG.ratingKeys.map(k=>ratingControl(h,k)).join("")}</div></div></article>`).join("");
  }
  function renderTeams(){teamsGrid.innerHTML=state.teams.map(t=>`<div class="team"><h3>${esc(t.name)}</h3><div class="team-list">${t.memberIds.map(id=>byId(null,id)).filter(Boolean).map(h=>`<div class="team-player">${portrait(h,"mini-portrait")}${esc(name(h))}</div>`).join("")}</div></div>`).join("");}
  function teamOptions(){return state.houseguests.map(h=>`<option value="${h.id}">${esc(name(h))}</option>`).join("");}

  function ensureRelationship(a,b){
    if(!state.relationships[a])state.relationships[a]={};
    if(!state.relationships[a][b])state.relationships[a][b]=GameState.emptyRelationships();
    if(!state.relationships[a][b].type)state.relationships[a][b].type="Unspecified";
    return state.relationships[a][b];
  }
  function renderRelationships(){
    if(!relationshipsGrid)return;
    const ids=state.houseguests.map(h=>h.id);
    if(ids.length<2){relationshipsGrid.innerHTML="<p>Add at least two houseguests.</p>";return;}
    const currentA=relationshipsGrid.dataset.a&&ids.includes(relationshipsGrid.dataset.a)?relationshipsGrid.dataset.a:ids[0];
    const currentB=relationshipsGrid.dataset.b&&ids.includes(relationshipsGrid.dataset.b)&&relationshipsGrid.dataset.b!==currentA?relationshipsGrid.dataset.b:(ids[1]===currentA?ids[0]:ids[1]);
    relationshipsGrid.dataset.a=currentA;relationshipsGrid.dataset.b=currentB;
    const r=ensureRelationship(currentA,currentB);
    const typeOptions=REL_TYPES.map(t=>`<option value="${esc(t)}" ${r.type===t?"selected":""}>${esc(t)}</option>`).join("");
    const a=byId(null,currentA),b=byId(null,currentB);
    relationshipsGrid.innerHTML=`<div class="relationship-editor"><div class="relationship-pair-preview"><div class="relationship-person">${portrait(a,"relationship-portrait")}<strong>${esc(name(a))}</strong></div><div class="relationship-connector">↔</div><div class="relationship-person">${portrait(b,"relationship-portrait")}<strong>${esc(name(b))}</strong></div></div><div class="relationship-selects"><label>Houseguest A<select data-rel-a>${teamOptions()}</select></label><label>Houseguest B<select data-rel-b>${teamOptions()}</select></label></div><label class="relationship-type-field">Relationship Type<select data-rel-type>${typeOptions}</select></label><label class="relationship-check"><input type="checkbox" data-rel-both checked> Apply values to both directions</label><div class="relationship-sliders">${REL_KEYS.map(k=>`<label><span>${REL_LABELS[k]} <b data-rel-value="${k}">${r[k]}</b></span><input type="range" min="0" max="100" value="${r[k]}" data-rel-key="${k}"></label>`).join("")}</div><p class="relationship-help">Choose a relationship type such as Showmance, Bromance, Best Friends or Rivalry, then fine-tune the six relationship ratings. The type is saved with the relationship and can influence how the relationship is presented.</p></div>`;
    const aSel=relationshipsGrid.querySelector('[data-rel-a]'),bSel=relationshipsGrid.querySelector('[data-rel-b]');
    aSel.value=currentA;bSel.value=currentB;
  }
  function setRelationshipType(a,b,type,both){
    const r=ensureRelationship(a,b);r.type=type;
    if(both){const rr=ensureRelationship(b,a);rr.type=type;}
    state.season.relationshipsCustomized=true;
  }
  function setRelationshipPair(a,b,key,value,both){
    const r=ensureRelationship(a,b);r[key]=Number(value);
    if(both){const rr=ensureRelationship(b,a);rr[key]=Number(value);}
    state.season.relationshipsCustomized=true;
  }
  function renderAlliancesSetup(){
    if(!allianceSetup)return;
    const alliances=state.alliances||[];
    const memberPicker=state.houseguests.map(h=>`<label class="member-picker-card"><input type="checkbox" data-new-alliance-member="${h.id}"><span class="member-picker-portrait">${portrait(h,"alliance-picker-portrait")}</span><span>${esc(name(h))}</span></label>`).join("");
    const typeOptions=ALLIANCE_TYPES.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
    const customCards=alliances.filter(a=>a.custom).map(a=>{
      const members=a.memberIds.map(id=>{const h=byId(null,id);return h?`<div class="setup-alliance-member">${portrait(h,"alliance-mini-portrait")}<span>${esc(name(h))}</span></div>`:""}).join("");
      return `<div class="setup-alliance"><div><strong>${esc(a.name)}</strong><small>${esc(a.type||"Custom")} · ${a.memberIds.length} members</small></div><div class="setup-alliance-members">${members}</div><button type="button" data-remove-alliance="${a.id}" class="danger-link">Remove</button></div>`;
    }).join("");
    allianceSetup.innerHTML=`<div class="alliance-create"><label>Alliance Name<input id="newAllianceName" placeholder="e.g. The Cookout"></label><label>Alliance Type<select id="newAllianceType">${typeOptions}</select></label><div class="member-picker">${memberPicker}</div><button id="addAllianceBtn" class="primary">+ Create Alliance</button></div><div class="custom-alliance-list">${customCards||"<p class=\"muted-note\">No custom alliances yet. Simulated alliances may still form during the season.</p>"}</div>`;
    $("addAllianceBtn")?.addEventListener("click",()=>{
      const allianceName=$("newAllianceName").value.trim();
      const allianceType=$("newAllianceType").value;
      const memberIds=[...allianceSetup.querySelectorAll('[data-new-alliance-member]:checked')].map(x=>x.dataset.newAllianceMember);
      if(!allianceName){toastMsg("Enter an alliance name.");return;}
      if(memberIds.length<2){toastMsg("Choose at least two members.");return;}
      const id=`custom-alliance-${Date.now()}`;
      const a={id,name:allianceName,type:allianceType,memberIds,formedWeek:0,active:true,custom:true};
      state.alliances.push(a);
      memberIds.forEach(id=>{const h=byId(null,id);if(h&&!h.allianceIds.includes(a.id))h.allianceIds.push(a.id);});
      renderAlliancesSetup();toastMsg(`${allianceName} created.`);
    });
    allianceSetup.querySelectorAll('[data-remove-alliance]').forEach(btn=>btn.addEventListener("click",()=>{
      const id=btn.dataset.removeAlliance;state.alliances=state.alliances.filter(a=>a.id!==id);state.houseguests.forEach(h=>h.allianceIds=h.allianceIds.filter(x=>x!==id));renderAlliancesSetup();
    }));
  }
  function ensureFeedSettings(){
    state.season=state.season||{};
    if(typeof state.season.liveFeedsEnabled!=="boolean")state.season.liveFeedsEnabled=true;
    state.season.liveFeedProfile={backstories:"",priorRelationships:"",personalities:"",conflictsAndRomance:"",recurringTopics:"",feedInstructions:"",...(state.season.liveFeedProfile||{})};
  }
  function renderLiveFeedSetup(){
    ensureFeedSettings();
    if(liveFeedsToggle){liveFeedsToggle.textContent=`Live Feeds: ${state.season.liveFeedsEnabled?"ON":"OFF"}`;liveFeedsToggle.classList.toggle("off",!state.season.liveFeedsEnabled);liveFeedsToggle.setAttribute("aria-pressed",String(state.season.liveFeedsEnabled));}
    liveFeedPromptPanel?.classList.toggle("hidden",!state.season.liveFeedsEnabled);
    const p=state.season.liveFeedProfile;
    [["feedBackstories","backstories"],["feedPriorRelationships","priorRelationships"],["feedPersonalities","personalities"],["feedConflictsAndRomance","conflictsAndRomance"],["feedRecurringTopics","recurringTopics"],["feedInstructions","feedInstructions"]].forEach(([id,key])=>{const el=$(id);if(el&&document.activeElement!==el)el.value=p[key]||"";});
  }
  function syncLiveFeedSetupToState(){
    ensureFeedSettings();
    [["feedBackstories","backstories"],["feedPriorRelationships","priorRelationships"],["feedPersonalities","personalities"],["feedConflictsAndRomance","conflictsAndRomance"],["feedRecurringTopics","recurringTopics"],["feedInstructions","feedInstructions"]].forEach(([id,key])=>{const el=$(id);if(el)state.season.liveFeedProfile[key]=el.value;});
  }
  function refreshSetup(){renderCast();renderTeams();renderRelationships();renderAlliancesSetup();renderLiveFeedSetup();validate();$("seasonName").value=state.season.name;$("themeUrl").value=state.season.themeUrl||"";$("logoUrl").value=state.season.logoUrl||"";}
  function validate(){const ok=state.houseguests.every(h=>h.firstName.trim()&&h.lastName.trim());validity.textContent=ok?"Cast ready":"Names required";validity.classList.toggle("invalid",!ok);}
  function assignDemoTeams(){state.teams.forEach(t=>t.memberIds=[]);state.houseguests.forEach((h,i)=>{const t=state.teams[Math.floor(i/4)];h.teamId=t.id;t.memberIds.push(h.id);});}
  function loadDemo(){state=GameState.createInitialState(BB23_CONFIG);state.season.name="Big Brother 23 — Custom Demo";state.houseguests.forEach((h,i)=>{[h.firstName,h.lastName]=demoNames[i];h.ratings.general=45+(i*7)%45;h.ratings.physical=40+(i*11)%55;h.ratings.mental=42+(i*13)%53;h.ratings.social=45+(i*9)%50;h.ratings.strategic=40+(i*17)%58;});assignDemoTeams();refreshSetup();toastMsg("Demo cast loaded.");}
  function refreshSetupPortrait(h){const card=castGrid.querySelector(`.cast-card input[data-id="${h.id}"]`)?.closest('.cast-card');const box=card?.querySelector('.setup-portrait');if(box)box.innerHTML=portrait(h,"setup-img");const tools=card?.querySelector('.portrait-tools');if(tools)tools.innerHTML=`${h.portraitUrl?`<button type="button" class="clear-portrait" data-clear-portrait="${h.id}">Remove Picture</button>`:""}`;}
  function handleCastEdit(e){
    const el=e.target;
    const h=state.houseguests.find(x=>x.id===el.dataset.id);
    if(!h)return;
    if(el.dataset.field) h[el.dataset.field]=el.value;
    if(el.dataset.rating){
      if(!h.ratings) h.ratings={general:50,physical:50,mental:50,social:50,strategic:50};
      h.ratings[el.dataset.rating]=Math.max(0,Math.min(100,Number(el.value)));
      const label=el.closest("label")?.querySelector(".rating-label b");
      if(label) label.textContent=String(h.ratings[el.dataset.rating]);
    }
    if(el.dataset.field==="portraitUrl") refreshSetupPortrait(h);
    if(el.dataset.field==="firstName"||el.dataset.field==="lastName"){
      const n=el.closest(".cast-card")?.querySelector(".cast-name"); if(n)n.textContent=name(h);
    }
    validate();
  }
  castGrid.addEventListener("input",handleCastEdit);
  castGrid.addEventListener("change",handleCastEdit);
  castGrid.addEventListener("change",async e=>{const el=e.target;if(!el.matches('[data-portrait-upload]'))return;const h=state.houseguests.find(x=>x.id===el.dataset.id);const file=el.files?.[0];if(!h||!file)return;if(!file.type.startsWith("image/")){toastMsg("Please choose an image file.");el.value="";return;}try{h.portraitUrl=await imageFileToDataUrl(file,640,0.82);refreshSetup();toastMsg(`${name(h)} picture uploaded.`);}catch(err){console.error(err);toastMsg("Could not read that picture.");}el.value="";});
  castGrid.addEventListener("click",e=>{const b=e.target.closest('[data-clear-portrait]');if(!b)return;const h=state.houseguests.find(x=>x.id===b.dataset.clearPortrait);if(!h)return;h.portraitUrl="";refreshSetup();toastMsg("Picture removed.");});
  function imageFileToDataUrl(file,maxSize=640,quality=0.82){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error||new Error("File read failed"));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Image decode failed"));img.onload=()=>{const scale=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",quality));};img.src=reader.result;};reader.readAsDataURL(file);});}

  relationshipsGrid?.addEventListener("change",e=>{
    const aSel=relationshipsGrid.querySelector('[data-rel-a]'),bSel=relationshipsGrid.querySelector('[data-rel-b]');
    if(e.target.matches('[data-rel-a],[data-rel-b]')){if(aSel.value===bSel.value){toastMsg("Choose two different houseguests.");return;}relationshipsGrid.dataset.a=aSel.value;relationshipsGrid.dataset.b=bSel.value;renderRelationships();return;}
    if(e.target.matches('[data-rel-type]')){const both=relationshipsGrid.querySelector('[data-rel-both]')?.checked;setRelationshipType(aSel.value,bSel.value,e.target.value,both);return;}
  });
  relationshipsGrid?.addEventListener("input",e=>{
    if(!e.target.matches('[data-rel-key]'))return;const a=relationshipsGrid.dataset.a,b=relationshipsGrid.dataset.b,both=relationshipsGrid.querySelector('[data-rel-both]')?.checked;setRelationshipPair(a,b,e.target.dataset.relKey,e.target.value,both);const out=relationshipsGrid.querySelector(`[data-rel-value="${e.target.dataset.relKey}"]`);if(out)out.textContent=e.target.value;
  });

  $("seasonName").addEventListener("input",e=>state.season.name=e.target.value);$("themeUrl").addEventListener("input",e=>state.season.themeUrl=e.target.value);$("logoUrl").addEventListener("input",e=>state.season.logoUrl=e.target.value);
  liveFeedsToggle?.addEventListener("click",()=>{ensureFeedSettings();state.season.liveFeedsEnabled=!state.season.liveFeedsEnabled;renderLiveFeedSetup();toastMsg(state.season.liveFeedsEnabled?"Detailed live feeds enabled.":"Live feeds disabled for this season.");});
  ["feedBackstories","feedPriorRelationships","feedPersonalities","feedConflictsAndRomance","feedRecurringTopics","feedInstructions"].forEach(id=>$(id)?.addEventListener("input",syncLiveFeedSetupToState));
  $("loadDemoBtn").onclick=loadDemo;$("resetBtn").onclick=()=>{if(confirm("Reset the entire cast?")){state=GameState.createInitialState(BB23_CONFIG);refreshSetup();}};
  $("saveBtn").onclick=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));toastMsg("Cast, relationships and alliances saved.");};
  $("exportBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="bb23-custom-season-v16.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $("importInput").onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!x.houseguests||x.houseguests.length!==16)throw Error("Invalid 16-player cast");x.relationships=x.relationships||{};Object.values(x.relationships).forEach(row=>Object.values(row||{}).forEach(r=>{if(r&&!r.type)r.type="Unspecified";}));x.alliances=(x.alliances||[]).map(a=>({...a,type:a.type||"Custom"}));x.season=x.season||{};if(typeof x.season.liveFeedsEnabled!=="boolean")x.season.liveFeedsEnabled=true;x.season.liveFeedProfile={backstories:"",priorRelationships:"",personalities:"",conflictsAndRomance:"",recurringTopics:"",feedInstructions:"",...(x.season.liveFeedProfile||{})};state=x;refreshSetup();toastMsg("Season imported.");}catch(err){alert("Import failed: "+err.message)}e.target.value="";};
  $("simulateBtn").onclick=startSeason;$("resimulateBtn").onclick=startSeason;$("backToSetupBtn").onclick=resetSetup;
  previousBtn.onclick=previous;nextBtn.onclick=next;revealWeekBtn.onclick=revealWeek;revealSeasonBtn.onclick=()=>revealTo(history.length-1);
  timeline.addEventListener("click",e=>{const b=e.target.closest("button[data-index]");if(!b)return;const i=Number(b.dataset.index);if(i<=pointer+1)revealTo(i);});
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));renderTab();});

  function resume(){try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw){ for(const key of LEGACY_STORAGE_KEYS){ raw=localStorage.getItem(key); if(raw) break; } }
    if(!raw)return;
    const x=JSON.parse(raw); if(!x.houseguests)return;
    state=x; state.intendedTarget=state.intendedTarget||null; state.targetHistory=state.targetHistory||[]; state.backdoorTargetId=state.backdoorTargetId||null;
    history=state.history||[];
    const saved=Number(localStorage.getItem(REVEAL_KEY));
    if(history.length){pointer=Number.isFinite(saved)?saved:-1;setupView.classList.add("hidden");seasonView.classList.remove("hidden");updateSeasonUI();}
  }catch(e){console.warn(e)}}
  refreshSetup();resume();
})();
