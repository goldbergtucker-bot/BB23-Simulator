/*
 * BIG BROTHER 23 CUSTOM SIMULATOR — STAGE 1 UI
 */

(() => {
  const STORAGE_KEY = "bb23CustomSimulatorStage1";

  let state = GameState.createInitialState(BB23_CONFIG);

  const castGrid = document.getElementById("castGrid");
  const teamsGrid = document.getElementById("teamsGrid");
  const statePreview = document.getElementById("statePreview");
  const validity = document.getElementById("validity");
  const toast = document.getElementById("toast");

  const setupView = document.getElementById("setupView");
  const seasonView = document.getElementById("seasonView");
  const startSeasonBtn = document.getElementById("startSeasonBtn");
  const revealNextBtn = document.getElementById("revealNextBtn");
  const revealPrevBtn = document.getElementById("revealPrevBtn");
  const revealAllBtn = document.getElementById("revealAllBtn");
  const backToSetupBtn = document.getElementById("backToSetupBtn");
  const feed = document.getElementById("feed");
  const castStatusList = document.getElementById("castStatusList");
  const seasonHeading = document.getElementById("seasonHeading");
  const seasonStatusLine = document.getElementById("seasonStatusLine");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const pageBadge = document.getElementById("pageBadge");

  let revealEvents = [];
  let revealPointer = 0;
  let displayState = state;

  const demoNames = [
    ["Tucker", "Player"], ["Grace", "Player"], ["Antonio", "Player"], ["Riley", "Player"],
    ["Aly", "Player"], ["Stephanie", "Player"], ["Jordan", "Player"], ["Morgan", "Player"],
    ["Cameron", "Player"], ["Taylor", "Player"], ["Alex", "Player"], ["Casey", "Player"],
    ["Drew", "Player"], ["Jamie", "Player"], ["Logan", "Player"], ["Parker", "Player"]
  ];

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function playerName(hg) {
    const name = `${hg.firstName} ${hg.lastName}`.trim();
    return name || `Houseguest ${hg.slot}`;
  }

  function renderCast() {
    castGrid.innerHTML = state.houseguests.map(hg => `
      <article class="cast-card">
        <div class="portrait-wrap">
          ${hg.portraitUrl
            ? `<img src="${escapeHtml(hg.portraitUrl)}" alt="${escapeHtml(playerName(hg))}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"><div class="placeholder" style="display:none">PORTRAIT ERROR</div>`
            : `<div class="placeholder">PORTRAIT URL</div>`}
        </div>
        <div class="cast-body">
          <div class="cast-number">HOUSEGUEST ${String(hg.slot).padStart(2,"0")}</div>
          <div class="cast-name">${escapeHtml(playerName(hg))}</div>
          <div class="cast-fields">
            <label>First Name<input type="text" data-id="${hg.id}" data-field="firstName" value="${escapeHtml(hg.firstName)}" placeholder="First name"></label>
            <label>Last Name<input type="text" data-id="${hg.id}" data-field="lastName" value="${escapeHtml(hg.lastName)}" placeholder="Last name"></label>
            <label>Portrait URL<input type="url" data-id="${hg.id}" data-field="portraitUrl" value="${escapeHtml(hg.portraitUrl)}" placeholder="https://..."></label>
            <div class="row">${BB23_CONFIG.ratingKeys.slice(0,2).map(key=>ratingControl(hg,key)).join("")}</div>
            <div class="row">${BB23_CONFIG.ratingKeys.slice(2,4).map(key=>ratingControl(hg,key)).join("")}</div>
            ${ratingControl(hg,"strategic")}
          </div>
        </div>
      </article>`).join("");
  }
  function ratingControl(hg,key){return `<label><span class="rating-label"><span>${key}</span><strong>${hg.ratings[key]}</strong></span><input type="range" min="1" max="100" value="${hg.ratings[key]}" data-id="${hg.id}" data-rating="${key}"></label>`}
  function renderTeams(){teamsGrid.innerHTML=state.teams.map(team=>{const members=team.memberIds.map(id=>state.houseguests.find(h=>h.id===id)).filter(Boolean);return `<div class="team"><h3>${escapeHtml(team.name)}</h3><div class="team-sub">${members.length}/4 assigned</div><div class="team-list">${members.length?members.map(h=>`<div class="team-player">${h.portraitUrl?`<img class="mini-portrait" src="${escapeHtml(h.portraitUrl)}">`:`<div class="mini-portrait"></div>`}${escapeHtml(playerName(h))}</div>`).join(""):"<div class=\"team-player\">Team draft occurs in the premiere.</div>"}</div></div>`}).join("")}
  function validate(){const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim());validity.textContent=missing.length?`${missing.length} player${missing.length===1?"":"s"} need a name`:"Cast ready";validity.classList.toggle("invalid",Boolean(missing.length))}
  function refresh(){renderCast();renderTeams();validate();statePreview.textContent=JSON.stringify(state,null,2)}
  function assignDemoTeams(){state.teams.forEach(t=>t.memberIds=[]);state.houseguests.forEach((hg,i)=>{const t=state.teams[Math.floor(i/4)];hg.teamId=t.id;t.memberIds.push(hg.id)})}
  function loadDemo(){state=GameState.createInitialState(BB23_CONFIG);state.season.name="Big Brother 23 — Custom Demo";state.houseguests.forEach((hg,i)=>{hg.firstName=demoNames[i][0];hg.lastName=demoNames[i][1];hg.ratings.general=45+(i*7%45);hg.ratings.physical=40+(i*11%55);hg.ratings.mental=42+(i*13%53);hg.ratings.social=45+(i*9%50);hg.ratings.strategic=40+(i*17%58)});assignDemoTeams();refresh();showToast("Demo cast loaded.")}

  castGrid.addEventListener("input",event=>{const el=event.target,hg=state.houseguests.find(h=>h.id===el.dataset.id);if(!hg)return;if(el.dataset.field){hg[el.dataset.field]=el.value;if(el.dataset.field==="portraitUrl")renderCast()}if(el.dataset.rating){hg.ratings[el.dataset.rating]=Number(el.value);const strong=el.parentElement.querySelector("strong");if(strong)strong.textContent=el.value}validate();statePreview.textContent=JSON.stringify(state,null,2)});
  document.getElementById("seasonName").addEventListener("input",e=>{state.season.name=e.target.value;statePreview.textContent=JSON.stringify(state,null,2)});
  document.getElementById("themeUrl").addEventListener("input",e=>{state.season.themeUrl=e.target.value;statePreview.textContent=JSON.stringify(state,null,2)});
  document.getElementById("logoUrl").addEventListener("input",e=>{state.season.logoUrl=e.target.value;statePreview.textContent=JSON.stringify(state,null,2)});
  document.getElementById("loadDemoBtn").addEventListener("click",loadDemo);
  document.getElementById("resetBtn").addEventListener("click",()=>{if(!confirm("Reset the entire Stage 1 cast?"))return;state=GameState.createInitialState(BB23_CONFIG);document.getElementById("seasonName").value=state.season.name;document.getElementById("themeUrl").value="";document.getElementById("logoUrl").value="";refresh();showToast("Cast reset.")});
  document.getElementById("saveBtn").addEventListener("click",()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));showToast("Season saved in this browser.")});
  document.getElementById("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bb23-custom-season-stage1.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);showToast("Season JSON exported.")});
  document.getElementById("importInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!imported.houseguests||imported.houseguests.length!==16)throw new Error("The file does not contain a valid 16-player BB23 cast.");state=imported;document.getElementById("seasonName").value=state.season?.name||"";document.getElementById("themeUrl").value=state.season?.themeUrl||"";document.getElementById("logoUrl").value=state.season?.logoUrl||"";refresh();showToast("Season imported.")}catch(err){alert(`Import failed: ${err.message}`)}e.target.value=""});

  function phaseTag(phase){return ({premiere:"PREMIERE",team:"TEAM PHASE","high-roller":"HIGH ROLLER'S ROOM",standard:"STANDARD WEEK",finale:"FINALE"}[phase]||String(phase||"").toUpperCase())}
  function eventLabel(type){return ({teams:"TEAMS",hoh:"HOH",twist:"TWIST",wildcard:"WILDCARD",team:"TEAM SAFETY","team-safety":"TEAM SAFETY","pov-players":"POV PLAYERS",pov:"POV","veto":"POV", "veto-ceremony":"VETO CEREMONY", nominations:"NOMINATIONS",power:"POWER", "bb-bucks":"BB BUCKS","high-roller-room":"HIGH ROLLER'S ROOM","eviction-voting":"EVICTION VOTE",eviction:"EVICTION",alliance:"ALLIANCE","final3-part1":"FINAL HOH PART 1","final3-part2":"FINAL HOH PART 2","final3-part3":"FINAL HOH PART 3","final-decision":"FINAL HOH DECISION","jury-vote":"JURY VOTE",winner:"WINNER"}[type]||String(type||"").replaceAll("-"," ").toUpperCase())}
  function findHg(id, source=displayState){return source?.houseguests?.find(h=>h.id===id)||state.houseguests.find(h=>h.id===id)}
  function portrait(id,source=displayState,small=false){const h=findHg(id,source);return h?.portraitUrl?`<img class="event-portrait ${small?"small":""}" src="${escapeHtml(h.portraitUrl)}" alt="${escapeHtml(playerName(h))}">`:`<div class="event-portrait ${small?"small":""}">${escapeHtml((h?.firstName||"?").charAt(0))}</div>`}
  function names(ids,source=displayState){return (ids||[]).map(id=>findHg(id,source)).filter(Boolean).map(playerName)}

  function eventIds(entry,snap){
    const s=snap||displayState;
    if(entry.type==="hoh") return s.currentHOH?[s.currentHOH]:[];
    if(entry.type==="nominations"||entry.type==="veto-ceremony") return (s.nominees||[]).slice();
    if(entry.type==="pov-players") return (s.povPlayers||[]).slice();
    if(entry.type==="veto") return (s.vetoWinners||[]).slice();
    if(entry.type==="eviction") return (s.evicted||[]).slice(-1);
    if(entry.type==="eviction-voting") return (s.evictionVotes||[]).map(v=>v.voterId).concat((s.nominees||[]));
    if(entry.type==="winner"||entry.type==="final-decision") return [s.finale?.winnerId,s.finale?.thirdPlaceId].filter(Boolean);
    return [];
  }
  function renderEvent(entry){const snap=entry.snapshot||state;const ids=eventIds(entry,snap);const people=ids.slice(0,8);return `<article class="event-card event-${escapeHtml(entry.type)}"><div class="event-top"><span class="event-tag">${phaseTag(entry.phase)}</span><span class="event-label">${eventLabel(entry.type)}</span></div><h3>${escapeHtml(entry.title)}</h3>${people.length?`<div class="event-portraits">${people.map(id=>`<div class="event-person">${portrait(id,snap)}<span>${escapeHtml(playerName(findHg(id,snap)))}</span></div>`).join("")}</div>`:""}<ul>${entry.lines.map(l=>`<li>${escapeHtml(l)}</li>`).join("")}</ul></article>`}

  function renderCastStatus(source=displayState){const rows=source.houseguests.slice().sort((a,b)=>{if(a.active!==b.active)return a.active?-1:1;return (a.placement??999)-(b.placement??999)});castStatusList.innerHTML=rows.map(hg=>{let badge=`<span class="status-pill active">In House</span>`;if(!hg.active){if(hg.placement===1)badge=`<span class="status-pill winner">WINNER</span>`;else if(hg.placement===2)badge=`<span class="status-pill runner-up">Runner-Up</span>`;else if(hg.juryMember)badge=`<span class="status-pill jury">Jury · ${ordinalSafe(hg.placement)}</span>`;else badge=`<span class="status-pill evicted">${ordinalSafe(hg.placement)} place</span>`}else if(hg.id===source.currentHOH)badge=`<span class="status-pill hoh">HOH</span>`;else if(hg.nominated)badge=`<span class="status-pill nominated">Nominated</span>`;else if(hg.safe)badge=`<span class="status-pill safe">Safe</span>`;return `<div class="status-row ${hg.active?"":"is-out"}">${portrait(hg.id,source,true)}<div class="status-row-body"><div class="status-row-name">${escapeHtml(playerName(hg))}</div></div>${badge}</div>`}).join("")}
  function ordinalSafe(n){return n==null?"":SeasonEngine.ordinal(n)}
  function revealNext(){if(revealPointer>=revealEvents.length)return;const entry=revealEvents[revealPointer];displayState=entry.snapshot||state;const wrap=document.createElement("div");wrap.innerHTML=renderEvent(entry);feed.appendChild(wrap.firstElementChild);revealPointer++;state.ui=state.ui||{};state.ui.revealedEvents=revealPointer;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderCastStatus(displayState);updateSeasonControls();feed.scrollTop=feed.scrollHeight}
  function revealAll(){while(revealPointer<revealEvents.length)revealNext()}
  function revealPrevious(){if(revealPointer<=0)return;revealPointer--;feed.innerHTML="";displayState=revealPointer>0?(revealEvents[revealPointer-1].snapshot||state):GameState.createInitialState(BB23_CONFIG);for(let i=0;i<revealPointer;i++){const wrap=document.createElement("div");wrap.innerHTML=renderEvent(revealEvents[i]);feed.appendChild(wrap.firstElementChild)}state.ui=state.ui||{};state.ui.revealedEvents=revealPointer;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderCastStatus(displayState);updateSeasonControls();feed.scrollTop=feed.scrollHeight}
  function updateSeasonControls(){const done=revealPointer>=revealEvents.length;revealNextBtn.disabled=done;revealAllBtn.disabled=done;revealPrevBtn.disabled=revealPointer<=0;seasonStatusLine.textContent=done?"The season is complete — all events have been revealed.":revealPointer===0?`Ready — ${revealEvents.length} events are queued.`:`Event ${revealPointer} of ${revealEvents.length} revealed — use Reveal Next to continue.`}

  startSeasonBtn.addEventListener("click",()=>{const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim());if(missing.length){showToast("Every houseguest needs a name before the season can start.");return}const preSeasonState=GameState.clone(state);SeasonEngine.simulateSeason(state,BB23_CONFIG);state.ui={revealedEvents:0};localStorage.setItem(STORAGE_KEY,JSON.stringify(state));revealEvents=state.history;revealPointer=0;displayState=preSeasonState;feed.innerHTML="";setupView.classList.add("hidden");seasonView.classList.remove("hidden");pageSubtitle.textContent="Season in Progress";pageBadge.textContent="LIVE SIMULATION";seasonHeading.textContent=state.season.name||"Big Brother 23 — Custom Cast";renderCastStatus(displayState);updateSeasonControls();revealNext()});
  revealPrevBtn.addEventListener("click",revealPrevious);revealNextBtn.addEventListener("click",revealNext);revealAllBtn.addEventListener("click",revealAll);

  backToSetupBtn.addEventListener("click",()=>{if(!confirm("Start a brand new season? Your current cast stays, but all game results will be cleared."))return;const preservedCast=state.houseguests.map(hg=>({id:hg.id,slot:hg.slot,firstName:hg.firstName,lastName:hg.lastName,portraitUrl:hg.portraitUrl,ratings:Object.assign({},hg.ratings),teamId:hg.teamId}));const preservedSeason=Object.assign({},state.season);state=GameState.createInitialState(BB23_CONFIG);state.houseguests.forEach((h,i)=>Object.assign(h,preservedCast[i]||{}));state.season=Object.assign(state.season,preservedSeason,{evictionCount:0});state.teams.forEach(t=>t.memberIds=[]);state.houseguests.forEach(h=>{const t=state.teams.find(x=>x.id===h.teamId);if(t)t.memberIds.push(h.id)});localStorage.setItem(STORAGE_KEY,JSON.stringify(state));seasonView.classList.add("hidden");setupView.classList.remove("hidden");pageSubtitle.textContent="Custom Cast Setup";pageBadge.textContent="BB23 TEMPLATE";document.getElementById("seasonName").value=state.season.name;refresh();showToast("New season ready — review your cast and start again.")});

  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved){try{state=JSON.parse(saved);document.getElementById("seasonName").value=state.season?.name||"";document.getElementById("themeUrl").value=state.season?.themeUrl||"";document.getElementById("logoUrl").value=state.season?.logoUrl||""}catch(_){} }
  const resumeSeason=Boolean(state.phase&&state.phase!=="setup"&&state.history&&state.history.length);
  if(resumeSeason){revealEvents=state.history;revealPointer=Math.min(Number(state.ui?.revealedEvents)||0,revealEvents.length);feed.innerHTML="";displayState=revealPointer>0?(revealEvents[revealPointer-1].snapshot||state):GameState.createInitialState(BB23_CONFIG);setupView.classList.add("hidden");seasonView.classList.remove("hidden");pageSubtitle.textContent=state.phase==="complete"&&revealPointer>=revealEvents.length?"Season Complete":"Season in Progress";pageBadge.textContent=revealPointer>=revealEvents.length?"SEASON COMPLETE":"LIVE SIMULATION";seasonHeading.textContent=state.season.name||"Big Brother 23 — Custom Cast";for(let i=0;i<revealPointer;i++){const wrap=document.createElement("div");wrap.innerHTML=renderEvent(revealEvents[i]);feed.appendChild(wrap.firstElementChild)}renderCastStatus(displayState);updateSeasonControls()}else refresh();
})();
