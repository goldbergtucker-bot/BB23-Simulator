/*
 * BIG BROTHER 23 CUSTOM SIMULATOR
 * BrantSteele-style presentation layer.
 * The season engine still owns simulation/data; this file owns navigation
 * and rendering of one event at a time.
 */
(() => {
  const STORAGE_KEY = "bb23CustomSimulatorBrantsteeleV4";
  const REVEAL_KEY = "bb23CustomSimulatorBrantsteeleV4Index";
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
  const demoNames = [["Tucker","Player"],["Grace","Player"],["Antonio","Player"],["Riley","Player"],["Aly","Player"],["Stephanie","Player"],["Jordan","Player"],["Morgan","Player"],["Cameron","Player"],["Taylor","Player"],["Alex","Player"],["Casey","Player"],["Drew","Player"],["Jamie","Player"],["Logan","Player"],["Parker","Player"]];

  const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const name = h => `${h.firstName} ${h.lastName}`.trim() || `Houseguest ${h.slot}`;
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
  function eventData(entry, view) {
    const d = entry.data || {};
    if (entry.type === "eviction-voting") {
      const votes = d.votes || view?.evictionVotes || [];
      return `<div class="vote-list">${votes.map(v=>{const voter=byId(view,v.voterId),target=byId(view,v.targetId);return `<div class="vote-row"><div class="vote-person">${portrait(voter,"vote-portrait")}<strong>${esc(name(voter))}</strong></div><div class="vote-arrow">VOTES TO EVICT</div><div class="vote-person target">${portrait(target,"vote-portrait")}<strong>${esc(name(target))}</strong></div></div>`}).join("")}</div>`;
    }
    if (entry.type === "jury-vote") {
      const votes = d.votes || [];
      return `<div class="vote-list jury-votes">${votes.map(v=>{const juror=byId(view,v.voterId),target=byId(view,v.targetId);return `<div class="vote-row"><div class="vote-person">${portrait(juror,"vote-portrait")}<strong>${esc(name(juror))}</strong></div><div class="vote-arrow">VOTES FOR</div><div class="vote-person target">${portrait(target,"vote-portrait")}<strong>${esc(name(target))}</strong></div></div>`}).join("")}</div>`;
    }
    const players = findPlayers(entry,view);
    if (entry.type === "nominations" || entry.type === "veto-ceremony" || entry.type === "eviction") {
      return `<div class="hero-players">${players.slice(0,3).map(h=>playerCard(h, (d.nomineeIds||[]).includes(h.id)?"NOMINEE":"")).join("")}</div>`;
    }
    if (players.length) return `<div class="hero-players">${players.slice(0,8).map(h=>playerCard(h, h.id===d.winnerId?"WINNER":"")).join("")}</div>`;
    return "";
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
    eventBody.innerHTML=`${eventData(e,view)}${eventText(e)}`;
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
    const source=view?.houseguests||state.houseguests;
    const active=source.filter(h=>h.active), out=source.filter(h=>!h.active).sort((a,b)=>(a.placement||99)-(b.placement||99));
    memoryWall.innerHTML=`<div class="wall-section"><h3>IN THE HOUSE · ${active.length}</h3><div class="memory-grid">${active.map(h=>`<div class="memory-card">${portrait(h,"memory-portrait")}<div>${esc(name(h))}</div>${statusBadge(h,view)}</div>`).join("")}</div></div><div class="wall-section"><h3>ELIMINATED</h3><div class="memory-grid eliminated">${out.map(h=>`<div class="memory-card">${portrait(h,"memory-portrait")}<div>${esc(name(h))}</div>${statusBadge(h,view)}</div>`).join("")}</div></div>`;
  }
  function renderTimeline(){timeline.innerHTML=history.map((e,i)=>`<button class="timeline-item ${i===pointer?"selected":""} ${i<=pointer?"revealed":"locked"}" data-index="${i}"><span>${i+1}</span><div><strong>${esc(e.title)}</strong><small>${weekLabel(e.week)}</small></div></button>`).join("");}
  function renderStats(){
    const final=state.houseguests.slice().sort((a,b)=>(a.placement||99)-(b.placement||99));
    tabContent.innerHTML=`<div class="tab-panel"><h2>Season Results</h2><div class="results-grid">${final.map(h=>`<div class="result-card"><b>${h.placement?ordinal(h.placement):"—"}</b>${portrait(h,"result-portrait")}<strong>${esc(name(h))}</strong>${h.juryMember?"<small>Jury</small>":""}</div>`).join("")}</div></div>`;
  }
  function renderAlliances(){
    const a=state.alliances||[]; tabContent.innerHTML=`<div class="tab-panel"><h2>Alliances & Relationships</h2>${a.length?a.map(x=>`<div class="alliance-card"><h3>${esc(x.name)}</h3><div class="alliance-members">${x.memberIds.map(id=>{const h=byId(null,id);return playerCard(h)}).join("")}</div></div>`).join(""):"<p>No alliances have formed yet.</p>"}</div>`;
  }
  function renderTab(){
    if(activeTab==="stats")renderStats(); else if(activeTab==="alliances")renderAlliances(); else {tabContent.innerHTML=""; tabContent.classList.add("hidden"); return;} tabContent.classList.remove("hidden");
  }
  function updateSeasonUI(){
    const view=history[pointer]?.snapshot; const complete=state.phase==="complete";
    seasonHeading.textContent=state.season.name||"Big Brother 23";
    seasonStatusLine.textContent=complete?"SEASON COMPLETE":pointer<0?"READY":`${weekLabel(history[pointer]?.week)} · ${history[pointer]?.title||""}`;
    previousBtn.disabled=pointer<0; nextBtn.disabled=pointer>=history.length-1; revealWeekBtn.disabled=pointer<0 || pointer>=history.length-1; revealSeasonBtn.disabled=pointer>=history.length-1;
    renderEvent(pointer); renderTimeline(); renderMemory(view); renderTab();
  }
  function revealTo(i){ pointer=Math.max(-1,Math.min(i,history.length-1)); localStorage.setItem(REVEAL_KEY,String(pointer)); updateSeasonUI(); }
  function next(){if(pointer<history.length-1)revealTo(pointer+1);}
  function previous(){if(pointer>=0)revealTo(pointer-1);}
  function revealWeek(){if(pointer<0)return; const w=history[pointer].week; let i=pointer; while(i+1<history.length && history[i+1].week===w)i++; revealTo(i);}
  function startSeason(resimulate=false){
    const missing=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim()); if(missing.length){toastMsg("Every houseguest needs a first and last name."); return;}
    const cast=JSON.parse(JSON.stringify(state));
    state=GameState.createInitialState(BB23_CONFIG); state.season=cast.season; state.houseguests=cast.houseguests; state.teams=cast.teams; state.relationships=cast.relationships;
    SeasonEngine.simulateSeason(state,BB23_CONFIG); history=state.history||[]; pointer=-1;
    state.phase="complete"; // simulation is complete; UI reveal is separate
    setupView.classList.add("hidden"); seasonView.classList.remove("hidden"); localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); localStorage.setItem(REVEAL_KEY,"-1");
    toastMsg(resimulate?"Season resimulated.":"Season simulated."); updateSeasonUI();
  }
  function resetSetup(){setupView.classList.remove("hidden");seasonView.classList.add("hidden");activeTab="event";}
  function assignDemoTeams(){state.teams.forEach(t=>t.memberIds=[]);state.houseguests.forEach((h,i)=>{const t=state.teams[Math.floor(i/4)];h.teamId=t.id;t.memberIds.push(h.id);});}
  function loadDemo(){state=GameState.createInitialState(BB23_CONFIG);state.season.name="Big Brother 23 — Custom Demo";state.houseguests.forEach((h,i)=>{[h.firstName,h.lastName]=demoNames[i];h.ratings.general=45+(i*7)%45;h.ratings.physical=40+(i*11)%55;h.ratings.mental=42+(i*13)%53;h.ratings.social=45+(i*9)%50;h.ratings.strategic=40+(i*17)%58;});assignDemoTeams();refreshSetup();toastMsg("Demo cast loaded.");}
  function ratingControl(h,k){return `<label><span class="rating-label"><span>${k}</span><strong>${h.ratings[k]}</strong></span><input type="range" min="1" max="100" value="${h.ratings[k]}" data-id="${h.id}" data-rating="${k}"></label>`;}
  function renderCast(){castGrid.innerHTML=state.houseguests.map(h=>`<article class="cast-card"><div class="setup-portrait">${portrait(h,"setup-img")}</div><div class="cast-body"><div class="cast-number">HOUSEGUEST ${String(h.slot).padStart(2,"0")}</div><div class="cast-name">${esc(name(h))}</div><label>First Name<input data-id="${h.id}" data-field="firstName" value="${esc(h.firstName)}"></label><label>Last Name<input data-id="${h.id}" data-field="lastName" value="${esc(h.lastName)}"></label><label>Portrait URL<input data-id="${h.id}" data-field="portraitUrl" value="${esc(h.portraitUrl)}" placeholder="https://..."></label><div class="portrait-tools"><label class="upload-portrait">Upload Picture<input type="file" accept="image/*" data-id="${h.id}" data-portrait-upload></label>${h.portraitUrl?`<button type="button" class="clear-portrait" data-clear-portrait="${h.id}">Remove Picture</button>`:""}</div><small class="portrait-help">Use a URL or upload a JPG, PNG, WEBP, or GIF. Uploaded pictures are saved with the cast.</small><div class="rating-grid">${BB23_CONFIG.ratingKeys.map(k=>ratingControl(h,k)).join("")}</div></div></article>`).join("");}
  function renderTeams(){teamsGrid.innerHTML=state.teams.map(t=>`<div class="team"><h3>${esc(t.name)}</h3><div class="team-list">${t.memberIds.map(id=>byId(null,id)).filter(Boolean).map(h=>`<div class="team-player">${portrait(h,"mini-portrait")}${esc(name(h))}</div>`).join("")}</div></div>`).join("");}
  function validate(){const n=state.houseguests.filter(h=>!h.firstName.trim()||!h.lastName.trim()).length;validity.textContent=n?`${n} player${n===1?"":"s"} need a name`:"Cast ready";validity.classList.toggle("invalid",!!n);}
  function refreshSetup(){renderCast();renderTeams();validate();$("seasonName").value=state.season.name;$("themeUrl").value=state.season.themeUrl||"";$("logoUrl").value=state.season.logoUrl||"";}

  castGrid.addEventListener("input",e=>{const el=e.target,h=state.houseguests.find(x=>x.id===el.dataset.id);if(!h)return;if(el.dataset.field){h[el.dataset.field]=el.value;const card=el.closest('.cast-card');const title=card?.querySelector('.cast-name');if(title)title.textContent=name(h);if(el.dataset.field==="portraitUrl") refreshSetupPortrait(h);}if(el.dataset.rating){h.ratings[el.dataset.rating]=Number(el.value);const s=el.parentElement.querySelector("strong");if(s)s.textContent=el.value;}validate();});

  function refreshSetupPortrait(h){const card=castGrid.querySelector(`.cast-card input[data-id="${h.id}"]`)?.closest('.cast-card');const box=card?.querySelector('.setup-portrait');if(box)box.innerHTML=portrait(h,"setup-img");const tools=card?.querySelector('.portrait-tools');if(tools)tools.innerHTML=`${h.portraitUrl?`<button type="button" class="clear-portrait" data-clear-portrait="${h.id}">Remove Picture</button>`:""}`;}

  castGrid.addEventListener("change",async e=>{const el=e.target;if(!el.matches('[data-portrait-upload]'))return;const h=state.houseguests.find(x=>x.id===el.dataset.id);const file=el.files?.[0];if(!h||!file)return;if(!file.type.startsWith("image/")){toastMsg("Please choose an image file.");el.value="";return;}try{h.portraitUrl=await imageFileToDataUrl(file,640,0.82);refreshSetup();toastMsg(`${name(h)} picture uploaded.`);}catch(err){console.error(err);toastMsg("Could not read that picture.");}el.value="";});

  castGrid.addEventListener("click",e=>{const b=e.target.closest('[data-clear-portrait]');if(!b)return;const h=state.houseguests.find(x=>x.id===b.dataset.clearPortrait);if(!h)return;h.portraitUrl="";refreshSetup();toastMsg("Picture removed.");});

  function imageFileToDataUrl(file,maxSize=640,quality=0.82){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(reader.error||new Error("File read failed"));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("Image decode failed"));img.onload=()=>{const scale=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",quality));};img.src=reader.result;};reader.readAsDataURL(file);});}
  $("seasonName").addEventListener("input",e=>state.season.name=e.target.value); $("themeUrl").addEventListener("input",e=>state.season.themeUrl=e.target.value); $("logoUrl").addEventListener("input",e=>state.season.logoUrl=e.target.value);
  $("loadDemoBtn").onclick=loadDemo; $("resetBtn").onclick=()=>{if(confirm("Reset the entire cast?")){state=GameState.createInitialState(BB23_CONFIG);refreshSetup();}};
  $("saveBtn").onclick=()=>{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));toastMsg("Cast saved.");};
  $("exportBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="bb23-custom-season.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
  $("importInput").onchange=async e=>{try{const x=JSON.parse(await e.target.files[0].text());if(!x.houseguests||x.houseguests.length!==16)throw Error("Invalid 16-player cast");state=x;refreshSetup();toastMsg("Season imported.");}catch(err){alert("Import failed: "+err.message)}e.target.value="";};
  $("simulateBtn").onclick=()=>startSeason(false); $("resimulateBtn").onclick=()=>startSeason(true); $("backToSetupBtn").onclick=resetSetup;
  previousBtn.onclick=previous; nextBtn.onclick=next; revealWeekBtn.onclick=revealWeek; revealSeasonBtn.onclick=()=>revealTo(history.length-1);
  timeline.addEventListener("click",e=>{const b=e.target.closest("button[data-index]");if(!b)return;const i=Number(b.dataset.index);if(i<=pointer+1)revealTo(i);});
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));renderTab();});

  function resume(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;const x=JSON.parse(raw);if(!x.houseguests)return;state=x;history=state.history||[];const saved=Number(localStorage.getItem(REVEAL_KEY));if(history.length){pointer=Number.isFinite(saved)?saved:-1;setupView.classList.add("hidden");seasonView.classList.remove("hidden");updateSeasonUI();}}catch(e){console.warn(e)}}
  refreshSetup(); resume();
})();
