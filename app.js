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
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[c]));
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
            ? `<img src="${escapeHtml(hg.portraitUrl)}" alt="${escapeHtml(playerName(hg))}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';">
               <div class="placeholder" style="display:none;">PORTRAIT ERROR</div>`
            : `<div class="placeholder">PORTRAIT URL</div>`}
        </div>
        <div class="cast-body">
          <div class="cast-number">HOUSEGUEST ${String(hg.slot).padStart(2, "0")}</div>
          <div class="cast-name">${escapeHtml(playerName(hg))}</div>

          <div class="cast-fields">
            <label>First Name
              <input type="text" data-id="${hg.id}" data-field="firstName" value="${escapeHtml(hg.firstName)}" placeholder="First name">
            </label>
            <label>Last Name
              <input type="text" data-id="${hg.id}" data-field="lastName" value="${escapeHtml(hg.lastName)}" placeholder="Last name">
            </label>
            <label>Portrait URL
              <input type="url" data-id="${hg.id}" data-field="portraitUrl" value="${escapeHtml(hg.portraitUrl)}" placeholder="https://...">
            </label>

            <div class="row">
              ${BB23_CONFIG.ratingKeys.slice(0,2).map(key => ratingControl(hg, key)).join("")}
            </div>
            <div class="row">
              ${BB23_CONFIG.ratingKeys.slice(2,4).map(key => ratingControl(hg, key)).join("")}
            </div>
            ${ratingControl(hg, "strategic")}
          </div>
        </div>
      </article>
    `).join("");
  }

  function ratingControl(hg, key) {
    return `
      <label>
        <span class="rating-label"><span>${key}</span><strong>${hg.ratings[key]}</strong></span>
        <input type="range" min="1" max="100" value="${hg.ratings[key]}"
          data-id="${hg.id}" data-rating="${key}">
      </label>
    `;
  }

  function renderTeams() {
    teamsGrid.innerHTML = state.teams.map(team => {
      const members = team.memberIds.map(id => state.houseguests.find(h => h.id === id)).filter(Boolean);
      return `
        <div class="team">
          <h3>${escapeHtml(team.name)}</h3>
          <div class="team-sub">${members.length}/4 assigned</div>
          <div class="team-list">
            ${members.length ? members.map(hg => `
              <div class="team-player">
                ${hg.portraitUrl ? `<img class="mini-portrait" src="${escapeHtml(hg.portraitUrl)}" alt="">` : `<div class="mini-portrait"></div>`}
                ${escapeHtml(playerName(hg))}
              </div>
            `).join("") : `<div class="team-player">Team draft occurs in the premiere.</div>`}
          </div>
        </div>
      `;
    }).join("");
  }

  function validate() {
    const missing = state.houseguests.filter(hg => !hg.firstName.trim() || !hg.lastName.trim());
    validity.textContent = missing.length
      ? `${missing.length} player${missing.length === 1 ? "" : "s"} need a name`
      : "Cast ready";
    validity.classList.toggle("invalid", Boolean(missing.length));
  }

  function refresh() {
    renderCast();
    renderTeams();
    validate();
    statePreview.textContent = JSON.stringify(state, null, 2);
  }

  function assignDemoTeams() {
    state.teams.forEach(t => t.memberIds = []);
    state.houseguests.forEach((hg, i) => {
      const team = state.teams[Math.floor(i / 4)];
      hg.teamId = team.id;
      team.memberIds.push(hg.id);
    });
  }

  function loadDemo() {
    state = GameState.createInitialState(BB23_CONFIG);
    state.season.name = "Big Brother 23 — Custom Demo";
    state.houseguests.forEach((hg, i) => {
      hg.firstName = demoNames[i][0];
      hg.lastName = demoNames[i][1];
      hg.ratings.general = 45 + ((i * 7) % 45);
      hg.ratings.physical = 40 + ((i * 11) % 55);
      hg.ratings.mental = 42 + ((i * 13) % 53);
      hg.ratings.social = 45 + ((i * 9) % 50);
      hg.ratings.strategic = 40 + ((i * 17) % 58);
    });
    assignDemoTeams();
    refresh();
    showToast("Demo cast loaded.");
  }

  castGrid.addEventListener("input", event => {
    const el = event.target;
    const hg = state.houseguests.find(h => h.id === el.dataset.id);
    if (!hg) return;

    if (el.dataset.field) {
      hg[el.dataset.field] = el.value;
      if (el.dataset.field === "portraitUrl") {
        renderCast();
      }
    }

    if (el.dataset.rating) {
      hg.ratings[el.dataset.rating] = Number(el.value);
      const strong = el.parentElement.querySelector("strong");
      if (strong) strong.textContent = el.value;
    }

    validate();
    statePreview.textContent = JSON.stringify(state, null, 2);
  });

  document.getElementById("seasonName").addEventListener("input", e => {
    state.season.name = e.target.value;
    statePreview.textContent = JSON.stringify(state, null, 2);
  });

  document.getElementById("themeUrl").addEventListener("input", e => {
    state.season.themeUrl = e.target.value;
    statePreview.textContent = JSON.stringify(state, null, 2);
  });

  document.getElementById("logoUrl").addEventListener("input", e => {
    state.season.logoUrl = e.target.value;
    statePreview.textContent = JSON.stringify(state, null, 2);
  });

  document.getElementById("loadDemoBtn").addEventListener("click", loadDemo);

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset the entire Stage 1 cast?")) return;
    state = GameState.createInitialState(BB23_CONFIG);
    document.getElementById("seasonName").value = state.season.name;
    document.getElementById("themeUrl").value = "";
    document.getElementById("logoUrl").value = "";
    refresh();
    showToast("Cast reset.");
  });

  document.getElementById("saveBtn").addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    showToast("Season saved in this browser.");
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "bb23-custom-season-stage1.json";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Season JSON exported.");
  });

  document.getElementById("importInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported.houseguests || imported.houseguests.length !== 16) {
        throw new Error("The file does not contain a valid 16-player BB23 cast.");
      }
      state = imported;
      document.getElementById("seasonName").value = state.season?.name || "";
      document.getElementById("themeUrl").value = state.season?.themeUrl || "";
      document.getElementById("logoUrl").value = state.season?.logoUrl || "";
      refresh();
      showToast("Season imported.");
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    e.target.value = "";
  });

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      document.getElementById("seasonName").value = state.season?.name || "";
      document.getElementById("themeUrl").value = state.season?.themeUrl || "";
      document.getElementById("logoUrl").value = state.season?.logoUrl || "";
    } catch (_) {}
  }

  refresh();
})();
