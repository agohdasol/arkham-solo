"use strict";

globalThis.Tabletop = (() => {
  const zones = {
    deck: "플레이어 덱", hand: "손패", assets: "플레이 영역", threats: "위협 영역",
    board: "시나리오 · 장소", encounter: "조우 덱", discard: "플레이어 버림", encounterDiscard: "조우 버림", setAside: "별도 보관",
  };
  const stats = { resources: "자원", clues: "단서", damage: "피해", horror: "공포", doom: "파멸", actions: "행동" };
  const safeHosts = new Set(["steamusercontent-a.akamaihd.net", "steamusercontent.com", "cloud.steamusercontent.com",
    "steamuserimages-a.akamaihd.net", "raw.githubusercontent.com", "assets.arkhamhorror.app"]);
  function imageURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && safeHosts.has(url.hostname) ? url.href : "";
    } catch { return ""; }
  }

  function parse(source, label) {
    const roots = source?.ObjectStates || (source?.ObjectState ? [source.ObjectState] : source?.Name ? [source] : null);
    if (!Array.isArray(roots)) throw new Error("Tabletop Simulator 형식의 JSON을 선택해 주세요.");
    const cards = [];
    const tokens = [];
    const seen = new Set();
    function visit(items, parents = [], inherited = {}) {
      if (parents.length > 36 || !Array.isArray(items)) return;
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const name = String(item.Nickname || "").trim().slice(0, 160);
        const path = name ? [...parents, name] : parents;
        const deck = item.CustomDeck || inherited;
        if (/^Card(?:Custom)?$/.test(item.Name) && name) {
          let meta = {};
          try { meta = JSON.parse(item.GMNotes || "{}") || {}; } catch { /* Notes can be plain text. */ }
          const number = Number(item.CardID);
          const image = deck[Math.floor(number / 100)] || {};
          const id = String(meta.id || item.GUID || number).slice(0, 40);
          const key = id + "|" + name;
          if (!seen.has(key) && cards.length < 15000) {
            seen.add(key);
            cards.push({
              id, name, type: String(meta.type || "Card").slice(0, 35), source: label,
              group: parents.join(" / ").slice(0, 280), className: String(meta.class || "").slice(0, 30),
              cost: Number.isInteger(meta.cost) && meta.cost >= 0 ? meta.cost : null,
              alternateIds: Array.isArray(meta.alternate_ids) ? meta.alternate_ids.filter((id) => typeof id === "string").slice(0, 20) : [],
              stats: Object.fromEntries(Object.entries({ will: meta.willpowerIcons, intellect: meta.intellectIcons,
                fight: meta.combatIcons, evade: meta.agilityIcons, wild: meta.wildIcons }).filter(([, v]) => Number.isFinite(v))),
              info: String(item.Description || meta.traits || "").slice(0, 500),
              face: imageURL(image.FaceURL), back: image.UniqueBack ? imageURL(image.BackURL) : "",
              width: Math.max(1, Math.min(10, Number(image.NumWidth) || 1)),
              height: Math.max(1, Math.min(10, Number(image.NumHeight) || 1)),
              cell: Number.isInteger(number) ? number % 100 : 0,
            });
          }
        }
        if (name === "Chaos Bag" && Array.isArray(item.ContainedObjects)) {
          for (const token of item.ContainedObjects) {
            if (typeof token?.Nickname === "string" && token.Nickname.trim()) tokens.push(token.Nickname.trim().slice(0, 32));
          }
        }
        visit(item.ContainedObjects, path, deck);
        if (item.States && typeof item.States === "object") visit(Object.values(item.States), path, deck);
      }
    }
    visit(roots);
    if (!cards.length && !tokens.length) throw new Error("이 파일에서 카드 또는 혼돈 토큰을 찾지 못했습니다.");
    return { cards, tokens };
  }

  function fresh(bag = Arkham.difficulties.standard.bag) {
    return { mode: "table", round: 1, phase: "investigation", resources: 5, clues: 0,
      damage: 0, horror: 0, doom: 0, actions: 3, bag: [...bag], token: "",
      zones: Object.fromEntries(Object.keys(zones).map((zone) => [zone, []])), notes: "", log: [] };
  }
  function add(state, card, zone, qty = 1) {
    for (let index = 0; index < qty; index++) {
      state.zones[zone].push({ card, exhausted: false, back: false, tokens: 0 });
    }
  }
  function move(state, source, index, destination) {
    if (source === destination || !state.zones[source]?.[index] || !state.zones[destination]) return false;
    const [entry] = state.zones[source].splice(index, 1);
    state.zones[destination].push(entry);
    Arkham.log(state, zones[source] + " → " + zones[destination] + (["deck", "encounter"].includes(destination) ? "" : " · " + entry.card.name));
    return true;
  }
  function decklist(text) {
    let raw;
    try { raw = JSON.parse(text); } catch {
      raw = {};
      for (const line of text.trim().split(/\n/)) {
        const m = /^(\d{5,}(?:-[\w]+)?)(?:\s*(?:x|×|,)?\s*(\d+))?$/.exec(line.trim());
        if (!m) throw new Error("카드 코드와 수량을 한 줄에 하나씩 적어 주세요. 예시 01020 x2");
        raw[m[1]] = (raw[m[1]] || 0) + Number(m[2] || 1);
      }
    }
    const slots = raw?.slots || raw;
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) throw new Error("덱 목록을 읽을 수 없습니다.");
    const entries = Object.entries(slots);
    if (!entries.length || entries.length > 200 || entries.some(([id, qty]) =>
      !/^\d{5,}(?:-[\w]+)?$/.test(id) || !Number.isInteger(qty) || qty < 1 || qty > 10) ||
      entries.reduce((n, [, qty]) => n + qty, 0) > 200) throw new Error("카드 코드 또는 수량을 확인해 주세요.");
    return { entries, investigator: String(raw?.investigator_code || "") };
  }
  return { zones, stats, parse, fresh, add, move, decklist, imageURL };
})();

