/**
 * 《山海来信》2.5D Three.js 宣纸景深微缩剧场引擎
 * 管理透视摄影机、GSAP 器物推镜对焦、GLSL 光影舞台、3D 立牌神兽漫游及景深天气粒子。
 * 注意：内部 Three.js 实例完全保留在普通 JS 类实例内，不放入 Vue 响应式代理。
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { BEASTS } from '../data/gameData.js';
import { beastImgUrl, imageUrl } from '../data/artwork.js';
import {
  createOffscreenCanvas,
  createWebGLRenderer,
  disposeObject3D,
  loadImageTexture,
  prefersReducedMotion
} from './webglAdapter.js';
import {
  DIORAMA_FRAG,
  DIORAMA_VERT,
  GODRAY_FRAG,
  GODRAY_VERT,
  LOGICAL_H,
  LOGICAL_W,
  PARTICLE_FRAG,
  PARTICLE_VERT,
  getCameraPreset,
  logicalToWorld
} from './shaders.js';

const HALL_ANCHORS = [
  { x: 430, y: 520, label: '蒲团' },
  { x: 640, y: 545, label: '堂中' },
  { x: 905, y: 495, label: '望窗' },
  { x: 750, y: 515, label: '赏古架' },
  { x: 525, y: 560, label: '听风' }
];

const YARD_ANCHORS = [
  { x: 440, y: 530, label: '石凳前' },
  { x: 645, y: 555, label: '庭院中' },
  { x: 830, y: 525, label: '月洞门旁' }
];

const INITIAL_SPOT = {
  baize: { x: 430, y: 520 },
  jiuweihu: { x: 645, y: 545 },
  qingniao: { x: 905, y: 495 },
  jingwei: { x: 540, y: 555 }
};

function drawJingweiToCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);

  const r = size * 0.25;
  ctx.fillStyle = '#48687a';
  ctx.strokeStyle = '#36281c';
  ctx.lineWidth = Math.max(2, size * 0.014);

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

  ctx.fillStyle = '#f8f0e2';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.68, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#c0563f';
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.45);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.98, r * 0.15, -r * 0.72);
  ctx.quadraticCurveTo(r * 0.35, -r * 0.96, r * 0.38, -r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#5c7f93';
  ctx.beginPath();
  ctx.arc(0, -r * 0.28, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fdf8ee';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.16, r * 0.38, r * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d231c';
  ctx.beginPath();
  ctx.arc(-r * 0.14, -r * 0.26, size * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.28, size * 0.008, 0, Math.PI * 2);
  ctx.fill();

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
  ctx.ellipse(r * 0.68, -r * 0.1, size * 0.032, size * 0.022, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function createSoftShadowTexture() {
  const c = createOffscreenCanvas(128, 64);
  if (!c) return null;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 32, 4, 64, 32, 60);
    grad.addColorStop(0, 'rgba(42, 24, 10, 0.36)');
    grad.addColorStop(0.65, 'rgba(42, 24, 10, 0.14)');
    grad.addColorStop(1, 'rgba(42, 24, 10, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function resolveParticleModeIndex(scene, timeOfDay, modeName) {
  if (scene === 'hall') return 0;
  const mode = timeOfDay === 'night' && modeName !== 'snow' && modeName !== 'rain' ? 'fireflies' : modeName;
  if (mode === 'leaves') return 2;
  if (mode === 'rain') return 3;
  if (mode === 'snow') return 4;
  if (mode === 'fireflies') return 5;
  return 1;
}

function resolveTimeVec4(mode) {
  return {
    dawn: mode === 'dawn' ? 1 : 0,
    noon: mode === 'noon' ? 1 : 0,
    dusk: mode === 'dusk' ? 1 : 0,
    night: mode === 'night' ? 1 : 0
  };
}

export class DioramaEngine {
  constructor(canvas, initialProps, callbacks = {}) {
    this.canvas = canvas;
    this.onActorPositions = callbacks.onActorPositions || (() => {});
    this.reducedMotion = prefersReducedMotion();

    this.sceneName = initialProps.scene || 'hall';
    this.timeOfDay = initialProps.timeOfDay || 'noon';
    this.particleMode = initialProps.particleMode || 'petals';
    this.homeBeastIds = Array.isArray(initialProps.homeBeastIds) ? initialProps.homeBeastIds : [];
    this.focusTarget = initialProps.focusTarget || null;

    this.pointerTarget = { x: 0, y: 0 };
    this.pointerSmooth = { x: 0, y: 0 };

    const initCam = getCameraPreset(this.focusTarget, this.sceneName);
    this.camPose = { ...initCam };
    this.shakeOffset = { x: 0, y: 0, z: 0 };
    this.projVec = new THREE.Vector3();

    this.renderer = createWebGLRenderer(canvas, { alpha: false, antialias: true, maxDpr: 2 });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x281b11);
    this.camera = new THREE.PerspectiveCamera(34, 16 / 10, 0.1, 60);
    this.camera.position.set(this.camPose.x, this.camPose.y, this.camPose.z);
    this.camera.lookAt(this.camPose.lookX, this.camPose.lookY, 0);

    this.rafId = 0;
    this.lastTs = 0;
    this.lastActorEmit = 0;
    this.disposed = false;

    this.buildBackdrop();
    this.buildGodRays();
    this.buildBeasts();
    this.buildParticles();

    // 同步初始时间与季节状态
    const tv = resolveTimeVec4(this.timeOfDay);
    this.backdropUniforms.uTimeMix.value.set(tv.dawn, tv.noon, tv.dusk, tv.night);
    this.backdropUniforms.uSceneMix.value = this.sceneName === 'yard' ? 1 : 0;
    this.backdropUniforms.uRainAmount.value = this.particleMode === 'rain' ? 1 : 0;
    this.backdropUniforms.uFocusBlur.value = initCam.blur;
    this.backdropUniforms.uDim.value = initCam.dim;

    this.particleUniforms.uMode.value = resolveParticleModeIndex(this.sceneName, this.timeOfDay, this.particleMode);

    this.startLoop();
  }

  buildBackdrop() {
    const hallTex = loadImageTexture(imageUrl('home-hall.jpg'), { srgb: true });
    const yardTex = loadImageTexture(imageUrl('home-yard.jpg'), { srgb: true });

    const geo = new THREE.PlaneGeometry(17.6, 11.0, 24, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const px = pos.getX(i);
      const normX = px / 8.8;
      // 轻度环形剧场弧度，增强运镜立体包裹感
      pos.setZ(i, -0.38 * normX * normX);
    }
    geo.computeVertexNormals();

    this.backdropUniforms = {
      uHallMap: { value: hallTex },
      uYardMap: { value: yardTex },
      uSceneMix: { value: this.sceneName === 'yard' ? 1 : 0 },
      uMistFade: { value: 0 },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uTimeMix: { value: new THREE.Vector4(0, 1, 0, 0) },
      uFocusBlur: { value: 0 },
      uDim: { value: 0 },
      uRainAmount: { value: 0 },
      uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 800) }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.backdropUniforms,
      vertexShader: DIORAMA_VERT,
      fragmentShader: DIORAMA_FRAG,
      depthWrite: false
    });

    this.backdropMesh = new THREE.Mesh(geo, mat);
    this.backdropMesh.position.z = -0.25;
    this.scene.add(this.backdropMesh);
  }

  buildGodRays() {
    const geo = new THREE.PlaneGeometry(8.4, 8.2);
    this.godRayUniforms = {
      uTime: { value: 0 },
      uIntensity: { value: 1.0 },
      uRayColor: { value: new THREE.Color(1.0, 0.93, 0.74) }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.godRayUniforms,
      vertexShader: GODRAY_VERT,
      fragmentShader: GODRAY_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.godRayMesh = new THREE.Mesh(geo, mat);
    this.godRayMesh.position.set(4.5, 0.2, 0.25);
    this.scene.add(this.godRayMesh);
  }

  buildBeasts() {
    this.beastGroup = new THREE.Group();
    this.scene.add(this.beastGroup);
    this.shadowTex = createSoftShadowTexture();
    this.actors = {};

    BEASTS.forEach((b, idx) => {
      const base = INITIAL_SPOT[b.id] || { x: 480 + idx * 90, y: 490 };
      const group = new THREE.Group();

      const shadowGeo = new THREE.PlaneGeometry(1.5, 0.52);
      const shadowMat = new THREE.MeshBasicMaterial({
        map: this.shadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
      });
      const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
      shadowMesh.position.set(0, -0.82, -0.02);
      group.add(shadowMesh);

      let tex;
      const imgUrl = beastImgUrl(b.id);
      if (imgUrl) {
        tex = loadImageTexture(imgUrl, { srgb: true });
      } else {
        const c = createOffscreenCanvas(384, 384);
        if (c) drawJingweiToCanvas(c);
        tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
      }

      const spriteGeo = new THREE.PlaneGeometry(2.3, 2.3);
      const spriteMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.03,
        side: THREE.DoubleSide
      });
      const spriteMesh = new THREE.Mesh(spriteGeo, spriteMat);
      group.add(spriteMesh);

      group.visible = this.homeBeastIds.includes(b.id);
      this.beastGroup.add(group);

      this.actors[b.id] = {
        group,
        spriteMesh,
        spriteMat,
        shadowMesh,
        lx: base.x,
        ly: base.y,
        tx: base.x,
        ty: base.y,
        facing: 1,
        phase: idx * 1.7,
        nextMoveAt: 6 + idx * 4,
        petSpring: { scaleY: 1, jump: 0 }
      };
    });
  }

  buildParticles() {
    this.particleCount = 96;
    const positions = new Float32Array(this.particleCount * 3);
    const seeds = new Float32Array(this.particleCount);
    const sizes = new Float32Array(this.particleCount);

    this.particleState = [];
    for (let i = 0; i < this.particleCount; i += 1) {
      const lx = Math.random() * LOGICAL_W;
      const ly = Math.random() * LOGICAL_H;
      const z = 0.4 + Math.random() * 2.5;
      const w = logicalToWorld(lx, ly, z);
      positions[i * 3] = w.x;
      positions[i * 3 + 1] = w.y;
      positions[i * 3 + 2] = w.z;

      const seed = i / this.particleCount;
      seeds[i] = seed;
      sizes[i] = 16 + (i % 5) * 4.5;

      this.particleState.push({
        lx,
        ly,
        z,
        vx: (Math.random() - 0.5) * 24,
        vy: 26 + Math.random() * 44,
        phase: Math.random() * Math.PI * 2,
        seed
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    this.particleUniforms = {
      uPixelRatio: { value: this.renderer.getPixelRatio() },
      uTime: { value: 0 },
      uMode: { value: 0 }
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.particleUniforms,
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false
    });

    this.particlePoints = new THREE.Points(geo, mat);
    this.scene.add(this.particlePoints);
  }

  resize(width, height) {
    if (this.disposed || !width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.particleUniforms.uPixelRatio.value = this.renderer.getPixelRatio();
  }

  setPointer(nx, ny) {
    const scale = this.reducedMotion ? 0.25 : 1.0;
    this.pointerTarget.x = THREE.MathUtils.clamp(nx, -1, 1) * scale;
    this.pointerTarget.y = THREE.MathUtils.clamp(ny, -1, 1) * scale;
  }

  resetPointer() {
    this.pointerTarget.x = 0;
    this.pointerTarget.y = 0;
  }

  triggerPet(beastId) {
    const a = this.actors[beastId];
    if (!a) return;
    gsap.killTweensOf(a.petSpring);
    a.petSpring.jump = 0;
    a.petSpring.scaleY = 0.86;
    gsap.to(a.petSpring, {
      jump: 0.42,
      scaleY: 1.12,
      duration: 0.16,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        gsap.to(a.petSpring, {
          jump: 0,
          scaleY: 1,
          duration: 0.34,
          ease: 'elastic.out(1.2, 0.45)'
        });
      }
    });
  }

  triggerCameraShake() {
    if (this.reducedMotion) return;
    gsap.killTweensOf(this.shakeOffset);
    this.shakeOffset.y = 0.08;
    this.shakeOffset.z = -0.14;
    gsap.to(this.shakeOffset, {
      y: 0,
      z: 0,
      duration: 0.32,
      ease: 'elastic.out(1.3, 0.38)'
    });
  }

  setFocusTarget(modalName) {
    this.focusTarget = modalName || null;
    const target = getCameraPreset(this.focusTarget, this.sceneName);
    const dur = this.reducedMotion ? 0.2 : 0.68;
    const ease = 'power3.out';

    gsap.killTweensOf(this.camPose);
    gsap.to(this.camPose, {
      x: target.x,
      y: target.y,
      z: target.z,
      lookX: target.lookX,
      lookY: target.lookY,
      duration: dur,
      ease,
      overwrite: 'auto'
    });

    gsap.to(this.backdropUniforms.uFocusBlur, {
      value: target.blur,
      duration: dur,
      ease
    });
    gsap.to(this.backdropUniforms.uDim, {
      value: target.dim,
      duration: dur,
      ease
    });
  }

  updateProps(next) {
    const prevScene = this.sceneName;
    if (next.scene && next.scene !== prevScene) {
      this.sceneName = next.scene;
      // 推门宣纸柔雾转场
      const dur = this.reducedMotion ? 0.25 : 0.62;
      gsap.killTweensOf(this.backdropUniforms.uMistFade);
      this.backdropUniforms.uMistFade.value = 0.72;
      gsap.to(this.backdropUniforms.uMistFade, { value: 0, duration: dur, ease: 'power2.out' });
      gsap.to(this.backdropUniforms.uSceneMix, {
        value: this.sceneName === 'yard' ? 1 : 0,
        duration: dur * 0.65,
        ease: 'power2.inOut'
      });

      const anchors = this.sceneName === 'yard' ? YARD_ANCHORS : HALL_ANCHORS;
      BEASTS.forEach((b, i) => {
        const a = this.actors[b.id];
        const spot = anchors[i % anchors.length];
        if (a && spot) {
          a.lx = spot.x + (i === 3 ? 25 : 0);
          a.ly = spot.y + (i === 3 ? 20 : 0);
          a.tx = a.lx;
          a.ty = a.ly;
          a.nextMoveAt = 5 + i * 3;
        }
      });

      this.setFocusTarget(this.focusTarget);
    }

    if (next.timeOfDay && next.timeOfDay !== this.timeOfDay) {
      this.timeOfDay = next.timeOfDay;
      const tv = resolveTimeVec4(this.timeOfDay);
      gsap.to(this.backdropUniforms.uTimeMix.value, {
        x: tv.dawn,
        y: tv.noon,
        z: tv.dusk,
        w: tv.night,
        duration: 0.7,
        ease: 'power2.out'
      });
    }

    if (next.particleMode && next.particleMode !== this.particleMode) {
      this.particleMode = next.particleMode;
      gsap.to(this.backdropUniforms.uRainAmount, {
        value: this.particleMode === 'rain' ? 1 : 0,
        duration: 0.6
      });
    }

    if (Array.isArray(next.homeBeastIds)) {
      this.homeBeastIds = next.homeBeastIds;
      Object.entries(this.actors).forEach(([id, a]) => {
        a.group.visible = this.homeBeastIds.includes(id);
      });
    }

    this.particleUniforms.uMode.value = resolveParticleModeIndex(
      this.sceneName,
      this.timeOfDay,
      this.particleMode
    );
  }

  updateBeasts(dt, timeSec) {
    const anchors = this.sceneName === 'hall' ? HALL_ANCHORS : YARD_ANCHORS;
    const tintHex = this.timeOfDay === 'night' ? 0x9aa9d4 : this.timeOfDay === 'dusk' ? 0xf6c59c : this.timeOfDay === 'dawn' ? 0xf2f4ec : 0xffffff;
    const visiblePositions = {};

    this.homeBeastIds.forEach((bid, idx) => {
      const a = this.actors[bid];
      if (!a) return;

      a.nextMoveAt -= dt;
      if (a.nextMoveAt <= 0) {
        a.nextMoveAt = 11 + Math.random() * 10;
        const pick = anchors[(Math.floor(Math.random() * anchors.length) + idx) % anchors.length];
        a.tx = pick.x + (idx - 1) * 44;
        a.ty = pick.y + (idx % 2) * 14;
        a.facing = a.tx >= a.lx ? 1 : -1;
      }

      const dx = a.tx - a.lx;
      const dy = a.ty - a.ly;
      const dist = Math.hypot(dx, dy);
      let walkHop = 0;
      if (dist > 1.5) {
        const step = Math.min(dist, 56 * dt);
        a.lx += (dx / dist) * step;
        a.ly += (dy / dist) * step;
        walkHop = Math.abs(Math.sin(timeSec * 9.5 + idx)) * 0.085;
      }

      const zDepth = 0.35 + (a.ly / LOGICAL_H) * 0.45;
      const wp = logicalToWorld(a.lx, a.ly, zDepth);
      a.group.position.set(wp.x, wp.y, wp.z);

      const breathY = 1 + Math.sin(timeSec * 2.2 + a.phase) * 0.022;
      const breathX = 1 - Math.sin(timeSec * 2.2 + a.phase) * 0.015;
      const finalScaleY = breathY * a.petSpring.scaleY;
      const finalScaleX = (breathX / Math.max(0.75, a.petSpring.scaleY)) * a.facing;

      a.spriteMesh.scale.set(finalScaleX, finalScaleY, 1);
      a.spriteMesh.position.y = walkHop + a.petSpring.jump;
      a.shadowMesh.scale.setScalar(1 - Math.min(0.28, (walkHop + a.petSpring.jump) * 0.45));
      a.spriteMat.color.setHex(tintHex);

      // 投影到屏幕百分比以精准对齐热区文字牌与对话气泡
      this.projVec.set(wp.x, wp.y, wp.z).project(this.camera);
      visiblePositions[bid] = {
        leftPct: (this.projVec.x * 0.5 + 0.5) * 100,
        topPct: (-this.projVec.y * 0.5 + 0.5) * 100
      };
    });

    if (timeSec - this.lastActorEmit > 0.045) {
      this.lastActorEmit = timeSec;
      this.onActorPositions(visiblePositions);
    }
  }

  updateParticles(dt) {
    const mode = resolveParticleModeIndex(this.sceneName, this.timeOfDay, this.particleMode);
    const posAttr = this.particlePoints.geometry.attributes.position;
    const sizeAttr = this.particlePoints.geometry.attributes.aSize;

    for (let i = 0; i < this.particleCount; i += 1) {
      const p = this.particleState[i];
      p.phase += dt * 1.5;

      if (mode === 0) {
        // 屋内：茶炉袅袅水烟 (seed < 0.48) + 窗前浮金
        if (p.seed < 0.48) {
          p.ly -= dt * 26;
          p.lx += Math.sin(p.phase * 1.6) * 10 * dt;
          if (p.ly < 310 || p.ly > 520 || p.lx < 35 || p.lx > 175) {
            p.lx = 86 + (Math.random() - 0.5) * 24;
            p.ly = 492;
          }
          sizeAttr.array[i] = 28 + Math.max(0, 492 - p.ly) * 0.14;
        } else {
          p.lx += Math.sin(p.phase * 0.8) * 9 * dt;
          p.ly += Math.cos(p.phase * 0.7) * 7 * dt;
          if (p.lx < 780 || p.lx > 1220 || p.ly < 150 || p.ly > 640) {
            p.lx = 820 + Math.random() * 380;
            p.ly = 180 + Math.random() * 430;
          }
          sizeAttr.array[i] = 11 + (i % 3) * 4;
        }
      } else if (mode === 3) {
        // 细雨
        p.lx -= dt * 95;
        p.ly += dt * 460;
        if (p.ly > LOGICAL_H + 30) {
          p.ly = -20;
          p.lx = Math.random() * (LOGICAL_W + 220);
        }
        sizeAttr.array[i] = 24 + (i % 4) * 5;
      } else if (mode === 5) {
        // 夏夜流萤
        p.lx += Math.sin(p.phase * 0.75) * 22 * dt;
        p.ly += Math.cos(p.phase * 0.6) * 16 * dt;
        if (p.ly < 190) p.ly = 650;
        if (p.ly > 760) p.ly = 220;
        sizeAttr.array[i] = 24 + (i % 3) * 6;
      } else if (mode === 4) {
        // 初雪
        p.lx += (Math.sin(p.phase) * 16 - 10) * dt;
        p.ly += p.vy * 0.62 * dt;
        if (p.ly > LOGICAL_H + 20) {
          p.ly = -15;
          p.lx = Math.random() * (LOGICAL_W + 120);
        }
        sizeAttr.array[i] = 13 + (i % 4) * 3;
      } else {
        // 飘瓣 / 霜降落叶
        p.lx += (Math.sin(p.phase) * 22 - 16) * dt;
        p.ly += p.vy * 0.68 * dt;
        if (p.ly > LOGICAL_H + 20 || p.lx < -40) {
          p.ly = -15;
          p.lx = Math.random() * (LOGICAL_W + 160);
        }
        sizeAttr.array[i] = 18 + (i % 4) * 4;
      }

      const wp = logicalToWorld(p.lx, p.ly, p.z);
      posAttr.array[i * 3] = wp.x;
      posAttr.array[i * 3 + 1] = wp.y;
      posAttr.array[i * 3 + 2] = wp.z;
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }

  startLoop() {
    const tick = (ts) => {
      if (this.disposed) return;
      if (!this.lastTs) this.lastTs = ts;
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      const timeSec = ts / 1000;

      // 平滑指针视差
      this.pointerSmooth.x += (this.pointerTarget.x - this.pointerSmooth.x) * 0.075;
      this.pointerSmooth.y += (this.pointerTarget.y - this.pointerSmooth.y) * 0.075;
      this.backdropUniforms.uParallax.value.set(this.pointerSmooth.x, this.pointerSmooth.y);
      this.backdropUniforms.uTime.value = timeSec;

      // 更新窗棂丁达尔天光柱可见度与角度
      const isSunRay = this.sceneName === 'hall' && (this.timeOfDay === 'dawn' || this.timeOfDay === 'noon');
      const rayTarget = isSunRay ? 1.0 : this.sceneName === 'yard' && this.timeOfDay !== 'night' ? 0.35 : 0.0;
      this.godRayUniforms.uTime.value = timeSec;
      this.godRayUniforms.uIntensity.value += (rayTarget - this.godRayUniforms.uIntensity.value) * 0.05;
      this.godRayMesh.visible = this.godRayUniforms.uIntensity.value > 0.01;
      if (this.timeOfDay === 'dusk') {
        this.godRayUniforms.uRayColor.value.setRGB(1.0, 0.72, 0.42);
      } else {
        this.godRayUniforms.uRayColor.value.setRGB(1.0, 0.94, 0.78);
      }

      // 更新相机运镜 + 细微手持窥视感
      const focusFactor = this.focusTarget ? 0.18 : 0.42;
      const camX = this.camPose.x + this.pointerSmooth.x * focusFactor + this.shakeOffset.x;
      const camY = this.camPose.y - this.pointerSmooth.y * (focusFactor * 0.52) + this.shakeOffset.y;
      const camZ = this.camPose.z + this.shakeOffset.z;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(this.camPose.lookX, this.camPose.lookY, 0);

      this.particleUniforms.uTime.value = timeSec;
      this.updateBeasts(dt, timeSec);
      this.updateParticles(dt);

      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    gsap.killTweensOf(this.camPose);
    gsap.killTweensOf(this.shakeOffset);
    gsap.killTweensOf(this.backdropUniforms.uFocusBlur);
    gsap.killTweensOf(this.backdropUniforms.uDim);
    gsap.killTweensOf(this.backdropUniforms.uMistFade);
    gsap.killTweensOf(this.backdropUniforms.uSceneMix);
    gsap.killTweensOf(this.backdropUniforms.uTimeMix.value);
    gsap.killTweensOf(this.backdropUniforms.uRainAmount);
    Object.values(this.actors).forEach((a) => gsap.killTweensOf(a.petSpring));
    disposeObject3D(this.scene);
    if (this.shadowTex) this.shadowTex.dispose();
    this.renderer.dispose();
  }
}
