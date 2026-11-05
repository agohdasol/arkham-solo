"use strict";

const T = Tabletop;
const $ = (s) => document.querySelector(s);
const store = "arkham-table.v2.";
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(store + key)) ?? fallback; } catch { return fallback; } };
const write = (key, value) => {
  try { localStorage.setItem(store + key, JSON.stringify(value)); return true; }
  catch { return false; }
};
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const button = (action, title, value = "", css = "", disabled = false) =>
  `<button type="button" data-action="${action}" data-value="${h(value)}" class="${css}" ${disabled ? "disabled" : ""}>${title}</button>`;
const campaignLink = "https://github.com/Chr1Z93/SCED-downloads/releases/download/v1.22.21/night_of_the_zealot.json";
const guideLink = "https://www.fantasyflightgames.com/product/arkham-horror-the-card-game/";
const campaignGuide = "https://images-cdn.fantasyflightgames.com/filer_public/8d/30/8d308b73-92f1-4b1e-aa7f-ce39e8d79786/night_of_the_zealot_campaign_guide.pdf";
const dialog = $("#dialog");
const view = $("#view");
const board = $("#board");
const menu = $("#menu");
const toast = $("#toast");
const keep = { scale: 1, x: 0, y: 0 };
let state = read("table", T.fresh());
if (!validSave(state)) state = T.fresh();
let library = read("library", []);
let packs = read("packs", []);
let importedBag = read("bag", []);
let undo = [];
let selected = "";
let drag = null;
let suppressClick = false;
let toastTimer;
let importReturn = "setup";
let libraryFilter = { query: "", type: "", visible: 36 };
let deckSearch = "";
let saveOkay = true;
const shape = (card) => ["Act", "Agenda", "Investigator"].includes(card?.type) ? "landscape" : "portrait";
const chaosSymbols = { "Skull": "☠", "Cultist": "♟", "Tablet": "▤", "Elder Thing": "✥", "Auto-fail": "✕", "Elder Sign": "✦", "Bless": "✧", "Curse": "◈", "Frost": "❄" };
const chaosLabels = { "Skull": "해골", "Cultist": "광신도", "Tablet": "석판", "Elder Thing": "고대 존재", "Auto-fail": "자동 실패", "Elder Sign": "고대 표식", "Bless": "축복", "Curse": "저주", "Frost": "서리" };

function save() {
  saveOkay = write("table", state);
  $("#save-status").textContent = saveOkay ? "이 브라우저에 자동 저장" : "저장 공간 부족 · 파일로 내보내기";
}
function update(change) {
  const last = structuredClone(state);
  try {
    if (change(state) === false) { state = last; return false; }
  } catch (error) {
    state = last;
    note(error.message);
    return false;
  }
  undo.push(last);
  if (undo.length > 36) undo.shift();
  save();
  render();
  return true;
}
function note(message) {
  toast.textContent = message;
  toast.hidden = false;
  (dialog.open ? dialog : document.body).append(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4300);
}
function atlas(sheet) {
  const url = T.imageURL(sheet?.url);
  if (!url) return "";
  const w = T.range(Number(sheet.w) || 1, 1, 10);
  const ht = T.range(Number(sheet.h) || 1, 1, 10);
  const cell = T.range(Number(sheet.cell) || 0, 0, w * ht - 1);
  const x = w > 1 ? (cell % w) / (w - 1) * 100 : 0;
  const y = ht > 1 ? Math.floor(cell / w) / (ht - 1) * 100 : 0;
  return `<span class="art" aria-hidden="true" style="background-image:url(&quot;${h(url.replace(/[()"'\\]/g, (c) => encodeURIComponent(c)))}&quot;);background-size:${w * 100}% ${ht * 100}%;background-position:${x}% ${y}%"></span>`;
}
function face(card, down = false, side = 0, known = false) {
  if (!card) return "";
  const version = side ? card.states?.[side - 1] : card;
  return `<span class="card-face ${down ? "back" : "front"}"><span class="card-fallback" aria-hidden="true">
  <span class="card-glyph">✦</span><small>${down ? "" : h(card.type)}</small><b>${down && !known ? "" : h(version?.name || card.name)}</b></span>
  ${atlas(down ? (version?.back || card.back) : (version?.front || card.front))}</span>`;
}
function objectHTML(o) {
  const title = T.title(o);
  const common = `data-piece="${o.id}" style="left:${o.x}px;top:${o.y}px;--turn:${o.angle}deg" tabindex="0" role="button"`;
  const focused = selected === "b:" + o.id ? " selected" : "";
  if (o.kind === "token") {
    const [glyph, name] = T.tokenKinds[o.token];
    return `<div ${common} class="piece token-piece token-${o.token}${focused}" aria-label="${name} ${o.n}"><span>${glyph}</span>${o.n > 1 ? `<b>${o.n}</b>` : ""}</div>`;
  }
  if (o.kind === "bag") return `<div ${common} class="piece bag-piece${focused}" aria-label="${h(title)} 상자"><span>▧</span><b>${h(title)}</b><small>${o.items.length}개</small></div>`;
  const card = o.cards.at(-1);
  const count = o.cards.length;
  const known = o.backKnown || !!o.name;
  const hidden = o.down && !known;
  const chips = Object.entries(o.tokens).filter(([, count]) => count > 0).map(([key, n]) =>
    `<span class="token-chip token-${key}" title="${T.tokenKinds[key][1]} ${n}">${T.tokenKinds[key][0]} ${n}</span>`).join("");
  return `<div ${common} class="piece card-piece ${shape(card)} ${count > 1 ? "pile" : ""}${focused}"
    aria-label="${h(hidden ? "뒤집힌 카드" : title)}${count > 1 ? " " + count + "장" : ""}">
    <div class="rotated">${face(card, o.down, o.side, known)}
    ${count > 1 ? `<span class="pile-count">${count}</span>` : ""}
    ${chips ? `<div class="token-chips">${chips}</div>` : ""}</div>
    ${o.name || o.role ? `<span class="piece-label">${h(o.name || T.roles[o.role]?.label)}</span>` : ""}
  </div>`;
}
function handHTML() {
  return state.hand.map((card, i) => `<div class="hand-card ${selected === "h:" + i ? "selected" : ""}" tabindex="0" role="button"
    aria-label="${h(card.name)}" data-hand="${i}">${face(card)}<span>${h(card.name)}</span></div>`).join("") ||
    "<p>플레이어 덱에서 뽑은 카드가 여기 놓입니다. 손패의 카드를 테이블 위로 끌어다 놓으세요.</p>";
}
function render() {
  const focus = document.activeElement;
  const piece = focus?.dataset?.piece;
  const hand = focus?.dataset?.hand;
  $("#scenario").textContent = state.scenario || "빈 테이블";
  $("#welcome").hidden = !!state.objects.length || !!state.scenario;
  $("#pieces").innerHTML = state.objects.map(objectHTML).join("");
  $("#hand-count").textContent = state.hand.length;
  $("#hand").innerHTML = handHTML();
  const deck = T.byRole(state, "player");
  $("#hand-actions").innerHTML = button("quick-draw", "＋ 1장 뽑기", "", "", !deck) +
    button("mulligan", "멀리건", "", "", !deck || !state.hand.length);
  $("#phase").innerHTML = `<span class="round"><small>ROUND</small><b>${state.round}</b></span>` +
    T.phases.map((label, i) => `<button type="button" data-action="phase" data-value="${i}" ${i === state.phase ? 'aria-current="step"' : ""}>${label}</button>`).join("") +
    button("next-phase", "→", "", "next");
  $("#bag-count").textContent = state.bag.length + "개";
  const pulled = state.pulled.at(-1);
  $("#chaos-result").innerHTML = pulled ? `<span>${h(chaosSymbols[pulled] || pulled)}</span>
    <small>${h(chaosLabels[pulled] || pulled)}${state.pulled.length > 1 ? " · 뽑은 토큰 " + state.pulled.length + "개" : ""}</small>`
    : "<span>◉</span><small>토큰을 뽑아 판정</small>";
  $("#return-chaos").disabled = !state.pulled.length;
  $("#undo").disabled = !undo.length;
  $("#selected-control").disabled = !find(selected) && !handCard(selected);
  if (!dialog.open) {
    if (piece !== undefined) document.querySelector(`[data-piece="${Number(piece)}"]`)?.focus({ preventScroll: true });
    else if (hand !== undefined) document.querySelector(`[data-hand="${Number(hand)}"]`)?.focus({ preventScroll: true });
  }
}
function fit() {
  const pad = 32;
  const sx = (view.clientWidth - pad) / T.WIDTH;
  const sy = (view.clientHeight - pad) / T.HEIGHT;
  keep.scale = T.range(Math.min(sx, sy), .32, 1.5);
  keep.x = Math.max(10, (view.clientWidth - T.WIDTH * keep.scale) / 2);
  keep.y = Math.max(12, (view.clientHeight - T.HEIGHT * keep.scale) / 2);
  transform();
}
function transform() {
  board.style.transform = `translate(${keep.x}px, ${keep.y}px) scale(${keep.scale})`;
  $("#scale").textContent = Math.round(keep.scale * 100) + "%";
}
function zoom(mult, cx = view.clientWidth / 2, cy = view.clientHeight / 2) {
  const next = T.range(keep.scale * mult, .27, 2.4);
  keep.x = cx - (cx - keep.x) / keep.scale * next;
  keep.y = cy - (cy - keep.y) / keep.scale * next;
  keep.scale = next;
  transform();
}
const boardPoint = (cx, cy) => {
  const r = view.getBoundingClientRect();
  return { x: (cx - r.left - keep.x) / keep.scale, y: (cy - r.top - keep.y) / keep.scale };
};
function showDialog(title, body, tagline = "ARKHAM ARCHIVE") {
  if (toast.parentElement === dialog) document.body.append(toast);
  dialog.innerHTML = `<div class="dialog-head"><div><small>${tagline}</small><h2 id="dialog-title">${h(title)}</h2></div>${button("close", "×")}</div>
    <div class="dialog-body">${body}</div>`;
  closeMenu();
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  if (toast.parentElement === dialog) document.body.append(toast);
  if (dialog.open) dialog.close();
}
function setupDialog() {
  const hasCore = T.indexCards(library).has("01001");
  const list = [...packs].sort((a, b) => a.code && b.code ? a.code.localeCompare(b.code) : a.name.localeCompare(b.name));
  showDialog("시나리오 준비", `<div class="setup-steps">
    <article><span>01</span><div><b>플레이어 카드</b><p>${hasCore ? "롤랜드 기본 덱을 만들 수 있습니다." : "기존에 받은 Arkham.SCE.v4.9.3.json을 가져오세요."}</p></div>
    ${button("import", hasCore ? "다른 자료 추가" : "파일 선택", "setup")}</article>
    <article><span>02</span><div><b>시나리오 카드</b><p>광신도의 밤 파일이나 SCED에서 저장한 다른 시나리오를 가져오세요.</p></div>
    <div class="setup-buttons"><a class="button-link" href="${campaignLink}" target="_blank" rel="noreferrer">광신도의 밤 받기 ↗</a>
    ${button("import", "파일 선택", "setup")}</div></article></div>
    <form id="scenario-form" class="setup-form">
    <label>시나리오 또는 저장 테이블<select name="pack" required><option value="">${list.length ? "테이블에 놓을 시나리오 선택" : "아직 가져온 시나리오가 없습니다"}</option>
    ${list.map((p) => `<option value="${h(p.key)}" ${p.code === "SB0101" ? "selected" : ""}>${h(p.name)}</option>`).join("")}</select></label>
    <label>광신도의 밤 난이도<select name="difficulty">${Object.entries(T.difficulties).map(([k,v]) => `<option value="${k}" ${k === "standard" ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="check"><input type="checkbox" name="roland" ${hasCore ? "checked" : "disabled"}> 롤랜드 기본 덱과 시작 손패 5장 함께 놓기</label>
    ${state.objects.length ? '<p class="muted">준비를 시작하면 현재 테이블이 새 시나리오로 바뀝니다. 저장 파일을 먼저 내보낼 수 있습니다.</p>' : ""}
    <button type="submit" class="gold" ${!list.length ? "disabled" : ""}>테이블에 펼치기</button></form>
    <p class="muted">각 카드의 규칙과 캠페인 기록은 직접 진행합니다. <a href="${guideLink}" target="_blank" rel="noreferrer">공식 규칙 ↗</a> · <a href="${campaignGuide}" target="_blank" rel="noreferrer">광신도의 밤 가이드 ↗</a></p>`, "SCED · SCENARIO SETUP");
}
function libraryRows() {
  const query = libraryFilter.query.trim().toLowerCase().split(/\s+/);
  const results = library.map((c, i) => ({ c, i })).filter(({ c }) =>
    (!libraryFilter.type || c.type === libraryFilter.type) && query.every((q) => [c.name, c.code, c.group, c.source].join(" ").toLowerCase().includes(q)));
  $("#library-results").innerHTML = `<p class="muted">검색 결과 ${results.length}종</p><div class="result-list">${results.slice(0, libraryFilter.visible).map(({ c, i }) =>
    `<article><div><b>${h(c.name)}</b><small>${h(c.code)} · ${h(c.type)} · ${h(c.group || c.source)}</small></div>
    ${button("library-add", "테이블에 놓기", i)}${button("library-hand", "손패에", i)}</article>`).join("") || "<p>카드가 없습니다. SCED JSON을 가져오세요.</p>"}</div>
    ${results.length > libraryFilter.visible ? button("library-more", "더 보기") : ""}`;
}
function libraryDialog() {
  showDialog("카드 자료실", `<div class="dialog-row">${button("import", "＋ SCED JSON 가져오기", "library", "gold")}<span>${library.length}종</span></div>
    <div class="filter-row"><label>검색<input id="library-query" type="search" value="${h(libraryFilter.query)}" placeholder="카드명, 코드, 세트"></label>
    <label>종류<select id="library-type"><option value="">전체</option>${[...new Set(library.map((c) => c.type))].sort().map((t) => `<option value="${h(t)}" ${t === libraryFilter.type ? "selected" : ""}>${h(t)}</option>`).join("")}</select></label></div>
    <div id="library-results"></div>`, "CARD LIBRARY");
  libraryRows();
}
function deckDialog() {
  showDialog("플레이어 덱 준비", `<p>SCED 플레이어 카드 자료가 필요합니다. 덱을 준비하면 기존 조사자, 플레이어 카드 영역과 손패가 새 덱으로 바뀝니다.</p>
    <div class="dialog-row">${button("roland", "롤랜드 기본 덱 + 시작 손패", "", "gold", !T.indexCards(library).has("01001"))}
    ${button("import", "SCED 가져오기", "deck")}</div>
    <form id="deck-form"><label>ArkhamDB 내보내기 JSON 또는 카드 코드 목록
    <textarea name="deck" rows="5" maxlength="50000" required placeholder="01020 x2&#10;01039 x2"></textarea></label>
    <label class="check"><input type="checkbox" name="opening" checked> 약점을 제외한 시작 손패 5장 뽑기</label>
    <button type="submit">덱 배치</button></form>`, "INVESTIGATOR DECK");
}
function inspect(ref, alternate = false) {
  const o = ref.startsWith("b:") ? state.objects.find((p) => p.id === Number(ref.slice(2))) : null;
  if (o?.kind === "bag") return openBag(o);
  if (o?.kind === "token") return;
  const c = o ? o.cards.at(-1) : state.hand[Number(ref.slice(2))];
  if (!c) return;
  const down = alternate ? !o?.down : !!o?.down;
  const hidden = down && !o?.backKnown && !alternate;
  showDialog(hidden ? (o?.name || "뒤집힌 카드") : c.name, `<div class="card-detail"><div class="large-card ${shape(c)}">${face(c, down, o?.side, !hidden)}</div>
    <div>${!hidden ? `<p>${h(c.type)} · ${h(c.code)}${c.cost !== null ? " · 비용 " + h(c.cost) : ""}</p><p>${h(c.info)}</p>
    <div class="stats">${Object.entries(c.stats).map(([k,v]) => `<span>${h(k)} ${v}</span>`).join("")}</div>` : "<p>덱의 앞면을 확인하려면 반대쪽 보기를 선택하세요.</p>"}
    <div class="dialog-row">${button("other-side", "반대쪽 보기", ref + "|" + (alternate ? "0" : "1"))}
    ${o?.kind === "cards" ? button("flip", "테이블에서 뒤집기", ref) : ""}</div></div></div>`, "CARD VIEW");
}
function deckRows(o) {
  const q = deckSearch.trim().toLowerCase();
  $("#deck-results").innerHTML = `<div class="result-list">${o.cards.map((c, i) => ({ c, i })).reverse().filter(({ c }) =>
    (c.name + " " + c.code).toLowerCase().includes(q)).map(({ c, i }) =>
    `<article><div><b>${h(c.name)}</b><small>${h(c.code)} · ${h(c.type)}</small></div>
    ${button("take-card", "꺼내기", o.id + "|" + i)}</article>`).join("") || "<p>일치하는 카드가 없습니다.</p>"}</div>`;
}
function deckContents(o) {
  deckSearch = "";
  showDialog(T.title(o), `<p>덱 내부를 봅니다. 선택한 카드를 꺼내도 나머지 카드의 순서는 유지됩니다.</p>
    <label>카드 찾기<input type="search" id="deck-search" data-id="${o.id}" placeholder="카드명 또는 코드"></label><div id="deck-results"></div>`, "SEARCH DECK");
  deckRows(o);
}
function openBag(o) {
  showDialog(T.title(o), `<div class="result-list">${o.items.map((item, i) => `<article><div><b>${h(item.name || item.card?.name)}</b>
    <small>${item.kind === "deck" ? item.cards.length + "장" : item.kind === "bag" ? item.items.length + "개" : h(item.card.type)}</small></div>
    ${button("take-item", "테이블에 꺼내기", o.id + "|" + i)}</article>`).join("") || "<p>상자가 비어 있습니다.</p>"}</div>`, "SET ASIDE");
}
function placeItem(s, item) {
  const n = s.objects.filter((o) => o.x >= 550 && o.x < 1030 && o.y >= 295 && o.y < 560).length;
  const x = 570 + (n % 4) * 118;
  const y = 315 + (Math.floor(n / 4) % 2) * 145;
  if (item.kind === "bag") return T.piece(s, "bag", x, y, { name: item.name, items: item.items });
  if (item.kind === "deck") return T.pile(s, item.cards, x, y, { name: item.name, down: true });
  return T.pile(s, [item.card], x, y, { backKnown: item.card.type === "Location" });
}
function help() {
  showDialog("테이블 조작", `<ul class="help">
    <li>시나리오 준비에서 두 JSON을 불러온 뒤 시나리오를 선택하세요. 공식 캠페인의 결말과 다음 시나리오의 추가 설정은 가이드를 따라 처리합니다.</li>
    <li>카드를 자유롭게 끌어 옮기세요. 손패에서 테이블로 드래그하면 내려놓고, 테이블에서 손패로 드래그하면 가져옵니다. 카드 위에 <kbd>Shift</kbd>를 누른 채 떨어뜨리면 더미에 넣습니다.</li>
    <li>우클릭이나 <kbd>Enter</kbd>로 카드 메뉴를 열어 뽑기, 섞기, 검색, 뒤집기, 회전, 버리기, 토큰 조작을 합니다. 더블 클릭이나 <kbd>Space</kbd>로 크게 봅니다.</li>
    <li>토큰 공급처에서 토큰을 끌어 카드에 올려놓거나 빈 곳에 놓으세요. 혼돈 토큰은 <b>반납</b>을 누를 때 주머니에 돌아갑니다.</li>
    <li>빈 곳을 끌면 시점이 이동합니다. 마우스 휠이나 화면 아래 버튼으로 확대·축소합니다. <kbd>Ctrl</kbd>+<kbd>Z</kbd>는 되돌리기입니다.</li>
    <li>준비된 TTS 저장의 카드와 덱 위치를 가져올 수 있습니다. SCED Lua는 브라우저에서 실행되지 않으므로 카드 효과, 적 이동과 캠페인 결말을 직접 적용합니다.</li>
    </ul><p><a href="${guideLink}" target="_blank" rel="noreferrer">공식 규칙·캠페인 가이드 ↗</a> ·
    <a href="https://github.com/Chr1Z93/SCED" target="_blank" rel="noreferrer">SCED 프로젝트 ↗</a></p>`, "FIELD MANUAL");
}
function notesDialog() {
  showDialog("플레이 기록", `<label>캠페인 메모<textarea id="notes" maxlength="12000" rows="4">${h(state.notes)}</textarea></label>
    <ol class="history">${state.log.map((row) => `<li><small>R${row.round}</small>${h(row.text)}</li>`).join("") || "<li>아직 기록이 없습니다.</li>"}</ol>`, "CAMPAIGN LOG");
}
function saveDialog() {
  showDialog("저장 관리", `<p>테이블과 손패는 이 브라우저에 저장됩니다. 다른 브라우저에서도 이어서 하려면 저장 파일을 이용하세요.</p>
    <div class="dialog-row">${button("export", "현재 테이블 내보내기", "", "gold")}${button("restore", "저장 파일 불러오기")}</div>
    <p class="muted">불러오기를 실행하면 현재 테이블이 저장 파일의 상태로 바뀝니다.</p>`, "LOCAL SAVE");
}
function bagDialog() {
  showDialog("혼돈 주머니 편집", `<p>토큰을 쉼표나 줄바꿈으로 구분합니다. 같은 값은 개수만큼 적으세요. 변경 시 뽑은 토큰도 주머니에 합칩니다.</p>
    <form id="bag-form"><label>토큰 목록<textarea name="tokens" rows="5" maxlength="4500" required>${h([...state.bag, ...state.pulled].join(", "))}</textarea></label>
    <div class="dialog-row"><button type="submit" class="gold">저장</button>${button("bag-imported", "SCED 기본값 적용", "", "", !importedBag.length)}</div></form>`, "CHAOS BAG");
}
function mulliganDialog() {
  showDialog("멀리건", `<p>바꿀 시작 손패를 선택하세요. 새 카드를 뽑은 후 선택한 카드를 덱에 섞습니다.</p>
    <form id="mulligan-form">${state.hand.map((c,i) => `<label class="check"><input type="checkbox" name="card" value="${i}"> ${h(c.name)}</label>`).join("")}
    <button class="gold" type="submit">선택한 카드 교체</button></form>`, "OPENING HAND");
}
function closeMenu() { menu.hidden = true; }
function select(ref) {
  selected = ref;
  $("#selected-control").disabled = !find(ref) && !handCard(ref);
  document.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
  const [kind,id] = ref.split(":");
  if (id !== undefined) document.querySelector(`[data-${kind === "b" ? "piece" : "hand"}="${Number(id)}"]`)?.classList.add("selected");
}
function contextMenu(ref, x, y) {
  const o = find(ref);
  const c = handCard(ref);
  if (!o && !c) return;
  select(ref);
  const items = [];
  const add = (action, label) => items.push(button(action, label, ref, "menu-item"));
  if (c) {
    add("inspect", "크게 보기");
    add("play-hand", "테이블에 놓기");
    add("discard-player", "플레이어 버림에 놓기");
    if (T.byRole(state, "player")) { add("top", "플레이어 덱 위로"); add("bottom", "플레이어 덱 아래로"); }
  } else if (o.kind === "cards") {
    add("inspect", "크게 보기");
    add("flip", "앞·뒷면 뒤집기");
    add("rotate", "90° 회전");
    if (o.cards.at(-1).states.length) add("next-side", "대체 상태 전환");
    if (o.cards.length > 1 || ["player", "encounter"].includes(o.role)) {
      add("draw", "맨 위 카드 뽑기");
      add("shuffle", "섞기");
      add("deck-contents", "덱 안에서 찾기");
      if (o.cards.length > 2) add("split", "절반으로 나누기");
    }
    if (["agenda", "act"].includes(o.role)) add("advance", "현재 카드 뒷면을 펼치고 진행");
    if (o.cards.length === 1) add("to-hand", "손패로 이동");
    if (o.role !== "playerDiscard") add("discard-player", "플레이어 버림에 놓기");
    if (o.role !== "encounterDiscard") add("discard-encounter", "조우 버림에 놓기");
    if (o.role === "playerDiscard" || o.role === "encounterDiscard") add("recycle", "섞어서 원래 덱으로");
    add("markers", "카드의 토큰 조정");
  } else if (o.kind === "bag") {
    add("open-bag", "상자 열기");
  } else {
    add("token-add", "수량 +1");
    add("token-sub", "수량 −1");
  }
  if (o) add("remove", "테이블에서 치우기");
  menu.innerHTML = `<b>${h(c?.name || T.title(o))}</b>${items.join("")}`;
  menu.hidden = false;
  menu.style.left = Math.max(6, Math.min(x, innerWidth - menu.offsetWidth - 8)) + "px";
  menu.style.top = Math.max(6, Math.min(y, innerHeight - menu.offsetHeight - 8)) + "px";
}
const find = (ref) => ref.startsWith("b:") ? state.objects.find((o) => o.id === Number(ref.slice(2))) : null;
const handCard = (ref) => ref.startsWith("h:") ? state.hand[Number(ref.slice(2))] : null;
function markers(o) {
  showDialog("카드 위 토큰", `<div class="marker-editor">${Object.entries(T.tokenKinds).filter(([k]) => k !== "investigator").map(([k,[g,name]]) =>
    `<div><b>${g} ${name}</b>${button("mark-minus", "−", o.id + "|" + k, "", !o.tokens[k])}
    <span>${o.tokens[k] || 0}</span>${button("mark-plus", "+", o.id + "|" + k)}</div>`).join("")}</div>`, "CARD COUNTERS");
}

function moveHand(s, i, x, y) {
  const c = s.hand.splice(i, 1)[0];
  if (!c) return false;
  T.pile(s, [c], x, y, { sideOfTable: "player", backKnown: c.type === "Location" });
  T.log(s, c.name + " · 손패에서 내려놓음");
}
function placeLibrary(s, c) {
  const n = s.objects.filter((o) => o.x >= 540 && o.x < 995 && o.y > 640).length;
  T.pile(s, [c], 540 + (n % 5) * 105, 657 + Math.floor(n / 5) * 110, { backKnown: c.type === "Location", sideOfTable: c.type === "Location" ? "" : "player" });
  T.log(s, c.name + " · 자료실에서 배치");
}
function cardAction(action, ref) {
  const o = find(ref);
  const c = handCard(ref);
  if (!o && !c) return;
  if (action === "inspect") return inspect(ref);
  if (action === "deck-contents" && o?.cards?.length) return deckContents(o);
  if (action === "open-bag" && o?.kind === "bag") return openBag(o);
  if (action === "markers" && o?.kind === "cards") return markers(o);
  const wasInspect = dialog.open && !!dialog.querySelector(".card-detail");
  const success = update((s) => {
    switch (action) {
      case "flip": {
        if (o?.kind !== "cards") return false;
        o.down = !o.down;
        const card = o.cards.at(-1);
        if (o.cards.length === 1 && o.down && !o.revealed && card.type === "Location") {
          o.revealed = true;
          if (card.clues && !o.tokens.clue) o.tokens.clue = card.clues;
        }
        break;
      }
      case "rotate":
        if (o?.kind !== "cards") return false;
        o.angle = (o.angle + 90) % 360;
        break;
      case "next-side":
        if (!o?.cards?.at(-1).states.length) return false;
        o.side = (o.side + 1) % (o.cards.at(-1).states.length + 1);
        break;
      case "draw":
        if (!o?.cards?.length || (o.cards.length < 2 && !["player","encounter"].includes(o.role))) return false;
        T.draw(s, o);
        select("");
        break;
      case "shuffle":
        if (!o?.cards || o.cards.length < 2) return false;
        o.cards = T.shuffle(o.cards);
        o.side = 0;
        T.log(s, T.title(o) + " 섞기");
        break;
      case "split":
        if (!o?.cards || o.cards.length < 3) return false;
        T.pile(s, o.cards.splice(Math.floor(o.cards.length / 2)), o.x + 115, o.y + 22, { down: o.down, sideOfTable: o.sideOfTable || "" });
        break;
      case "advance":
        if (!o?.cards || !["act","agenda"].includes(o.role)) return false;
        T.advance(s, o);
        break;
      case "to-hand":
        if (o?.cards?.length !== 1) return false;
        s.hand.push(o.cards[0]);
        T.remove(s, o.id);
        select("");
        break;
      case "play-hand":
        if (!c) return false;
        moveHand(s, Number(ref.slice(2)), 520 + (s.objects.length % 6) * 110, 655);
        select("");
        break;
      case "discard-player":
      case "discard-encounter": {
        const role = action === "discard-player" ? "playerDiscard" : "encounterDiscard";
        if (o?.role === role || (!c && !o?.cards)) return false;
        const cards = c ? s.hand.splice(Number(ref.slice(2)), 1) : o.cards;
        if (o) T.remove(s, o.id);
        T.discard(s, cards, role);
        T.log(s, T.roles[role].label + " · " + cards.length + "장");
        select("");
        break;
      }
      case "recycle": {
        if (!o?.cards || !["playerDiscard", "encounterDiscard"].includes(o.role)) return false;
        const role = o.role === "playerDiscard" ? "player" : "encounter";
        const position = T.roles[role];
        const existing = T.byRole(s, role);
        if (existing) { existing.cards = T.shuffle([...existing.cards, ...o.cards]); existing.down = true; }
        else T.pile(s, T.shuffle(o.cards), position.x, position.y, { name: position.label, role, down: true, sideOfTable: role === "player" ? "player" : "" });
        T.remove(s, o.id);
        T.log(s, position.label + " 재구성 및 섞기");
        select("");
        break;
      }
      case "top":
      case "bottom": {
        const deck = T.byRole(s, "player");
        if (!c || !deck) return false;
        s.hand.splice(Number(ref.slice(2)), 1);
        if (action === "top") deck.cards.push(c);
        else deck.cards.unshift(c);
        select("");
        break;
      }
      case "token-add":
      case "token-sub":
        if (o?.kind !== "token") return false;
        o.n = T.range(o.n + (action === "token-add" ? 1 : -1), 0, 99);
        if (!o.n) T.remove(s, o.id);
        break;
      case "remove":
        if (!o) return false;
        T.remove(s, o.id);
        select("");
        break;
      default: return false;
    }
  });
  if (success && wasInspect && action === "flip") inspect(ref);
}

function generalAction(action, value) {
  switch (action) {
    case "setup": return setupDialog();
    case "library": return libraryDialog();
    case "deck": return deckDialog();
    case "help": return help();
    case "note": return notesDialog();
    case "save": return saveDialog();
    case "bag": return bagDialog();
    case "mulligan": return mulliganDialog();
    case "close": return closeDialog();
    case "import":
      importReturn = value || "setup";
      $("#sced-file").click();
      return;
    case "restore": return $("#save-file").click();
    case "export": return exportSave();
    case "selected-menu": {
      const target = $("#selected-control");
      const rect = target.getBoundingClientRect();
      return contextMenu(selected, rect.left, rect.top - 24);
    }
    case "fit": return fit();
    case "zoom-in": return zoom(1.19);
    case "zoom-out": return zoom(1 / 1.19);
    case "undo":
      if (undo.length) {
        state = undo.pop();
        select("");
        save();
        render();
        note("직전 조작을 되돌렸습니다.");
      }
      return;
    case "next-phase":
      return update((s) => {
        s.phase = (s.phase + 1) % 4;
        if (!s.phase) s.round++;
        T.log(s, T.phases[s.phase] + " 단계");
      });
    case "phase":
      return update((s) => { const phase = Number(value); if (s.phase === phase) return false; s.phase = phase; });
    case "chaos":
      if (!state.bag.length) return note("주머니가 비었습니다. 뽑은 토큰을 반납하세요.");
      return update((s) => {
        const [t] = s.bag.splice(Math.floor(Math.random() * s.bag.length), 1);
        s.pulled.push(t);
        T.log(s, "혼돈 토큰 · " + (chaosLabels[t] || t));
      });
    case "return-chaos":
      return update((s) => { if (!s.pulled.length) return false; s.bag.push(...s.pulled); s.pulled = []; });
    case "bag-imported":
      if (importedBag.length && update((s) => { s.bag = [...importedBag]; s.pulled = []; })) closeDialog();
      return;
    case "quick-draw": {
      const deck = T.byRole(state, "player");
      if (deck) cardAction("draw", "b:" + deck.id);
      return;
    }
    case "roland":
      if (update((s) => T.installDeck(s, T.starter(), library, { opening: true, basic: true }))) closeDialog();
      return;
    case "library-more":
      libraryFilter.visible += 36;
      return libraryRows();
    case "library-add":
    case "library-hand": {
      const card = library[Number(value)];
      if (!card) return;
      if (update((s) => action === "library-add" ? placeLibrary(s, card) : s.hand.push(card))) note(card.name + " 추가");
      return;
    }
    case "other-side": {
      const [ref, side] = value.split("|");
      return inspect(ref, side === "1");
    }
    case "mark-minus":
    case "mark-plus": {
      const [id, key] = value.split("|");
      const o = find("b:" + id);
      if (!o || !Object.hasOwn(T.tokenKinds, key)) return;
      if (update(() => { o.tokens[key] = T.range((o.tokens[key] || 0) + (action === "mark-plus" ? 1 : -1), 0, 99); })) markers(o);
      return;
    }
    case "take-card": {
      const [id, index] = value.split("|").map(Number);
      const o = find("b:" + id);
      if (o?.cards?.[index] && update((s) => T.draw(s, o, index))) closeDialog();
      return;
    }
    case "take-item": {
      const [id, index] = value.split("|").map(Number);
      const o = find("b:" + id);
      if (o?.items?.[index] && update((s) => placeItem(s, o.items.splice(index, 1)[0]))) {
        closeDialog();
        note("상자에서 꺼냈습니다.");
      }
      return;
    }
    default: return cardAction(action, value);
  }
}
function targetRef(element) {
  const target = element?.closest("[data-piece],[data-hand]");
  if (!target) return "";
  return target.dataset.piece !== undefined ? "b:" + target.dataset.piece : "h:" + target.dataset.hand;
}
function positionForMenu(target) {
  const r = target.getBoundingClientRect();
  return [r.right - 12, r.top + 6];
}
function inRect(el, x, y) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
function discardAt(point) {
  return ["playerDiscard", "encounterDiscard"].find((role) => {
    const a = T.roles[role];
    return point.x >= a.x - 10 && point.x <= a.x + 115 && point.y >= a.y - 10 && point.y <= a.y + 145;
  });
}
function underPiece(event, ignore = null) {
  for (const el of document.elementsFromPoint(event.clientX, event.clientY)) {
    const ref = targetRef(el);
    const o = find(ref);
    if (o && o !== ignore && o.kind === "cards") return o;
  }
  return null;
}
function boardDrop(s, o, point, event, target) {
  if (o.kind === "cards" && o.cards.length === 1 && inRect($("#hand-dock"), event.clientX, event.clientY)) {
    s.hand.push(o.cards[0]);
    T.remove(s, o.id);
    return;
  }
  if (!inRect(view, event.clientX, event.clientY)) return false;
  const discard = discardAt(point);
  if (o.kind === "cards" && discard && o.role !== discard) {
    T.discard(s, o.cards, discard);
    T.remove(s, o.id);
    return;
  }
  if (o.kind === "cards" && target && event.shiftKey) {
    target.cards.push(...o.cards);
    T.remove(s, o.id);
    return;
  }
  if (o.kind === "token" && o.token !== "investigator" && target) {
    target.tokens[o.token] = T.range((target.tokens[o.token] || 0) + o.n, 0, 99);
    T.remove(s, o.id);
    return;
  }
  o.x = T.range(Math.round(point.x - drag.dx), 4, T.WIDTH - (o.kind === "token" ? 46 : 105));
  o.y = T.range(Math.round(point.y - drag.dy), 4, T.HEIGHT - (o.kind === "token" ? 46 : 132));
  if (o.kind !== "token") {
    T.remove(s, o.id);
    s.objects.push(o);
  }
}
function pointerDown(event) {
  if (event.button > 1 || event.target.closest("button:not([data-token]),dialog,#menu") || drag) return;
  const el = event.target.closest("[data-piece],[data-hand],[data-token]");
  if (!el && !view.contains(event.target)) return;
  closeMenu();
  const ref = targetRef(el);
  const item = find(ref);
  const point = boardPoint(event.clientX, event.clientY);
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ref, el,
    token: el?.dataset.token, pan: !el || event.button === 1,
    dx: item ? point.x - item.x : 48, dy: item ? point.y - item.y : 63,
    initialX: keep.x, initialY: keep.y, moved: false };
  if (drag.pan) { view.classList.add("panning"); event.preventDefault(); }
}
function pointerMove(event) {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  if (event.cancelable) event.preventDefault();
  if (drag.pan) {
    keep.x = T.range(drag.initialX + dx, -T.WIDTH * keep.scale + 80, view.clientWidth - 80);
    keep.y = T.range(drag.initialY + dy, -T.HEIGHT * keep.scale + 70, view.clientHeight - 70);
    transform();
  } else if (find(drag.ref)) {
    drag.el.style.translate = dx / keep.scale + "px " + dy / keep.scale + "px";
    drag.el.classList.add("dragging");
  } else {
    if (!drag.ghost) {
      drag.ghost = document.createElement("div");
      drag.ghost.className = "drag-ghost";
      drag.ghost.textContent = drag.token ? T.tokenKinds[drag.token][0] : handCard(drag.ref)?.name || "";
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = event.clientX + 13 + "px";
    drag.ghost.style.top = event.clientY + 13 + "px";
  }
}
function pointerEnd(event, cancelled = false) {
  if (!drag || drag.id !== event.pointerId) return;
  const active = drag;
  if (active.moved) {
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
  }
  active.ghost?.remove();
  if (active.el) { active.el.style.translate = ""; active.el.classList.remove("dragging"); }
  view.classList.remove("panning");
  if (active.moved && !active.pan && !cancelled) {
    const point = boardPoint(event.clientX, event.clientY);
    const item = find(active.ref);
    const card = handCard(active.ref);
    const target = underPiece(event, item);
    if (item) update((s) => boardDrop(s, item, point, event, target));
    else if (inRect(view, event.clientX, event.clientY) && (card || active.token)) {
      update((s) => {
        if (active.token) {
          if (target && active.token !== "investigator") target.tokens[active.token] = T.range((target.tokens[active.token] || 0) + 1, 0, 99);
          else T.token(s, active.token, point.x - 18, point.y - 18);
          return;
        }
        const i = Number(active.ref.slice(2));
        const discard = discardAt(point);
        if (discard) T.discard(s, s.hand.splice(i, 1), discard);
        else if (target && event.shiftKey) target.cards.push(...s.hand.splice(i, 1));
        else moveHand(s, i, point.x - 49, point.y - 66);
        select("");
      });
    }
  }
  drag = null;
}

function validSave(s) {
  const int = (v, max = 99999) => Number.isInteger(v) && v >= 0 && v <= max;
  const str = (v, max = 500) => typeof v === "string" && v.length <= max;
  const arr = (v, test, max) => Array.isArray(v) && v.length <= max && v.every(test);
  const sheet = (v) => v && str(v.url, 3000) && int(v.w, 10) && v.w >= 1 && int(v.h, 10) && v.h >= 1 && int(v.cell, 99);
  const validCard = (v) => v && str(v.name, 140) && str(v.code, 48) && str(v.type, 40) && str(v.info, 600) &&
    sheet(v.front) && sheet(v.back) && arr(v.states, (s) => s && str(s.name, 140) && sheet(s.front) && sheet(s.back), 12) &&
    v.stats && Object.values(v.stats).every((n) => int(n, 99)) && (v.cost === null || int(v.cost, 99));
  function box(v, depth = 0) {
    return v && depth < 24 && (v.kind === "card" ? validCard(v.card) :
      v.kind === "deck" ? str(v.name, 140) && arr(v.cards, validCard, 900) && v.cards.length :
      v.kind === "bag" && str(v.name, 140) && arr(v.items, (x) => box(x, depth + 1), 500));
  }
  function validPiece(v) {
    if (!v || !int(v.id, s.seq) || !int(v.x, T.WIDTH) || !int(v.y, T.HEIGHT) || !int(v.angle, 359) ||
        typeof v.down !== "boolean" || !int(v.side, 12) || !v.tokens || typeof v.tokens !== "object" ||
        !Object.entries(v.tokens).every(([k,n]) => Object.hasOwn(T.tokenKinds, k) && int(n, 99)) ||
        !(v.name === undefined || str(v.name, 140)) || !(v.role === undefined || v.role === "" || Object.hasOwn(T.roles, v.role))) return false;
    if (v.kind === "token") return Object.hasOwn(T.tokenKinds, v.token) && int(v.n, 99) && v.n >= 1;
    if (v.kind === "bag") return box(v);
    return v.kind === "cards" && arr(v.cards, validCard, 900) && v.cards.length > 0;
  }
  return s && s.version === 2 && int(s.seq, 9999999) && str(s.scenario, 180) && str(s.code, 30) &&
    int(s.round) && s.round >= 1 && int(s.phase, 3) && str(s.notes, 12000) &&
    arr(s.bag, (v) => str(v, 36) && v.length > 0, 120) && arr(s.pulled, (v) => str(v, 36) && v.length > 0, 120) &&
    s.bag.length + s.pulled.length > 0 && s.bag.length + s.pulled.length <= 120 &&
    arr(s.objects, validPiece, 1000) && new Set(s.objects.map((o) => o.id)).size === s.objects.length &&
    arr(s.hand, validCard, 250) && arr(s.log, (v) => v && int(v.round) && str(v.text, 500), 60);
}
async function fileJSON(file, limit) {
  if (file.size > limit) throw new Error("지원하는 JSON 파일 크기를 초과했습니다.");
  try { return JSON.parse(await file.text()); } catch { throw new Error("올바른 JSON 파일을 선택하세요."); }
}
async function importSced(files) {
  const readFiles = [];
  const errors = [];
  for (const file of files) {
    try { readFiles.push(T.parse(await fileJSON(file, 64 * 1024 * 1024), file.name.slice(0, 120))); }
    catch (e) { errors.push(file.name + " · " + e.message); }
  }
  if (!readFiles.length) throw new Error(errors.join(" / "));
  const seen = new Map(library.map((c) => [c.source + "|" + c.code + "|" + c.name + "|" + c.type, c]));
  const scenarios = new Map(packs.map((p) => [p.key, p]));
  for (const f of readFiles) {
    for (const c of f.library) seen.set(c.source + "|" + c.code + "|" + c.name + "|" + c.type, c);
    for (const p of f.packs) scenarios.set(p.key, p);
    if (f.bag.length) importedBag = f.bag;
  }
  library = [...seen.values()];
  packs = [...scenarios.values()];
  const saved = [write("library", library), write("packs", packs), write("bag", importedBag)].every(Boolean);
  if (!state.scenario && !state.pulled.length && readFiles.some((f) => f.bag.length)) {
    update((s) => { s.bag = [...importedBag]; });
  }
  ({ setup: setupDialog, deck: deckDialog, library: libraryDialog }[importReturn] || setupDialog)();
  note("자료실 " + library.length + "종 · 시나리오/테이블 " + packs.length + "개" +
    (saved ? "" : " · 저장 공간 부족으로 이번 실행에만 유지") + (errors.length ? " · " + errors.join(" / ") : ""));
}
function exportSave() {
  const blob = new Blob([JSON.stringify({ format: "arkham-web-table", state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arkham-table-round-" + state.round + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function submit(event) {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  try {
    if (form.id === "scenario-form") {
      const pack = packs.find((p) => p.key === data.get("pack"));
      if (!pack) return;
      if (update((s) => {
        T.setup(s, pack, data.get("difficulty"));
        if (data.has("roland")) T.installDeck(s, T.starter(), library, { opening: true, basic: true });
        select("");
      })) { closeDialog(); fit(); }
    } else if (form.id === "deck-form") {
      const deck = T.decklist(data.get("deck"));
      if (update((s) => T.installDeck(s, deck, library, { opening: data.has("opening") }))) closeDialog();
    } else if (form.id === "bag-form") {
      const tokens = data.get("tokens").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
      if (!tokens.length || tokens.length > 120 || tokens.some((x) => x.length > 36)) throw new Error("36자 이하의 토큰을 1~120개 입력하세요.");
      if (update((s) => { s.bag = tokens; s.pulled = []; })) closeDialog();
    } else if (form.id === "mulligan-form") {
      const indices = data.getAll("card").map(Number);
      if (!indices.length) throw new Error("바꿀 카드를 선택하세요.");
      if (update((s) => {
        const deck = T.byRole(s, "player");
        if (!deck) return false;
        const swapped = [];
        const retained = [];
        s.hand.forEach((c,i) => (indices.includes(i) ? swapped : retained).push(c));
        const setAside = [];
        const replacement = [];
        while (replacement.length < swapped.length && deck.cards.length) {
          const c = deck.cards.pop();
          if (c.weakness) setAside.push(c);
          else replacement.push(c);
        }
        s.hand = [...retained, ...replacement, ...swapped.splice(replacement.length)];
        deck.cards = T.shuffle([...deck.cards, ...setAside, ...swapped]);
        if (!deck.cards.length) T.remove(s, deck.id);
        T.log(s, "멀리건 · " + replacement.length + "장 교체");
      })) closeDialog();
    }
  } catch (error) { note(error.message); }
}

document.addEventListener("click", (event) => {
  if (suppressClick) return;
  const button = event.target.closest("[data-action]");
  if (button) {
    const { action, value = "" } = button.dataset;
    closeMenu();
    generalAction(action, value);
    return;
  }
  const token = event.target.closest("[data-token]")?.dataset.token;
  if (token) {
    update((s) => T.token(s, token, 1000 + s.objects.length % 4 * 45, 477 + s.objects.length % 3 * 42));
    return;
  }
  if (!menu.contains(event.target)) closeMenu();
  const ref = targetRef(event.target);
  if (ref) select(ref);
});
document.addEventListener("contextmenu", (event) => {
  const ref = targetRef(event.target);
  if (!ref) return;
  event.preventDefault();
  contextMenu(ref, event.clientX, event.clientY);
});
document.addEventListener("dblclick", (event) => {
  const ref = targetRef(event.target);
  if (ref && !suppressClick) inspect(ref);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeMenu(); return; }
  if (dialog.open || event.target.closest("textarea,input,select,[contenteditable]")) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault(); generalAction("undo", ""); return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const ref = targetRef(event.target) || selected;
  if (!ref) return;
  if (["Enter", "ContextMenu"].includes(event.key) && targetRef(event.target)) {
    event.preventDefault();
    contextMenu(ref, ...positionForMenu(event.target));
    menu.querySelector("button")?.focus();
    return;
  }
  const action = { f: "flip", r: "shuffle", q: "rotate", d: "draw", " ": "inspect" }[event.key.toLowerCase()];
  if (action && !event.target.closest("button,a")) {
    event.preventDefault();
    closeMenu();
    cardAction(action, ref);
  }
});
document.addEventListener("pointerdown", pointerDown);
document.addEventListener("pointermove", pointerMove, { passive: false });
document.addEventListener("pointerup", pointerEnd);
document.addEventListener("pointercancel", (e) => pointerEnd(e, true));
view.addEventListener("wheel", (event) => {
  event.preventDefault();
  const r = view.getBoundingClientRect();
  zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX - r.left, event.clientY - r.top);
}, { passive: false });
document.addEventListener("submit", submit);
document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "library-query") {
    libraryFilter.query = target.value;
    libraryFilter.visible = 36;
    libraryRows();
  } else if (target.id === "deck-search") {
    deckSearch = target.value;
    const o = find("b:" + target.dataset.id);
    if (o) deckRows(o);
  } else if (target.id === "notes") { state.notes = target.value; save(); }
});
document.addEventListener("change", async (event) => {
  const target = event.target;
  try {
    if (target.id === "library-type") {
      libraryFilter.type = target.value;
      libraryFilter.visible = 36;
      libraryRows();
    } else if (target.id === "sced-file" && target.files.length) {
      await importSced([...target.files]);
    } else if (target.id === "save-file" && target.files.length) {
      const file = await fileJSON(target.files[0], 14 * 1024 * 1024);
      if (file?.format !== "arkham-web-table" || !validSave(file.state)) throw new Error("이 웹 테이블에서 내보낸 저장 JSON을 선택하세요.");
      if (update((s) => Object.assign(s, file.state))) { closeDialog(); fit(); note("테이블을 복원했습니다."); }
    }
  } catch (error) { note(error.message); }
  if (target.type === "file") target.value = "";
});
$("#mat").innerHTML = `<div class="table-heading"><small>ARKHAM HORROR · SOLO TABLE</small><b>MYTHOS AREA</b></div>
  <div class="table-line"></div><div class="table-center">✦<small>INVESTIGATION AREA</small></div>
  <div class="table-player"><small>INVESTIGATOR PLAY AREA</small></div>` +
  Object.entries(T.roles).map(([k,v]) => `<div class="slot slot-${k}" style="left:${v.x}px;top:${v.y}px"><span>${v.label}</span></div>`).join("");
$("#tokens").innerHTML = Object.entries(T.tokenKinds).map(([k,[g,name]]) =>
  `<button type="button" class="token-supply token-${k}" data-token="${k}"><b>${g}</b><span>${name}</span></button>`).join("");
window.addEventListener("resize", fit);
save();
render();
fit();

