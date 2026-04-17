/**
 * lighting.js - Lighting preset configurations
 * Named presets for different moods/scenarios, environment maps for IBL
 */
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const PRESETS = {
  studio: {
    name: 'Studio',
    ambient: { color: 0x404050, intensity: 0.4 },
    lights: [
      { type: 'directional', color: 0xffffff, intensity: 1.0, position: [5, 8, 5], shadow: true },
      { type: 'directional', color: 0x8080ff, intensity: 0.3, position: [-3, 4, -3], shadow: false },
      { type: 'point', color: 0xffffff, intensity: 0.2, position: [0, 3, 0] }
    ]
  },

  sunset: {
    name: 'Sunset',
    ambient: { color: 0x1a1020, intensity: 0.3 },
    lights: [
      { type: 'directional', color: 0xff8844, intensity: 1.2, position: [8, 2, 3], shadow: true },
      { type: 'directional', color: 0xff4422, intensity: 0.4, position: [5, 1, 5], shadow: false },
      { type: 'hemisphere', skyColor: 0xff7744, groundColor: 0x221122, intensity: 0.5 }
    ]
  },

  night: {
    name: 'Night',
    ambient: { color: 0x101020, intensity: 0.2 },
    lights: [
      { type: 'directional', color: 0x4466aa, intensity: 0.5, position: [3, 8, 3], shadow: true },
      { type: 'point', color: 0x6688cc, intensity: 0.3, position: [0, 4, 0] },
      { type: 'hemisphere', skyColor: 0x112244, groundColor: 0x080810, intensity: 0.4 }
    ]
  },

  overcast: {
    name: 'Overcast',
    ambient: { color: 0x606070, intensity: 0.6 },
    lights: [
      { type: 'directional', color: 0xaaaaaa, intensity: 0.6, position: [0, 10, 0], shadow: true },
      { type: 'hemisphere', skyColor: 0x888899, groundColor: 0x444455, intensity: 0.5 }
    ]
  },

  dramatic: {
    name: 'Dramatic',
    ambient: { color: 0x101010, intensity: 0.1 },
    lights: [
      { type: 'spot', color: 0xffffff, intensity: 2.0, position: [3, 6, 2], target: [0, 0, 0], angle: 0.4, shadow: true },
      { type: 'point', color: 0x4444ff, intensity: 0.3, position: [-3, 1, -2] }
    ]
  },

  neon: {
    name: 'Neon',
    ambient: { color: 0x100510, intensity: 0.2 },
    lights: [
      { type: 'point', color: 0xff00ff, intensity: 1.0, position: [3, 2, 0] },
      { type: 'point', color: 0x00ffff, intensity: 1.0, position: [-3, 2, 0] },
      { type: 'point', color: 0xffff00, intensity: 0.5, position: [0, 4, 3] },
      { type: 'directional', color: 0xffffff, intensity: 0.3, position: [0, 5, 0], shadow: true }
    ]
  },

  cyberpunk: {
    name: 'Cyberpunk',
    ambient: { color: 0x050510, intensity: 0.15 },
    lights: [
      { type: 'point', color: 0xff0066, intensity: 1.5, position: [4, 1, 2] },
      { type: 'point', color: 0x00ccff, intensity: 1.5, position: [-4, 1, -2] },
      { type: 'spot', color: 0x9900ff, intensity: 1.0, position: [0, 6, 0], target: [0, 0, 0], angle: 0.6, shadow: true },
      { type: 'directional', color: 0x220033, intensity: 0.2, position: [0, 3, 5], shadow: false }
    ]
  },

  warm: {
    name: 'Warm',
    ambient: { color: 0x2a1810, intensity: 0.3 },
    lights: [
      { type: 'directional', color: 0xffcc88, intensity: 1.0, position: [4, 6, 4], shadow: true },
      { type: 'point', color: 0xff8844, intensity: 0.5, position: [-2, 2, 2] },
      { type: 'hemisphere', skyColor: 0xffddaa, groundColor: 0x221100, intensity: 0.4 }
    ]
  },

  cool: {
    name: 'Cool',
    ambient: { color: 0x101828, intensity: 0.3 },
    lights: [
      { type: 'directional', color: 0x88ccff, intensity: 1.0, position: [4, 6, 4], shadow: true },
      { type: 'point', color: 0x4488cc, intensity: 0.5, position: [-2, 2, 2] },
      { type: 'hemisphere', skyColor: 0xaaddff, groundColor: 0x001122, intensity: 0.4 }
    ]
  },

  rim: {
    name: 'Rim Light',
    ambient: { color: 0x080808, intensity: 0.1 },
    lights: [
      { type: 'directional', color: 0xffffff, intensity: 0.3, position: [0, 5, 5], shadow: true },
      { type: 'directional', color: 0xffffcc, intensity: 1.5, position: [-5, 3, -3], shadow: false },
      { type: 'directional', color: 0xccffff, intensity: 1.5, position: [5, 3, -3], shadow: false }
    ]
  },

  backlit: {
    name: 'Backlit',
    ambient: { color: 0x101020, intensity: 0.15 },
    lights: [
      { type: 'directional', color: 0xffffff, intensity: 2.0, position: [0, 4, -6], shadow: true },
      { type: 'directional', color: 0x8888ff, intensity: 0.3, position: [3, 2, 3], shadow: false },
      { type: 'hemisphere', skyColor: 0x334455, groundColor: 0x111122, intensity: 0.3 }
    ]
  },

  goldenHour: {
    name: 'Golden Hour',
    ambient: { color: 0x1a1510, intensity: 0.25 },
    lights: [
      { type: 'directional', color: 0xffaa55, intensity: 1.4, position: [10, 2, 4], shadow: true },
      { type: 'directional', color: 0xff8833, intensity: 0.6, position: [8, 1, 2], shadow: false },
      { type: 'hemisphere', skyColor: 0xffcc88, groundColor: 0x332211, intensity: 0.4 },
      { type: 'point', color: 0xffddaa, intensity: 0.3, position: [-3, 1, 0] }
    ]
  },

  noir: {
    name: 'Film Noir',
    ambient: { color: 0x050505, intensity: 0.05 },
    lights: [
      { type: 'spot', color: 0xffffff, intensity: 2.5, position: [4, 8, 0], target: [0, 0, 0], angle: 0.3, shadow: true },
      { type: 'point', color: 0x222233, intensity: 0.2, position: [-2, 1, 2] }
    ]
  },

  underwater: {
    name: 'Underwater',
    ambient: { color: 0x051525, intensity: 0.4 },
    lights: [
      { type: 'directional', color: 0x00aacc, intensity: 0.8, position: [0, 10, 0], shadow: true },
      { type: 'point', color: 0x00ffcc, intensity: 0.4, position: [3, 2, 3] },
      { type: 'point', color: 0x0066aa, intensity: 0.3, position: [-3, 1, -3] },
      { type: 'hemisphere', skyColor: 0x00aaff, groundColor: 0x001122, intensity: 0.5 }
    ]
  },

  horror: {
    name: 'Horror',
    ambient: { color: 0x080505, intensity: 0.1 },
    lights: [
      { type: 'point', color: 0xff2200, intensity: 0.8, position: [0, -1, 0] },
      { type: 'spot', color: 0xffcc00, intensity: 0.5, position: [3, 4, 3], target: [0, 1, 0], angle: 0.5, shadow: true },
      { type: 'directional', color: 0x330000, intensity: 0.2, position: [-3, 2, -3], shadow: false }
    ]
  },

  industrialRuin: {
    name: 'Industrial Ruin',
    ambient: { color: 0x111316, intensity: 0.2 },
    lights: [
      { type: 'directional', color: 0xd8d5cf, intensity: 0.9, position: [-6, 10, 4], shadow: true },
      { type: 'spot', color: 0xff6b42, intensity: 0.7, position: [0, 8, 0], target: [0, 0, 0], angle: 0.35, shadow: false },
      { type: 'point', color: 0xff5233, intensity: 0.4, position: [0, 2, 0] },
      { type: 'hemisphere', skyColor: 0xb8c1ca, groundColor: 0x0d0c0a, intensity: 0.3 }
    ]
  },

  showcase: {
    name: 'Showcase',
    ambient: { color: 0x606878, intensity: 0.6 },
    lights: [
      { type: 'directional', color: 0xfff8f0, intensity: 1.2, position: [5, 8, 5], shadow: true },
      { type: 'directional', color: 0xc8d0e0, intensity: 0.5, position: [-4, 5, -3], shadow: false },
      { type: 'directional', color: 0xe0d8c8, intensity: 0.3, position: [0, 2, -5], shadow: false },
      { type: 'hemisphere', skyColor: 0xd0d8e8, groundColor: 0x303038, intensity: 0.5 }
    ]
  }
};

// Procedural environment map presets (generated via PMREMGenerator)
const ENV_PRESETS = {
  none:    { name: 'None' },
  studio:  { name: 'Studio',  sky: 0xc8ccd4, ground: 0x404448, horizon: 0x888890, sunColor: 0xfff8f0, sunIntensity: 0.6, sunPos: [5, 8, 5] },
  outdoor: { name: 'Outdoor', sky: 0x88aadd, ground: 0x556644, horizon: 0xccddee, sunColor: 0xffffee, sunIntensity: 1.0, sunPos: [8, 10, 4] },
  sunset:  { name: 'Sunset',  sky: 0x443355, ground: 0x221111, horizon: 0xff8844, sunColor: 0xff7733, sunIntensity: 1.2, sunPos: [10, 2, 3] },
  night:   { name: 'Night',   sky: 0x0a0a18, ground: 0x060608, horizon: 0x182040, sunColor: 0x4466aa, sunIntensity: 0.3, sunPos: [3, 8, 3] }
};

class LightingManager {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.lights = [];
    this.ambient = null;
    this.intensityMultiplier = 1.0;
    this.currentPreset = null;
    this.keyLight = null;
    this.keyLightHelper = null;
    this.shadowQuality = 'medium';
    this.envMap = null;
    this.envMapIntensity = 1.0;
    this.currentEnvPreset = 'none';
    this.pmremGenerator = renderer ? new THREE.PMREMGenerator(renderer) : null;
    if (this.pmremGenerator) this.pmremGenerator.compileEquirectangularShader();
  }
  
  applyPreset(presetName) {
    this.applyConfig({ preset: presetName });
  }

  applyConfig(config = {}) {
    const preset = config.preset ? PRESETS[config.preset] : null;
    if (config.preset && !preset) {
      console.warn(`Unknown lighting preset: ${config.preset}`);
    }

    const ambientDef = config.ambient || preset?.ambient || { color: 0x404050, intensity: 0.4 };
    const lightDefs = config.lights || preset?.lights || [];

    this.clearLights();
    this.keyLight = null;
    this.intensityMultiplier = config.intensity ?? 1.0;

    this.ambient = new THREE.AmbientLight(
      ambientDef.color,
      (ambientDef.intensity ?? 0.4) * this.intensityMultiplier
    );
    this.scene.add(this.ambient);

    for (const lightDef of lightDefs) {
      const light = this.createLight(lightDef);
      if (!light) continue;

      this.lights.push(light);
      this.scene.add(light);

      if (!this.keyLight && lightDef.shadow) {
        this.keyLight = light;
      }

      if (light.target) {
        this.scene.add(light.target);
      }
    }

    this.currentPreset = config.preset || null;

    if (config.shadowQuality) {
      this.setShadowQuality(config.shadowQuality);
    }

    if (config.keyLightPosition) {
      this.setKeyLightPosition(
        config.keyLightPosition.azimuth ?? 35,
        config.keyLightPosition.elevation ?? 45,
        config.keyLightPosition.distance ?? 8
      );
    }

    if (config.keyLightColor) {
      this.setKeyLightColor(config.keyLightColor);
    }

    if (config.ambientColor) {
      this.setAmbientColor(config.ambientColor);
    }

    if (config.ambientIntensity !== undefined) {
      this.setAmbientIntensity(config.ambientIntensity);
    }
  }

  reset() {
    this.clearEnvironment();
    this.applyConfig({ preset: 'studio', intensity: 1, shadowQuality: 'medium' });
  }
  
  createLight(def) {
    let light;
    
    switch (def.type) {
      case 'directional':
        light = new THREE.DirectionalLight(def.color, def.intensity * this.intensityMultiplier);
        light.position.set(...def.position);
        if (def.shadow) {
          light.castShadow = true;
          light.shadow.mapSize.width = 1024;
          light.shadow.mapSize.height = 1024;
          light.shadow.camera.near = 0.5;
          light.shadow.camera.far = 50;
          light.shadow.camera.left = -10;
          light.shadow.camera.right = 10;
          light.shadow.camera.top = 10;
          light.shadow.camera.bottom = -10;
          light.shadow.bias = -0.0001;
        }
        break;
        
      case 'point':
        light = new THREE.PointLight(def.color, def.intensity * this.intensityMultiplier);
        light.position.set(...def.position);
        break;
        
      case 'spot':
        light = new THREE.SpotLight(def.color, def.intensity * this.intensityMultiplier);
        light.position.set(...def.position);
        light.angle = def.angle || 0.5;
        light.penumbra = 0.3;
        if (def.target) {
          light.target.position.set(...def.target);
        }
        if (def.shadow) {
          light.castShadow = true;
          light.shadow.mapSize.width = 1024;
          light.shadow.mapSize.height = 1024;
        }
        break;
        
      case 'hemisphere':
        light = new THREE.HemisphereLight(
          def.skyColor,
          def.groundColor,
          def.intensity * this.intensityMultiplier
        );
        break;
        
      default:
        console.warn(`Unknown light type: ${def.type}`);
        return null;
    }
    
    return light;
  }
  
  setIntensity(multiplier) {
    this.intensityMultiplier = multiplier;
    
    // Update existing lights
    if (this.ambient) {
      const preset = PRESETS[this.currentPreset];
      this.ambient.intensity = preset.ambient.intensity * multiplier;
    }
    
    // Re-apply preset to update all lights
    if (this.currentPreset) {
      this.applyPreset(this.currentPreset);
    }
  }
  
  clearLights() {
    if (this.ambient) {
      this.scene.remove(this.ambient);
      this.ambient = null;
    }
    
    for (const light of this.lights) {
      this.scene.remove(light);
      if (light.target) {
        this.scene.remove(light.target);
      }
    }
    
    this.lights = [];
  }
  
  getPresetNames() {
    return Object.keys(PRESETS);
  }

  /**
   * Set key light position using spherical coordinates
   * @param {number} azimuth - Horizontal angle in degrees (0-360)
   * @param {number} elevation - Vertical angle in degrees (0-90)
   * @param {number} distance - Distance from origin
   */
  setKeyLightPosition(azimuth, elevation, distance = 8) {
    if (!this.keyLight) return;

    const azimuthRad = (azimuth * Math.PI) / 180;
    const elevationRad = (elevation * Math.PI) / 180;

    const x = distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
    const y = distance * Math.sin(elevationRad);
    const z = distance * Math.cos(elevationRad) * Math.cos(azimuthRad);

    this.keyLight.position.set(x, y, z);
  }

  /**
   * Set key light color
   * @param {number|string} color - Hex color value
   */
  setKeyLightColor(color) {
    if (!this.keyLight) return;
    this.keyLight.color.set(color);
  }

  /**
   * Set shadow quality
   * @param {'low'|'medium'|'high'|'ultra'} quality
   */
  setShadowQuality(quality) {
    this.shadowQuality = quality;

    const sizes = {
      low: 512,
      medium: 1024,
      high: 2048,
      ultra: 4096
    };

    const mapSize = sizes[quality] || 1024;

    for (const light of this.lights) {
      if (light.castShadow) {
        light.shadow.mapSize.width = mapSize;
        light.shadow.mapSize.height = mapSize;
        light.shadow.map?.dispose();
        light.shadow.map = null;
      }
    }
  }

  /**
   * Get the key light for external manipulation
   */
  getKeyLight() {
    return this.keyLight;
  }

  /**
   * Set ambient light color
   * @param {number|string} color - Hex color value
   */
  setAmbientColor(color) {
    if (this.ambient) {
      this.ambient.color.set(color);
    }
  }

  /**
   * Set ambient light intensity
   * @param {number} intensity - 0 to 1
   */
  setAmbientIntensity(intensity) {
    if (this.ambient) {
      this.ambient.intensity = intensity;
    }
  }

  /**
   * Get available environment preset names
   */
  getEnvPresetNames() {
    return Object.keys(ENV_PRESETS);
  }

  /**
   * Apply a procedural environment map preset
   * @param {string} presetName - Name from ENV_PRESETS
   */
  setEnvironment(presetName) {
    this.currentEnvPreset = presetName;

    if (presetName === 'none' || !presetName) {
      this.clearEnvironment();
      return;
    }

    const preset = ENV_PRESETS[presetName];
    if (!preset) {
      console.warn(`Unknown env preset: ${presetName}`);
      return;
    }

    if (!this.pmremGenerator) return;

    // Build a simple scene to generate the env map
    const envScene = new THREE.Scene();

    // Sky dome (upper hemisphere)
    const skyGeo = new THREE.SphereGeometry(50, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const skyMat = new THREE.MeshBasicMaterial({ color: preset.sky, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    // Ground dome (lower hemisphere)
    const groundGeo = new THREE.SphereGeometry(50, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({ color: preset.ground, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(groundGeo, groundMat));

    // Horizon band
    const bandGeo = new THREE.TorusGeometry(50, 2.5, 8, 64);
    const bandMat = new THREE.MeshBasicMaterial({ color: preset.horizon });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    envScene.add(band);

    // Sun/key light spot
    if (preset.sunColor) {
      const sunGeo = new THREE.SphereGeometry(3, 16, 16);
      const sunMat = new THREE.MeshBasicMaterial({ color: preset.sunColor });
      const sun = new THREE.Mesh(sunGeo, sunMat);
      const sp = preset.sunPos;
      const sunDir = new THREE.Vector3(sp[0], sp[1], sp[2]).normalize().multiplyScalar(48);
      sun.position.copy(sunDir);
      envScene.add(sun);
    }

    // Generate and apply
    const renderTarget = this.pmremGenerator.fromScene(envScene, 0.04);
    const oldEnv = this.envMap;

    this.envMap = renderTarget.texture;
    this.scene.environment = this.envMap;

    // Clean up
    if (oldEnv) oldEnv.dispose();
    envScene.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  /**
   * Set environment map intensity on all scene materials
   * @param {number} intensity
   */
  setEnvMapIntensity(intensity) {
    this.envMapIntensity = intensity;
    this.scene.traverse(child => {
      if (child.isMesh && child.material && child.material.isMeshStandardMaterial) {
        child.material.envMapIntensity = intensity;
        child.material.needsUpdate = true;
      }
    });
  }

  /**
   * Clear environment map
   */
  clearEnvironment() {
    this.scene.environment = null;
    if (this.envMap) {
      this.envMap.dispose();
      this.envMap = null;
    }
    this.currentEnvPreset = 'none';
  }
}

export { LightingManager, PRESETS };
