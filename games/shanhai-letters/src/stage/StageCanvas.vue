<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { BEASTS } from '../data/gameData.js';
import { beastImgUrl, imageUrl } from '../data/artwork.js';

const props = defineProps({
  scene: { type: String, required: true },      // 'hall' | 'yard'
  timeOfDay: { type: String, required: true },  // 'dawn' | 'noon' | 'dusk' | 'night'
  particleMode: { type: String, default: 'petals' },
  homeBeastIds: { type: Array, default: () => [] },
  petTriggers: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['actor-positions']);

const canvasRef = ref(null);

const LOGICAL_W = 1280;
const LOGICAL_H = 800;

/* 屋内正厅锚点与室外庭院锚点 */
const HALL_ANCHORS = [
  { x: 430, y: 520, label: '蒲团' },
  { x: 640, y: 545, label: '堂中' },
  { x: 905, y: 495, label: '望窗' },
  { x: 750, y: 515, label: '赏古架' },
  { x: 525, y: 560, label: '听风' }
];

const YARD_ANCHORS = [
  { x: 560, y: 510, label: '石凳' },
  { x: 740, y: 565, label: '月洞门' },
  { x: 340, y: 515, label: '廊下' }
];

const INITIAL_SPOT = {
  baize: { x: 430, y: 520 },
  jiuweihu: { x: 645, y: 545 },
  qingniao: { x: 905, y: 495 },
  jingwei: { x: 540, y: 555 }
};

let rafId = 0;
let lastTs = 0;
let camX = 0;
let camY = 0;
let targetCamX = 0;
let targetCamY = 0;
let sceneFade = 1;
let lastActorEmit = 0;

const images = {};
const particles = [];
const ripples = [];
const actors = {};

function preloadImages() {
  const list = [
    ['hall', imageUrl('home-hall.jpg')],
    ['yard', imageUrl('home-yard.jpg')]
  ];
  BEASTS.forEach((b) => {
    const url = beastImgUrl(b.id);
    if (url) list.push([`beast:${b.id}`, url]);
  });
  list.forEach(([key, url]) => {
    if (!url || images[key]) return;
    const img = new Image();
    img.src = url;
    images[key] = img;
  });
}

function initActors() {
  BEASTS.forEach((b, i) => {
    const base = INITIAL_SPOT[b.id] || { x: 480 + i * 90, y: 490 };
    actors[b.id] = {
      x: base.x,
      y: base.y,
      tx: base.x,
      ty: base.y,
      phase: i * 1.7,
      nextMoveAt: 6 + i * 4,
      petTimer: 0,
      lastPetMark: 0,
      facing: 1
    };
  });
}

function initParticles() {
  particles.length = 0;
  for (let i = 0; i < 48; i += 1) {
    particles.push(spawnParticle(true));
  }
}

function spawnParticle(randomY = false) {
  return {
    x: Math.random() * LOGICAL_W,
    y: randomY ? Math.random() * LOGICAL_H : -20,
    vx: (Math.random() - 0.5) * 24,
    vy: 26 + Math.random() * 44,
    size: 2.5 + Math.random() * 4,
    phase: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 2.2,
    alpha: 0.35 + Math.random() * 0.5
  };
}

function drawCoverImage(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.complete || !img.naturalWidth) {
    const g = ctx.createLinearGradient(0, 0, 0, dh);
    g.addColorStop(0, '#ead8b8');
    g.addColorStop(1, '#d3bc96');
    ctx.fillStyle = g;
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* 绘制精美矢量版精卫（如无外部 PNG） */
function drawJingweiCanvas(ctx, size) {
  const r = size * 0.34;
  ctx.save();
  // 双翼与尾羽
  ctx.fillStyle = '#48687a';
  ctx.strokeStyle = '#36281c';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.ellipse(-r * 0.65, r * 0.1, r * 0.45, r * 0.24, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(r * 0.45, r * 0.35);
  ctx.quadraticCurveTo(r * 1.25, r * 0.2, r * 1.35, r * 0.55);
  ctx.quadraticCurveTo(r * 0.8, r * 0.65, r * 0.4, r * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 圆润身躯
  ctx.fillStyle = '#f8f0e2';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.68, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 朱红头冠
  ctx.fillStyle = '#c0563f';
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.45);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.98, r * 0.15, -r * 0.72);
  ctx.quadraticCurveTo(r * 0.35, -r * 0.96, r * 0.38, -r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 头部花冠纹
  ctx.fillStyle = '#5c7f93';
  ctx.beginPath();
  ctx.arc(0, -r * 0.28, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fdf8ee';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.16, r * 0.38, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  ctx.fillStyle = '#2d231c';
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.26, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.28, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // 黄喙与衔着的西山小石子
  ctx.fillStyle = '#d99b43';
  ctx.beginPath();
  ctx.moveTo(r * 0.24, -r * 0.24);
  ctx.lineTo(r * 0.72, -r * 0.14);
  ctx.lineTo(r * 0.24, -r * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ece2cc';
  ctx.beginPath();
  ctx.ellipse(r * 0.68, -r * 0.1, 6.5, 4.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawLightingPass(ctx, timeSec) {
  const mode = props.timeOfDay;
  if (mode === 'dawn') {
    const g = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
    g.addColorStop(0, 'rgba(132, 182, 198, 0.16)');
    g.addColorStop(0.6, 'rgba(255, 226, 178, 0.08)');
    g.addColorStop(1, 'rgba(255, 210, 150, 0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  } else if (mode === 'dusk') {
    const g = ctx.createLinearGradient(0, 0, LOGICAL_W, LOGICAL_H);
    g.addColorStop(0, 'rgba(214, 112, 58, 0.2)');
    g.addColorStop(0.55, 'rgba(240, 162, 82, 0.14)');
    g.addColorStop(1, 'rgba(116, 62, 56, 0.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  } else if (mode === 'night') {
    ctx.fillStyle = 'rgba(18, 28, 56, 0.44)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  // 屋内窗口斜射天光束（早晨与正午）
  if (props.scene === 'hall' && (mode === 'dawn' || mode === 'noon')) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ray = ctx.createLinearGradient(1180, 140, 740, 680);
    ray.addColorStop(0, 'rgba(255, 244, 204, 0.26)');
    ray.addColorStop(1, 'rgba(255, 244, 204, 0)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(1060, 120);
    ctx.lineTo(1260, 220);
    ctx.lineTo(960, 760);
    ctx.lineTo(660, 620);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 灯笼呼吸点光源（暮霞与宵夜尤为明显）
  const glowAlpha = mode === 'night' ? 0.52 : mode === 'dusk' ? 0.34 : 0.16;
  const lanternPoints = props.scene === 'hall'
    ? [{ x: 145, y: 155, r: 150 }, { x: 1135, y: 155, r: 150 }, { x: 108, y: 495, r: 95 }]
    : [{ x: 225, y: 125, r: 140 }, { x: 485, y: 245, r: 90 }];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  lanternPoints.forEach((pt, idx) => {
    const pulse = 0.88 + 0.12 * Math.sin(timeSec * 2.1 + idx * 1.9);
    const rad = pt.r * pulse;
    const rg = ctx.createRadialGradient(pt.x + camX * 0.5, pt.y + camY * 0.5, 4, pt.x + camX * 0.5, pt.y + camY * 0.5, rad);
    rg.addColorStop(0, `rgba(255, 214, 126, ${glowAlpha})`);
    rg.addColorStop(0.55, `rgba(255, 168, 76, ${glowAlpha * 0.36})`);
    rg.addColorStop(1, 'rgba(255, 168, 76, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(pt.x + camX * 0.5, pt.y + camY * 0.5, rad, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function updateAndDrawParticles(ctx, dt) {
  if (props.scene === 'hall') {
    // 正厅：茶炉袅袅水烟 + 窗边阳光浮尘
    ctx.save();
    for (let i = 0; i < 14; i += 1) {
      const p = particles[i];
      p.phase += dt * 0.9;
      p.y -= dt * 22;
      if (p.y < 330 || p.y > 515) {
        p.x = 92 + (Math.random() - 0.5) * 18;
        p.y = 485;
        p.alpha = 0.32;
      }
      const progress = Math.max(0, Math.min(1, (485 - p.y) / 150));
      const sx = p.x + Math.sin(p.phase * 1.7) * 9 + camX * 0.8;
      const sy = p.y + camY * 0.8;
      const rad = 5 + progress * 15;
      const alpha = Math.sin(progress * Math.PI) * 0.24;
      ctx.fillStyle = `rgba(255, 250, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // 窗边金尘
    for (let i = 14; i < 32; i += 1) {
      const p = particles[i];
      p.phase += dt * 0.8;
      const mx = 830 + ((i * 37) % 340) + Math.sin(p.phase) * 14 + camX * 1.1;
      const my = 200 + ((i * 61) % 390) + Math.cos(p.phase * 0.8) * 12 + camY * 1.1;
      const a = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(p.phase * 1.4))) * (props.timeOfDay === 'night' ? 0.3 : 0.85);
      ctx.fillStyle = `rgba(255, 242, 194, ${a})`;
      ctx.beginPath();
      ctx.arc(mx, my, 1.8 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // 庭院：按节气/时段绘制细雨涟漪 / 金桂飘瓣 / 霜降落叶 / 夏夜流萤 / 初雪
  const mode = props.timeOfDay === 'night' && props.particleMode !== 'snow' && props.particleMode !== 'rain'
    ? 'fireflies'
    : props.particleMode;

  ctx.save();
  particles.forEach((p, idx) => {
    p.phase += dt * 1.6;
    p.rot += p.vrot * dt;

    if (mode === 'rain') {
      p.x -= dt * 65;
      p.y += dt * 430;
      if (p.y > 540 + (idx % 5) * 42) {
        if (ripples.length < 22 && Math.random() < 0.38) {
          ripples.push({ x: p.x, y: p.y, r: 2, alpha: 0.45 });
        }
        p.x = Math.random() * (LOGICAL_W + 180);
        p.y = -20;
      }
      ctx.strokeStyle = `rgba(218, 232, 242, ${p.alpha * 0.72})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + camX * 1.1, p.y + camY * 1.1);
      ctx.lineTo(p.x - 6 + camX * 1.1, p.y + 24 + camY * 1.1);
      ctx.stroke();
    } else if (mode === 'fireflies') {
      p.x += Math.sin(p.phase * 0.7) * 18 * dt;
      p.y += Math.cos(p.phase * 0.5) * 14 * dt;
      if (p.y < 220) p.y = 620;
      if (p.y > 760) p.y = 260;
      const glow = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.phase * 1.5));
      const fx = p.x + camX * 1.15;
      const fy = p.y + camY * 1.15;
      const rg = ctx.createRadialGradient(fx, fy, 0.5, fx, fy, 11);
      rg.addColorStop(0, `rgba(255, 236, 132, ${glow * 0.92})`);
      rg.addColorStop(1, 'rgba(255, 220, 100, 0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(fx, fy, 11, 0, Math.PI * 2);
      ctx.fill();
    } else if (mode === 'snow') {
      p.x += (Math.sin(p.phase) * 14 - 8) * dt;
      p.y += (p.vy * 0.55) * dt;
      if (p.y > LOGICAL_H + 10) Object.assign(p, spawnParticle(false));
      ctx.fillStyle = `rgba(255, 252, 248, ${p.alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.x + camX * 1.1, p.y + camY * 1.1, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // petals 或 leaves
      p.x += (Math.sin(p.phase) * 20 - 14) * dt;
      p.y += (p.vy * 0.65) * dt;
      if (p.y > LOGICAL_H + 10 || p.x < -30) {
        Object.assign(p, spawnParticle(false));
        p.x = Math.random() * (LOGICAL_W + 120);
      }
      ctx.save();
      ctx.translate(p.x + camX * 1.15, p.y + camY * 1.15);
      ctx.rotate(p.rot);
      ctx.fillStyle = mode === 'leaves'
        ? `rgba(206, 98, 58, ${p.alpha * 0.82})`
        : `rgba(244, 202, 92, ${p.alpha * 0.88})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.95, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // 地面水圈涟漪
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const rp = ripples[i];
    rp.r += dt * 36;
    rp.alpha -= dt * 0.72;
    if (rp.alpha <= 0) {
      ripples.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `rgba(224, 238, 246, ${rp.alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(rp.x + camX * 0.9, rp.y + camY * 0.9, rp.r, rp.r * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function updateAndDrawBeasts(ctx, dt, timeSec) {
  const anchors = props.scene === 'hall' ? HALL_ANCHORS : YARD_ANCHORS;
  const visiblePositions = {};

  props.homeBeastIds.forEach((bid, idx) => {
    const a = actors[bid];
    if (!a) return;

    // 检查是否有新摸头触发
    const petStamp = props.petTriggers[bid] || 0;
    if (petStamp > a.lastPetMark) {
      a.lastPetMark = petStamp;
      a.petTimer = 0.58;
    }
    if (a.petTimer > 0) a.petTimer = Math.max(0, a.petTimer - dt);

    // 自主漫游选点
    a.nextMoveAt -= dt;
    if (a.nextMoveAt <= 0) {
      a.nextMoveAt = 11 + Math.random() * 10;
      const pick = anchors[(Math.floor(Math.random() * anchors.length) + idx) % anchors.length];
      a.tx = pick.x + (idx - 1) * 44;
      a.ty = pick.y + (idx % 2) * 14;
      a.facing = a.tx >= a.x ? 1 : -1;
    }

    const dx = a.tx - a.x;
    const dy = a.ty - a.y;
    const dist = Math.hypot(dx, dy);
    let walkHop = 0;
    if (dist > 1.5) {
      const step = Math.min(dist, 56 * dt);
      a.x += (dx / dist) * step;
      a.y += (dy / dist) * step;
      walkHop = Math.abs(Math.sin(timeSec * 9.5 + idx)) * 7;
    }

    const px = a.x + camX * 0.78;
    const py = a.y + camY * 0.78;

    // 物理呼吸与摸头弹性 Squash & Stretch
    let sx = 1 - Math.sin(timeSec * 2.2 + a.phase) * 0.016;
    let sy = 1 + Math.sin(timeSec * 2.2 + a.phase) * 0.024;
    let jumpY = -walkHop;
    if (a.petTimer > 0) {
      const p = 1 - a.petTimer / 0.58;
      const squash = Math.sin(p * Math.PI * 2.4) * (1 - p) * 0.16;
      sx = 1 - squash;
      sy = 1 + squash;
      jumpY -= Math.sin(Math.min(1, p * 1.4) * Math.PI) * 18;
    }

    const spriteSize = 186;

    // 地面柔影
    ctx.save();
    ctx.fillStyle = 'rgba(54, 34, 16, 0.24)';
    ctx.beginPath();
    ctx.ellipse(px, py + spriteSize * 0.36, 54 * (1 - Math.abs(jumpY) * 0.008), 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(px, py + jumpY);
    ctx.scale(sx * a.facing, sy);

    const img = images[`beast:${bid}`];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    } else if (bid === 'jingwei') {
      drawJingweiCanvas(ctx, spriteSize);
    }
    ctx.restore();

    visiblePositions[bid] = {
      leftPct: (px / LOGICAL_W) * 100,
      topPct: (py / LOGICAL_H) * 100
    };
  });

  if (timeSec - lastActorEmit > 0.045) {
    lastActorEmit = timeSec;
    emit('actor-positions', visiblePositions);
  }
}

function frame(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  const timeSec = ts / 1000;

  const canvas = canvasRef.value;
  if (canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      camX += (targetCamX - camX) * 0.065;
      camY += (targetCamY - camY) * 0.065;
      sceneFade = Math.min(1, sceneFade + dt * 3.2);

      ctx.save();
      ctx.scale(targetW / LOGICAL_W, targetH / LOGICAL_H);

      // 1. 场景底图（随视差略微放大 3% 防止边缘露白）
      const pad = 26;
      const bgKey = props.scene === 'yard' ? 'yard' : 'hall';
      drawCoverImage(ctx, images[bgKey], -pad + camX * 0.45, -pad + camY * 0.45, LOGICAL_W + pad * 2, LOGICAL_H + pad * 2);

      // 2. 四时天光染色与灯笼点光源
      drawLightingPass(ctx, timeSec);

      // 3. 屋内 / 庭院可动神兽木偶
      updateAndDrawBeasts(ctx, dt, timeSec);

      // 4. 氛围粒子（水烟/浮尘/细雨涟漪/花瓣/流萤/雪）
      updateAndDrawParticles(ctx, dt);

      // 5. 场景推门柔雾淡入
      if (sceneFade < 1) {
        ctx.fillStyle = `rgba(246, 236, 219, ${(1 - sceneFade) * 0.55})`;
        ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      }

      ctx.restore();
    }
  }

  rafId = requestAnimationFrame(frame);
}

function handlePointerMove(e) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const nx = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
  const ny = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  targetCamX = -nx * 14;
  targetCamY = -ny * 7;
}

function resetParallax() {
  targetCamX = 0;
  targetCamY = 0;
}

watch(() => props.scene, () => {
  sceneFade = 0.25;
  const anchors = props.scene === 'hall' ? HALL_ANCHORS : YARD_ANCHORS;
  BEASTS.forEach((b, i) => {
    const a = actors[b.id];
    const spot = anchors[i % anchors.length];
    if (a && spot) {
      a.x = spot.x + (i - 1) * 40;
      a.y = spot.y;
      a.tx = a.x;
      a.ty = a.y;
      a.nextMoveAt = 5 + i * 3;
    }
  });
});

onMounted(() => {
  preloadImages();
  initActors();
  initParticles();
  rafId = requestAnimationFrame(frame);
});

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="stage-canvas"
    @pointermove="handlePointerMove"
    @pointerleave="resetParallax"
  />
</template>

<style scoped>
.stage-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
