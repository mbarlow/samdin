/**
 * postfx.js - Post-processing effects using Three.js EffectComposer
 * Bloom, Outline, Pixelation, Vignette, Chromatic Aberration, Film Grain, Scanlines
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { ReflectorForSSRPass } from 'three/addons/objects/ReflectorForSSRPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Custom pixelation shader
const PixelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    pixelSize: { value: 4 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    varying vec2 vUv;

    void main() {
      vec2 dxy = pixelSize / resolution;
      vec2 coord = dxy * floor(vUv / dxy);
      gl_FragColor = texture2D(tDiffuse, coord);
    }
  `
};

// Vignette shader
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    intensity: { value: 0.5 },
    softness: { value: 0.5 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    uniform float softness;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec2 uv = vUv * (1.0 - vUv);
      float vignette = uv.x * uv.y * 15.0;
      vignette = pow(vignette, softness * 0.5 + 0.1);
      color.rgb = mix(color.rgb * vignette, color.rgb, 1.0 - intensity);
      gl_FragColor = color;
    }
  `
};

// Chromatic Aberration shader
const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0.005 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 offset = amount * (vUv - 0.5);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      float a = texture2D(tDiffuse, vUv).a;
      gl_FragColor = vec4(r, g, b, a);
    }
  `
};

// Film Grain shader
const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.15 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    float random(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = random(vUv + time) * 2.0 - 1.0;
      color.rgb += grain * intensity;
      gl_FragColor = color;
    }
  `
};

// Scanlines shader
const ScanlinesShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    intensity: { value: 0.3 },
    count: { value: 300 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float intensity;
    uniform float count;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float scanline = sin(vUv.y * count * 3.14159) * 0.5 + 0.5;
      scanline = pow(scanline, 1.5);
      color.rgb = mix(color.rgb, color.rgb * scanline, intensity);
      gl_FragColor = color;
    }
  `
};

// Color Grading shader (HSL adjustments)
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    hue: { value: 0 },
    saturation: { value: 1 },
    brightness: { value: 1 },
    contrast: { value: 1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float hue;
    uniform float saturation;
    uniform float brightness;
    uniform float contrast;
    varying vec2 vUv;

    vec3 rgb2hsl(vec3 c) {
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float l = (maxC + minC) / 2.0;
      float s = 0.0;
      float h = 0.0;
      if (maxC != minC) {
        float d = maxC - minC;
        s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
        if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
        else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
        else h = (c.r - c.g) / d + 4.0;
        h /= 6.0;
      }
      return vec3(h, s, l);
    }

    float hue2rgb(float p, float q, float t) {
      if (t < 0.0) t += 1.0;
      if (t > 1.0) t -= 1.0;
      if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
      if (t < 1.0/2.0) return q;
      if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
      return p;
    }

    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x, s = hsl.y, l = hsl.z;
      if (s == 0.0) return vec3(l);
      float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
      float p = 2.0 * l - q;
      return vec3(
        hue2rgb(p, q, h + 1.0/3.0),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1.0/3.0)
      );
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Convert to HSL
      vec3 hsl = rgb2hsl(color.rgb);

      // Apply hue shift
      hsl.x = mod(hsl.x + hue, 1.0);

      // Apply saturation
      hsl.y *= saturation;

      // Convert back to RGB
      vec3 rgb = hsl2rgb(hsl);

      // Apply brightness
      rgb *= brightness;

      // Apply contrast
      rgb = (rgb - 0.5) * contrast + 0.5;

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
    }
  `
};

class PostFXManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.composer = null;
    this.renderPass = null;
    this.ssaoPass = null;
    this.bokehPass = null;
    this.ssrPass = null;
    this.bloomPass = null;
    this.outlinePass = null;
    this.pixelPass = null;
    this.vignettePass = null;
    this.chromaPass = null;
    this.grainPass = null;
    this.scanlinesPass = null;
    this.colorGradePass = null;
    this.fxaaPass = null;
    this.outputPass = null;

    this.enabled = {
      ssao: false,
      dof: false,
      ssr: false,
      bloom: false,
      outline: false,
      pixel: false,
      vignette: false,
      chromatic: false,
      grain: false,
      scanlines: false,
      colorGrade: false,
      fxaa: false
    };

    this.settings = {
      ssao: { kernelRadius: 8, minDistance: 0.005, maxDistance: 0.1 },
      dof: { focus: 5.0, aperture: 0.002, maxblur: 0.01 },
      ssr: { thickness: 0.018, maxDistance: 0.3, opacity: 0.5 },
      bloom: { strength: 1.0, radius: 0.4, threshold: 0.8 },
      outline: { color: 0xffffff, thickness: 2, strength: 3 },
      pixel: { size: 4 },
      vignette: { intensity: 0.5, softness: 0.5 },
      chromatic: { amount: 0.005 },
      grain: { intensity: 0.15 },
      scanlines: { intensity: 0.3, count: 300 },
      colorGrade: { hue: 0, saturation: 1, brightness: 1, contrast: 1 }
    };

    this.startTime = Date.now();
    this.wireframeBypass = false;

    this.init();
  }

  init() {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Create composer
    this.composer = new EffectComposer(this.renderer);

    // Base render pass
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // SSAO pass (Screen-Space Ambient Occlusion)
    this.ssaoPass = new SSAOPass(this.scene, this.camera, size.x, size.y);
    this.ssaoPass.kernelRadius = this.settings.ssao.kernelRadius;
    this.ssaoPass.minDistance = this.settings.ssao.minDistance;
    this.ssaoPass.maxDistance = this.settings.ssao.maxDistance;
    this.ssaoPass.enabled = false;
    this.composer.addPass(this.ssaoPass);

    // Depth of Field (Bokeh) pass
    this.bokehPass = new BokehPass(this.scene, this.camera, {
      focus: this.settings.dof.focus,
      aperture: this.settings.dof.aperture,
      maxblur: this.settings.dof.maxblur
    });
    this.bokehPass.enabled = false;
    this.composer.addPass(this.bokehPass);

    // SSR pass (Screen-Space Reflections)
    try {
      this.ssrPass = new SSRPass({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width: size.x,
        height: size.y,
        groundReflector: null,
        selects: null
      });
      this.ssrPass.thickness = this.settings.ssr.thickness;
      this.ssrPass.maxDistance = this.settings.ssr.maxDistance;
      this.ssrPass.opacity = this.settings.ssr.opacity;
      this.ssrPass.enabled = false;
      this.composer.addPass(this.ssrPass);
    } catch (e) {
      console.warn('SSR pass not available:', e.message);
      this.ssrPass = null;
    }

    // Bloom pass
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      this.settings.bloom.strength,
      this.settings.bloom.radius,
      this.settings.bloom.threshold
    );
    this.bloomPass.enabled = false;
    this.composer.addPass(this.bloomPass);

    // Outline pass
    this.outlinePass = new OutlinePass(
      new THREE.Vector2(size.x, size.y),
      this.scene,
      this.camera
    );
    this.outlinePass.visibleEdgeColor.set(this.settings.outline.color);
    this.outlinePass.edgeThickness = this.settings.outline.thickness;
    this.outlinePass.edgeStrength = this.settings.outline.strength;
    this.outlinePass.enabled = false;
    this.composer.addPass(this.outlinePass);

    // Color grade pass
    this.colorGradePass = new ShaderPass(ColorGradeShader);
    this.colorGradePass.enabled = false;
    this.composer.addPass(this.colorGradePass);

    // Vignette pass
    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.enabled = false;
    this.composer.addPass(this.vignettePass);

    // Chromatic aberration pass
    this.chromaPass = new ShaderPass(ChromaticAberrationShader);
    this.chromaPass.enabled = false;
    this.composer.addPass(this.chromaPass);

    // Film grain pass
    this.grainPass = new ShaderPass(FilmGrainShader);
    this.grainPass.enabled = false;
    this.composer.addPass(this.grainPass);

    // Scanlines pass
    this.scanlinesPass = new ShaderPass(ScanlinesShader);
    this.scanlinesPass.uniforms.resolution.value.set(size.x, size.y);
    this.scanlinesPass.enabled = false;
    this.composer.addPass(this.scanlinesPass);

    // Pixel pass
    this.pixelPass = new ShaderPass(PixelShader);
    this.pixelPass.uniforms.resolution.value.set(size.x, size.y);
    this.pixelPass.uniforms.pixelSize.value = this.settings.pixel.size;
    this.pixelPass.enabled = false;
    this.composer.addPass(this.pixelPass);

    // FXAA pass
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.fxaaPass.uniforms['resolution'].value.set(1/size.x, 1/size.y);
    this.fxaaPass.enabled = false;
    this.composer.addPass(this.fxaaPass);

    // Output pass (color space correction)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  setSSAO(enabled, settings = {}) {
    this.enabled.ssao = enabled;
    this.ssaoPass.enabled = enabled;

    if (settings.kernelRadius !== undefined) {
      this.ssaoPass.kernelRadius = settings.kernelRadius;
      this.settings.ssao.kernelRadius = settings.kernelRadius;
    }
    if (settings.minDistance !== undefined) {
      this.ssaoPass.minDistance = settings.minDistance;
      this.settings.ssao.minDistance = settings.minDistance;
    }
    if (settings.maxDistance !== undefined) {
      this.ssaoPass.maxDistance = settings.maxDistance;
      this.settings.ssao.maxDistance = settings.maxDistance;
    }
  }

  setDOF(enabled, settings = {}) {
    this.enabled.dof = enabled;
    this.bokehPass.enabled = enabled;

    if (settings.focus !== undefined) {
      this.bokehPass.uniforms['focus'].value = settings.focus;
      this.settings.dof.focus = settings.focus;
    }
    if (settings.aperture !== undefined) {
      this.bokehPass.uniforms['aperture'].value = settings.aperture;
      this.settings.dof.aperture = settings.aperture;
    }
    if (settings.maxblur !== undefined) {
      this.bokehPass.uniforms['maxblur'].value = settings.maxblur;
      this.settings.dof.maxblur = settings.maxblur;
    }
  }

  setSSR(enabled, settings = {}) {
    if (!this.ssrPass) return;
    this.enabled.ssr = enabled;
    this.ssrPass.enabled = enabled;

    if (settings.thickness !== undefined) {
      this.ssrPass.thickness = settings.thickness;
      this.settings.ssr.thickness = settings.thickness;
    }
    if (settings.maxDistance !== undefined) {
      this.ssrPass.maxDistance = settings.maxDistance;
      this.settings.ssr.maxDistance = settings.maxDistance;
    }
    if (settings.opacity !== undefined) {
      this.ssrPass.opacity = settings.opacity;
      this.settings.ssr.opacity = settings.opacity;
    }
  }

  setBloom(enabled, settings = {}) {
    this.enabled.bloom = enabled;
    this.bloomPass.enabled = enabled;

    if (settings.strength !== undefined) {
      this.bloomPass.strength = settings.strength;
      this.settings.bloom.strength = settings.strength;
    }
    if (settings.radius !== undefined) {
      this.bloomPass.radius = settings.radius;
      this.settings.bloom.radius = settings.radius;
    }
    if (settings.threshold !== undefined) {
      this.bloomPass.threshold = settings.threshold;
      this.settings.bloom.threshold = settings.threshold;
    }
  }

  setOutline(enabled, settings = {}) {
    this.enabled.outline = enabled;
    this.outlinePass.enabled = enabled;

    if (settings.color !== undefined) {
      this.outlinePass.visibleEdgeColor.set(settings.color);
      this.settings.outline.color = settings.color;
    }
    if (settings.thickness !== undefined) {
      this.outlinePass.edgeThickness = settings.thickness;
      this.settings.outline.thickness = settings.thickness;
    }
    if (settings.strength !== undefined) {
      this.outlinePass.edgeStrength = settings.strength;
      this.settings.outline.strength = settings.strength;
    }
  }

  setOutlineObjects(objects) {
    this.outlinePass.selectedObjects = objects;
  }

  setPixel(enabled, settings = {}) {
    this.enabled.pixel = enabled;
    this.pixelPass.enabled = enabled;

    if (settings.size !== undefined) {
      this.pixelPass.uniforms.pixelSize.value = settings.size;
      this.settings.pixel.size = settings.size;
    }
  }

  setVignette(enabled, settings = {}) {
    this.enabled.vignette = enabled;
    this.vignettePass.enabled = enabled;

    if (settings.intensity !== undefined) {
      this.vignettePass.uniforms.intensity.value = settings.intensity;
      this.settings.vignette.intensity = settings.intensity;
    }
    if (settings.softness !== undefined) {
      this.vignettePass.uniforms.softness.value = settings.softness;
      this.settings.vignette.softness = settings.softness;
    }
  }

  setChromatic(enabled, settings = {}) {
    this.enabled.chromatic = enabled;
    this.chromaPass.enabled = enabled;

    if (settings.amount !== undefined) {
      this.chromaPass.uniforms.amount.value = settings.amount;
      this.settings.chromatic.amount = settings.amount;
    }
  }

  setGrain(enabled, settings = {}) {
    this.enabled.grain = enabled;
    this.grainPass.enabled = enabled;

    if (settings.intensity !== undefined) {
      this.grainPass.uniforms.intensity.value = settings.intensity;
      this.settings.grain.intensity = settings.intensity;
    }
  }

  setScanlines(enabled, settings = {}) {
    this.enabled.scanlines = enabled;
    this.scanlinesPass.enabled = enabled;

    if (settings.intensity !== undefined) {
      this.scanlinesPass.uniforms.intensity.value = settings.intensity;
      this.settings.scanlines.intensity = settings.intensity;
    }
    if (settings.count !== undefined) {
      this.scanlinesPass.uniforms.count.value = settings.count;
      this.settings.scanlines.count = settings.count;
    }
  }

  setColorGrade(enabled, settings = {}) {
    this.enabled.colorGrade = enabled;
    this.colorGradePass.enabled = enabled;

    if (settings.hue !== undefined) {
      this.colorGradePass.uniforms.hue.value = settings.hue;
      this.settings.colorGrade.hue = settings.hue;
    }
    if (settings.saturation !== undefined) {
      this.colorGradePass.uniforms.saturation.value = settings.saturation;
      this.settings.colorGrade.saturation = settings.saturation;
    }
    if (settings.brightness !== undefined) {
      this.colorGradePass.uniforms.brightness.value = settings.brightness;
      this.settings.colorGrade.brightness = settings.brightness;
    }
    if (settings.contrast !== undefined) {
      this.colorGradePass.uniforms.contrast.value = settings.contrast;
      this.settings.colorGrade.contrast = settings.contrast;
    }
  }

  setFXAA(enabled) {
    this.enabled.fxaa = enabled;
    this.fxaaPass.enabled = enabled;
  }

  reset() {
    this.setSSAO(false, this.settings.ssao);
    this.setDOF(false, this.settings.dof);
    this.setSSR(false, this.settings.ssr);
    this.setBloom(false, this.settings.bloom);
    this.setOutline(false, this.settings.outline);
    this.setPixel(false, this.settings.pixel);
    this.setVignette(false, this.settings.vignette);
    this.setChromatic(false, this.settings.chromatic);
    this.setGrain(false, this.settings.grain);
    this.setScanlines(false, this.settings.scanlines);
    this.setColorGrade(false, this.settings.colorGrade);
    this.setFXAA(false);
  }

  applyConfig(config = {}) {
    const effects = [
      ['ssao', this.setSSAO.bind(this)],
      ['dof', this.setDOF.bind(this)],
      ['ssr', this.setSSR.bind(this)],
      ['bloom', this.setBloom.bind(this)],
      ['outline', this.setOutline.bind(this)],
      ['pixel', this.setPixel.bind(this)],
      ['vignette', this.setVignette.bind(this)],
      ['chromatic', this.setChromatic.bind(this)],
      ['grain', this.setGrain.bind(this)],
      ['scanlines', this.setScanlines.bind(this)],
      ['colorGrade', this.setColorGrade.bind(this)]
    ];

    for (const [key, setter] of effects) {
      if (!(key in config)) continue;
      const value = config[key];
      if (typeof value === 'boolean') {
        setter(value, this.settings[key] || {});
      } else {
        setter(value.enabled !== false, value);
      }
    }

    if ('fxaa' in config) {
      this.setFXAA(typeof config.fxaa === 'object' ? config.fxaa.enabled !== false : !!config.fxaa);
    }
  }

  isActive() {
    return Object.values(this.enabled).some(v => v);
  }

  render() {
    // Update time-based uniforms
    if (this.enabled.grain) {
      this.grainPass.uniforms.time.value = (Date.now() - this.startTime) * 0.001;
    }

    if (this.isActive() && !this.wireframeBypass) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize(width, height) {
    this.composer.setSize(width, height);
    this.ssaoPass.setSize(width, height);
    if (this.ssrPass) this.ssrPass.setSize(width, height);
    this.pixelPass.uniforms.resolution.value.set(width, height);
    this.scanlinesPass.uniforms.resolution.value.set(width, height);
    this.fxaaPass.uniforms['resolution'].value.set(1/width, 1/height);
  }
}

export { PostFXManager };
