"use strict";

const A = Arkham;
const T = Tabletop;
const storeKey = "arkham-archive.v1.";
const main = document.querySelector("main");
const dialog = document.querySelector("dialog");
const announcer = document.querySelector("#announcer");
const modeNames = { story: "자동 시나리오", table: "SCED 수동 테이블" };
const slotNames = { ...T.zones, investigator: "조사자" };
const statIcons = { resources: "◈", clues: "✦", damage: "♥", horror: "◐", doom: "⌛", actions: "◆" };
const html = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (action, text, value = "", css = "", disabled = false, extra = "") =>
  `<button type="button" data-action="${action}" data-value="${html(value)}" class="${css}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
const num = (value, max = 999) => Number.isInteger(value) && value >= 0 && value <= max;
const read = (name) => { try { return JSON.parse(localStorage.getItem(storeKey + name)); } catch { return null; } };
const write = (name, value) => {
  try { localStorage.setItem(storeKey + name, JSON.stringify(value)); return true; }
  catch { return false; }
};
let catalog = read("catalog") || [];
let importedBag = read("bag") || [];
let mode = read("mode") === "table" ? "table" : "story";
let state = read(mode) || (mode === "story" ? A.fresh() : T.fresh());
let history = [];
let activeZone = "hand";
let filter = { q: "", source: "", zone: "deck", limit: 30 };
let storageOkay = true;
let messageTimer;

function note(text) {
  announcer.textContent = text;
  const current = document.querySelector("#toast");
  current?.remove();
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.className = "toast";
  toast.textContent = text;
  (dialog.open ? dialog : document.body).append(toast);
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => toast.remove(), 4000);
}
function save() {
  storageOkay = write(mode, state) && write("mode", mode);
}
function update(change) {
  const previous = structuredClone(state);
  if (change(state) === false) return false;
  history.push(previous);
  if (history.length > 35) history.shift();
  save();
  render();
  return true;
}
function selectMode(next, fresh = null) {
  save();
  mode = next;
  state = fresh || read(mode) || (mode === "story" ? A.fresh() : T.fresh(importedBag.length ? importedBag : undefined));
  history = [];
  activeZone = "hand";
  save();
  render();
  closeDialog();
}

const symbols = {
  lamp: '<path d="M7 19h10M9 16h6M8 6h8l2 8H6zM12 6V3m0 11v5"/>',
  books: '<path d="M4 5h4v14H4zm5 0h4v14H9zm5 2 3-1 4 12-3 1zM4 15h9"/>',
  door: '<path d="M5 21h14M7 21V4h10v17M13 12h1M10 7h4"/>',
  vault: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 9V5m0 14v-4m-3-3H5m14 0h-4"/>',
  eye: '<path d="M2 12c5-8 15-8 20 0-5 8-15 8-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  knife: '<path d="m5 19 5-5m-3-3 6 6m-4-4 5-7 6-2-2 6-7 5"/>',
  cross: '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z"/>',
  star: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
  wind: '<path d="M3 8h13a2 2 0 1 0-2-2M3 12h16a2 2 0 1 1-2 2M3 16h8a2 2 0 1 1-2 2"/>',
  coins: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 4 14 4 14 0V7M5 12v5c0 4 14 4 14 0v-5"/>',
};
const icon = (id, css = "") => `<svg class="icon ${css}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[id] || symbols.star}</svg>`;
const seal = `<svg class="seal-art" viewBox="0 0 300 240" aria-hidden="true">
  <defs><radialGradient id="glow"><stop stop-color="#d1ad69" stop-opacity=".21"/><stop offset="1" stop-color="#d1ad69" stop-opacity="0"/></radialGradient></defs>
  <circle cx="150" cy="120" r="120" fill="url(#glow)"/>
  <g fill="none" stroke="currentColor">
  <circle cx="150" cy="120" r="90"/><circle cx="150" cy="120" r="82" stroke-dasharray="1 5"/>
  <circle cx="150" cy="120" r="68"/><circle cx="150" cy="120" r="43" opacity=".5"/>
  <path d="M150 38l71 123H79Z M150 202 79 79h142Z" opacity=".54"/>
  <path d="M107 120q43-47 86 0-43 47-86 0Z"/><ellipse cx="150" cy="120" rx="12" ry="19"/>
  <path d="M150 17v23m0 160v23M47 120h23m160 0h23M83 53l13 13m108 108 13 13M83 187l13-13M204 66l13-13" opacity=".6"/>
  </g><circle cx="150" cy="120" r="4" fill="currentColor"/>
</svg>`;
const phaseIcons = { mythos: "◈", investigation: "✦", enemy: "♜", upkeep: "☾" };
const available = () => !state.outcome && !state.pending && state.phase === "investigation" && state.actions > 0;
const story = (action, text, value = "", css = "", disabled = false) => button("story-" + action, text, value, css, disabled);

function hero() {
  const isStory = mode === "story";
  return `<div class="mode-tabs" role="group" aria-label="게임 모드">
    ${button("mode", "✦ &nbsp; 자동 시나리오", "story", "", false, 'aria-pressed="' + isStory + '"')}
    ${button("mode", "▤ &nbsp; SCED 수동 테이블", "table", "", false, 'aria-pressed="' + !isStory + '"')}
    <span class="save-status"><i></i> ${storageOkay ? "이 브라우저에 자동 저장" : "자동 저장 불가 · 저장 내보내기 사용"}</span>
  </div>
  <section class="hero" aria-labelledby="scenario-title">
    <div class="hero-content">
      <div class="eyebrow"><span></span> ${isStory ? "사건 기록 01 / 독립 시나리오" : "자유 플레이 / 내 카드 컬렉션"}</div>
      <h1 id="scenario-title">${isStory ? "닫힌 서고의 밤" : "아컴 카드 테이블"}</h1>
      <p>${isStory ? "새벽이 오기 전, 사라진 기록의 흔적을 찾아 봉인을 되살리세요." :
        "SCED에서 불러온 카드와 혼돈 토큰으로 나만의 조사 테이블을 차리세요."}</p>
      <div class="hero-tags"><span>1인 플레이</span><span>${isStory ? A.difficulties[state.difficulty].name + " 난이도" : "직접 규칙 처리"}</span></div>
    </div>${seal}
  </section>`;
}
function phaseBar() {
  return `<section class="phasebar" aria-label="라운드 및 단계"><div class="round"><small>ROUND</small><b>${String(state.round).padStart(2, "0")}</b></div>
  <ol>${A.phases.map((id, i) => `<li ${id === state.phase ? 'aria-current="step"' : ""}><span>${phaseIcons[id]}</span><b>${A.phaseNames[id]}</b><small>0${i + 1}</small></li>`).join("")}</ol>
  ${button("undo", "↶ <span>되돌리기</span>", "", "undo", !history.length)}
  </section>`;
}
function counters() {
  const inv = A.investigators[state.investigator];
  const ranges = mode === "story" ? { damage: inv.hp, horror: inv.sanity, actions: 3 } : {};
  return `<div class="counters">${["resources", "clues", "damage", "horror", "actions"].map((id) =>
    `<div class="counter stat-${id}"><span>${statIcons[id]} ${T.stats[id]}</span><b>${state[id]}${ranges[id] ? `<small> / ${ranges[id]}</small>` : ""}</b></div>`).join("")}</div>`;
}
function investigator() {
  const inv = A.investigators[state.investigator];
  return `<section class="panel investigator"><div class="panel-top"><h2>조사자</h2><small>INVESTIGATOR</small></div>
    <div class="portrait"><div aria-hidden="true">${inv.sigil}</div><span><b>${inv.name}</b><small>${inv.title}</small></span></div>
    <div class="skills">${Object.entries(A.skills).map(([id, name]) => `<div><span>${name}</span><b>${inv[id]}</b></div>`).join("")}</div>
    ${counters()}
  </section>`;
}
function objective() {
  const cap = A.difficulties[state.difficulty].doom;
  return `<section class="panel objective"><div class="panel-top"><h2>사건 목표</h2><small>ACT 0${state.act}</small></div>
    <div class="objective-body"><h3>${state.act === 1 ? "감춰진 입구" : "닫아야 할 문"}</h3>
    <p>${state.act === 1 ? "단서 2개를 모아 지하 보관소를 엽니다." : "단서 3개를 모으고, 지하 보관소에 교전 중인 적이 없을 때 봉인을 시도합니다."}</p>
    <div class="objective-progress"><span>✦ 단서</span><b>${state.clues} / ${state.act === 1 ? 2 : 3}</b></div>
    ${state.act === 1 ? story("advance", "주요목적 진행", "", "secondary wide", state.clues < 2 || state.phase !== "investigation" || !!state.pending || !!state.outcome)
        : story("seal", "봉인 시도 · 의지 3", "", "primary wide", !available() || state.place !== "vault" || state.clues < 3 || A.engaged(state).length > 0)}
    </div></section>
    <section class="panel doom"><div class="panel-top"><h2>다가오는 파멸</h2><small>${state.doom} / ${cap}</small></div>
      <div class="doom-pips" aria-label="파멸 ${state.doom}, 한계 ${cap}">${Array.from({ length: cap }, (_, i) => `<i class="${i < state.doom ? "lit" : ""}"></i>`).join("")}</div>
    </section>`;
}
function map() {
  return `<section class="panel map-panel"><div class="panel-top"><h2>조사 현장</h2><small>LOCATION MAP</small></div>
    <div class="map-grid">${Object.entries(A.locations).map(([id, loc]) => {
      const here = id === state.place;
      const locked = id === "vault" && state.act === 1;
      const reachable = A.locations[state.place].links.includes(id) && !locked;
      const locationEnemies = state.enemies.filter((e) => e.place === id);
      return `<article class="location ${here ? "here" : ""} ${locked ? "locked" : ""}">
        <div class="location-head"><span class="loc-icon">${icon(loc.icon)}</span><span class="location-label">${here ? "현재 위치" : locked ? "잠김" : locationEnemies.length ? "적 " + locationEnemies.length : "장소"}</span></div>
        <small>${loc.en}</small><h3>${loc.name}</h3>
        <div class="loc-info"><span>장막 <b>${locked ? "—" : loc.shroud}</b></span><span>✦ <b>${locked ? "—" : state.places[id]}</b></span></div>
        ${here ? story("investigate", "조사하기", "", "secondary wide", !available() || !state.places[id]) :
        story("move", locked ? "봉인됨" : reachable ? "이동 →" : "연결되지 않음", id, "wide", !available() || !reachable)}
      </article>`;
    }).join("")}</div>
    <p class="subtle map-note">열람실 ↔ 서고 또는 사서실 ↔ 지하 보관소 <span>인접한 장소만 이동 가능</span></p>
  </section>`;
}
function roundControl() {
  const next = { investigation: "조사 종료 →", enemy: "정리 단계 →", upkeep: "다음 라운드 →", mythos: "조사 시작 →" }[state.phase];
  const encounter = A.encounters[state.currentEncounter];
  const pending = state.pending;
  const last = state.lastTest;
  return `<section class="panel round-control"><div class="panel-top"><h2>라운드 진행</h2><small>${A.phaseNames[state.phase]} 단계</small></div>
    ${state.outcome ? `<div class="outcome" role="status"><small>사건 종료</small><h3>${html(state.outcome)}</h3>${button("new", "새 사건 시작", "", "primary")}</div>` : `
    ${encounter ? `<div class="encounter"><small>조우 카드</small><b>${encounter.name}</b><p>${encounter.text}</p></div>` : ""}
    ${pending ? `<div class="test-box"><div><span>능력 테스트</span><h3>${A.skills[pending.skill]} ${pending.base + pending.commit.reduce((n, id) => n + A.cards[id].icons, 0)} <small>vs</small> ${pending.difficulty}</h3></div>
    <p>손패에서 같은 능력 또는 직감 카드를 소모할 수 있습니다.</p>
    ${pending.commit.map((id, i) => story("uncommit", html(A.cards[id].name) + " ↶", i, "chip")).join("")}
    ${story("resolve", "◉ 혼돈 토큰 뽑기", "", "primary wide")}</div>` : `
    ${last ? `<div class="last-test ${last.success ? "good" : "bad"}"><span class="token">${last.token}</span><div><b>${last.label} ${last.success ? "성공" : "실패"}</b><small>최종 ${last.total} / 난이도 ${last.difficulty}</small></div></div>` : ""}
    ${state.phase === "investigation" ? `<div class="action-row">${story("draw", "＋ 카드", "", "", !available())}
      ${story("resource", "◈ 자원", "", "", !available())}
      ${story("resign", "철수", "", "", !available() || state.place !== "hall")}</div>` : ""}
    ${state.phase === "upkeep" && state.hand.length > 8 ? '<p class="danger">손패가 8장이 될 때까지 버려 주세요.</p>' : ""}
    ${story("next", next, "", "primary wide", state.phase === "upkeep" && state.hand.length > 8)}
    `}`}
  </section>`;
}
function enemiesHere() {
  const list = state.enemies.filter((e) => e.place === state.place);
  if (!list.length) return "";
  return `<section class="panel"><div class="panel-top"><h2>현재 장소의 적</h2><small>${list.length} ENEMY</small></div>
    <div class="entry-list">${list.map((e) => {
      const def = A.enemies[e.id];
      return `<article class="enemy"><div><b>${def.name}</b><small>전투 ${def.fight} · 체력 ${def.hp - e.damage}/${def.hp} · 회피 ${def.evade}${e.exhausted ? " · 소진" : ""}</small></div>
      <div class="action-row">${story("fight", "전투", e.key, "", !available())}
      ${state.assets.some((a) => a.id === "knife") ? story("knife", "단검", e.key, "", !available()) : ""}
      ${story("evade", "회피", e.key, "", !available() || e.exhausted)}</div></article>`;
    }).join("")}</div></section>`;
}
function storyCards() {
  return `<section class="panel cards-panel"><div class="panel-top"><h2>손패 <span class="badge">${state.hand.length}</span></h2>
    <small>덱 ${state.deck.length} · 버림 ${state.discard.length}</small></div>
    <div class="card-tray">${state.hand.map((id, index) => {
      const c = A.cards[id];
      const canCommit = state.pending && [state.pending.skill, "wild"].includes(c.skill);
      const playable = available() && c.cost !== undefined && c.cost <= state.resources &&
        !(id === "leads" && !state.places[state.place]) && !state.assets.some((a) => a.id === id);
      return `<article class="game-card type-${c.type === "자산" ? "asset" : c.type === "능력" ? "skill" : "event"}">
        <div class="card-top"><small>${c.type}</small><span>${c.cost ?? "–"}</span></div>
        <div class="card-icon">${icon(c.icon)}</div><h3>${c.name}</h3><p>${c.text}</p>
        <small class="card-skill">${A.skills[c.skill] || "만능"} +${c.icons}</small>
        ${state.pending ? story("commit", "테스트에 소모", index, "wide", !canCommit) :
          state.phase === "upkeep" && state.hand.length > 8 ? story("discard", "버리기", index, "wide") :
          c.cost !== undefined ? story("play", "사용", index, "wide", !playable) : "<span class='card-passive'>테스트용</span>"}
      </article>`;
    }).join("") || "<p class='empty'>손패가 비어 있습니다.</p>"}</div>
    </section>
    <section class="panel"><div class="panel-top"><h2>플레이 영역 <span class="badge">${state.assets.length}</span></h2><small>ASSETS</small></div>
    <div class="entry-list">${state.assets.map((asset, index) => {
      const c = A.cards[asset.id];
      return `<article class="asset-row">${icon(c.icon)}<div><b>${c.name}</b><small>${c.text}${asset.uses !== null ? " · 남은 물자 " + asset.uses : ""}</small></div>
      ${asset.id === "lamp" ? story("lamp", "등불로 조사", "", "", !available() || !asset.uses || !state.places[state.place]) : ""}
      ${asset.id === "kit" ? `<div class="action-row">${story("heal-damage", "피해 회복", index, "", !available() || !asset.uses || !state.damage)}
        ${story("heal-horror", "공포 회복", index, "", !available() || !asset.uses || !state.horror)}</div>` : ""}</article>`;
    }).join("") || "<p class='empty'>손패의 자산 카드를 사용하면 여기에 놓입니다.</p>"}</div></section>`;
}
function logPanel() {
  return `<section class="panel journal"><div class="panel-top"><h2>조사 기록</h2><small>CASE LOG</small></div>
    <ol>${state.log.slice(0, 16).map((item) => `<li><small>R${html(item.round)}</small><span class="${html(item.kind)}">${html(item.text)}</span></li>`).join("") || "<li>아직 기록이 없습니다.</li>"}</ol>
  </section>`;
}
function renderStory() {
  return `<div class="story-layout"><aside class="stack">${investigator()}${objective()}</aside>
    <div class="stack">${map()}${enemiesHere()}${storyCards()}</div>
    <aside class="stack">${roundControl()}${logPanel()}</aside></div>`;
}

function image(card, back = false) {
  const url = T.imageURL(back ? card.back : card.face);
  if (!url || !read("art")) return "";
  const w = Math.max(1, Math.min(10, Number(card.width) || 1));
  const h = Math.max(1, Math.min(10, Number(card.height) || 1));
  const cell = Math.max(0, Math.min(w * h - 1, Number(card.cell) || 0));
  const x = w > 1 ? (cell % w) / (w - 1) * 100 : 0;
  const y = h > 1 ? Math.floor(cell / w) / (h - 1) * 100 : 0;
  return `<span class="art-frame" aria-hidden="true" style="background-image:url(&quot;${html(url.replace(/[()"'\\]/g, (c) => encodeURIComponent(c)))}&quot;);background-size:${w * 100}% ${h * 100}%;background-position:${x}% ${y}%"></span>`;
}
function tableZones() {
  const pile = ["deck", "encounter"].includes(activeZone);
  const selected = state.zones[activeZone];
  return `<section class="panel"><div class="panel-top"><h2>카드 영역</h2><small>TABLE ZONES</small></div>
    <div class="zone-tabs" role="group" aria-label="카드 영역">${Object.entries(T.zones).map(([id, label]) =>
      button("zone", label + " <small>" + state.zones[id].length + "</small>", id, "", false, 'aria-pressed="' + (id === activeZone) + '"')).join("")}</div>
    <div class="zone-title"><h3>${T.zones[activeZone]}</h3><span>${selected.length}장</span>
    ${selected.length > 1 ? button("shuffle", "섞기", activeZone) : ""}</div>
    <div class="entry-list">${pile ? `<div class="pile-area"><span class="card-back-symbol">✦</span><p>카드 ${selected.length}장</p>
      ${button("table-draw", "맨 위 카드 뽑기", activeZone, "primary", !selected.length)}
      ${button("peek", "맨 위 카드 보기", activeZone, "", !selected.length)}
      ${button("table-move-top", "맨 위 카드 버리기", activeZone, "", !selected.length)}</div>` :
      selected.map(({ card, exhausted, back, tokens }, index) => `<article class="table-card ${exhausted ? "exhausted" : ""}">
        ${image(card, back)}<div><small>${back ? "뒷면" : html(card.type)} ${exhausted ? "· 소진" : ""}</small>
        <h3>${back ? "뒤집힌 카드" : html(card.name)}</h3>
        <p>${back ? "" : html(card.info)}${tokens ? " · 토큰 " + tokens : ""}</p></div>
        ${button("inspect", "카드 조작", index)}</article>`).join("") || "<p class='empty'>카드가 없습니다. 카드 자료실에서 추가하거나 덱에서 뽑으세요.</p>"}</div></section>`;
}
function renderTable() {
  return `<div class="table-layout"><aside class="stack"><section class="panel"><div class="panel-top"><h2>테이블 조작</h2><small>SOLO</small></div>
    <div class="table-actions">${button("catalog", "＋ 카드 자료실", "", "primary wide")}
    ${button("import", "SCED JSON 불러오기", "", "wide")}${button("decklist", "덱 목록 불러오기", "", "wide")}
    ${button("table-draw", "플레이어 카드 뽑기", "deck", "wide", !state.zones.deck.length)}
    ${button("table-draw", "조우 카드 뽑기", "encounter", "wide", !state.zones.encounter.length)}
    ${button("art", read("art") ? "카드 이미지 끄기" : "카드 이미지 켜기", "", "wide")}
    ${button("table-next", "다음 단계 →", "", "wide")}</div></section>
    <section class="panel"><div class="panel-top"><h2>카운터</h2><small>수동 조정</small></div>
    <div class="table-stats">${Object.entries(T.stats).map(([id, label]) =>
      `<div><span>${statIcons[id]} ${label}</span>${button("minus", "−", id, "", !state[id], 'aria-label="' + label + ' 줄이기"')}
       <b>${state[id]}</b>${button("plus", "+", id, "", false, 'aria-label="' + label + ' 늘리기"')}</div>`).join("")}</div></section></aside>
    <div class="stack">${tableZones()}<section class="panel"><div class="panel-top"><h2>시나리오 메모</h2><small>NOTES</small></div>
    <label class="sr-only" for="notes">시나리오 메모</label><textarea id="notes" maxlength="12000" placeholder="단계별 규칙, 장소 연결, 결말 등을 적어 두세요.">${html(state.notes)}</textarea></section></div>
    <aside class="stack"><section class="panel"><div class="panel-top"><h2>혼돈 주머니</h2><small>${state.bag.length} TOKENS</small></div>
    <div class="bag-body"><div class="bag-token">${html(state.token || "◉")}</div>${button("token", "혼돈 토큰 뽑기", "", "primary wide")}
    ${button("bag", "토큰 구성 편집", "", "wide")}</div></section>${logPanel()}</aside></div>`;
}
function render() {
  const focused = document.activeElement;
  const action = focused?.dataset.action;
  const value = focused?.dataset.value;
  main.innerHTML = hero() + phaseBar() + (mode === "story" ? renderStory() : renderTable());
  if (action && !dialog.open && !document.body.contains(focused)) {
    const next = [...main.querySelectorAll("button[data-action]")].find((el) =>
      el.dataset.action === action && el.dataset.value === value && !el.disabled);
    next?.focus({ preventScroll: true });
  }
}

function openDialog(title, content, label = "ARCHIVE DESK") {
  dialog.innerHTML = `<div class="dialog-head"><div><small>${label}</small><h2 id="dialog-title">${title}</h2></div>
    ${button("close", "×", "", "close", false, 'aria-label="닫기"')}</div><div class="dialog-body">${content}</div>`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { if (dialog.open) dialog.close(); }
function showNew() {
  openDialog("새 게임", `<p>새 게임을 시작하면 선택한 모드의 기존 진행 기록을 덮어씁니다.</p>
    <form id="new-game">
      <label>조사자 <select name="investigator">${Object.entries(A.investigators).map(([id, inv]) =>
        `<option value="${id}">${inv.name} · ${inv.title}</option>`).join("")}</select></label>
      <label>난이도 <select name="difficulty">${Object.entries(A.difficulties).map(([id, item]) =>
        `<option value="${id}" ${id === "standard" ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>
      <button class="primary wide" type="submit">닫힌 서고의 밤 시작</button>
    </form><hr>${button("new-table", "새 SCED 수동 테이블 시작", "", "wide")}`, "NEW SESSION");
}
function help() {
  openDialog("플레이 안내", `<div class="help-copy">
    <h3>닫힌 서고의 밤</h3><p>독립 팬 시나리오입니다. 조사 단계에는 행동 3회가 주어집니다.
    장소를 이동하고 장막값을 상대로 조사해 단서를 모으세요. 단서 2개로 지하 보관소를 열고, 단서 3개를 더 모아 봉인을 시도하세요.</p>
    <p>테스트에는 손패에서 같은 능력 아이콘을 가진 카드를 소모할 수 있습니다. 해골은 1막에서 −1, 2막에서 −2입니다.
    별은 +2, 촉수는 자동 실패입니다. 교전 중 전투·회피·철수 이외의 행동을 하면 기회 공격을 받습니다.</p>
    <p>첫 라운드는 조사 단계부터 시작합니다. 이후 신화 → 조사 → 적 → 정리 순으로 진행하며, 파멸 한계에 도달하거나 체력·정신력을 잃으면 사건이 종료됩니다.</p>
    <h3>SCED 수동 테이블</h3><ol>
    <li><b>SCED JSON 불러오기</b>에서 Arkham.SCE.v4.9.3.json을 선택합니다. 이 파일에는 플레이어 카드와 혼돈 주머니가 있습니다.</li>
    <li>시나리오 카드는 별도 JSON으로 가져옵니다. Tabletop Simulator의 SCED에서 준비한 시나리오를 저장하거나 아래 커뮤니티 자료를 이용하세요.
    <a href="https://github.com/Chr1Z93/SCED-downloads/tree/main/downloadable" target="_blank" rel="noreferrer">SCED 캠페인 자료</a></li>
    <li><b>카드 자료실</b>에서 카드나 그룹을 골라 영역에 추가합니다. ArkhamDB 내보내기 JSON 또는 카드 코드 목록으로 덱을 만들 수도 있습니다.</li>
    <li>카드를 섞고 뽑은 뒤, 장소 공개·소진·카드 이동·토큰·단계는 카드와 규칙을 보며 직접 조작합니다.</li></ol>
    <p>게임과 불러온 카드 목록은 이 브라우저에 보관됩니다. 카드 그림을 켜면 해당 카드의 외부 이미지 주소에 연결합니다.</p>
    <p><a href="https://www.fantasyflightgames.com/product/arkham-horror-the-card-game/" target="_blank" rel="noreferrer">공식 규칙 및 캠페인 가이드</a>
      · <a href="https://github.com/halogenandtoast/ArkhamHorror" target="_blank" rel="noreferrer">참고 프로젝트</a></p></div>`, "FIELD MANUAL");
}
function showSettings() {
  openDialog("저장 관리", `<p>현재 모드의 진행을 파일로 백업하고 다른 브라우저에서도 이어서 플레이할 수 있습니다.</p>
    <div class="dialog-actions">${button("export", "저장 내보내기", "", "primary")}${button("restore", "저장 불러오기")}</div>
    <hr><label class="toggle"><input type="checkbox" id="art-toggle" ${read("art") ? "checked" : ""}> SCED 카드 이미지 표시</label>
    <p class="subtle">켜면 카드 그림만 원래 이미지 서버에서 불러옵니다. JSON 파일은 브라우저에서 읽습니다.</p>`, "LOCAL STORAGE");
}
function showImport() {
  openDialog("SCED 자료 불러오기", `<p>플레이어 카드용 <b>Arkham.SCE.v4.9.3.json</b>과 별도 시나리오 JSON을 선택할 수 있습니다.
    파일의 카드·토큰 데이터만 읽어 카드 자료실에 추가합니다.</p>
    <label class="file-label">TTS 저장 파일 또는 저장 오브젝트 <input id="sced-input" type="file" accept=".json,application/json" multiple></label>
    <p class="subtle">SCED 소스 ZIP은 제작 참고용입니다. 플레이에는 JSON을 사용하세요.</p>
    <div class="dialog-actions">${button("catalog", "자료실 열기", "", "primary")}</div>`, "SCED · TABLETOP SIMULATOR");
}
function showDecklist() {
  openDialog("덱 목록 불러오기", `<p>먼저 SCED 플레이어 카드 JSON을 불러오세요. 목록에 있는 모든 카드를 찾으면 플레이어 덱에 추가합니다.</p>
    <form id="deck-form"><label>ArkhamDB JSON 또는 카드 코드 목록<textarea name="list" required maxlength="50000" rows="7" placeholder="01020 x2&#10;01039 x2"></textarea></label>
    <button type="submit" class="primary">플레이어 덱에 추가</button></form>
    <label class="file-label">덱 JSON 파일 선택 <input id="deck-input" type="file" accept=".json,application/json"></label>`, "DECK IMPORT");
}
function deckFrom(text) {
  const { entries, investigator } = T.decklist(text);
  const byId = new Map();
  for (const c of catalog) if (!byId.has(c.id)) byId.set(c.id, c);
  for (const c of catalog) for (const id of c.alternateIds || []) if (!byId.has(id)) byId.set(id, c);
  const missing = [...entries.map(([id]) => id), ...(investigator ? [investigator] : [])].filter((id) => !byId.has(id));
  if (missing.length) throw new Error("자료실에서 찾을 수 없는 카드 코드 · " + missing.slice(0, 12).join(", "));
  update((s) => {
    for (const [id, qty] of entries) T.add(s, byId.get(id), "deck", qty);
    if (investigator) T.add(s, byId.get(investigator), "assets");
    s.zones.deck = A.shuffle(s.zones.deck);
    A.log(s, "플레이어 덱을 불러와 섞었습니다.");
  });
  activeZone = "deck";
  closeDialog();
  render();
  note("플레이어 덱에 카드 " + entries.reduce((sum, [, n]) => sum + n, 0) + "장을 추가했습니다.");
}
function filteredCards() {
  const words = filter.q.trim().toLowerCase().split(/\s+/);
  return catalog.map((c, index) => ({ c, index })).filter(({ c }) => {
    if (filter.source && c.source !== filter.source) return false;
    const text = [c.name, c.id, c.type, c.group, c.className].join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
function catalogRows() {
  const list = filteredCards();
  const groups = [...new Set(list.map(({ c }) => c.group))].filter(Boolean);
  const group = filter.q.trim().toLowerCase();
  const isGroup = group && list.length > 1 && list.length <= 100 && groups.every((g) => g.toLowerCase().includes(group));
  dialog.querySelector("#catalog-results").innerHTML = `<div class="search-count">검색 결과 ${list.length}장
  ${isGroup ? button("add-group", "검색 결과 모두 추가", "", "small") : ""}</div>
  <div class="catalog-list">${list.slice(0, filter.limit).map(({ c, index }) =>
    `<article><div><b>${html(c.name)}</b><small>${html(c.id)} · ${html(c.type)}${c.cost !== null ? " · 비용 " + c.cost : ""}</small>
    <small title="${html(c.group)}">${html(c.group)}</small></div>
    ${button("add-card", "＋ 추가", index, "small")}</article>`).join("") ||
    '<p class="empty">가져온 자료가 없거나 검색 결과가 없습니다.</p>'}</div>
  ${list.length > filter.limit ? button("more", "30장 더 보기", "", "wide") : ""}`;
}
function showCatalog() {
  const sources = [...new Set(catalog.map((c) => c.source))];
  if (!sources.includes(filter.source)) filter.source = "";
  openDialog("카드 자료실", `<p>${catalog.length}종의 카드 · ${button("import", "SCED JSON 불러오기", "", "small")}</p>
    <div class="catalog-filters">
    <label>카드 검색 <input type="search" id="search" placeholder="이름, 카드 코드 또는 그룹" value="${html(filter.q)}"></label>
    <label>자료 <select id="source"><option value="">모든 자료</option>${sources.map((s) =>
      `<option value="${html(s)}" ${s === filter.source ? "selected" : ""}>${html(s)}</option>`).join("")}</select></label>
    <label>추가할 영역 <select id="destination">${Object.entries(T.zones).map(([id, name]) =>
      `<option value="${id}" ${id === filter.zone ? "selected" : ""}>${name}</option>`).join("")}</select></label>
    </div><div id="catalog-results"></div>`, "CARD INDEX");
  catalogRows();
}
function showCard(zone, index, peek = false) {
  const e = state.zones[zone][index];
  if (!e) return;
  const c = e.card;
  const title = e.back && !peek ? "뒤집힌 카드" : html(c.name);
  openDialog(title, `<div class="card-detail">${image(c, e.back && !peek)}<div>
    ${!e.back || peek ? `<p>${html(c.type)} · ${html(c.id)}${c.cost !== null ? " · 비용 " + c.cost : ""}</p>
    <p>${html(c.info)}</p><p class="subtle">${html(c.group)}</p>
    <p>${Object.entries(c.stats || {}).map(([key, n]) => html(A.skills[key] || "만능") + " " + html(n)).join(" · ")}</p>` : ""}
    ${!peek ? `<form id="move-card"><input type="hidden" name="index" value="${index}">
    <label>카드 이동 <select name="destination">${Object.entries(T.zones).filter(([id]) => id !== zone).map(([id, name]) =>
      `<option value="${id}">${name}</option>`).join("")}</select></label><button class="primary" type="submit">선택한 영역으로 이동</button></form>
    <div class="dialog-actions">${button("flip", "앞·뒷면 전환", index)}${button("exhaust", e.exhausted ? "준비" : "소진", index)}
    ${button("card-minus", "토큰 −", index, "", !e.tokens)}<span>${e.tokens}</span>${button("card-plus", "토큰 +", index)}</div>
    ${button("remove-card", "테이블에서 제거", index, "quiet")}` : ""}</div></div>`, "CARD VIEW");
}
function editBag() {
  openDialog("혼돈 토큰 구성", `<p>토큰을 쉼표나 줄바꿈으로 구분하세요. 같은 이름을 반복하면 해당 토큰이 여러 개 들어갑니다.</p>
    <form id="bag-form"><label>혼돈 토큰<textarea name="bag" rows="5" maxlength="3500" required>${html(state.bag.join(", "))}</textarea></label>
    <div class="dialog-actions"><button class="primary" type="submit">구성 저장</button>
    ${button("use-imported-bag", "SCED 기본 구성 사용", "", "", !importedBag.length)}</div></form>`, "CHAOS BAG");
}
function download() {
  const blob = new Blob([JSON.stringify({ format: "arkham-archive", version: 1, state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arkham-" + mode + "-round-" + state.round + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function validCard(c) {
  return c && typeof c.name === "string" && c.name.length <= 160 && typeof c.id === "string" &&
    [c.type, c.info, c.group, c.source, c.face, c.back].every((s) => typeof s === "string") &&
    (c.cost === null || num(c.cost)) && (!c.stats || Object.values(c.stats).every((n) => num(n)));
}
function validateSave(data) {
  const s = data?.state;
  const keys = (o, key) => typeof key === "string" && Object.hasOwn(o, key);
  const array = (v, f, max = 1500) => Array.isArray(v) && v.length <= max && v.every(f);
  if (data?.format !== "arkham-archive" || data.version !== 1 || !s ||
      !A.phases.includes(s.phase) || !num(s.round, 99999) || s.round < 1 ||
      !Object.keys(T.stats).every((key) => num(s[key], 9999)) ||
      !array(s.log, (x) => x && num(x.round, 99999) && typeof x.text === "string" && typeof x.kind === "string", 80)) return false;
  if (s.mode === "table") {
    return s.zones && Object.keys(T.zones).every((key) => array(s.zones[key], (e) => e &&
      validCard(e.card) && typeof e.back === "boolean" && typeof e.exhausted === "boolean" && num(e.tokens))) &&
      array(s.bag, (t) => typeof t === "string" && t.length > 0 && t.length <= 32, 100) &&
      s.bag.length > 0 && typeof s.token === "string" && typeof s.notes === "string" && s.notes.length <= 12000;
  }
  if (s.mode !== "story" || !keys(A.investigators, s.investigator) || !keys(A.difficulties, s.difficulty) ||
      !keys(A.locations, s.place) || ![1, 2].includes(s.act) || s.actions > 3 ||
      typeof s.outcome !== "string" || !num(s.serial, 9999) ||
      !Object.entries(A.locations).every(([id, def]) => num(s.places?.[id], def.clues)) ||
      !["deck", "hand", "discard"].every((key) => array(s[key], (id) => keys(A.cards, id), 24)) ||
      !["encounter", "encounterDiscard"].every((key) => array(s[key], (id) => keys(A.encounters, id), 9)) ||
      !(s.currentEncounter === "" || keys(A.encounters, s.currentEncounter)) ||
      !array(s.assets, (a) => a && keys(A.cards, a.id) && (a.uses === null || num(a.uses, 3)), 12) ||
      !array(s.enemies, (e) => e && keys(A.enemies, e.id) && keys(A.locations, e.place) &&
        num(e.key, 9999) && num(e.damage) && typeof e.exhausted === "boolean", 50)) return false;
  if (s.pending && (!["investigate", "fight", "evade", "seal", "encounter"].includes(s.pending.kind) ||
      !keys(A.skills, s.pending.skill) || !num(s.pending.difficulty, 10) || !num(s.pending.base, 15) ||
      !array(s.pending.commit, (id) => keys(A.cards, id), 24) ||
      (s.pending.kind === "encounter" && !keys(A.encounters, s.currentEncounter)) ||
      (["fight", "evade"].includes(s.pending.kind) && !s.enemies.some((e) => e.key === s.pending.target)) ||
      (s.pending.kind === "fight" && ![1, 2].includes(s.pending.damage)))) return false;
  const last = s.lastTest;
  return !last || (A.difficulties[s.difficulty].bag.includes(last.token) && num(last.total, 100) &&
    num(last.difficulty, 10) && typeof last.success === "boolean" && ["조사", "전투", "회피", "조우", "봉인"].includes(last.label));
}
async function readJSON(file, limit) {
  if (file.size > limit) throw new Error("지원하는 파일 크기를 초과했습니다.");
  try { return JSON.parse(await file.text()); }
  catch { throw new Error("올바른 JSON 파일을 선택해 주세요."); }
}
function restoreSave() {
  openDialog("저장 불러오기", `<p>가져온 파일의 모드에 해당하는 현재 진행 기록을 덮어씁니다.</p>
    <label class="file-label">내보낸 게임 저장 JSON <input id="restore-input" type="file" accept=".json,application/json"></label>`, "RESTORE SESSION");
}
async function importSources(files) {
  const accepted = [];
  const errors = [];
  for (const file of files) {
    try { accepted.push(T.parse(await readJSON(file, 64 * 1024 * 1024), file.name.slice(0, 130))); }
    catch (error) { errors.push(file.name + " · " + error.message); }
  }
  if (!accepted.length) throw new Error(errors.join(" / "));
  const cardMap = new Map(catalog.map((c) => [JSON.stringify([c.source, c.id, c.name]), c]));
  for (const result of accepted) {
    for (const c of result.cards) cardMap.set(JSON.stringify([c.source, c.id, c.name]), c);
    if (result.tokens.length) importedBag = result.tokens.slice(0, 100);
  }
  catalog = [...cardMap.values()];
  const stored = write("catalog", catalog) && write("bag", importedBag);
  if (mode === "table" && state.log.length === 0 && accepted.some((item) => item.tokens.length)) {
    update((s) => { s.bag = [...importedBag]; A.log(s, "SCED 혼돈 주머니를 불러왔습니다."); });
  }
  filter = { q: "", source: "", zone: filter.zone, limit: 30 };
  showCatalog();
  note("카드 자료 " + catalog.length + "종" + (stored ? " · 이 브라우저에 저장" : " · 이번 실행에만 유지") +
    (errors.length ? " / " + errors.join(" / ") : ""));
}
function tableAction(action, value) {
  if (action === "import") showImport();
  else if (action === "decklist") showDecklist();
  else if (action === "catalog") showCatalog();
  else if (action === "art") { write("art", !read("art")); render(); }
  else if (action === "bag") editBag();
  else if (action === "zone" && T.zones[value]) { activeZone = value; render(); }
  else if (action === "shuffle") update((s) => { s.zones[value] = A.shuffle(s.zones[value]); A.log(s, T.zones[value] + " 섞기"); });
  else if (action === "inspect") showCard(activeZone, Number(value));
  else if (action === "peek") showCard(value, state.zones[value].length - 1, true);
  else if (action === "table-draw" || action === "table-move-top") {
    const dest = action === "table-move-top" ? (value === "deck" ? "discard" : "encounterDiscard") : value === "deck" ? "hand" : "threats";
    activeZone = dest;
    update((s) => {
      const e = s.zones[value].at(-1);
      if (!e) return false;
      e.back = false;
      return T.move(s, value, s.zones[value].length - 1, dest);
    });
  } else if (action === "token") update((s) => {
    s.token = A.drawToken(s.bag);
    A.log(s, "혼돈 토큰 · " + s.token);
  });
  else if (action === "table-next") update((s) => {
    const i = A.phases.indexOf(s.phase);
    s.phase = A.phases[(i + 1) % A.phases.length];
    if (s.phase === "mythos") s.round++;
    A.log(s, A.phaseNames[s.phase] + " 단계");
  });
  else if (action === "plus" || action === "minus") update((s) => {
    s[value] = Math.max(0, Math.min(9999, s[value] + (action === "plus" ? 1 : -1)));
  });
  else if (action === "add-card" || action === "add-group") {
    const list = action === "add-card" ? [catalog[Number(value)]] : filteredCards().map(({ c }) => c);
    if (list.some((c) => !c) || !list.length || list.length > 100) return;
    update((s) => {
      for (const c of list) T.add(s, c, filter.zone);
      A.log(s, T.zones[filter.zone] + " · " + list.length + "장 추가");
    });
    note(T.zones[filter.zone] + "에 " + list.length + "장 추가");
  } else if (action === "more") { filter.limit += 30; catalogRows(); }
  else if (action === "use-imported-bag") {
    if (importedBag.length) update((s) => { s.bag = [...importedBag]; s.token = ""; });
    closeDialog();
  } else if (["flip", "exhaust", "card-minus", "card-plus", "remove-card"].includes(action)) {
    const index = Number(value);
    update((s) => {
      const e = s.zones[activeZone][index];
      if (!e) return false;
      if (action === "flip") e.back = !e.back;
      if (action === "exhaust") e.exhausted = !e.exhausted;
      if (action === "card-minus" || action === "card-plus") e.tokens = Math.max(0, Math.min(999, e.tokens + (action === "card-plus" ? 1 : -1)));
      if (action === "remove-card") {
        s.zones[activeZone].splice(index, 1);
        A.log(s, e.card.name + " · 제거");
      }
    });
    if (action === "remove-card") closeDialog();
    else showCard(activeZone, index);
  }
}
document.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-action]");
  if (!target) return;
  const { action, value } = target.dataset;
  if (action === "new") showNew();
  else if (action === "mode" && mode !== value) selectMode(value);
  else if (action === "help") help();
  else if (action === "settings") showSettings();
  else if (action === "close") closeDialog();
  else if (action === "new-table") selectMode("table", T.fresh(importedBag.length ? importedBag : undefined));
  else if (action === "export") download();
  else if (action === "restore") restoreSave();
  else if (action === "undo" && history.length) { state = history.pop(); save(); render(); note("직전 조작을 되돌렸습니다."); }
  else if (mode === "story" && action.startsWith("story-")) {
    update((s) => A.storyAction(s, action.slice(6), value));
    if (action === "story-resolve" && state.lastTest) note(state.lastTest.label + (state.lastTest.success ? " 성공" : " 실패"));
  } else if (mode === "table") tableAction(action, value);
});
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "search") { filter.q = target.value; filter.limit = 30; catalogRows(); }
  if (target.id === "notes" && mode === "table") { state.notes = target.value; save(); }
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.id === "source") { filter.source = target.value; filter.limit = 30; catalogRows(); }
    if (target.id === "destination") filter.zone = target.value;
    if (target.id === "art-toggle") { write("art", target.checked); render(); }
    if (target.id === "sced-input" && target.files.length) await importSources([...target.files]);
    if (target.id === "deck-input" && target.files.length) {
      if (target.files[0].size > 50000) throw new Error("덱 파일 크기가 너무 큽니다.");
      deckFrom(await target.files[0].text());
    }
    if (target.id === "restore-input" && target.files.length) {
      const file = await readJSON(target.files[0], 12 * 1024 * 1024);
      if (!validateSave(file)) throw new Error("이 앱에서 내보낸 유효한 저장 파일을 선택해 주세요.");
      selectMode(file.state.mode, file.state);
      note("저장한 게임을 불러왔습니다.");
    }
  } catch (error) { note(error.message); }
  if (target.type === "file") target.value = "";
});
document.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  try {
    if (event.target.id === "new-game") selectMode("story", A.fresh(data.get("investigator"), data.get("difficulty")));
    if (event.target.id === "deck-form") deckFrom(data.get("list"));
    if (event.target.id === "move-card") {
      const destination = data.get("destination");
      update((s) => T.move(s, activeZone, Number(data.get("index")), destination));
      activeZone = destination;
      closeDialog();
      render();
    }
    if (event.target.id === "bag-form") {
      const tokens = data.get("bag").split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
      if (!tokens.length || tokens.length > 100 || tokens.some((t) => t.length > 32)) throw new Error("토큰 1~100개를 입력하세요. 토큰당 최대 32자입니다.");
      update((s) => { s.bag = tokens; s.token = ""; });
      closeDialog();
    }
  } catch (error) { note(error.message); }
});

save();
render();


