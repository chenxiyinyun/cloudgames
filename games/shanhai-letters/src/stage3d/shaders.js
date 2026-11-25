/**
 * 《山海来信》2.5D 景深舞台与 3D 器物 GLSL 着色器 & 镜头运镜坐标系
 * 本模块为纯常量与纯函数，可在 Node / Vitest 环境直接做单元测试。
 */

export const LOGICAL_W = 1280;
export const LOGICAL_H = 800;
export const WORLD_W = 16;
export const WORLD_H = 10;

/**
 * 逻辑坐标 (0..1280, 0..800) 映射到 Three.js 3D 世界坐标 (-8..8, +5..-5, z)
 */
export function logicalToWorld(lx, ly, z = 0) {
  const x = (lx / LOGICAL_W - 0.5) * WORLD_W;
  const y = (0.5 - ly / LOGICAL_H) * WORLD_H;
  return { x, y, z };
}

/**
 * Three.js 3D 世界坐标逆映射到逻辑坐标 (0..1280, 0..800)
 */
export function worldToLogical(wx, wy) {
  const lx = (wx / WORLD_W + 0.5) * LOGICAL_W;
  const ly = (0.5 - wy / WORLD_H) * LOGICAL_H;
  return { x: lx, y: ly };
}

/**
 * 各器物台面对应的摄影机推镜对焦参数
 */
export const CAMERA_PRESETS = {
  default: { x: 0, y: 0, z: 15.6, lookX: 0, lookY: 0, blur: 0, dim: 0 },
  pack: { x: -4.15, y: -1.75, z: 11.4, lookX: -4.55, lookY: -1.95, blur: 0.72, dim: 0.24 },
  tea: { x: -4.75, y: -0.7, z: 11.1, lookX: -5.15, lookY: -0.85, blur: 0.72, dim: 0.24 },
  shelf: { x: 0, y: 0.9, z: 11.8, lookX: 0, lookY: 1.0, blur: 0.64, dim: 0.22 },
  codex: { x: -3.55, y: 0.85, z: 11.4, lookX: -3.85, lookY: 0.95, blur: 0.72, dim: 0.24 },
  mailHall: { x: -2.4, y: -0.6, z: 12.2, lookX: -2.6, lookY: -0.8, blur: 0.72, dim: 0.24 },
  mailYard: { x: -4.55, y: -1.45, z: 11.2, lookX: -4.95, lookY: -1.65, blur: 0.72, dim: 0.24 },
  beast: { x: 0, y: -0.35, z: 12.6, lookX: 0, lookY: -0.45, blur: 0.68, dim: 0.22 },
  settings: { x: 0, y: 0.2, z: 13.7, lookX: 0, lookY: 0.2, blur: 0.64, dim: 0.26 }
};

export function getCameraPreset(modal, scene = 'hall') {
  if (!modal) return CAMERA_PRESETS.default;
  if (modal === 'mail') {
    return scene === 'yard' ? CAMERA_PRESETS.mailYard : CAMERA_PRESETS.mailHall;
  }
  return CAMERA_PRESETS[modal] || CAMERA_PRESETS.default;
}

/* ============ 1. 2.5D 宣纸景深舞台主着色器 ============ */
export const DIORAMA_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const DIORAMA_FRAG = /* glsl */ `
uniform sampler2D uHallMap;
uniform sampler2D uYardMap;
uniform float uSceneMix;     // 0.0 = hall, 1.0 = yard
uniform float uMistFade;     // 转场宣纸柔雾权重 (0..1)
uniform vec2 uParallax;      // 指针归一化视差 (-1..1)
uniform float uTime;
uniform vec4 uTimeMix;       // (dawn, noon, dusk, night)
uniform float uFocusBlur;    // 推镜景深虚化 (0..1)
uniform float uDim;          // 聚焦暗角压暗 (0..1)
uniform float uRainAmount;   // 细雨涟漪强度 (0..1)
uniform vec2 uTexelSize;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

/* 解析空间深度场：区分正厅(墙面/木地板/前景茶案/窗景)与庭院(远山月洞门/石板院地/前景信箱桂树) */
float computeDepth(vec2 uv, float isYard) {
  if (isYard < 0.5) {
    float wall = 0.14;
    float floorRamp = smoothstep(0.36, 0.0, uv.y) * 0.72;
    float leftStoveTable = smoothstep(0.30, 0.06, uv.x) * smoothstep(0.68, 0.16, uv.y) * 0.52;
    float rightWindow = smoothstep(0.76, 0.96, uv.x) * 0.36;
    float lanternL = exp(-dot(uv - vec2(0.115, 0.825), uv - vec2(0.115, 0.825)) * 85.0) * 0.45;
    float lanternR = exp(-dot(uv - vec2(0.882, 0.825), uv - vec2(0.882, 0.825)) * 85.0) * 0.45;
    return clamp(wall + max(floorRamp, leftStoveTable) + rightWindow * 0.35 + lanternL + lanternR, 0.05, 0.96);
  }
  float wall = 0.24;
  float sky = smoothstep(0.64, 0.86, uv.y) * 0.20;
  float moonDist = length((uv - vec2(0.76, 0.51)) * vec2(1.0, 0.65));
  float moonHole = (1.0 - smoothstep(0.08, 0.135, moonDist)) * 0.20;
  float floorRamp = smoothstep(0.40, 0.0, uv.y) * 0.64;
  float leftPorch = smoothstep(0.32, 0.04, uv.x) * smoothstep(0.92, 0.24, uv.y) * 0.42;
  float mailbox = smoothstep(0.20, 0.03, uv.x) * smoothstep(0.54, 0.12, uv.y) * 0.56;
  float rightGarden = smoothstep(0.68, 0.96, uv.x) * 0.48;
  return clamp(wall - sky - moonHole + max(floorRamp, max(leftPorch, max(mailbox, rightGarden))), 0.02, 0.96);
}

vec3 sampleBackdrop(sampler2D mapTex, vec2 baseUv, float blurAmount) {
  if (blurAmount <= 0.01) {
    return texture2D(mapTex, baseUv).rgb;
  }
  vec3 acc = texture2D(mapTex, baseUv).rgb * 0.20;
  float r = (1.5 + blurAmount * 6.5);
  vec2 stepUv = uTexelSize * r;
  // 8-tap 黄金角圆形散景核
  acc += texture2D(mapTex, clamp(baseUv + vec2(0.92, 0.38) * stepUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(-0.38, 0.92) * stepUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(-0.92, -0.38) * stepUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(0.38, -0.92) * stepUv, 0.003, 0.997)).rgb * 0.10;
  vec2 outerUv = stepUv * 1.65;
  acc += texture2D(mapTex, clamp(baseUv + vec2(0.71, -0.71) * outerUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(-0.71, 0.71) * outerUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(0.71, 0.71) * outerUv, 0.003, 0.997)).rgb * 0.10;
  acc += texture2D(mapTex, clamp(baseUv + vec2(-0.71, -0.71) * outerUv, 0.003, 0.997)).rgb * 0.10;
  return acc;
}

float pointGlow(vec2 uv, vec2 center, float radius, float pulseSpeed, float seed) {
  vec2 d = (uv - center) * vec2(1.6, 1.0);
  float pulse = 0.88 + 0.12 * sin(uTime * pulseSpeed + seed);
  float r = radius * pulse;
  float dist = length(d) / max(0.001, r);
  return exp(-dist * dist * 2.4);
}

void main() {
  // 轻度内缩防止视差偏移边缘露白
  vec2 centeredUv = (vUv - 0.5) * 0.955 + 0.5;
  float depthHall = computeDepth(centeredUv, 0.0);
  float depthYard = computeDepth(centeredUv, 1.0);
  float depth = mix(depthHall, depthYard, uSceneMix);

  vec2 uvShift = uParallax * (depth - 0.36) * vec2(0.032, -0.020);
  vec2 parallaxUv = clamp(centeredUv + uvShift, 0.003, 0.997);

  // 庭院青石板细雨涟漪折射
  if (uSceneMix > 0.25 && uRainAmount > 0.02) {
    float groundMask = smoothstep(0.38, 0.12, parallaxUv.y) * smoothstep(0.18, 0.36, parallaxUv.x) * smoothstep(0.84, 0.64, parallaxUv.x);
    if (groundMask > 0.01) {
      float rip1 = sin(length((parallaxUv - vec2(0.45, 0.20)) * vec2(1.6, 3.0)) * 90.0 - uTime * 5.2);
      float rip2 = sin(length((parallaxUv - vec2(0.58, 0.15)) * vec2(1.6, 3.0)) * 105.0 - uTime * 4.7);
      parallaxUv += vec2(rip1, rip2) * 0.0016 * groundMask * uRainAmount;
    }
  }

  // 根据聚焦程度叠加光学微虚化
  float edgeBlur = smoothstep(0.16, 0.68, length(vUv - 0.5)) * 0.35 + 0.65;
  float blur = uFocusBlur * edgeBlur;

  vec3 hallCol = sampleBackdrop(uHallMap, parallaxUv, blur);
  vec3 yardCol = sampleBackdrop(uYardMap, parallaxUv, blur);
  vec3 col = mix(hallCol, yardCol, uSceneMix);

  // 细雨微凉水泽反光
  if (uSceneMix > 0.25 && uRainAmount > 0.02) {
    float sheenMask = smoothstep(0.36, 0.08, parallaxUv.y) * smoothstep(0.20, 0.40, parallaxUv.x) * smoothstep(0.80, 0.60, parallaxUv.x);
    col = mix(col, vec3(0.62, 0.72, 0.78), sheenMask * 0.18 * uRainAmount);
  }

  // 四时天光定调 (dawn, noon, dusk, night)
  vec3 dawnGrade = mix(col, col * vec3(0.95, 1.01, 1.05) + vec3(0.03, 0.04, 0.05), 0.65);
  vec3 noonGrade = col * vec3(1.02, 1.00, 0.97);
  vec3 duskGrade = col * vec3(1.12, 0.88, 0.72) + vec3(0.05, 0.015, 0.0);
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 nightBase = mix(col, vec3(luma), 0.28) * vec3(0.38, 0.46, 0.72);

  col = dawnGrade * uTimeMix.x
      + noonGrade * uTimeMix.y
      + duskGrade * uTimeMix.z
      + nightBase * uTimeMix.w;

  // 灯笼与茶炉暖色三维点光（暮霞与宵夜尤为透亮）
  float warmPower = 0.22 * uTimeMix.x + 0.14 * uTimeMix.y + 0.56 * uTimeMix.z + 0.95 * uTimeMix.w;
  float hallGlow = pointGlow(vUv, vec2(0.115, 0.81), 0.23, 2.2, 0.3)
                 + pointGlow(vUv, vec2(0.882, 0.81), 0.23, 2.0, 2.4)
                 + pointGlow(vUv, vec2(0.105, 0.35), 0.18, 4.1, 1.1) * 0.85;
  float yardGlow = pointGlow(vUv, vec2(0.155, 0.85), 0.24, 2.1, 0.8)
                 + pointGlow(vUv, vec2(0.39, 0.69), 0.16, 2.4, 3.1);
  float lampMask = mix(hallGlow, yardGlow, uSceneMix);
  col += vec3(1.0, 0.68, 0.30) * lampMask * warmPower * 0.68;

  // 宣纸细微纤维纹理 + 自然暗角
  float fiber = (valueNoise(vUv * vec2(180.0, 112.0)) - 0.5) * 0.032;
  col += fiber;

  float vig = smoothstep(0.86, 0.34, length((vUv - 0.5) * vec2(1.05, 1.15)));
  col *= mix(0.84, 1.02, vig);

  // 推镜聚焦时的外围柔压暗与转场宣纸雾气
  col *= (1.0 - uDim * 0.34);
  col = mix(col, vec3(0.95, 0.90, 0.81), clamp(uMistFade, 0.0, 0.85));

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;

/* ============ 2. 窗棂丁达尔天光柱着色器 ============ */
export const GODRAY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GODRAY_FRAG = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform vec3 uRayColor;
varying vec2 vUv;

void main() {
  // 沿对角线从右上窗棂斜落地板的条纹光束
  float diag = vUv.x * 0.72 + vUv.y * 0.68;
  float beam1 = pow(max(0.0, sin((vUv.x - vUv.y * 0.72) * 18.0 + uTime * 0.22)), 2.2);
  float beam2 = pow(max(0.0, sin((vUv.x - vUv.y * 0.68) * 11.0 - uTime * 0.14 + 1.2)), 2.0);
  float rays = 0.52 + 0.32 * beam1 + 0.16 * beam2;

  float edgeX = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.68, vUv.x);
  float edgeY = smoothstep(0.02, 0.38, vUv.y) * smoothstep(1.0, 0.76, vUv.y);
  float taper = smoothstep(0.25, 1.15, diag);

  float alpha = rays * edgeX * edgeY * taper * uIntensity * 0.26;
  gl_FragColor = vec4(uRayColor * alpha, alpha);
  #include <colorspace_fragment>
}
`;

/* ============ 3. 3D 景深写意粒子着色器 (花瓣 / 茶烟 / 细雨 / 初雪 / 流萤) ============ */
export const PARTICLE_VERT = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uPixelRatio;
uniform float uTime;
varying float vSeed;
varying float vDepthAlpha;

void main() {
  vSeed = aSeed;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  float dist = max(1.0, -mvPos.z);
  vDepthAlpha = clamp(1.25 - (dist - 10.0) * 0.05, 0.35, 1.0);
  gl_PointSize = aSize * uPixelRatio * (15.5 / dist);
  gl_Position = projectionMatrix * mvPos;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
uniform int uMode;   // 0=茶烟金尘, 1=花瓣, 2=秋叶, 3=细雨, 4=飘雪, 5=流萤
uniform float uTime;
varying float vSeed;
varying float vDepthAlpha;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float ang = vSeed * 6.2831 + uTime * (uMode == 1 || uMode == 2 ? 1.4 : 0.25);
  float c = cos(ang);
  float s = sin(ang);
  vec2 rp = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

  vec3 col = vec3(1.0, 0.96, 0.88);
  float alpha = 0.0;

  if (uMode == 3) {
    // 细雨丝（斜向纤细雨线）
    vec2 rainP = vec2(p.x * 0.96 - p.y * 0.26, p.x * 0.26 + p.y * 0.96);
    float streakX = smoothstep(0.065, 0.015, abs(rainP.x));
    float streakY = smoothstep(0.48, 0.12, abs(rainP.y));
    alpha = streakX * streakY * 0.62;
    col = vec3(0.84, 0.91, 0.96);
  } else if (uMode == 5) {
    // 暖金流萤散景光晕
    float d = length(p) * 2.0;
    float flicker = 0.38 + 0.62 * (0.5 + 0.5 * sin(uTime * 2.8 + vSeed * 25.0));
    alpha = exp(-d * d * 3.4) * flicker * 0.92;
    col = vec3(1.0, 0.88, 0.45);
  } else if (uMode == 1 || uMode == 2) {
    // 花瓣 / 霜叶：自然瓜子瓣形剪影
    vec2 petalP = rp * vec2(1.25, 2.35);
    float d = length(petalP);
    alpha = smoothstep(0.54, 0.30, d) * 0.85;
    col = uMode == 2 ? vec3(0.82, 0.38, 0.22) : vec3(0.96, 0.80, 0.38);
  } else if (uMode == 4) {
    // 初雪软绒
    float d = length(p) * 2.0;
    alpha = smoothstep(0.95, 0.15, d) * 0.82;
    col = vec3(1.0, 0.99, 0.96);
  } else {
    // 正厅：茶炉轻烟与窗前浮金
    float d = length(p) * 2.0;
    if (vSeed < 0.48) {
      alpha = exp(-d * d * 2.6) * 0.20;
      col = vec3(0.99, 0.97, 0.92);
    } else {
      float twinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.9 + vSeed * 19.0));
      alpha = exp(-d * d * 4.5) * twinkle * 0.68;
      col = vec3(1.0, 0.92, 0.68);
    }
  }

  if (alpha < 0.01) discard;
  alpha *= vDepthAlpha;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/* ============ 4. 宣纸朱砂印章纤维渗透着色器 ============ */
export const INK_BLEED_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const INK_BLEED_FRAG = /* glsl */ `
uniform sampler2D uStampMap;
uniform float uProgress;   // 0..1 压印渗透进度
uniform float uTime;
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 567.21));
  p += dot(p, p + 31.4);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  if (uProgress <= 0.005) discard;
  vec2 centered = vUv - 0.5;
  float fiber = noise(vUv * 42.0) * 0.6 + noise(vUv * 96.0) * 0.4;
  vec2 bleedUv = clamp(vUv + (fiber - 0.5) * 0.014 * smoothstep(0.2, 1.0, uProgress), 0.0, 1.0);
  vec4 mask = texture2D(uStampMap, bleedUv);

  // 从印心向外辐射式渗透显影
  float radial = length(centered) * 1.45;
  float reveal = smoothstep(radial - 0.25, radial + 0.05, uProgress * 1.38 - fiber * 0.14);
  float grainDry = smoothstep(0.18, 0.72, fiber + 0.35 * uProgress);

  float alpha = mask.a * reveal * mix(0.76, 0.96, grainDry);
  if (alpha < 0.02) discard;

  vec3 cinnabar = mix(vec3(0.64, 0.16, 0.11), vec3(0.80, 0.26, 0.17), fiber);
  gl_FragColor = vec4(cinnabar, alpha);
  #include <colorspace_fragment>
}
`;

/* ============ 5. 藏品描金釉面流光着色器 ============ */
export const RELIC_FOIL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RELIC_FOIL_FRAG = /* glsl */ `
uniform sampler2D uArtMap;
uniform vec2 uTilt;       // (-1..1) 实时把玩倾角
uniform float uTime;
uniform float uRarity;    // 0=common, 1=rare, 2=legend
varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec4 tex = texture2D(uArtMap, vUv);
  // 宣纸博物托底色
  vec3 paperBg = vec3(0.972, 0.941, 0.866);
  float paperGrain = (hash21(floor(vUv * 220.0)) - 0.5) * 0.024;
  paperBg += paperGrain;

  // 把纹理自然叠放进木框中心安全区
  vec2 frameDist = abs(vUv - 0.5);
  float borderMask = smoothstep(0.46, 0.48, max(frameDist.x, frameDist.y));
  vec3 col = mix(paperBg, tex.rgb, tex.a);

  // 倾角扫光反射（青釉与描金高光）
  vec2 lightDir = normalize(vec2(0.75 + uTilt.x * 0.9, 0.55 - uTilt.y * 0.9));
  float sweepPos = dot(vUv - 0.5, lightDir) - sin(uTime * 0.85) * 0.12 - uTilt.x * 0.25;
  float sheenBand = exp(-sweepPos * sweepPos * 28.0);

  if (uRarity >= 1.5) {
    // 传说流光：金箔 + 青绿琉璃虹彩
    float holo = 0.5 + 0.5 * sin((vUv.x * 9.0 + vUv.y * 7.0) + uTilt.x * 4.5 + uTime * 1.4);
    vec3 glazeCol = mix(vec3(0.95, 0.78, 0.34), vec3(0.45, 0.82, 0.74), holo);
    col += glazeCol * sheenBand * 0.34;
    float foilSpeck = step(0.985, hash21(floor(vUv * 95.0)));
    col += vec3(1.0, 0.86, 0.42) * foilSpeck * (0.25 + sheenBand * 0.75);
  } else if (uRarity >= 0.5) {
    // 稀有描金：温润金丝高光
    col += vec3(0.96, 0.82, 0.46) * sheenBand * 0.24;
  } else {
    // 寻常藏品：柔和瓷面反光
    col += vec3(1.0, 0.98, 0.92) * sheenBand * 0.11;
  }

  // 细描金内框线
  col = mix(col, vec3(0.83, 0.64, 0.31), borderMask * 0.65);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  #include <colorspace_fragment>
}
`;
