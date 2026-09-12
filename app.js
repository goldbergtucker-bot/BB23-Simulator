/*
 * BIG BROTHER 23 CUSTOM SIMULATOR
 * BrantSteele-style event viewer.
 * The engine simulates once; the UI reveals immutable event snapshots one at a time.
 */
(() => {
  const STORAGE_KEY = "bb23CustomSimulatorStage2";
  const REVEAL_KEY = "bb23CustomSimulatorRevealIndex";
  let state = GameState.createInitialState(BB23_CONFIG);
  let history = [];
  let pointer = 0;

  const $ = id => document.getElementById(id);
  const castGrid = $("castGrid"), teamsGrid = $("teamsGrid"), statePreview = $("statePreview"), validity = $("validity"), toast = $("toast");
  const setupView = $("setupView"), seasonView = $("seasonView"), feed = $("feed"), castStatusList = $("castStatusList"), statsList = $("statsList");
  const seasonHeading = $("seasonHeading"), seasonStatusLine = $("seasonStatusLine"), pageSubtitle = $("pageSubtitle"), pageBadge = $("pageBadge");
  const demoNames = [["Tucker","Player"],["Grace","Player"],["Antonio","Player"],["Riley","Player"],["Aly","Player"],["Stephanie","Player"],["Jordan","Player"],["Morgan","Player"],["Cameron","Player"],["Taylor","Player"],["Alex","Player"],["Casey","Player"],["Drew","Player"],["Jamie","Player"],["Logan","Player"],["Parker","Player"]];

  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function name(h){return `${h.firstName} ${h.lastName}`.trim()||`Houseguest ${h.slot}`;}
  function ordinal(n){return SeasonEngine.ordinal(n);}
  function toastMsg(m){toast.textContent=m;toast.classList.add("show");clearTimeout(toastMsg.t);toastMsg.t=setTimeout(()=>toast.classList.remove("show"),2200);}

  function renderCast(){
    castGrid.innerHTML=state.houseguests.map(h=>`<article class="cast-card">
      <div class="portrait-wrap">${h.portraitUrl?`<img src="${esc(h.portraitUrl)}" alt="${esc(name(h))}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"><div class="placeholder" style="display:none">PORTRAIT ERROR</div>`:`<div class="placeholder">PORTRAIT URL</div>`}</div>
      <div class="cast-body"><div class="cast-number">HOUSEGUEST ${String(h.slot).padStart(2,"0")}</div><div class="cast-name">${esc(name(h))}</div>
      <div class="cast-fields"><label>First Name<input type="text" data-id="${h.id}" data-field="firstName" value="${esc(h.firstName)}"></label>
      <label>Last Name<input type="text" data-id="${h.id}" data-field="lastName" value="${esc(h.lastName)}"></label>
      <label>Portrait URL<input type="url" data-id="${h.id}" data-field="portraitUrl" value="${esc(h.portraitUrl)}" placeholder="https://..."></label>
      <div class="row">${BB23_CONFIG.ratingKeys.slice(0,2).map(k=>ratingControl(h,k)).join("")}</div>
      <div class="row">${BB23_CONFIG.ratingKeys.slice(2,4).map(k=>ratingControl(h,k)).join("")}</div>${ratingControl(h,"strategic")}</div></div></article>`).join("");
  }
  function ratingControl(h,k){return `<label><span class="rating-label"><span>${k}</span><strong>${h.ratings[k]}</strong></span><input type="range" min="1" max="100" value="${h.ratings[k]}" data-id="${h.id}" data-rating="${k}"></label>`;}
  function renderTeams(){teamsGrid.innerHTML=state.teams.map(t=>{const ms=t.memberIds.map(id=>state.houseguests.find(h=>h.id===id)).filter(Boolean);return `<div class="team"><h3>${esc(t.name)}</h3><div class="team-sub">${ms.length}/4 assigned</div><div class="team-list">${ms.length?ms.map(h=>`<div class="team-player">${h.portraitUrl?`<img class="mini-portrait" src="${esc(h.portraitUrl)}" alt="">`:`<div class="mini-portrait"></div>`}${esc(name(h))}</div>`).join(""):"<div class=\"team-player\">Team draft occurs in the premiere.</div>"}</div></div>`}).join("");}
  function validate(){const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim());validity.textContent=missing.length?`${missing.length} player${missing.length===1?"":"s"} need a name`:"Cast ready";validity.classList.toggle("invalid",!!missing.length);}
  function refreshSetup(){renderCast();renderTeams();validate();statePreview.textContent=JSON.stringify(state,null,2);}
  function assignDemoTeams(){state.teams.forEach(t=>t.memberIds=[]);state.houseguests.forEach((h,i)=>{const t=state.teams[Math.floor(i/4)];h.teamId=t.id;t.memberIds.push(h.id);});}
  function loadDemo(){state=GameState.createInitialState(BB23_CONFIG);state.season.name="Big Brother 23 â Custom Demo";state.houseguests.forEach((h,i)=>{[h.firstName,h.lastName]=demoNames[i];h.ratings.general=45+(i*7)%45;h.ratings.physical=40+(i*11)%55;h.ratings.mental=42+(i*13)%53;h.ratings.social=45+(i*9)%50;h.ratings.strategic=40+(i*17)%58;});assignDemoTeams();refreshSetup();toastMsg("Demo cast loaded.");}

  castGrid.addEventListener("input",e=>{const el=e.target,h=state.houseguests.find(x=>x.id===el.dataset.id);if(!h)return;if(el.dataset.field){h[el.dataset.field]=el.value;if(el.dataset.field==="portraitUrl")renderCast();}if(el.dataset.rating){h.ratings[el.dataset.rating]=Number(el.value);const s=el.parentElement.querySelector("strong");if(s)s.textContent=el.value;}validate();statePreview.textContent=JSON.stringify(state,null,2);});
  ["seasonName","themeUrl","logoUrl"].forEach(id=>$(id).addEventListener("input",e=>{state.season[{seasonName:"name",themeUrl:"themeUrl",logoUrl:"logoUrl"}[id]]=e.target.value;statePreview.textContent=JSON.stringify(state,null,2);}));
  $("loadDemoBtn").onclick=loadDemo;
  $("resetBtn").onclick=()=>{if(confirm("Reset the entire cast?")){state=GameState.createInitialState(BB23_CONFIG);refreshSetup();toastMsg("Cast reset.");}};
  $("saveBtn").onclick=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));toastMsg("Season saved.");};
  $("exportBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="bb23-custom-season.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $("importInput").onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!x.houseguests||x.houseguests.length!==16)throw Error("Invalid 16-player cast");state=x;$("seasonName").value=state.season?.name||"";$("themeUrl").value=state.season?.themeUrl||"";$("logoUrl").value=state.season?.logoUrl||"";refreshSetup();toastMsg("Season imported.");}catch(err){alert("Import failed: "+err.message)}e.target.value="";};

  function snapshotAt(i){return history[i]?.snapshot||null;}
  function getViewState(){return pointer>0?snapshotAt(pointer-1):null;}
  function statusBadge(h,view){
    if(!h.active){if(h.placement===1)return `<span class="status-pill winner">WINNER</span>`;if(h.placement===2)return `<span class="status-pill runner-up">RUNNER-UP</span>`;if(h.juryMember)return `<span class="status-pill jury">JURY Â· ${ordinal(h.placement)}</span>`;return `<span class="status-pill evicted">${ordinal(h.placement)} PLACE</span>`;}
    if(view?.currentHOH===h.id)return `<span class="status-pill hoh">HOH</span>`;
    if(view?.nominees?.includes(h.id))return `<span class="status-pill nominated">NOMINATED</span>`;
    if(view?.povPlayers?.includes(h.id))return `<span class="status-pill pov">POV</span>`;
    if(h.safe)return `<span class="status-pill safe">SAFE</span>`;
    return `<span class="status-pill active">IN HOUSE</span>`;
  }
  function renderCastStatus(view=getViewState()){
    const source=view?.houseguests||state.houseguests;
    const rows=source.slice().sort((a,b)=>{if(a.active!==b.active)return a.active?-1:1;return (a.placement??0)-(b.placement??0);});
    castStatusList.innerHTML=rows.map(h=>`<div class="status-row ${h.active?"":"is-out"}">${h.portraitUrl?`<img class="mini-portrait" src="${esc(h.portraitUrl)}" alt="">`:`<div class="mini-portrait"></div>`}<div class="status-row-body"><div class="status-row-name">${esc(name(h))}</div></div>${statusBadge(h,view)}</div>`).join("");
  }

  function findMentionedPlayers(entry,view){
    const all=view.houseguests;const text=`${entry.title} ${(entry.lines||[]).join(" ")}`.toLowerCase();
    return all.filter(h=>text.includes(name(h).toLowerCase()));
  }
  function idsForEntry(entry,view){
    const data=entry.data||{};
    if(data.participantIds?.length)return data.participantIds.map(id=>view.houseguests.find(h=>h.id===id)).filter(Boolean);
    return findMentionedPlayers(entry,view);
  }
  function portraits(players){return players.length?`<div class="event-portraits">${players.slice(0,12).map(h=>`<div class="event-player">${h.portraitUrl?`<img src="${esc(h.portraitUrl)}" alt="${esc(name(h))}">`:`<div class="event-portrait-placeholder"></div>`}<strong>${esc(name(h))}</strong></div>`).join("")}</div>`:"";}
  function voteMarkup(entry,view){
    const votes=(entry.data?.votes||[]);
    if(!votes.length)return "";
    return `<div class="vote-list">${votes.map(v=>{const voter=view.houseguests.find(h=>h.id===v.voterId),target=view.houseguests.find(h=>h.id===v.targetId);if(!voter||!target)return "";return `<div class="vote-row"><div class="vote-person">${voter.portraitUrl?`<img src="${esc(voter.portraitUrl)}">`:`<div class="vote-placeholder"></div>`}<strong>${esc(name(voter))}</strong></div><span class="vote-arrow">â</span><div class="vote-person target">${target.portraitUrl?`<img src="${esc(target.portraitUrl)}">`:`<div class="vote-placeholder"></div>`}<strong>${esc(name(target))}</strong></div></div>`}).join("")}</div>`;
  }
  function eventMarkup(entry,view){
    const players=idsForEntry(entry,view);
    const lines=(entry.lines||[]).map(l=>`<li>${esc(l)}</li>`).join("");
    const votes=(entry.type==="eviction-voting"||entry.type==="jury-vote")?voteMarkup(entry,view):"";
    return `<article class="feed-entry feed-${esc(entry.type)}"><div class="feed-entry-tag">${esc((entry.phase||"event").replaceAll("-"," ").toUpperCase())}</div><h3>${esc(entry.title)}</h3>${portraits(players)}${votes}<ul>${lines}</ul></article>`;
  }
  function renderStats(){
    if(!statsList)return;
    const source=state.statistics||{};
    const rows=state.houseguests.slice().sort((a,b)=>(a.placement??99)-(b.placement??99));
    statsList.innerHTML=rows.map(h=>{const x=source[h.id]||h.stats||{};return `<div class="stat-row"><div class="stat-player">${h.portraitUrl?`<img class="mini-portrait" src="${esc(h.portraitUrl)}">`:`<div class="mini-portrait"></div>`}<strong>${esc(name(h))}</strong><span>${h.placement?ordinal(h.placement):"In House"}</span></div><div class="stat-values"><span>HOH <b>${x.hohWins||0}</b></span><span>POV <b>${x.povWins||0}</b></span><span>NOMS <b>${x.nominations||0}</b></span><span>VOTES AGAINST <b>${x.votesAgainst||0}</b></span><span>COMP WINS <b>${x.competitionWins||0}</b></span><span>JURY VOTES <b>${x.juryVotesReceived||0}</b></span></div></div>`}).join("");
  }
  function weekLabel(w){return w==="Final"?"FINALE":w===0?"MOVE-IN":`WEEK ${w}`;}
  function renderFeed(){
    feed.innerHTML="";let lastWeek=Symbol();
    history.slice(0,pointer).forEach((entry,i)=>{if(entry.week!==lastWeek){const hdr=document.createElement("div");hdr.className="feed-week-header";hdr.textContent=weekLabel(entry.week);feed.appendChild(hdr);lastWeek=entry.week;}const wrap=document.createElement("div");wrap.innerHTML=eventMarkup(entry,entry.snapshot);feed.appendChild(wrap.firstElementChild);});
    feed.scrollTop=feed.scrollHeight;
  }
  function updateSeasonUI(){
    const done=pointer>=history.length;$("previousBtn").disabled=pointer<=1;$("revealNextBtn").disabled=done;$("revealAllBtn").disabled=done;$("revealWeekBtn").disabled=done;
    seasonStatusLine.textContent=done?"Season complete â every event has been revealed.":`Event ${pointer} of ${history.length}`;
    renderCastStatus(getViewState());renderFeed();renderStats();
  }
  function revealNext(){if(pointer>=history.length)return;pointer++;localStorage.setItem(REVEAL_KEY,String(pointer));updateSeasonUI();}
  function revealPrevious(){if(pointer<=1)return;pointer--;localStorage.setItem(REVEAL_KEY,String(pointer));updateSeasonUI();}
  function revealWeek(){if(pointer>=history.length)return;const w=history[pointer].week;while(pointer<history.length&&history[pointer].week===w)pointer++;localStorage.setItem(REVEAL_KEY,String(pointer));updateSeasonUI();}
  function revealAll(){pointer=history.length;localStorage.setItem(REVEAL_KEY,String(pointer));updateSeasonUI();}

  function startSeason(){
    const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim());if(missing.length){toastMsg("Every houseguest needs a first and last name.");return;}
    SeasonEngine.simulateSeason(state,BB23_CONFIG);history=state.history.slice();pointer=0;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.setItem(REVEAL_KEY,"0");
    setupView.classList.add("hidden");seasonView.classList.remove("hidden");pageSubtitle.textContent="Season in Progress";pageBadge.textContent="LIVE SIMULATION";seasonHeading.textContent=state.season.name||"Big Brother 23 â Custom Cast";updateSeasonUI();revealNext();
  }
  $("startSeasonBtn").onclick=startSeason;
  // These controls are added by JS so the repository also works with the original HTML.
  const controls=document.createElement("div");controls.className="season-controls";controls.innerHTML='<button id="previousBtn" class="secondary">Previous</button><button id="revealNextBtn">Reveal Next</button><button id="revealWeekBtn" class="secondary">Reveal Week</button><button id="revealAllBtn" class="secondary">Reveal Rest</button>';seasonView.querySelector(".season-hero .hero-actions").innerHTML="";seasonView.querySelector(".season-hero .hero-actions").appendChild(controls);$("previousBtn").onclick=revealPrevious;$("revealNextBtn").onclick=revealNext;$("revealWeekBtn").onclick=revealWeek;$("revealAllBtn").onclick=revealAll;
  $("backToSetupBtn").onclick=()=>{if(!confirm("Start a new simulation using this same cast?"))return;const cast=state.houseguests.map(h=>JSON.parse(JSON.stringify(h)));const name0=state.season.name;state=GameState.createInitialState(BB23_CONFIG);state.houseguests=cast.map((h,i)=>{const x=state.houseguests[i];Object.assign(x,{id:h.id,slot:h.slot,firstName:h.firstName,lastName:h.lastName,portraitUrl:h.portraitUrl,teamId:h.teamId,ratings:h.ratings});return x;});state.season.name=name0;state.teams.forEach(t=>t.memberIds=state.houseguests.filter(h=>h.teamId===t.id).map(h=>h.id));localStorage.setItem(STORAGE_KEY,JSON.stringify(state));localStorage.removeItem(REVEAL_KEY);history=[];pointer=0;seasonView.classList.add("hidden");setupView.classList.remove("hidden");pageSubtitle.textContent="Custom Cast Setup";pageBadge.textContent="BB23 TEMPLATE";refreshSetup();toastMsg("New simulation ready.");};

  // Resume setup/cast from storage, but never auto-reveal the completed season.
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved)try{state=JSON.parse(saved);$("seasonName").value=state.season?.name||"";$("themeUrl").value=state.season?.themeUrl||"";$("logoUrl").value=state.season?.logoUrl||"";}catch{}
  if(state.history?.length){history=state.history;let savedPointer=Number(localStorage.getItem(REVEAL_KEY));pointer=Number.isFinite(savedPointer)?Math.max(0,Math.min(savedPointer,history.length)):0;setupView.classList.add("hidden");seasonView.classList.remove("hidden");pageSubtitle.textContent=state.phase==="complete"?"Season Complete":"Season in Progress";pageBadge.textContent=state.phase==="complete"?"SEASON COMPLETE":"LIVE SIMULATION";seasonHeading.textContent=state.season.name||"Big Brother 23 â Custom Cast";updateSeasonUI();}else refreshSetup();
})();
