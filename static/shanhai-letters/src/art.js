/* 美术层：内置 SVG 占位图 + AI 素材自动替换 */
(function () {
  const SH = window.SH;

  /* 素材实际格式：神兽/纪念品/道具为透明 PNG，场景/UI 为压缩 JPG。
     必选素材直接按类型取扩展名；可选素材先在 assets/images/art-manifest.js 登记，
     避免每次渲染都为还没生成的图发出 404。调试时加 ?art=all 可强制探测全部可选素材。 */
  const EXT = { beast: 'png', sou: 'png', item: 'png', city: 'jpg', home: 'jpg', ui: 'jpg', codex: 'jpg', nav: 'png' };

  const PROBE_ALL = /[?&]art=all(?:&|$)/.test(location.search);
  const OPTIONAL = new Set((window.SH_ART && window.SH_ART.optional) || []);
  const missing = {};

  function optReady(base) {
    return PROBE_ALL || OPTIONAL.has(base);
  }
  function isMissing(key) {
    return !!missing[key];
  }
  function markMissing(key) {
    if (key) missing[key] = 1;
  }

  /** 图片标签：失败先换另一种扩展名，再执行 finalExpr；成功则打上 is-loaded 供 CSS 隐藏兜底 */
  function imgTag(base, kind, cls, alt, opts) {
    const key = opts && opts.key;
    if (key && isMissing(key)) return '';
    const primary = EXT[kind] || 'png';
    const secondary = primary === 'png' ? 'jpg' : 'png';
    const finalExpr =
      (opts && opts.finalExpr) ||
      `this.classList.add('art-missing');SH.art._miss('${key || ''}')`;
    const fail =
      `if(!this.dataset.f){this.dataset.f=1;this.src='${base}.${secondary}'}` +
      `else{${finalExpr}}`;
    return (
      `<img class="${cls || ''}" src="${base}.${primary}" alt="${alt || ''}" ` +
      `loading="lazy" decoding="async" draggable="false" aria-hidden="${alt ? 'false' : 'true'}" ` +
      `onload="this.classList.add('is-loaded')" onerror="${fail}">`
    );
  }

  /** 图片 + 内联兜底；两个扩展名都失败后，后续渲染直接只输出兜底 */
  function imgOr(kind, fileBase, fallbackHtml, alt, opts) {
    const key = (opts && opts.key) || `${kind}:${fileBase}`;
    const img = imgTag(`assets/images/${fileBase}`, kind, 'art-img', alt, {
      key,
      finalExpr: opts && opts.finalExpr
    });
    return `<span class="art" aria-hidden="${alt ? 'false' : 'true'}">` + img + fallbackHtml + `</span>`;
  }

  /* ---------- 内置 SVG 神兽 ---------- */
  const SVG = {
    baize: `<svg class="art-svg" viewBox="0 0 120 120" role="img" aria-label="白泽">
      <ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity=".08"/>
      <path d="M38 46 Q30 30 40 26 Q46 34 48 44 Z" fill="#cfd8e3"/>
      <path d="M82 46 Q90 30 80 26 Q74 34 72 44 Z" fill="#cfd8e3"/>
      <ellipse cx="60" cy="66" rx="30" ry="26" fill="#f4f1ea"/>
      <ellipse cx="60" cy="70" rx="22" ry="19" fill="#fffdf8"/>
      <path d="M32 60 Q22 46 34 40 Q44 46 44 58 Z" fill="#dfe5ee"/>
      <path d="M88 60 Q98 46 86 40 Q76 46 76 58 Z" fill="#dfe5ee"/>
      <ellipse cx="60" cy="52" rx="26" ry="22" fill="#fbf9f4"/>
      <path d="M40 34 Q44 22 52 30" stroke="#cfd8e3" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M80 34 Q76 22 68 30" stroke="#cfd8e3" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="52" r="3.4" fill="#3f4a5a"/>
      <circle cx="70" cy="52" r="3.4" fill="#3f4a5a"/>
      <circle cx="60" cy="40" r="4" fill="#8ba0bd"/>
      <circle cx="60" cy="40" r="1.6" fill="#33405a"/>
      <path d="M56 62 Q60 66 64 62" stroke="#3f4a5a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M44 76 Q60 84 76 76 L76 84 Q60 92 44 84 Z" fill="#8ba0bd"/>
      <rect x="52" y="86" width="16" height="14" rx="3" fill="#e8e2d4"/>
      <path d="M56 90 h8 M56 94 h8" stroke="#b9ae97" stroke-width="1.6"/>
    </svg>`,

    jiuweihu: `<svg class="art-svg" viewBox="0 0 120 120" role="img" aria-label="九尾狐">
      <ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity=".08"/>
      <g fill="#f6e2cf">
        <ellipse cx="34" cy="72" rx="16" ry="6" transform="rotate(-32 34 72)"/>
        <ellipse cx="38" cy="62" rx="16" ry="6" transform="rotate(-20 38 62)"/>
        <ellipse cx="46" cy="54" rx="16" ry="6" transform="rotate(-9 46 54)"/>
        <ellipse cx="60" cy="50" rx="16" ry="6"/>
        <ellipse cx="74" cy="54" rx="16" ry="6" transform="rotate(9 74 54)"/>
        <ellipse cx="82" cy="62" rx="16" ry="6" transform="rotate(20 82 62)"/>
        <ellipse cx="86" cy="72" rx="16" ry="6" transform="rotate(32 86 72)"/>
        <ellipse cx="44" cy="80" rx="15" ry="6" transform="rotate(-16 44 80)"/>
        <ellipse cx="76" cy="80" rx="15" ry="6" transform="rotate(16 76 80)"/>
      </g>
      <ellipse cx="60" cy="82" rx="22" ry="18" fill="#fbeedd"/>
      <ellipse cx="60" cy="56" rx="24" ry="21" fill="#fdf3e6"/>
      <path d="M38 40 L34 22 L50 34 Z" fill="#f6e2cf"/>
      <path d="M82 40 L86 22 L70 34 Z" fill="#f6e2cf"/>
      <path d="M38 40 L36 30 L47 36 Z" fill="#e7b7a0"/>
      <path d="M82 40 L84 30 L73 36 Z" fill="#e7b7a0"/>
      <circle cx="51" cy="56" r="3.4" fill="#4b3a33"/>
      <path d="M69 56 q3 -3 6 0" stroke="#4b3a33" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="66" rx="5" ry="4" fill="#4b3a33"/>
      <path d="M48 66 q12 8 24 0" stroke="#d8bda8" stroke-width="1.6" fill="none"/>
      <path d="M40 74 Q60 82 80 74 L80 78 Q60 86 40 78 Z" fill="#c0563f"/>
      <circle cx="60" cy="80" r="4" fill="#e8b04b"/>
      <rect x="70" y="84" width="14" height="16" rx="4" fill="#8f9b7d"/>
    </svg>`,

    qingniao: `<svg class="art-svg" viewBox="0 0 120 120" role="img" aria-label="青鸟">
      <ellipse cx="60" cy="104" rx="26" ry="5" fill="#000" opacity=".08"/>
      <g fill="#7fb3ab">
        <path d="M74 82 Q104 88 108 100 Q88 96 72 90 Z"/>
        <path d="M74 78 Q100 74 106 84 Q88 84 72 84 Z"/>
        <path d="M74 74 Q98 62 104 70 Q88 74 72 78 Z"/>
      </g>
      <ellipse cx="58" cy="62" rx="28" ry="26" fill="#8fc2ba"/>
      <ellipse cx="58" cy="66" rx="21" ry="20" fill="#dff0ec"/>
      <path d="M40 44 Q34 32 44 36" stroke="#5f9a92" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="54" r="3.6" fill="#31453f"/>
      <circle cx="50.8" cy="53" r="1.2" fill="#fff"/>
      <path d="M62 58 L74 60 L62 64 Z" fill="#d4663f"/>
      <path d="M36 58 Q30 54 34 50 Q38 54 36 58 Z" fill="#5f9a92"/>
      <path d="M40 86 L44 96" stroke="#d4663f" stroke-width="3" stroke-linecap="round"/>
      <path d="M62 86 L66 96" stroke="#d4663f" stroke-width="3" stroke-linecap="round"/>
      <rect x="46" y="90" width="26" height="16" rx="2" fill="#fdf6e6"/>
      <path d="M46 90 L59 99 L72 90" stroke="#d9cbb0" stroke-width="1.6" fill="none"/>
      <circle cx="66" cy="94" r="3" fill="#c0563f"/>
    </svg>`
  };

  const TAG_ICON = {
    history: '🏛️', ancient: '🏯', scholar: '📖', record: '📓', craft: '✂️',
    food: '🍜', tea: '🍵', social: '👥', playful: '🎭', night: '🏮', city: '🏙️',
    nature: '🍃', water: '🌊', desert: '🏜️', snow: '❄️', star: '⭐',
    letter: '💌', quiet: '🍵', empathy: '💗', rain: '☂️', travel: '🚉', curious: '🔍'
  };

  const WEATHER_ICON = { sunny: '☀️', cloudy: '☁️', rain: '🌧️', snow: '❄️', night: '🌙' };

  /* ---------- 手绘风导航图标（内联 SVG，可被 AI 素材替换） ---------- */
  const NAV_SVG = {
    yard: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M8 40V22a16 16 0 0 1 32 0v18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M8 40h32" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14 40V30h6v10M28 40V30h6v10" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
    pack: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M12 18c0-6 5-10 12-10s12 4 12 10v18a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M12 22h24M24 8v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M18 30h12M18 35h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    mail: `<svg class="nav-svg" viewBox="0 0 48 48"><rect x="7" y="13" width="34" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M7 16l17 12 17-12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="37" cy="33" r="6" fill="currentColor" opacity=".18"/><path d="M34 33l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    codex: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M10 10h20a4 4 0 0 1 4 4v24H14a4 4 0 0 1-4-4Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M34 14h4v24h-4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M16 18h12M16 24h12M16 30h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    home: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M8 22 24 8l16 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 20v18h24V20" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><rect x="20" y="27" width="8" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 25h4M29 25h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`
  };

  /* ---------- 手绘风随身道具 SVG（替代系统 Emoji，与水墨淡彩统一） ---------- */
  const ITEM_SVG = {
    camera: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><rect x="11" y="21" width="42" height="28" rx="6" fill="#7c6855" stroke="#453729" stroke-width="2.2"/><rect x="11" y="21" width="42" height="10" rx="4" fill="#e6d6b8" stroke="#453729" stroke-width="2.2"/><rect x="23" y="15" width="18" height="7" rx="2.5" fill="#d4a24e" stroke="#453729" stroke-width="2"/><circle cx="32" cy="37" r="10.5" fill="#fdf7ea" stroke="#453729" stroke-width="2.2"/><circle cx="32" cy="37" r="7" fill="#527688" stroke="#453729" stroke-width="1.8"/><circle cx="29.5" cy="34.5" r="2.2" fill="#fff" opacity=".75"/><circle cx="45" cy="26" r="2.5" fill="#c0563f"/></svg>`,
    oldbook: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M16 14h30a4 4 0 0 1 4 4v32H18a4 4 0 0 1-4-4V16a2 2 0 0 1 2-2Z" fill="#4f6d82" stroke="#453729" stroke-width="2.2"/><path d="M14 45h34v5H16a2 2 0 0 1-2-2v-3Z" fill="#f3e7cf" stroke="#453729" stroke-width="2"/><rect x="25" y="19" width="10" height="20" rx="1.5" fill="#fdf7ea" stroke="#c49a6c" stroke-width="1.5"/><path d="M42 14v31M46 14v31" stroke="#d4a24e" stroke-width="1.6"/><path d="M29 24v10" stroke="#7a6552" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    umbrella: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 10v41c0 3 4 4 6 2" fill="none" stroke="#6b4a2b" stroke-width="2.6" stroke-linecap="round"/><path d="M12 31c0-11 9-18 20-18s20 7 20 18Z" fill="#517896" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><path d="M22 31c0-11 4-18 10-18s10 7 10 18" fill="none" stroke="#d4a24e" stroke-width="1.4" opacity=".8"/><circle cx="32" cy="11" r="2.6" fill="#d4a24e" stroke="#453729" stroke-width="1.6"/><path d="M32 39l-3 5" stroke="#c0563f" stroke-width="2" stroke-linecap="round"/></svg>`,
    map: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M10 18l14-5 16 5 14-5v33l-14 5-16-5-14 5Z" fill="#f6ecd6" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 13v33M40 18v33" stroke="#c49a6c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M16 34q8-10 16-2t16-6" fill="none" stroke="#c0563f" stroke-width="2.2" stroke-dasharray="4 3" stroke-linecap="round"/><circle cx="48" cy="26" r="3.2" fill="#c0563f"/></svg>`,
    osmanthus: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="19" ry="4" fill="#6b4a2b" opacity=".14"/><ellipse cx="32" cy="46" rx="20" ry="7" fill="#e6d6b8" stroke="#453729" stroke-width="2"/><rect x="19" y="29" width="16" height="14" rx="3" fill="#f3d692" stroke="#453729" stroke-width="2"/><rect x="29" y="24" width="16" height="14" rx="3" fill="#f7e2aa" stroke="#453729" stroke-width="2"/><circle cx="34" cy="29" r="1.6" fill="#c0563f"/><circle cx="39" cy="31" r="1.5" fill="#d4a24e"/><circle cx="25" cy="34" r="1.5" fill="#d4a24e"/><circle cx="31" cy="37" r="1.3" fill="#c0563f"/></svg>`,
    bamboo: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M15 36c0-9 5-16 12-16h18c5 0 9 7 9 16s-4 14-9 14H27c-7 0-12-5-12-14Z" fill="#7d9b7e" stroke="#453729" stroke-width="2.2"/><ellipse cx="24" cy="35" rx="7" ry="12" fill="#fdf7ea" stroke="#453729" stroke-width="2"/><path d="M35 20v30M44 21v28" stroke="#5b7d5c" stroke-width="2"/><circle cx="23" cy="33" r="1.6" fill="#c0563f"/><circle cx="26" cy="37" r="1.4" fill="#8b6239"/></svg>`,
    hawthorn: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M26 44l10-18M38 44L28 26" stroke="#c49a6c" stroke-width="2.2" stroke-linecap="round"/><path d="M22 14h20v16c0 6-4 11-10 11s-10-5-10-11Z" fill="#fdf7ea" stroke="#453729" stroke-width="1.8" opacity=".88"/><circle cx="32" cy="20" r="5" fill="#c0563f" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="29" r="5.2" fill="#c85f46" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="38" r="4.8" fill="#b44b35" stroke="#453729" stroke-width="1.8"/><circle cx="30.5" cy="18.5" r="1.4" fill="#fff" opacity=".6"/></svg>`,
    notebook: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="19" ry="4" fill="#6b4a2b" opacity=".14"/><rect x="16" y="13" width="30" height="38" rx="4" fill="#e5d0ab" stroke="#453729" stroke-width="2.2"/><rect x="16" y="13" width="7" height="38" rx="2" fill="#9c6a44" stroke="#453729" stroke-width="2"/><rect x="27" y="20" width="13" height="15" rx="2" fill="#fdf7ea" stroke="#c49a6c" stroke-width="1.5"/><path d="M30 25h7M30 29h7" stroke="#8b6239" stroke-width="1.6" stroke-linecap="round"/><path d="M47 16l5 3-11 21-5 2 1-5Z" fill="#c0563f" stroke="#453729" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    bell: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 10c-5 0-8 4-8 8" fill="none" stroke="#c0563f" stroke-width="3" stroke-linecap="round"/><path d="M22 20c0-4 4-7 10-7s10 3 10 7l4 18H18Z" fill="#d4a24e" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="32" cy="39" rx="15" ry="4.5" fill="#b98635" stroke="#453729" stroke-width="2"/><circle cx="32" cy="43" r="4" fill="#8b6239" stroke="#453729" stroke-width="1.8"/><path d="M27 23c1-3 3-5 5-5" fill="none" stroke="#fff6de" stroke-width="2" stroke-linecap="round"/></svg>`,
    lantern: `<svg class="art-svg" viewBox="0 0 64 64"><ellipse cx="32" cy="56" rx="15" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 9v6M32 45v8" stroke="#c0563f" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="32" cy="30" rx="15" ry="15" fill="#e67e58" stroke="#453729" stroke-width="2.2"/><ellipse cx="32" cy="30" rx="9" ry="15" fill="#f7be72" opacity=".72"/><rect x="24" y="14" width="16" height="4" rx="1.5" fill="#6b4a2b" stroke="#453729" stroke-width="1.6"/><rect x="24" y="43" width="16" height="4" rx="1.5" fill="#6b4a2b" stroke="#453729" stroke-width="1.6"/><path d="M32 18v24" stroke="#c0563f" stroke-width="1.4" opacity=".6"/><path d="M29 50l3 5 3-5" stroke="#c0563f" stroke-width="2" fill="none"/></svg>`
  };

  /* ---------- 场景交互物件 SVG（桌案包袱、灵草、信封徽章、访客） ---------- */
  const PROP_SVG = {
    bundle: `<svg viewBox="0 0 110 86" class="prop-svg">
      <ellipse cx="55" cy="75" rx="40" ry="8" fill="#4b321b" opacity=".28"/>
      <path d="M18 58c0-18 14-28 37-28s37 10 37 28c0 10-12 16-37 16S18 68 18 58Z" fill="#4f748d" stroke="#36281c" stroke-width="2.5"/>
      <path d="M24 54c10 7 20 9 31 9s21-2 31-9" fill="none" stroke="#85a8bd" stroke-width="2" opacity=".7"/>
      <path d="M40 31c-6-9-15-10-18-4s6 11 18 7Z" fill="#6188a2" stroke="#36281c" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M70 31c6-9 15-10 18-4s-6 11-18 7Z" fill="#6188a2" stroke="#36281c" stroke-width="2.2" stroke-linejoin="round"/>
      <ellipse cx="55" cy="31" rx="9" ry="6" fill="#d4a24e" stroke="#36281c" stroke-width="2"/>
      <rect x="64" y="40" width="16" height="22" rx="3" transform="rotate(14 72 51)" fill="#f3e5c9" stroke="#36281c" stroke-width="2"/>
      <path d="M70 46l-2 10" stroke="#c0563f" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    clover: `<svg viewBox="0 0 48 48" class="prop-svg">
      <path d="M24 44c0-10-1-16 0-22" stroke="#4f7050" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="18" cy="18" rx="7" ry="5" transform="rotate(-35 18 18)" fill="#85b37f" stroke="#3e593e" stroke-width="1.8"/>
      <ellipse cx="30" cy="18" rx="7" ry="5" transform="rotate(35 30 18)" fill="#96c48d" stroke="#3e593e" stroke-width="1.8"/>
      <ellipse cx="18" cy="27" rx="6.5" ry="4.5" transform="rotate(30 18 27)" fill="#77a372" stroke="#3e593e" stroke-width="1.8"/>
      <ellipse cx="30" cy="27" rx="6.5" ry="4.5" transform="rotate(-30 30 27)" fill="#85b37f" stroke="#3e593e" stroke-width="1.8"/>
      <circle cx="24" cy="22" r="2.2" fill="#f7e396"/>
    </svg>`,
    mailFlag: `<svg viewBox="0 0 64 52" class="prop-svg">
      <rect x="6" y="12" width="52" height="34" rx="5" fill="#fdf7ea" stroke="#8b6239" stroke-width="2.4"/>
      <path d="M7 15l25 17 25-17" fill="none" stroke="#c49a6c" stroke-width="2.2" stroke-linejoin="round"/>
      <circle cx="32" cy="30" r="6" fill="#c0563f"/>
      <circle cx="32" cy="30" r="2.5" fill="#f7d388"/>
    </svg>`
  };

  const VISITOR_SVG = {
    grandma: `<svg viewBox="0 0 64 64" class="prop-svg"><circle cx="32" cy="56" r="0"/><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#7c9684" stroke="#453729" stroke-width="2"/><circle cx="32" cy="26" r="11" fill="#fbe7d2" stroke="#453729" stroke-width="2"/><path d="M21 25c0-8 5-12 11-12s11 4 11 12c-3-4-19-4-22 0Z" fill="#dcd8d0" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="11" r="4.5" fill="#dcd8d0" stroke="#453729" stroke-width="1.8"/><circle cx="28" cy="26" r="1.5" fill="#453729"/><circle cx="36" cy="26" r="1.5" fill="#453729"/><path d="M29 31q3 2 6 0" fill="none" stroke="#453729" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    postman: `<svg viewBox="0 0 64 64" class="prop-svg"><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#527864" stroke="#453729" stroke-width="2"/><circle cx="32" cy="27" r="10.5" fill="#f8dec4" stroke="#453729" stroke-width="2"/><path d="M21 21h22l-3-7H24Z" fill="#4b6c5a" stroke="#453729" stroke-width="2"/><path d="M19 21h26" stroke="#36281c" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="28" r="1.5" fill="#453729"/><circle cx="36" cy="28" r="1.5" fill="#453729"/><path d="M28 33h8" stroke="#8b6239" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    teahouse: `<svg viewBox="0 0 64 64" class="prop-svg"><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#9b7853" stroke="#453729" stroke-width="2"/><circle cx="32" cy="26" r="10.5" fill="#fae2c8" stroke="#453729" stroke-width="2"/><path d="M21 23c2-7 20-7 22 0Z" fill="#4a3c31" stroke="#453729" stroke-width="1.8"/><circle cx="28" cy="27" r="1.5" fill="#453729"/><circle cx="36" cy="27" r="1.5" fill="#453729"/><path d="M29 31q3 2 6 0" fill="none" stroke="#453729" stroke-width="1.6" stroke-linecap="round"/><rect x="37" y="42" width="10" height="8" rx="2" fill="#f3e6cc" stroke="#453729" stroke-width="1.6"/></svg>`,
    vendor: `<svg viewBox="0 0 64 64" class="prop-svg"><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#c0563f" stroke="#453729" stroke-width="2"/><circle cx="32" cy="26" r="10.5" fill="#fbe5ce" stroke="#453729" stroke-width="2"/><path d="M20 25c1-8 6-12 12-12s11 4 12 12c-4-3-20-3-24 0Z" fill="#3e3229" stroke="#453729" stroke-width="1.8"/><circle cx="28" cy="27" r="1.5" fill="#453729"/><circle cx="36" cy="27" r="1.5" fill="#453729"/><path d="M29 31q3 2.5 6 0" fill="none" stroke="#453729" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    guide: `<svg viewBox="0 0 64 64" class="prop-svg"><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#c49a6c" stroke="#453729" stroke-width="2"/><circle cx="32" cy="27" r="10.5" fill="#f4d4b2" stroke="#453729" stroke-width="2"/><path d="M18 22h28l-6-8H24Z" fill="#d4a24e" stroke="#453729" stroke-width="2"/><circle cx="28" cy="28" r="1.5" fill="#453729"/><circle cx="36" cy="28" r="1.5" fill="#453729"/><path d="M29 32q3 2 6 0" fill="none" stroke="#453729" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    curator: `<svg viewBox="0 0 64 64" class="prop-svg"><ellipse cx="32" cy="56" rx="16" ry="4" fill="#4b321b" opacity=".2"/><path d="M18 54c1-12 6-18 14-18s13 6 14 18Z" fill="#5b7590" stroke="#453729" stroke-width="2"/><circle cx="32" cy="26" r="10.5" fill="#fbe7d2" stroke="#453729" stroke-width="2"/><path d="M21 25c1-8 5-12 11-12s10 4 11 12c-3-4-19-4-22 0Z" fill="#3f332a" stroke="#453729" stroke-width="1.8"/><circle cx="28" cy="27" r="3" fill="none" stroke="#453729" stroke-width="1.4"/><circle cx="36" cy="27" r="3" fill="none" stroke="#453729" stroke-width="1.4"/><path d="M31 27h2" stroke="#453729" stroke-width="1.4"/></svg>`
  };

  /* 静心沙漏 / 补给 / 音效 / 设置 等小图标 */
  const MISC_SVG = {
    hourglass: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M14 8h20M14 40h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M16 8c0 8 8 10 8 16s-8 8-8 16M32 8c0 8-8 10-8 16s8 8 8 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M20 34h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    gift: `<svg class="nav-svg" viewBox="0 0 48 48"><rect x="9" y="18" width="30" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6 18h36v8H6zM24 18v22" stroke="currentColor" stroke-width="2.6" fill="none"/><path d="M24 18c-4-8-12-8-12-2 0 3 5 4 12 2Zm0 0c4-8 12-8 12-2 0 3-5 4-12 2Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
    sprout: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M24 40V22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M24 24c-8 0-12-5-12-10 8-1 12 3 12 10Zm0 0c8 0 12-5 12-10-8-1-12 3-12 10Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>`,
    soundOn: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M10 19h8l10-8v26l-10-8h-8Z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M33 17a10 10 0 0 1 0 14M38 12a16 16 0 0 1 0 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`,
    soundOff: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M10 19h8l10-8v26l-10-8h-8Z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M33 19l10 10M43 19L33 29" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`,
    gear: `<svg class="nav-svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="7" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M24 8v5M24 35v5M8 24h5M35 24h5M12.7 12.7l3.5 3.5M31.8 31.8l3.5 3.5M35.3 12.7l-3.5 3.5M16.2 31.8l-3.5 3.5" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>`,
    shelf: `<svg class="nav-svg" viewBox="0 0 48 48"><rect x="8" y="9" width="32" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.8"/><path d="M8 19h32M8 29h32M24 9v30" stroke="currentColor" stroke-width="2.4"/></svg>`,
    doorOut: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M10 38V14l14-6v30Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 14h12v24H24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M31 24h9M36 20l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    doorIn: `<svg class="nav-svg" viewBox="0 0 48 48"><path d="M12 38V14h12v24Z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 14l14-6v30l-14 0" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M18 24H9M13 20l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  /* 信封兜底 */
  const ENV_SVG = `<svg class="nav-svg" viewBox="0 0 64 44" style="width:100%;height:100%">
    <rect x="2" y="4" width="60" height="36" rx="4" fill="#fdf7ea" stroke="#c49a6c" stroke-width="2.4"/>
    <path d="M2 9l30 19L62 9" fill="none" stroke="#c49a6c" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="54" cy="33" r="5" fill="#c0563f" opacity=".75"/>
  </svg>`;

  /* ---------- UI 素材 ---------- */
  function uiImg(file, cls, alt) {
    if (isMissing('ui:' + file)) return '';
    return imgTag(`assets/images/${file}`, 'ui', cls, alt, {
      key: 'ui:' + file,
      finalExpr: `this.remove();SH.art._miss('ui:${file}')`
    });
  }

  /** 可选 UI 素材：未登记时直接返回空，不触发 404 */
  function uiOptional(file, cls, alt) {
    if (!optReady(file)) return '';
    return uiImg(file, cls, alt);
  }

  SH.art = {
    _miss: markMissing,

    uiPaper() { return uiImg('ui-paper', 'ui-paper-tex'); },
    uiScroll() { return uiImg('ui-scroll-title', 'ui-scroll-img'); },
    uiPlank() { return uiImg('ui-wood-plank', 'ui-plank-img'); },
    uiLetter() { return uiImg('ui-letter-paper', 'ui-letter-img'); },
    uiStamp() { return uiImg('ui-stamp-red', 'ui-stamp-img'); },
    codexCover() { return uiImg('codex-cover', 'codex-cover-img'); },
    uiShelf() { return uiOptional('ui-shelf', 'ui-shelf-img'); },
    uiEnvelope() {
      const img = uiOptional('ui-envelope', 'ui-envelope-img');
      return `<span class="env-fallback">${img}${ENV_SVG}</span>`;
    },

    navIcon(id) {
      const svg = NAV_SVG[id];
      if (!svg) return '';
      const base = 'ui-nav-' + id;
      const img =
        optReady(base) && !isMissing('nav:' + id)
          ? imgTag(`assets/images/${base}`, 'nav', 'nav-icon-img', '', {
              key: 'nav:' + id,
              finalExpr: `this.remove();SH.art._miss('nav:${id}')`
            })
          : '';
      return `<span class="nav-icon" aria-hidden="true">${img}${svg}</span>`;
    },
    miscIcon(id) {
      return `<span class="nav-icon misc" aria-hidden="true">${MISC_SVG[id] || ''}</span>`;
    },

    beast(id) {
      const def = (SH.BEASTS || []).find((b) => b.id === id);
      return imgOr('beast', 'beast-' + id, SVG[id] || '', def ? def.name : '神兽');
    },
    item(it) {
      const svg = ITEM_SVG[it.id] || `<span class="art-svg emoji-fallback" aria-hidden="true">${it.emoji}</span>`;
      const base = 'item-' + it.id;
      if (!optReady(base)) return `<span class="art">${svg}</span>`;
      return imgOr('item', base, svg, it.name);
    },
    propBundle() { return PROP_SVG.bundle; },
    propClover() { return PROP_SVG.clover; },
    propMailFlag() { return PROP_SVG.mailFlag; },
    propVisitor(id) { return VISITOR_SVG[id] || VISITOR_SVG.grandma; },
    souvenir(sou) {
      const icon = (sou.tags || []).map((t) => TAG_ICON[t]).filter(Boolean)[0] || '🎁';
      return imgOr('sou', sou.id, `<span class="art-svg emoji-fallback" aria-hidden="true">${icon}</span>`, sou.name);
    },
    city(city) {
      const fallback =
        `<span class="art-svg city-fallback">` +
        `<span class="city-name">${city.name}</span></span>`;
      return imgOr('city', 'city-' + city.id, fallback, city.name);
    },
    /** 场景图。hall 为必选；yard 等可选项未登记时直接复用 hall。 */
    scene(id, fallbackHtml) {
      if (id !== 'hall' && !optReady('home-' + id)) {
        return imgOr('home', 'home-hall', fallbackHtml || '', '');
      }
      const base = 'home-' + id;
      return imgOr('home', base, fallbackHtml || '', '', {
        key: 'scene:' + id,
        finalExpr:
          id === 'hall'
            ? `this.classList.add('art-missing');SH.art._miss('scene:hall')`
            : `this.src='assets/images/home-hall.jpg';SH.art._miss('scene:${id}')`
      });
    },
    weatherIcon(w) {
      return WEATHER_ICON[w] || '·';
    },
    tagIcon(t) {
      return TAG_ICON[t] || '·';
    }
  };
})();
