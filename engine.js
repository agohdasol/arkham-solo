"use strict";

globalThis.Arkham = (() => {
  const phases = ["mythos", "investigation", "enemy", "upkeep"];
  const phaseNames = { mythos: "신화", investigation: "조사", enemy: "적", upkeep: "정리" };
  const skills = { will: "의지", intellect: "지식", fight: "힘", evade: "민첩" };
  const investigators = {
    yun: { name: "윤서진", title: "야간 기록관", sigil: "書", hp: 7, sanity: 8, will: 4, intellect: 4, fight: 2, evade: 3 },
    han: { name: "한도현", title: "실종 사건 전문 탐정", sigil: "目", hp: 8, sanity: 7, will: 3, intellect: 3, fight: 4, evade: 3 },
  };
  const difficulties = {
    gentle: { name: "쉬움", doom: 9, bag: ["+2", "+1", "0", "0", "0", "-1", "-1", "-1", "-2", "해골", "별", "촉수"] },
    standard: { name: "보통", doom: 8, bag: ["+1", "0", "0", "-1", "-1", "-1", "-2", "-2", "-3", "해골", "해골", "별", "촉수"] },
    hard: { name: "어려움", doom: 7, bag: ["0", "0", "-1", "-1", "-2", "-2", "-3", "-3", "-4", "해골", "해골", "별", "촉수"] },
  };
  const locations = {
    hall: { name: "열람실", en: "READING ROOM", icon: "lamp", shroud: 2, clues: 1, links: ["stacks", "office"] },
    stacks: { name: "서고", en: "THE STACKS", icon: "books", shroud: 2, clues: 2, links: ["hall", "vault"] },
    office: { name: "사서실", en: "CURATOR’S OFFICE", icon: "door", shroud: 3, clues: 2, links: ["hall", "vault"] },
    vault: { name: "지하 보관소", en: "THE SEALED VAULT", icon: "vault", shroud: 3, clues: 2, links: ["stacks", "office"] },
  };
  const cards = {
    lamp: { name: "휴대용 등불", type: "자산", icon: "lamp", cost: 2, skill: "intellect", icons: 1, uses: 3, text: "물자 3개. 물자 1개를 써서 장막값을 2 낮추고 조사합니다." },
    knife: { name: "은제 단검", type: "자산", icon: "knife", cost: 2, skill: "fight", icons: 1, text: "이 무기로 공격하면 힘 +1, 성공 시 피해를 2 줍니다." },
    notebook: { name: "색인 수첩", type: "자산", icon: "books", cost: 2, skill: "intellect", icons: 1, text: "조사 테스트에서 지식 +1을 얻습니다." },
    kit: { name: "응급 가방", type: "자산", icon: "cross", cost: 1, skill: "will", icons: 1, uses: 2, text: "물자 2개. 행동과 물자 1개를 써서 피해 또는 공포를 1 회복합니다." },
    focus: { name: "차분한 관찰", type: "능력", icon: "eye", skill: "intellect", icons: 2, text: "지식 테스트에 소모합니다. 성공하면 카드 1장을 뽑습니다.", draw: true },
    grit: { name: "굳은 결의", type: "능력", icon: "star", skill: "will", icons: 2, text: "의지 테스트에 소모합니다. 성공하면 카드 1장을 뽑습니다.", draw: true },
    strike: { name: "정확한 일격", type: "능력", icon: "knife", skill: "fight", icons: 2, text: "힘 테스트에 소모합니다. 성공하면 카드 1장을 뽑습니다.", draw: true },
    reflex: { name: "재빠른 몸놀림", type: "능력", icon: "wind", skill: "evade", icons: 2, text: "민첩 테스트에 소모합니다. 성공하면 카드 1장을 뽑습니다.", draw: true },
    instinct: { name: "직감", type: "능력", icon: "eye", skill: "wild", icons: 1, text: "어떤 테스트에든 소모할 수 있습니다. 해당 능력값 +1." },
    supplies: { name: "비상 예산", type: "이벤트", icon: "coins", cost: 0, skill: "will", icons: 1, text: "자원을 3개 얻습니다." },
    leads: { name: "흩어진 서류", type: "이벤트", icon: "books", cost: 2, skill: "intellect", icons: 1, text: "현재 장소에서 테스트 없이 단서 1개를 발견합니다." },
    calm: { name: "숨 고르기", type: "이벤트", icon: "wind", cost: 1, skill: "will", icons: 1, text: "공포를 2 회복합니다." },
  };
  const enemies = {
    shade: { name: "서가의 망령", fight: 2, hp: 2, evade: 2, damage: 1, horror: 1, hunter: true },
    rat: { name: "먹빛 쥐 떼", fight: 2, hp: 1, evade: 3, damage: 1, horror: 0, hunter: false },
    keeper: { name: "침묵의 문지기", fight: 3, hp: 3, evade: 2, damage: 1, horror: 1, hunter: false },
  };
  const encounters = {
    whisper: { name: "종이 사이의 속삭임", skill: "will", difficulty: 3, horror: 1, text: "의지 (3). 실패하면 공포 1." },
    collapse: { name: "무너지는 서가", skill: "evade", difficulty: 3, damage: 1, text: "민첩 (3). 실패하면 피해 1." },
    toll: { name: "열세 번째 종소리", skill: "will", difficulty: 3, doom: 1, text: "의지 (3). 실패하면 파멸 1." },
    shade: { name: enemies.shade.name, enemy: true, text: "현재 장소에 사냥꾼 적이 나타납니다." },
    rat: { name: enemies.rat.name, enemy: true, text: "현재 장소에 적이 나타납니다." },
  };

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }
  const drawToken = (bag) => bag[Math.floor(Math.random() * bag.length)];
  function log(state, text, kind = "") {
    state.log.unshift({ round: state.round, text, kind });
    state.log.length = Math.min(state.log.length, 80);
  }
  function draw(state, count = 1) {
    for (let i = 0; i < count; i++) {
      if (!state.deck.length && state.discard.length) {
        state.deck = shuffle(state.discard);
        state.discard = [];
        state.horror++;
        log(state, "버린 카드로 덱을 다시 구성했습니다. 공포 +1.", "bad");
      }
      if (state.deck.length) state.hand.push(state.deck.pop());
    }
  }
  function fresh(investigator = "yun", difficulty = "standard") {
    const deck = Object.keys(cards).flatMap((id) => [id, id]);
    const state = {
      mode: "story", investigator, difficulty, round: 1, phase: "investigation",
      actions: 3, resources: 5, damage: 0, horror: 0, doom: 0, clues: 0, act: 1,
      place: "hall", places: Object.fromEntries(Object.entries(locations).map(([id, loc]) => [id, loc.clues])),
      deck: shuffle(deck), hand: [], assets: [], discard: [], enemies: [], serial: 0,
      encounter: shuffle(["whisper", "whisper", "collapse", "collapse", "toll", "shade", "shade", "rat", "rat"]),
      encounterDiscard: [], currentEncounter: "", pending: null, lastTest: null, outcome: "", log: [],
    };
    draw(state, 5);
    log(state, "열람실에서 조사를 시작했습니다. 첫 라운드는 조사 단계부터 진행합니다.");
    return state;
  }

  function checkEnd(state) {
    const inv = investigators[state.investigator];
    if (state.damage >= inv.hp) state.outcome = "기록관 탈출 실패 — 부상";
    else if (state.horror >= inv.sanity) state.outcome = "기록관 탈출 실패 — 공포";
    else if (state.doom >= difficulties[state.difficulty].doom) state.outcome = "봉인이 무너졌습니다";
    if (state.outcome) log(state, state.outcome, "bad");
  }
  const engaged = (state) => state.enemies.filter((e) => e.place === state.place && !e.exhausted);
  function spawn(state, id, place = state.place) {
    state.enemies.push({ id, key: ++state.serial, place, damage: 0, exhausted: false });
    log(state, locations[place].name + "에 " + enemies[id].name + " 출현.", "bad");
  }
  function enemyAttack(state, enemy, opportunity = false) {
    const def = enemies[enemy.id];
    state.damage += def.damage;
    state.horror += def.horror;
    log(state, def.name + (opportunity ? "의 기회 공격" : "의 공격") + " · 피해 " + def.damage + " / 공포 " + def.horror, "bad");
  }
  function spend(state, type) {
    state.actions--;
    if (!["fight", "evade", "resign"].includes(type)) {
      for (const e of engaged(state)) enemyAttack(state, e, true);
    }
    checkEnd(state);
    return !state.outcome;
  }
  function test(state, kind, skill, difficulty, options = {}) {
    const base = investigators[state.investigator][skill] + (options.bonus || 0);
    state.lastTest = null;
    state.pending = { kind, skill, difficulty, base, commit: [], ...options };
  }
  function resolve(state) {
    const p = state.pending;
    const bag = difficulties[state.difficulty].bag;
    const token = drawToken(bag);
    const modifier = token === "해골" ? (state.act === 2 ? -2 : -1) : token === "별" ? 2 : Number(token);
    const icons = p.commit.reduce((sum, id) => sum + cards[id].icons, 0);
    const total = token === "촉수" ? 0 : Math.max(0, p.base + icons + modifier);
    const success = token !== "촉수" && total >= p.difficulty;
    const label = { investigate: "조사", fight: "전투", evade: "회피", encounter: "조우", seal: "봉인" }[p.kind];
    state.lastTest = { token, total, difficulty: p.difficulty, success, label };
    log(state, label + " " + (success ? "성공" : "실패") + " · " + token + " (" + total + "/" + p.difficulty + ")", success ? "good" : "bad");
    state.pending = null;
    state.discard.push(...p.commit);
    if (success) {
      if (p.kind === "investigate") {
        state.places[state.place]--;
        state.clues++;
        log(state, "단서 1개를 발견했습니다.", "good");
      }
      if (p.kind === "fight") {
        const enemy = state.enemies.find((item) => item.key === p.target);
        enemy.damage += p.damage;
        if (enemy.damage >= enemies[enemy.id].hp) {
          state.enemies = state.enemies.filter((item) => item !== enemy);
          log(state, enemies[enemy.id].name + " 격파.", "good");
        }
      }
      if (p.kind === "evade") state.enemies.find((item) => item.key === p.target).exhausted = true;
      if (p.kind === "seal") {
        state.outcome = "기록관의 봉인을 되살렸습니다";
        log(state, state.outcome, "good");
      } else {
        for (const id of p.commit) if (cards[id].draw) draw(state);
      }
    } else if (p.kind === "encounter") {
      const e = encounters[state.currentEncounter];
      state.damage += e.damage || 0;
      state.horror += e.horror || 0;
      state.doom += e.doom || 0;
    }
    if (!state.outcome) checkEnd(state);
  }

  function advancePhase(state) {
    if (state.phase === "investigation") {
      state.phase = "enemy";
      state.actions = 0;
      for (const e of state.enemies) {
        if (e.exhausted) continue;
        if (e.place !== state.place && enemies[e.id].hunter) {
          const exits = locations[e.place].links.filter((id) => id !== "vault" || state.act === 2);
          if (exits.length) {
            e.place = exits.includes(state.place) ? state.place : exits[0];
            log(state, enemies[e.id].name + "이(가) " + locations[e.place].name + "(으)로 이동했습니다.");
          }
        }
        if (e.place === state.place) enemyAttack(state, e);
      }
    } else if (state.phase === "enemy") {
      state.phase = "upkeep";
      state.resources++;
      draw(state);
      for (const e of state.enemies) e.exhausted = false;
      log(state, "정리 · 카드 1장과 자원 1개를 얻었습니다.");
    } else if (state.phase === "upkeep") {
      state.round++;
      state.phase = "mythos";
      state.doom++;
      log(state, "신화 · 파멸 +1.", "bad");
      if (state.doom >= difficulties[state.difficulty].doom) {
        checkEnd(state);
        return;
      }
      if (!state.encounter.length) {
        state.encounter = shuffle(state.encounterDiscard);
        state.encounterDiscard = [];
      }
      state.currentEncounter = state.encounter.pop();
      state.encounterDiscard.push(state.currentEncounter);
      const e = encounters[state.currentEncounter];
      log(state, "조우 · " + e.name, "bad");
      if (e.enemy) spawn(state, state.currentEncounter);
      else test(state, "encounter", e.skill, e.difficulty);
    } else {
      state.phase = "investigation";
      state.actions = 3;
      state.currentEncounter = "";
      log(state, "조사 · 행동 3회를 사용할 수 있습니다.");
    }
    checkEnd(state);
  }

  function storyAction(state, action, value) {
    if (state.outcome) return false;
    if (action === "resolve" && state.pending) { resolve(state); return true; }
    if (action === "commit" && state.pending) {
      const id = state.hand[value];
      const card = cards[id];
      if (!card || ![state.pending.skill, "wild"].includes(card.skill)) return false;
      state.pending.commit.push(...state.hand.splice(value, 1));
      return true;
    }
    if (action === "uncommit" && state.pending && state.pending.commit[value]) {
      state.hand.push(...state.pending.commit.splice(value, 1));
      return true;
    }
    if (state.pending) return false;
    if (action === "discard" && state.phase === "upkeep" && state.hand.length > 8 && state.hand[value]) {
      state.discard.push(...state.hand.splice(value, 1));
      return true;
    }
    if (action === "next") {
      if (state.phase === "upkeep" && state.hand.length > 8) return false;
      advancePhase(state);
      return true;
    }
    if (state.phase !== "investigation") return false;
    if (action === "advance" && state.act === 1 && state.clues >= 2) {
      state.clues -= 2;
      state.act = 2;
      spawn(state, "keeper", "vault");
      log(state, "단서 2개를 사용해 지하 보관소를 열었습니다.", "good");
      return true;
    }
    if (!state.actions) return false;
    const loc = locations[state.place];
    const id = state.hand[value];
    const card = cards[id];
    const asset = state.assets[value];
    const enemy = state.enemies.find((item) => item.key === Number(value) && item.place === state.place);
    switch (action) {
      case "move":
        if (!loc.links.includes(value) || (value === "vault" && state.act === 1)) return false;
        if (spend(state, action)) {
          state.place = value;
          log(state, locations[value].name + "(으)로 이동했습니다.");
        }
        break;
      case "investigate":
      case "lamp": {
        const lamp = state.assets.find((item) => item.id === "lamp" && item.uses);
        if (!state.places[state.place] || (action === "lamp" && !lamp)) return false;
        if (spend(state, action)) {
          if (action === "lamp") lamp.uses--;
          test(state, "investigate", "intellect", Math.max(0, loc.shroud - (action === "lamp" ? 2 : 0)),
            { bonus: state.assets.some((item) => item.id === "notebook") ? 1 : 0 });
        }
        break;
      }
      case "fight":
      case "knife":
      case "evade": {
        if (!enemy || (action === "evade" && enemy.exhausted) ||
            (action === "knife" && !state.assets.some((item) => item.id === "knife"))) return false;
        const kind = action === "evade" ? "evade" : "fight";
        if (spend(state, kind)) test(state, kind, kind, enemies[enemy.id][kind],
          { target: enemy.key, bonus: action === "knife" ? 1 : 0, damage: action === "knife" ? 2 : 1 });
        break;
      }
      case "play":
        if (!card || card.cost === undefined || state.resources < card.cost ||
            (id === "leads" && !state.places[state.place]) ||
            (card.type === "자산" && state.assets.some((item) => item.id === id))) return false;
        if (spend(state, action)) {
          state.resources -= card.cost;
          state.hand.splice(value, 1);
          if (card.type === "자산") state.assets.push({ id, uses: card.uses ?? null });
          else state.discard.push(id);
          if (id === "supplies") state.resources += 3;
          if (id === "calm") state.horror = Math.max(0, state.horror - 2);
          if (id === "leads") { state.places[state.place]--; state.clues++; }
          log(state, card.name + " 사용.");
        }
        break;
      case "heal-damage":
      case "heal-horror": {
        const stat = action === "heal-damage" ? "damage" : "horror";
        if (asset?.id !== "kit" || !asset.uses || !state[stat]) return false;
        if (spend(state, action)) { asset.uses--; state[stat]--; log(state, "응급 가방으로 " + (stat === "damage" ? "피해" : "공포") + " 1을 회복했습니다."); }
        break;
      }
      case "draw":
        if (spend(state, action)) { draw(state); log(state, "카드 1장을 뽑았습니다."); checkEnd(state); }
        break;
      case "resource":
        if (spend(state, action)) { state.resources++; log(state, "자원 1개를 얻었습니다."); }
        break;
      case "seal":
        if (state.act !== 2 || state.place !== "vault" || state.clues < 3 || engaged(state).length) return false;
        if (spend(state, action)) test(state, "seal", "will", 3);
        break;
      case "resign":
        if (state.place !== "hall" || !spend(state, action)) return false;
        state.outcome = "기록관에서 철수했습니다";
        log(state, state.outcome);
        break;
      default: return false;
    }
    return true;
  }

  return { phases, phaseNames, skills, investigators, difficulties, locations, cards, enemies, encounters,
    shuffle, drawToken, log, fresh, engaged, storyAction };
})();
