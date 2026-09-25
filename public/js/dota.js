// Справочники и расчёты по данным OpenDota, общие для всех страниц.
// Подключается после app.js.

const Dota = (() => {
  // ── Ранги ──────────────────────────────────────────────────────
  // rank_tier: десятки — медаль (1–8), единицы — звезда внутри медали
  const MEDALS = { 1: 'Herald', 2: 'Guardian', 3: 'Crusader', 4: 'Archon', 5: 'Legend', 6: 'Ancient', 7: 'Divine', 8: 'Immortal' };
  const RANK_ICONS = 'https://www.opendota.com/assets/images/dota2/rank_icons';

  function rankLabel(tier) {
    const medal = Math.floor((tier || 0) / 10);
    const star = (tier || 0) % 10;
    if (!MEDALS[medal]) return '';
    return medal === 8 || !star ? MEDALS[medal] : `${MEDALS[medal]} ${star}`;
  }

  // Иконка медали и название. Звёзды не рисуем: номер уже в названии
  function rankHtml(tier, size = 18) {
    const label = rankLabel(tier);
    if (!label) return '';
    const medal = Math.floor(tier / 10);
    return `<img src="${RANK_ICONS}/rank_icon_${medal}.png" alt="" style="width:${size}px;height:${size}px;vertical-align:middle;margin-right:5px">${label}`;
  }

  // ── Режимы игры ────────────────────────────────────────────────
  // Коды 1 и 22 — оба All Pick (старый и новый). Рейтинговость задаёт lobby_type, а не режим
  const MODES = {
    1: 'All Pick', 22: 'All Pick', 2: 'Captains Mode', 3: 'Random Draft', 4: 'Single Draft', 5: 'All Random',
    12: 'Least Played', 16: 'Captains Draft', 18: 'Ability Draft', 20: 'All Random Deathmatch',
    21: '1v1 Solo Mid', 23: 'Turbo', 24: 'Mutation',
  };
  const modeName = (id) => MODES[id] || 'Другие режимы';
  const RANKED_LOBBY = 7;
  const isRanked = (m) => m.lobby_type === RANKED_LOBBY;

  // ── Позиции 1–5 ────────────────────────────────────────────────
  // OpenDota знает только линию, и то лишь в разобранных матчах.
  // Поэтому позиция оценивается: кор или саппорт — по фарму, какой именно — по линии, иначе по герою
  const POSITIONS = { 1: 'Керри', 2: 'Мид', 3: 'Оффлейн', 4: 'Саппорт', 5: 'Хард-саппорт' };
  const positionName = (p) => (POSITIONS[p] ? `${POSITIONS[p]} (${p})` : 'Неизвестно');

  const MID_HEROES = ['invoker', 'storm spirit', 'queen of pain', 'shadow fiend', 'lina', 'puck', 'tinker', 'zeus', 'ember spirit', 'outworld', 'void spirit', 'templar assassin', 'death prophet', 'arc warden', 'leshrac', 'kunkka', 'pangolier', 'viper', 'huskar', 'batrider', 'necrophos', 'sniper', 'lone druid', 'meepo', 'monkey king', 'primal beast'];
  const OFF_HEROES = ['axe', 'dragon knight', 'centaur', 'tidehunter', 'mars', 'underlord', 'night stalker', 'bristleback', 'dark seer', 'beastmaster', 'sand king', 'slardar', 'magnus', 'brewmaster', 'timbersaw', 'legion commander', 'doom', 'enigma', 'visage', 'razor', 'windranger', 'dawnbreaker', 'broodmother', 'abaddon'];
  const HARD_SUPPORT_HEROES = ['crystal maiden', 'lion', 'shadow shaman', 'witch doctor', 'jakiro', 'lich', 'winter wyvern', 'warlock', 'oracle', 'dazzle', 'vengeful spirit', 'ancient apparition', 'disruptor', 'bane', 'ogre magi', 'treant protector', 'io', 'undying', 'chen', 'keeper of the light'];
  const SUPPORT_HEROES = ['rubick', 'earth spirit', 'tusk', 'earthshaker', 'nyx assassin', 'skywrath mage', 'mirana', 'clockwerk', 'spirit breaker', 'pudge', 'techies', 'snapfire', 'hoodwink', 'grimstroke', 'phoenix', 'elder titan', 'shadow demon', 'marci', 'muerta', 'dark willow', 'weaver', 'bounty hunter', 'pugna', 'silencer', 'enchantress', 'nature', 'venomancer', 'ringmaster'];

  const has = (list, name) => list.some((x) => name.includes(x));

  function heroGuess(heroName) {
    const n = String(heroName || '').toLowerCase();
    if (!n) return 0;
    if (has(HARD_SUPPORT_HEROES, n)) return 5;
    if (has(SUPPORT_HEROES, n)) return 4;
    if (has(MID_HEROES, n)) return 2;
    if (has(OFF_HEROES, n)) return 3;
    return 1;
  }

  // m — матч игрока из OpenDota; heroName — локализованное имя героя (для запасного варианта)
  function estimatePosition(m, heroName) {
    const minutes = (m.duration || 0) / 60;
    const hasFarm = minutes > 5 && Number.isFinite(m.last_hits) && Number.isFinite(m.gold_per_min);
    const lane = m.lane_role; // 1 — лёгкая, 2 — мид, 3 — сложная, 4 — лес

    if (!hasFarm) return heroGuess(heroName);

    const lhPerMin = m.last_hits / minutes;
    // Саппортский герой с хорошим фармом (выигранная игра, Pudge, Rubick) — ещё не кор: порог выше
    const supportHero = heroGuess(heroName) >= 4;
    const core = supportHero
      ? lhPerMin >= 5 || m.gold_per_min >= 620
      : lhPerMin >= 3.5 || m.gold_per_min >= 520;

    if (core) {
      if (lane === 1) return 1;
      if (lane === 2) return 2;
      if (lane === 3) return 3;
      const guess = heroGuess(heroName);
      return guess === 2 || guess === 3 ? guess : 1;
    }
    // Саппорт: на лёгкой линии стоит пятая позиция, на сложной — четвёртая
    if (lane === 1) return 5;
    if (lane === 3) return 4;
    return lhPerMin >= 1.3 || m.gold_per_min >= 330 ? 4 : 5;
  }

  // Справочник героев OpenDota: id → { name, img }. Кэш на неделю
  const HEROES_KEY = 'dota_heroes_v1';
  let heroesPromise;
  function heroes() {
    heroesPromise ??= (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(HEROES_KEY) || 'null');
        if (cached && Date.now() - cached.ts < 7 * 86400e3) return cached.map;
      } catch {
        // кэш битый — загрузим заново
      }
      const list = await fetch('https://api.opendota.com/api/heroes').then((r) => r.json());
      const map = {};
      list.forEach((h) => {
        map[h.id] = { name: h.localized_name, img: String(h.name || '').replace('npc_dota_hero_', '') };
      });
      try {
        localStorage.setItem(HEROES_KEY, JSON.stringify({ ts: Date.now(), map }));
      } catch {
        // нет места — работаем без кэша
      }
      return map;
    })().catch(() => ({}));
    return heroesPromise;
  }

  // ── Часовой пояс ───────────────────────────────────────────────
  const TZ_KEY = 'dotai_tz';
  const TZ_OPTIONS = [
    'Asia/Tashkent', 'Asia/Almaty', 'Asia/Dushanbe', 'Asia/Bishkek', 'Europe/Moscow', 'Europe/Kyiv',
    'Europe/Minsk', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'UTC',
  ];

  function browserTz() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  // Выбор пользователя → для демо Ташкент (профиль владельца) → пояс браузера
  function tz() {
    let saved = null;
    try {
      saved = localStorage.getItem(TZ_KEY);
    } catch {
      // игнорируем
    }
    if (saved) return saved;
    return typeof DotAi !== 'undefined' && DotAi.isDemo() ? 'Asia/Tashkent' : browserTz();
  }

  function setTz(value) {
    try {
      localStorage.setItem(TZ_KEY, value);
    } catch {
      // игнорируем
    }
  }

  // Смещение вида UTC+5 для подписи
  function tzOffset(zone) {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName');
      return (part?.value || 'UTC').replace('GMT', 'UTC');
    } catch {
      return 'UTC';
    }
  }

  function tzLabel(zone) {
    const city = zone === 'UTC' ? 'UTC' : zone.split('/').pop().replace(/_/g, ' ');
    const names = { Tashkent: 'Ташкент', Almaty: 'Алматы', Dushanbe: 'Душанбе', Bishkek: 'Бишкек', Moscow: 'Москва', Kyiv: 'Киев', Minsk: 'Минск', Berlin: 'Берлин', London: 'Лондон', 'New York': 'Нью-Йорк' };
    return zone === 'UTC' ? 'UTC' : `${names[city] || city} (${tzOffset(zone)})`;
  }

  function tzOptions() {
    const list = [...TZ_OPTIONS];
    const own = browserTz();
    if (!list.includes(own)) list.unshift(own);
    return list.map((zone) => ({ value: zone, label: tzLabel(zone) }));
  }

  const formatters = {};
  function parts(ts, zone) {
    formatters[zone] ??= new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    });
    const out = {};
    formatters[zone].formatToParts(new Date(ts * 1000)).forEach((p) => (out[p.type] = p.value));
    return out;
  }

  // Час (0–23) матча в выбранном поясе
  const hourOf = (ts, zone = tz()) => Number(parts(ts, zone).hour) % 24;
  // Дата матча в выбранном поясе: '2026-09-25'
  const dayOf = (ts, zone = tz()) => {
    const p = parts(ts, zone);
    return `${p.year}-${p.month}-${p.day}`;
  };

  return {
    MEDALS, rankLabel, rankHtml,
    modeName, isRanked,
    POSITIONS, positionName, estimatePosition, heroGuess, heroes,
    tz, setTz, tzLabel, tzOptions, hourOf, dayOf,
  };
})();
