"use strict";

globalThis.Tabletop = (() => {
  const WIDTH = 1440;
  const HEIGHT = 930;
  const roles = {
    agenda: { label: "주요사건", x: 45, y: 70 },
    act: { label: "주요목적", x: 244, y: 70 },
    reference: { label: "시나리오 참조", x: 438, y: 70 },
    encounter: { label: "조우 덱", x: 1085, y: 65 },
    encounterDiscard: { label: "조우 버림", x: 1215, y: 65 },
    player: { label: "플레이어 덱", x: 46, y: 671 },
    playerDiscard: { label: "플레이어 버림", x: 175, y: 671 },
    investigator: { label: "조사자", x: 312, y: 685 },
  };
  const tokenKinds = { resource: ["◈", "자원"], clue: ["✦", "단서"], doom: ["⌛", "파멸"],
    damage: ["♥", "피해"], horror: ["◐", "공포"], investigator: ["◉", "조사자"] };
  const phases = ["신화", "조사", "적", "정리"];
  const standardBag = ["+1", "0", "0", "-1", "-1", "-1", "-2", "-2", "-3", "-4", "Skull", "Skull", "Cultist", "Tablet", "Auto-fail", "Elder Sign"];
  const easyBag = ["+1", "+1", "0", "0", "0", "-1", "-1", "-1", "-2", "-2", "Skull", "Skull", "Cultist", "Tablet", "Auto-fail", "Elder Sign"];
  const hardBag = ["0", "0", "0", "-1", "-1", "-2", "-2", "-3", "-3", "-4", "-5", "Skull", "Skull", "Cultist", "Tablet", "Auto-fail", "Elder Sign"];
  const expertBag = ["0", "-1", "-1", "-2", "-2", "-3", "-3", "-4", "-4", "-5", "-6", "-8", "Skull", "Skull", "Cultist", "Tablet", "Auto-fail", "Elder Sign"];
  const difficulties = { easy: "쉬움", standard: "보통", hard: "어려움", expert: "전문가" };
  const coreNames = { SB0101: "집결 · The Gathering", SB0102: "한밤의 가면 · The Midnight Masks", SB0103: "아래에서부터 삼키는 자 · The Devourer Below" };
  const safeHosts = new Set(["steamusercontent-a.akamaihd.net", "steamusercontent.com", "cloud.steamusercontent.com",
    "steamuserimages-a.akamaihd.net", "raw.githubusercontent.com", "assets.arkhamhorror.app", "i.imgur.com", "arkhamdb.com"]);
  const text = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const range = (v, min, max) => Math.max(min, Math.min(max, v));
  const json = (v) => { try { return JSON.parse(v) || {}; } catch { return {}; } };
  const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const info = (o) => json(o.GMNotes);
  const children = (o) => Array.isArray(o?.ContainedObjects) ? o.ContainedObjects.filter((v) => v && typeof v === "object") : [];
  const isCard = (o) => /^Card(Custom)?$/.test(o?.Name || "");
  const isDeck = (o) => /^Deck(Custom)?$/.test(o?.Name || "");
  const nameOf = (o) => text(o?.Nickname, 140) || text(o?.Name, 140) || "카드";
  const angle = (n) => Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : 0;
  const isDown = (transform) => angle(transform?.rotZ) >= 90 && angle(transform?.rotZ) < 270;
  function imageURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && safeHosts.has(url.hostname) ? url.href : "";
    } catch { return ""; }
  }
  function sheet(url, w = 1, h = 1, cell = 0) {
    return { url: imageURL(url), w: range(Math.trunc(Number(w) || 1), 1, 10), h: range(Math.trunc(Number(h) || 1), 1, 10), cell: range(cell, 0, 99) };
  }
  function sides(o, inherited = {}) {
    const cardId = Number(o.CardID);
    const deck = { ...inherited, ...o.CustomDeck }[Math.floor(cardId / 100)] || {};
    const cell = Number.isInteger(cardId) && cardId >= 0 ? cardId % 100 : 0;
    return {
      front: sheet(deck.FaceURL, deck.NumWidth, deck.NumHeight, cell),
      back: deck.UniqueBack ? sheet(deck.BackURL, deck.NumWidth, deck.NumHeight, cell) : sheet(deck.BackURL),
    };
  }
  function cardFrom(o, inherited, source, group = "") {
    const meta = info(o);
    const { front, back } = sides(o, inherited);
    const states = Object.values(o.States || {}).filter(isCard).slice(0, 12)
      .map((s) => ({ name: nameOf(s), ...sides(s, inherited) })).filter((s) => s.front.url);
    const stats = Object.fromEntries(Object.entries({
      "의지": meta.willpowerIcons, "지식": meta.intellectIcons, "힘": meta.combatIcons,
      "민첩": meta.agilityIcons, "체력": meta.health, "정신력": meta.sanity,
      "파멸 한계": meta.doomThreshold, "필요 단서/인": meta.clueThresholdPerInvestigator,
    }).filter(([, n]) => integer(n, 0, 99)));
    const clues = Array.isArray(meta.locationBack?.uses) ? meta.locationBack.uses.find((use) => use?.token === "clue") : null;
    return { code: text(meta.id || o.GUID, 48), name: nameOf(o), type: text(meta.type, 40) || "Card",
      clues: integer(clues?.countPerInvestigator ?? clues?.count, 0, 99) ? (clues.countPerInvestigator ?? clues.count) : 0,
      source, group, info: text(o.Description || meta.traits, 600), stats, weakness: !!meta.weakness,
      cost: integer(meta.cost, 0, 99) ? meta.cost : null,
      aliases: Array.isArray(meta.alternate_ids) ? meta.alternate_ids.map((id) => text(id, 48)).filter(Boolean).slice(0, 30) : [],
      front, back, states };
  }
  function parse(source, label) {
    const roots = Array.isArray(source?.ObjectStates) ? source.ObjectStates :
      source?.ObjectState ? [source.ObjectState] : source?.Name ? [source] : [];
    if (!roots.length) throw new Error("TTS 게임 저장 또는 SCED 저장 오브젝트 JSON을 선택하세요.");
    const library = [];
    const packs = [];
    let bag = [];
    const seen = new Set();
    const addCard = (card) => {
      const key = card.code + "|" + card.name + "|" + card.type;
      if (!seen.has(key) && library.length < 15000) { seen.add(key); library.push(card); }
      return card;
    };
    const readCard = (o, inherit, group) => addCard(cardFrom(o, inherit, label, group));
    function collect(items, path = [], inherit = {}) {
      if (path.length > 24) return [];
      const cards = [];
      for (const o of items) {
        if (!o || typeof o !== "object") continue;
        const name = nameOf(o);
        const group = path.join(" / ").slice(0, 260);
        if (isCard(o)) {
          cards.push(readCard(o, inherit, group));
          for (const s of Object.values(o.States || {}).filter(isCard)) readCard(s, inherit, group);
        }
        if (name === "Chaos Bag") bag = children(o).map((item) => text(item.Nickname, 36)).filter(Boolean).slice(0, 120);
        const next = o.CustomDeck || inherit;
        cards.push(...collect(children(o), [...path, name], next));
      }
      return cards;
    }
    function groupItems(items, name) {
      return items.filter((o) => o && typeof o === "object").flatMap((o) => {
        if (isCard(o)) return [{ kind: "card", card: cardFrom(o, {}, label, name), guid: text(o.GUID, 20), transform: o.Transform }];
        if (isDeck(o)) {
          const cards = children(o).filter(isCard).map((c) => cardFrom(c, o.CustomDeck, label, name));
          return cards.length ? [{ kind: "deck", cards, name: nameOf(o), guid: text(o.GUID, 20), transform: o.Transform }] : [];
        }
        if (children(o).length && !/^(All Player Cards|Additional Player Cards|Chaos Bag|.*tokens|Token Source|Object Source Bag|.*Documents)$/i.test(nameOf(o))) {
          const groups = groupItems(children(o), name);
          return groups.length ? [{ kind: "bag", name: nameOf(o), items: groups, guid: text(o.GUID, 20), transform: o.Transform }] : [];
        }
        return [];
      });
    }
    function findScenarios(items, depth = 0) {
      if (depth > 15) return;
      for (const o of items) {
        if (!o || typeof o !== "object") continue;
        const nested = children(o);
        const meta = info(o);
        if (meta.type === "ScenarioBox" || (nested.some((c) => isDeck(c) && /agenda deck/i.test(nameOf(c))) &&
            nested.some((c) => isDeck(c) && /encounter deck/i.test(nameOf(c))))) {
          const items = groupItems(nested, nameOf(o));
          if (items.length) packs.push({ key: label + ":" + (text(meta.id || o.GUID, 48) || packs.length),
            code: text(meta.id, 30), name: coreNames[meta.id] || nameOf(o), label, items });
        } else if (!/^(All Player Cards|Additional Player Cards)$/i.test(nameOf(o))) findScenarios(nested, depth + 1);
      }
    }
    collect(roots);
    findScenarios(roots);
    packs.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    const hasTemplate = roots.some((o) => nameOf(o) === "All Player Cards");
    const surface = groupItems(roots.filter((o) => (isCard(o) || isDeck(o)) &&
      (!hasTemplate || !["Tarot Deck", "Detailed Phase Reference"].includes(nameOf(o)))), "테이블");
    if (surface.length) packs.unshift({ key: label + ":table", code: "", name: text(source.SaveName, 140) || label, label, items: surface, surface: true });
    if (!library.length && !bag.length) throw new Error("이 파일에서 카드나 혼돈 토큰을 찾지 못했습니다.");
    return { library, packs, bag };
  }
  function shuffle(items, random = Math.random) {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function fresh() {
    return { version: 2, objects: [], hand: [], seq: 0, scenario: "", code: "", bag: [...standardBag], pulled: [],
      round: 1, phase: 1, notes: "", log: [] };
  }
  function log(state, message) {
    state.log.unshift({ round: state.round, text: message });
    state.log = state.log.slice(0, 60);
  }
  function piece(state, kind, x, y, data = {}) {
    const entry = { id: ++state.seq, kind, x: range(Math.round(x), 4, WIDTH - 70),
      y: range(Math.round(y), 4, HEIGHT - 55), angle: 0, down: false, side: 0, tokens: {}, ...data };
    state.objects.push(entry);
    return entry;
  }
  function pile(state, cards, x, y, data = {}) {
    return piece(state, "cards", x, y, { cards: [...cards], ...data });
  }
  const byRole = (s, role) => s.objects.find((o) => o.role === role && o.kind === "cards");
  const remove = (s, id) => { s.objects = s.objects.filter((o) => o.id !== id); };
  const title = (p) => p?.name || (p?.down ? "뒤집힌 카드" : p?.cards?.at(-1)?.name) || "카드";
  function token(state, key, x, y, n = 1) {
    return piece(state, "token", x, y, { token: key, n });
  }
  function roleFor(item) {
    if (/agenda deck/i.test(item.name || "") || item.card?.type === "Agenda") return "agenda";
    if (/^act deck/i.test(item.name || "") || item.card?.type === "Act") return "act";
    if (/encounter deck/i.test(item.name || "")) return "encounter";
    if (item.card?.type === "ScenarioReference") return "reference";
    return "";
  }
  function setup(state, pack, difficulty = "standard") {
    state.objects = [];
    state.hand = [];
    state.scenario = pack.name;
    state.code = pack.code;
    state.round = 1;
    state.phase = 1;
    state.pulled = [];
    if (pack.code.startsWith("SB01")) {
      state.bag = [...({ easy: easyBag, standard: standardBag, hard: hardBag, expert: expertBag }[difficulty] || standardBag)];
    }
    let items = pack.items;
    if (pack.code === "SB0102") {
      const locations = ["Downtown", "Southside"];
      const chosen = locations.map((name) => shuffle(items.filter((item) => item.card?.name === name))[0]);
      items = items.filter((item) => !locations.includes(item.card?.name) || chosen.includes(item));
    }
    if (pack.code === "SB0103") {
      const woods = items.find((item) => item.name === "Arkham Woods");
      const agents = items.find((item) => item.name === "Agents of Ancient One");
      const add = shuffle(agents?.items.filter((item) => item.kind === "deck") || [])[0]?.cards || [];
      items = items.filter((item) => item !== woods && item !== agents).map((item) =>
        roleFor(item) === "encounter" ? { ...item, cards: [...item.cards, ...add] } : item);
      if (woods?.cards) items.push(...shuffle(woods.cards).slice(0, 4).map((card) => ({ kind: "card", card })));
    }
    let free = 0;
    let reserve = 0;
    const coordinates = pack.surface ? pack.items.map((o) => o.transform).filter((t) => Number.isFinite(t?.posX) && Number.isFinite(t?.posZ)) : [];
    const xs = coordinates.map((t) => t.posX);
    const zs = coordinates.map((t) => t.posZ);
    const scale = Math.min(45, 1130 / (Math.max(...xs) - Math.min(...xs) || 1), 665 / (Math.max(...zs) - Math.min(...zs) || 1));
    for (const item of items) {
      const role = pack.surface ? "" : roleFor(item);
      const pos = roles[role] || (item.kind === "bag" ? { x: 1090 + reserve++ % 2 * 120, y: 287 + Math.floor((reserve - 1) / 2) * 128 } :
        { x: 137 + free % 6 * 148, y: 300 + Math.floor(free++ / 6) * 148 });
      const t = item.transform;
      const x = pack.surface && Number.isFinite(t?.posX) && xs.length ? 115 + (t.posX - Math.min(...xs)) * scale : pos.x;
      const y = pack.surface && Number.isFinite(t?.posZ) && zs.length ? 86 + (Math.max(...zs) - t.posZ) * scale : pos.y;
      if (item.kind === "bag") {
        piece(state, "bag", x, y, { name: item.name, items: item.items });
        continue;
      }
      let cards = item.kind === "deck" ? item.cards : [item.card];
      if (role === "encounter" || /cultist deck/i.test(item.name || "")) cards = shuffle(cards);
      const startingLocation = (pack.code === "SB0101" && item.card?.code === "01111") ||
        (pack.code === "SB0102" && item.card?.code === "01124") || (pack.code === "SB0103" && item.card?.code === "01149");
      const down = pack.surface ? isDown(t) : startingLocation || role === "encounter" ||
        (item.kind === "deck" && !role) || (item.card?.type !== "Location" && isDown(t));
      const object = pile(state, cards, x, y, { name: item.kind === "deck" ? item.name : "", role,
        angle: pack.surface ? angle((t?.rotY || 180) - 180) : 0,
        down, revealed: startingLocation,
        backKnown: item.card?.type === "Location" || role === "reference" || role === "investigator" });
      if (startingLocation && item.card.clues) object.tokens.clue = item.card.clues;
      if (role === "reference" && ["hard", "expert"].includes(difficulty)) object.down = true;
    }
    log(state, pack.name + " 준비");
  }
  function decklist(source) {
    let raw;
    try { raw = JSON.parse(source); } catch {
      raw = {};
      for (const line of source.trim().split(/\n/)) {
        const m = /^(\d{5,}(?:-[\w]+)?)(?:\s*(?:x|×|,)?\s*(\d+))?$/.exec(line.trim());
        if (!m) throw new Error("카드 코드와 수량을 한 줄에 하나씩 적어 주세요. 예시 01020 x2");
        raw[m[1]] = (raw[m[1]] || 0) + Number(m[2] || 1);
      }
    }
    const slots = raw?.slots || raw?.cards || raw;
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) throw new Error("덱 목록을 읽을 수 없습니다.");
    const entries = Object.entries(slots);
    if (!entries.length || entries.length > 200 || entries.some(([id, qty]) => !/^\d{5,}(?:-[\w]+)?$/.test(id) || !integer(qty, 1, 10)) ||
      entries.reduce((n, [, qty]) => n + qty, 0) > 200) throw new Error("카드 코드 또는 수량을 확인해 주세요.");
    return { name: text(raw?.name, 140) || "플레이어 덱", entries, investigator: text(raw?.investigator_code || raw?.investigator, 48) };
  }
  function starter() {
    const entries = [["01006", 1], ["01007", 1]];
    for (const [first, last] of [[16, 25], [30, 39]]) for (let i = first; i <= last; i++) entries.push(["010" + i, 1]);
    for (const n of [86, 87, 88, 89, 92]) entries.push(["010" + n, 2]);
    return { name: "롤랜드 뱅크스 기본 덱", investigator: "01001", entries };
  }
  function indexCards(library) {
    const map = new Map();
    for (const c of library) if (c.code && !map.has(c.code)) map.set(c.code, c);
    for (const c of library) for (const id of c.aliases || []) if (!map.has(id)) map.set(id, c);
    return map;
  }
  function installDeck(state, deck, library, { opening = false, basic = false } = {}) {
    const map = indexCards(library);
    const missing = [...deck.entries.map(([id]) => id), ...(deck.investigator ? [deck.investigator] : [])].filter((id) => !map.has(id));
    if (missing.length) throw new Error("자료실에 없는 카드 코드 · " + missing.slice(0, 12).join(", "));
    const cards = deck.entries.flatMap(([id, qty]) => Array(qty).fill(map.get(id)));
    if (basic) {
      const weaknesses = ["01096", "01097", "01098", "01099", "01100", "01101", "01102", "01103"]
        .map((id) => map.get(id)).filter((c) => c?.weakness);
      if (weaknesses.length) cards.push(shuffle(weaknesses)[0]);
    }
    state.objects = state.objects.filter((o) => o.sideOfTable !== "player" && !["player", "playerDiscard", "investigator"].includes(o.role));
    state.hand = [];
    const player = roles.player;
    const deckPiece = pile(state, shuffle(cards), player.x, player.y, { name: deck.name, role: "player", down: true, sideOfTable: "player" });
    if (deck.investigator) {
      const loc = roles.investigator;
      const inv = pile(state, [map.get(deck.investigator)], loc.x, loc.y, { role: "investigator", sideOfTable: "player", backKnown: true });
      inv.tokens.resource = 5;
      const location = state.objects.find((o) => o.cards?.some((c) => ["01111", "01124", "01149"].includes(c.code)));
      token(state, "investigator", location ? location.x + 98 : 480, location ? location.y + 84 : 725).sideOfTable = "player";
    }
    if (opening) {
      const weaknesses = [];
      while (state.hand.length < 5 && deckPiece.cards.length) {
        const card = deckPiece.cards.pop();
        if (card.weakness) weaknesses.push(card);
        else state.hand.push(card);
      }
      deckPiece.cards = shuffle([...deckPiece.cards, ...weaknesses]);
      if (!deckPiece.cards.length) remove(state, deckPiece.id);
    }
    log(state, deck.name + " 준비" + (opening ? " · 시작 손패 " + state.hand.length + "장" : ""));
  }
  function draw(state, object, index = object.cards.length - 1, destination = "") {
    if (!object.cards[index]) return null;
    const card = object.cards.splice(index, 1)[0];
    if (!object.cards.length) remove(state, object.id);
    if (destination === "hand" || (!destination && object.role === "player")) {
      state.hand.push(card);
      log(state, "플레이어 카드 뽑기");
      return null;
    }
    const x = object.role === "encounter" ? 929 : object.x + 114;
    const y = object.role === "encounter" ? 105 : object.y + 28;
    const next = pile(state, [card], x, y, { sideOfTable: object.sideOfTable || "", backKnown: card.type === "Location" });
    log(state, "카드 뽑기 · " + card.name);
    return next;
  }
  function discard(state, cards, role) {
    const current = byRole(state, role);
    if (current) current.cards.push(...cards);
    else pile(state, cards, roles[role].x, roles[role].y, { role, name: roles[role].label });
  }
  function advance(state, object) {
    const card = object.cards.pop();
    if (!card) return;
    object.tokens = {};
    if (!object.cards.length) remove(state, object.id);
    pile(state, [card], object.x + 72, object.y + 106, { down: true, backKnown: true });
    log(state, object.name + " 진행 · " + card.name);
  }
  return { WIDTH, HEIGHT, roles, tokenKinds, phases, difficulties, parse, shuffle, imageURL, fresh, log, piece, pile, token, byRole, remove, title,
    setup, decklist, starter, indexCards, installDeck, draw, discard, advance, range };
})();

