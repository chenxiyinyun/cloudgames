/**
 * 美术资源映射与手绘 SVG 兜底系统
 * 仅请求 public/shanhai-assets/images/ 中已实际存在的图片，新增风物使用定制手绘矢量图，绝不产生 404。
 */

export const AVAILABLE_IMAGES = new Set([
  'beast-baize.png',
  'beast-jiuweihu.png',
  'beast-qingniao.png',
  'city-chengdu.jpg',
  'city-dunhuang.jpg',
  'city-hangzhou.jpg',
  'city-harbin.jpg',
  'city-suzhou.jpg',
  'city-xian.jpg',
  'codex-cover.jpg',
  'home-hall.jpg',
  'home-yard.jpg',
  'ui-letter-paper.jpg',
  'ui-paper.jpg',
  'ui-scroll-title.jpg',
  'ui-stamp-red.jpg',
  'ui-wood-plank.jpg',
  'sou-arch-stone.png',
  'sou-bell-charm.png',
  'sou-boat-paddle.png',
  'sou-bridge-mark.png',
  'sou-camel-bell.png',
  'sou-chili.png',
  'sou-fresco.png',
  'sou-handbook.png',
  'sou-hotpot-token.png',
  'sou-ice-lantern.png',
  'sou-kunqu-fan.png',
  'sou-lantern.png',
  'sou-longjing.png',
  'sou-lotus-pod.png',
  'sou-osmanthus.png',
  'sou-panda-ear.png',
  'sou-paper-cut.png',
  'sou-paper-umbrella.png',
  'sou-pinecone.png',
  'sou-postcard.png',
  'sou-rail-map.png',
  'sou-rain-bottle.png',
  'sou-sand-vial.png',
  'sou-silk.png',
  'sou-snowflake.png',
  'sou-star-chart.png',
  'sou-tea-lid.png',
  'sou-terracotta.png',
  'sou-train-sketch.png',
  'sou-wall-brick.png'
]);

const IMG_BASE = '/shanhai-assets/images/';

export function hasImage(filename) {
  return AVAILABLE_IMAGES.has(filename);
}

export function imageUrl(filename) {
  return hasImage(filename) ? `${IMG_BASE}${filename}` : null;
}

export function beastImgUrl(id) {
  return imageUrl(`beast-${id}.png`);
}

export function cityImgUrl(id) {
  return imageUrl(`city-${id}.jpg`);
}

export function souvenirImgUrl(id) {
  return imageUrl(`${id}.png`);
}

/* ---------- 精卫等神兽内置手绘矢量 ---------- */
export const BEAST_SVGS = {
  baize: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity=".08"/><path d="M38 46 Q30 30 40 26 Q46 34 48 44 Z" fill="#cfd8e3"/><path d="M82 46 Q90 30 80 26 Q74 34 72 44 Z" fill="#cfd8e3"/><ellipse cx="60" cy="66" rx="30" ry="26" fill="#f4f1ea"/><ellipse cx="60" cy="70" rx="22" ry="19" fill="#fffdf8"/><ellipse cx="60" cy="52" rx="26" ry="22" fill="#fbf9f4"/><circle cx="50" cy="52" r="3.4" fill="#3f4a5a"/><circle cx="70" cy="52" r="3.4" fill="#3f4a5a"/><circle cx="60" cy="40" r="4" fill="#8ba0bd"/><path d="M56 62 Q60 66 64 62" stroke="#3f4a5a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  jiuweihu: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="104" rx="30" ry="6" fill="#000" opacity=".08"/><g fill="#f6e2cf"><ellipse cx="34" cy="72" rx="16" ry="6" transform="rotate(-32 34 72)"/><ellipse cx="86" cy="72" rx="16" ry="6" transform="rotate(32 86 72)"/><ellipse cx="60" cy="50" rx="16" ry="6"/></g><ellipse cx="60" cy="82" rx="22" ry="18" fill="#fbeedd"/><ellipse cx="60" cy="56" rx="24" ry="21" fill="#fdf3e6"/><path d="M38 40 L34 22 L50 34 Z" fill="#e7b7a0"/><path d="M82 40 L86 22 L70 34 Z" fill="#e7b7a0"/><circle cx="51" cy="56" r="3.4" fill="#4b3a33"/><circle cx="69" cy="56" r="3.4" fill="#4b3a33"/><path d="M40 74 Q60 82 80 74 L80 78 Q60 86 40 78 Z" fill="#c0563f"/></svg>`,
  qingniao: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="104" rx="26" ry="5" fill="#000" opacity=".08"/><ellipse cx="58" cy="62" rx="28" ry="26" fill="#8fc2ba"/><ellipse cx="58" cy="66" rx="21" ry="20" fill="#dff0ec"/><circle cx="50" cy="54" r="3.6" fill="#31453f"/><path d="M62 58 L74 60 L62 64 Z" fill="#d4663f"/></svg>`,
  jingwei: `<svg viewBox="0 0 120 120">
    <ellipse cx="60" cy="105" rx="26" ry="5" fill="#4a2e1a" opacity=".12"/>
    <path d="M32 68 Q16 58 24 44 Q38 46 44 62 Z" fill="#49687a" stroke="#36281c" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M74 78 Q104 84 106 94 Q88 92 70 86 Z" fill="#3d596b" stroke="#36281c" stroke-width="2"/>
    <path d="M76 72 Q102 68 106 78 Q88 80 72 80 Z" fill="#527488" stroke="#36281c" stroke-width="2"/>
    <ellipse cx="58" cy="66" rx="24" ry="22" fill="#f5ede0" stroke="#36281c" stroke-width="2.2"/>
    <path d="M38 56 Q58 46 78 58 Q70 80 58 84 Q42 80 38 56 Z" fill="#fdf8ee"/>
    <path d="M44 38 Q48 22 58 28 Q64 20 66 36" fill="#c0563f" stroke="#36281c" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="58" cy="46" r="18" fill="#5b7e92" stroke="#36281c" stroke-width="2.2"/>
    <path d="M42 48 Q58 40 74 48 Q70 62 58 62 Q44 62 42 48 Z" fill="#f7f0e2"/>
    <circle cx="51" cy="48" r="3.2" fill="#2e241d"/><circle cx="52" cy="47" r="1.1" fill="#fff"/>
    <path d="M68 48 L84 51 L68 56 Z" fill="#d99b43" stroke="#36281c" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="83" cy="53" rx="4.5" ry="3.2" fill="#e9dfc9" stroke="#36281c" stroke-width="1.6"/>
    <path d="M50 87 L48 97 M64 87 L66 97" stroke="#c0563f" stroke-width="2.8" stroke-linecap="round"/>
  </svg>`
};

/* ---------- 12 种随身道具手绘 SVG ---------- */
export const ITEM_SVGS = {
  camera: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><rect x="11" y="21" width="42" height="28" rx="6" fill="#7c6855" stroke="#453729" stroke-width="2.2"/><rect x="11" y="21" width="42" height="10" rx="4" fill="#e6d6b8" stroke="#453729" stroke-width="2.2"/><rect x="23" y="15" width="18" height="7" rx="2.5" fill="#d4a24e" stroke="#453729" stroke-width="2"/><circle cx="32" cy="37" r="10.5" fill="#fdf7ea" stroke="#453729" stroke-width="2.2"/><circle cx="32" cy="37" r="7" fill="#527688" stroke="#453729" stroke-width="1.8"/><circle cx="29.5" cy="34.5" r="2.2" fill="#fff" opacity=".75"/><circle cx="45" cy="26" r="2.5" fill="#c0563f"/></svg>`,
  oldbook: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M16 14h30a4 4 0 0 1 4 4v32H18a4 4 0 0 1-4-4V16a2 2 0 0 1 2-2Z" fill="#4f6d82" stroke="#453729" stroke-width="2.2"/><path d="M14 45h34v5H16a2 2 0 0 1-2-2v-3Z" fill="#f3e7cf" stroke="#453729" stroke-width="2"/><rect x="25" y="19" width="10" height="20" rx="1.5" fill="#fdf7ea" stroke="#c49a6c" stroke-width="1.5"/><path d="M42 14v31M46 14v31" stroke="#d4a24e" stroke-width="1.6"/><path d="M29 24v10" stroke="#7a6552" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  umbrella: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 10v41c0 3 4 4 6 2" fill="none" stroke="#6b4a2b" stroke-width="2.6" stroke-linecap="round"/><path d="M12 31c0-11 9-18 20-18s20 7 20 18Z" fill="#517896" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><path d="M22 31c0-11 4-18 10-18s10 7 10 18" fill="none" stroke="#d4a24e" stroke-width="1.4" opacity=".8"/><circle cx="32" cy="11" r="2.6" fill="#d4a24e" stroke="#453729" stroke-width="1.6"/></svg>`,
  map: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M10 18l14-5 16 5 14-5v33l-14 5-16-5-14 5Z" fill="#f6ecd6" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 13v33M40 18v33" stroke="#c49a6c" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M16 34q8-10 16-2t16-6" fill="none" stroke="#c0563f" stroke-width="2.2" stroke-dasharray="4 3" stroke-linecap="round"/><circle cx="48" cy="26" r="3.2" fill="#c0563f"/></svg>`,
  osmanthus: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="19" ry="4" fill="#6b4a2b" opacity=".14"/><ellipse cx="32" cy="46" rx="20" ry="7" fill="#e6d6b8" stroke="#453729" stroke-width="2"/><rect x="19" y="29" width="16" height="14" rx="3" fill="#f3d692" stroke="#453729" stroke-width="2"/><rect x="29" y="24" width="16" height="14" rx="3" fill="#f7e2aa" stroke="#453729" stroke-width="2"/><circle cx="34" cy="29" r="1.6" fill="#c0563f"/><circle cx="39" cy="31" r="1.5" fill="#d4a24e"/></svg>`,
  bamboo: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="20" ry="4" fill="#6b4a2b" opacity=".14"/><path d="M15 36c0-9 5-16 12-16h18c5 0 9 7 9 16s-4 14-9 14H27c-7 0-12-5-12-14Z" fill="#7d9b7e" stroke="#453729" stroke-width="2.2"/><ellipse cx="24" cy="35" rx="7" ry="12" fill="#fdf7ea" stroke="#453729" stroke-width="2"/><path d="M35 20v30M44 21v28" stroke="#5b7d5c" stroke-width="2"/></svg>`,
  hawthorn: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M26 44l10-18M38 44L28 26" stroke="#c49a6c" stroke-width="2.2" stroke-linecap="round"/><path d="M22 14h20v16c0 6-4 11-10 11s-10-5-10-11Z" fill="#fdf7ea" stroke="#453729" stroke-width="1.8" opacity=".88"/><circle cx="32" cy="20" r="5" fill="#c0563f" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="29" r="5.2" fill="#c85f46" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="38" r="4.8" fill="#b44b35" stroke="#453729" stroke-width="1.8"/></svg>`,
  notebook: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="19" ry="4" fill="#6b4a2b" opacity=".14"/><rect x="16" y="13" width="30" height="38" rx="4" fill="#e5d0ab" stroke="#453729" stroke-width="2.2"/><rect x="16" y="13" width="7" height="38" rx="2" fill="#9c6a44" stroke="#453729" stroke-width="2"/><rect x="27" y="20" width="13" height="15" rx="2" fill="#fdf7ea" stroke="#c49a6c" stroke-width="1.5"/><path d="M47 16l5 3-11 21-5 2 1-5Z" fill="#c0563f" stroke="#453729" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  bell: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="55" rx="16" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 10c-5 0-8 4-8 8" fill="none" stroke="#c0563f" stroke-width="3" stroke-linecap="round"/><path d="M22 20c0-4 4-7 10-7s10 3 10 7l4 18H18Z" fill="#d4a24e" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><ellipse cx="32" cy="39" rx="15" ry="4.5" fill="#b98635" stroke="#453729" stroke-width="2"/><circle cx="32" cy="43" r="4" fill="#8b6239" stroke="#453729" stroke-width="1.8"/></svg>`,
  lantern: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="56" rx="15" ry="3.5" fill="#6b4a2b" opacity=".14"/><path d="M32 9v6M32 45v8" stroke="#c0563f" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="32" cy="30" rx="15" ry="15" fill="#e67e58" stroke="#453729" stroke-width="2.2"/><ellipse cx="32" cy="30" rx="9" ry="15" fill="#f7be72" opacity=".72"/><rect x="24" y="14" width="16" height="4" rx="1.5" fill="#6b4a2b" stroke="#453729" stroke-width="1.6"/><rect x="24" y="43" width="16" height="4" rx="1.5" fill="#6b4a2b" stroke="#453729" stroke-width="1.6"/></svg>`,
  compass: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="19" ry="4" fill="#6b4a2b" opacity=".16"/><rect x="12" y="12" width="40" height="40" rx="8" fill="#8a6c48" stroke="#453729" stroke-width="2.2"/><circle cx="32" cy="32" r="14" fill="#f4e5c3" stroke="#453729" stroke-width="2"/><path d="M32 15v5M32 44v5M15 32h5M44 32h5" stroke="#8b6239" stroke-width="2" stroke-linecap="round"/><path d="M27 28c0-3 3-5 5-5s5 2 5 5c0 4-3 8-5 12-2-4-5-8-5-12Z" fill="#d4a24e" stroke="#453729" stroke-width="1.8"/><circle cx="32" cy="28" r="2.2" fill="#c0563f"/></svg>`,
  waxseal: `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="54" rx="18" ry="4" fill="#6b4a2b" opacity=".15"/><path d="M32 13c11 0 18 7 18 18 0 10-8 19-18 19s-18-8-18-19c0-10 7-18 18-18Z" fill="#c0563f" stroke="#453729" stroke-width="2.2"/><circle cx="32" cy="31" r="12" fill="#a8442f" stroke="#f3d49b" stroke-width="1.6"/><path d="M27 28h10M32 25v12M27 34h10" stroke="#f8e3ba" stroke-width="2" stroke-linecap="round"/></svg>`
};

/* ---------- 5 种灵材手绘 SVG ---------- */
export const MATERIAL_SVGS = {
  dew: `<svg viewBox="0 0 48 48"><path d="M24 8C16 19 12 25 12 31a12 12 0 0 0 24 0c0-6-4-12-12-23Z" fill="#8dc4cf" stroke="#345661" stroke-width="2.2"/><path d="M19 30a5 5 0 0 0 5 5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  osmanthus_seed: `<svg viewBox="0 0 48 48"><circle cx="19" cy="22" r="6" fill="#f3c556" stroke="#6b4a2b" stroke-width="1.8"/><circle cx="29" cy="20" r="5.5" fill="#f8d778" stroke="#6b4a2b" stroke-width="1.8"/><circle cx="24" cy="30" r="6" fill="#e8ae3d" stroke="#6b4a2b" stroke-width="1.8"/><path d="M13 31c6 5 16 6 22 0" fill="none" stroke="#4f7050" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  bamboo_shoot: `<svg viewBox="0 0 48 48"><path d="M18 39c0-14 4-24 10-30 4 8 6 18 4 30Z" fill="#7ca679" stroke="#365236" stroke-width="2.2" stroke-linejoin="round"/><path d="M19 28l13-3M20 20l11-2" stroke="#365236" stroke-width="1.8"/></svg>`,
  raw_paper: `<svg viewBox="0 0 48 48"><path d="M12 13h22l4 4v20H12Z" fill="#fdf6e4" stroke="#6b4a2b" stroke-width="2.2" stroke-linejoin="round"/><path d="M34 13v4h4" fill="none" stroke="#6b4a2b" stroke-width="2"/><path d="M17 22h14M17 28h10" stroke="#c49a6c" stroke-width="2" stroke-linecap="round"/></svg>`,
  cinnabar: `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="30" rx="14" ry="8" fill="#fdf7ea" stroke="#453729" stroke-width="2.2"/><ellipse cx="24" cy="28" rx="10" ry="5" fill="#c0563f"/><path d="M14 25v6c0 5 4 8 10 8s10-3 10-8v-6" fill="none" stroke="#453729" stroke-width="2.2"/></svg>`
};

/* ---------- 新纪念品手绘 SVG ---------- */
export const SOUVENIR_EXTRA_SVGS = {
  'sou-sea-pearl': `<svg viewBox="0 0 64 64"><path d="M14 42c6-18 18-26 32-24 6 8 4 22-8 28-10 4-18 2-24-4Z" fill="#f5ddd0" stroke="#453729" stroke-width="2.2"/><path d="M22 36c6-8 14-12 22-12M26 42c6-6 12-8 18-8" fill="none" stroke="#c0563f" stroke-width="1.6" opacity=".65"/><circle cx="24" cy="40" r="5" fill="#fffaf2" stroke="#d4a24e" stroke-width="1.8"/></svg>`,
  'sou-brick-ship': `<svg viewBox="0 0 64 64"><path d="M10 38h44l-8 12H18Z" fill="#9c6a44" stroke="#453729" stroke-width="2.2" stroke-linejoin="round"/><path d="M32 14v24" stroke="#453729" stroke-width="2.4"/><path d="M32 16l16 14H32Z" fill="#fdf6e4" stroke="#453729" stroke-width="2" stroke-linejoin="round"/><path d="M32 20l-12 10h12Z" fill="#f3dfc0" stroke="#453729" stroke-width="2" stroke-linejoin="round"/></svg>`,
  'sou-tie-dye': `<svg viewBox="0 0 64 64"><rect x="13" y="13" width="38" height="38" rx="5" fill="#466982" stroke="#2d4354" stroke-width="2.2"/><circle cx="32" cy="32" r="11" fill="none" stroke="#fdf7ea" stroke-width="2.4" stroke-dasharray="3 2"/><circle cx="32" cy="32" r="4.5" fill="#fdf7ea"/></svg>`,
  'sou-wind-flower': `<svg viewBox="0 0 64 64"><rect x="21" y="10" width="22" height="44" rx="4" fill="#f5e6ca" stroke="#6b4a2b" stroke-width="2.2"/><circle cx="32" cy="26" r="6" fill="#d98c5f"/><circle cx="32" cy="26" r="2.2" fill="#fff7e2"/><path d="M32 34v12" stroke="#4f7050" stroke-width="2" stroke-linecap="round"/></svg>`,
  'sou-compass': ITEM_SVGS.compass,
  'sou-hearth-stone': `<svg viewBox="0 0 64 64"><ellipse cx="32" cy="48" rx="19" ry="6" fill="#6b4a2b" opacity=".2"/><rect x="14" y="24" width="36" height="18" rx="9" fill="#8da894" stroke="#364f3d" stroke-width="2.2"/><ellipse cx="32" cy="30" rx="12" ry="4" fill="#b7ceb9" opacity=".6"/><circle cx="32" cy="33" r="3.5" fill="#c0563f"/></svg>`
};

export const CITY_GRADIENTS = {
  quanzhou: 'linear-gradient(150deg, #4b7d93 0%, #c86f54 65%, #f3d5a5 100%)',
  dali: 'linear-gradient(150deg, #5d869c 0%, #8eb4ad 55%, #f2ebd8 100%)'
};

export const WEATHER_MAP = {
  sunny: { icon: '☀️', label: '晴朗' },
  cloudy: { icon: '☁️', label: '多云' },
  rain: { icon: '🌧️', label: '细雨' },
  snow: { icon: '❄️', label: '飘雪' },
  night: { icon: '🌙', label: '夜色' }
};
