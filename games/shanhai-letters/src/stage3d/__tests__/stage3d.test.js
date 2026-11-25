import { describe, expect, it, afterEach } from 'vitest';
import {
  CAMERA_PRESETS,
  DIORAMA_FRAG,
  DIORAMA_VERT,
  GODRAY_FRAG,
  GODRAY_VERT,
  INK_BLEED_FRAG,
  INK_BLEED_VERT,
  LOGICAL_H,
  LOGICAL_W,
  PARTICLE_FRAG,
  PARTICLE_VERT,
  RELIC_FOIL_FRAG,
  RELIC_FOIL_VERT,
  getCameraPreset,
  logicalToWorld,
  worldToLogical
} from '../shaders.js';
import {
  getPlatformAdapter,
  isWebGLAvailable,
  registerPlatformAdapter
} from '../webglAdapter.js';

describe('stage3d shaders and camera presets', () => {
  afterEach(() => {
    registerPlatformAdapter(null);
  });

  it('converts logical stage coordinates symmetrically with Three.js world space', () => {
    const center = logicalToWorld(LOGICAL_W / 2, LOGICAL_H / 2, 0.5);
    expect(center.x).toBeCloseTo(0, 5);
    expect(center.y).toBeCloseTo(0, 5);
    expect(center.z).toBeCloseTo(0.5, 5);

    const topLeft = logicalToWorld(0, 0);
    expect(topLeft.x).toBeCloseTo(-8, 5);
    expect(topLeft.y).toBeCloseTo(5, 5);

    const back = worldToLogical(center.x, center.y);
    expect(back.x).toBeCloseTo(LOGICAL_W / 2, 5);
    expect(back.y).toBeCloseTo(LOGICAL_H / 2, 5);
  });

  it('provides valid camera presets for every interactive tabletop station and scene', () => {
    const modals = [null, 'pack', 'tea', 'shelf', 'codex', 'mail', 'beast', 'settings'];
    ['hall', 'yard'].forEach((scene) => {
      modals.forEach((modal) => {
        const preset = getCameraPreset(modal, scene);
        expect(Number.isFinite(preset.x)).toBe(true);
        expect(Number.isFinite(preset.y)).toBe(true);
        expect(preset.z).toBeGreaterThan(8);
        expect(preset.blur).toBeGreaterThanOrEqual(0);
        expect(preset.blur).toBeLessThanOrEqual(1);
      });
    });

    expect(getCameraPreset('mail', 'yard')).toEqual(CAMERA_PRESETS.mailYard);
    expect(getCameraPreset('mail', 'hall')).toEqual(CAMERA_PRESETS.mailHall);
    expect(getCameraPreset(null, 'hall')).toEqual(CAMERA_PRESETS.default);
  });

  it('exports complete GLSL shaders with expected uniforms', () => {
    expect(DIORAMA_VERT).toContain('gl_Position');
    expect(DIORAMA_FRAG).toContain('uHallMap');
    expect(DIORAMA_FRAG).toContain('uYardMap');
    expect(DIORAMA_FRAG).toContain('uParallax');
    expect(DIORAMA_FRAG).toContain('uFocusBlur');
    expect(DIORAMA_FRAG).toContain('uTimeMix');
    expect(DIORAMA_FRAG).toContain('uRainAmount');

    expect(GODRAY_VERT).toContain('gl_Position');
    expect(GODRAY_FRAG).toContain('uRayColor');

    expect(PARTICLE_VERT).toContain('gl_PointSize');
    expect(PARTICLE_FRAG).toContain('uMode');

    expect(INK_BLEED_VERT).toContain('gl_Position');
    expect(INK_BLEED_FRAG).toContain('uStampMap');
    expect(INK_BLEED_FRAG).toContain('uProgress');

    expect(RELIC_FOIL_VERT).toContain('gl_Position');
    expect(RELIC_FOIL_FRAG).toContain('uTilt');
    expect(RELIC_FOIL_FRAG).toContain('uRarity');
  });

  it('supports registering a custom mini-program WebGL adapter cleanly', () => {
    expect(getPlatformAdapter()).toBeNull();
    // Node 测试环境无 DOM，isWebGLAvailable 应稳定返回 false
    expect(isWebGLAvailable()).toBe(false);

    registerPlatformAdapter({
      isWebGLAvailable: () => true,
      getDevicePixelRatio: () => 2
    });
    expect(isWebGLAvailable()).toBe(true);
  });
});
