/**
 * animations.js - Animation system
 * Supports both anime.js behaviors and GLTF clip animations
 */
import * as THREE from 'three';
import { SpecAnimator, isNewAnimationFormat } from './spec-animator.js';

// anime is loaded globally from CDN

/**
 * Animation behavior definitions
 * Each returns an anime.js timeline or animation instance
 */
const Behaviors = {
  /**
   * Idle bobbing motion
   */
  idle(target, options = {}) {
    const amplitude = options.amplitude || 0.05;
    const duration = options.duration || 2000;
    const baseY = target.position.y;
    
    return anime({
      targets: target.position,
      y: [baseY, baseY + amplitude, baseY],
      duration: duration,
      easing: 'easeInOutSine',
      loop: true
    });
  },
  
  /**
   * Breathing glow effect for emissive materials
   */
  breathe(target, options = {}) {
    const minIntensity = options.min || 0.5;
    const maxIntensity = options.max || 2.0;
    const duration = options.duration || 3000;
    
    // Find emissive materials in target
    const materials = [];
    target.traverse((child) => {
      if (child.isMesh && child.material.emissive) {
        materials.push(child.material);
      }
    });
    
    if (materials.length === 0) return null;
    
    // Create animation objects for each material
    const animTargets = materials.map(m => ({ intensity: m.emissiveIntensity }));
    
    return anime({
      targets: animTargets,
      intensity: [minIntensity, maxIntensity, minIntensity],
      duration: duration,
      easing: 'easeInOutSine',
      loop: true,
      update: () => {
        animTargets.forEach((t, i) => {
          materials[i].emissiveIntensity = t.intensity;
        });
      }
    });
  },
  
  /**
   * Spin 360 degrees
   */
  spin(target, options = {}) {
    const duration = options.duration || 1000;
    const axis = options.axis || 'y';
    
    const rotation = { value: 0 };
    const startRotation = target.rotation[axis];
    
    return anime({
      targets: rotation,
      value: Math.PI * 2,
      duration: duration,
      easing: 'easeInOutQuad',
      update: () => {
        target.rotation[axis] = startRotation + rotation.value;
      },
      complete: () => {
        target.rotation[axis] = startRotation;
      }
    });
  },
  
  /**
   * Shake nervously
   */
  shake(target, options = {}) {
    const intensity = options.intensity || 0.03;
    const duration = options.duration || 500;
    const basePos = { x: target.position.x, z: target.position.z };
    
    return anime({
      targets: target.position,
      x: [
        basePos.x,
        basePos.x + intensity,
        basePos.x - intensity,
        basePos.x + intensity * 0.5,
        basePos.x - intensity * 0.5,
        basePos.x
      ],
      z: [
        basePos.z,
        basePos.z - intensity * 0.5,
        basePos.z + intensity,
        basePos.z - intensity * 0.5,
        basePos.z + intensity * 0.5,
        basePos.z
      ],
      duration: duration,
      easing: 'easeInOutQuad',
      loop: options.loop || false
    });
  },
  
  /**
   * Sweep/scan rotation - looking around
   */
  sweep(target, options = {}) {
    const angle = options.angle || 45; // degrees
    const duration = options.duration || 3000;
    const baseY = target.rotation.y;
    const rad = (angle * Math.PI) / 180;
    
    return anime({
      targets: target.rotation,
      y: [baseY, baseY + rad, baseY, baseY - rad, baseY],
      duration: duration,
      easing: 'easeInOutSine',
      loop: true
    });
  },
  
  /**
   * Excited jump and spin
   */
  excited(target, options = {}) {
    const jumpHeight = options.height || 0.3;
    const duration = options.duration || 1500;
    const baseY = target.position.y;
    
    const timeline = anime.timeline({
      easing: 'easeOutQuad'
    });
    
    // Jump up while spinning
    timeline.add({
      targets: target.position,
      y: baseY + jumpHeight,
      duration: duration * 0.3
    });
    
    timeline.add({
      targets: target.rotation,
      y: target.rotation.y + Math.PI * 2,
      duration: duration * 0.5
    }, 0);
    
    // Come back down
    timeline.add({
      targets: target.position,
      y: baseY,
      duration: duration * 0.3,
      easing: 'easeInQuad'
    });
    
    return timeline;
  },
  
  /**
   * Wobble and fall over (scared/damaged)
   */
  wobbleFall(target, options = {}) {
    const duration = options.duration || 2000;
    const baseY = target.position.y;
    
    const timeline = anime.timeline({
      easing: 'easeInOutQuad'
    });
    
    // Wobble
    timeline.add({
      targets: target.rotation,
      z: [0, 0.1, -0.15, 0.2, -0.25, 0.3],
      duration: duration * 0.6
    });
    
    // Fall
    timeline.add({
      targets: target.rotation,
      z: Math.PI / 2,
      duration: duration * 0.2,
      easing: 'easeInQuad'
    });
    
    // Drop
    timeline.add({
      targets: target.position,
      y: baseY - 0.3,
      duration: duration * 0.2,
      easing: 'easeInQuad'
    }, `-=${duration * 0.1}`);
    
    return timeline;
  },
  
  /**
   * Pulse - radial scale pulse
   */
  pulse(target, options = {}) {
    const scale = options.scale || 1.1;
    const duration = options.duration || 500;
    
    return anime({
      targets: target.scale,
      x: [1, scale, 1],
      y: [1, scale, 1],
      z: [1, scale, 1],
      duration: duration,
      easing: 'easeOutElastic(1, .5)'
    });
  }
};

/**
 * Animation controller - manages active animations on a model
 * Supports both anime.js behaviors and GLTF clip animations
 */
class AnimationController {
  constructor() {
    this.activeAnimations = new Map();
    this.mixer = null;
    this.currentModel = null;
    this.clips = [];
    this.activeAction = null;
    this.clock = new THREE.Clock();
  }

  /**
   * Set the current model and extract its animations
   * @param {THREE.Object3D} model
   * @returns {string[]} Array of animation clip names
   */
  setModel(model) {
    // Stop any existing animations
    this.stopEverything();

    this.currentModel = model;
    this.clips = [];

    // Check for GLTF animations
    if (model.userData.animations && model.userData.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(model);
      this.clips = model.userData.animations;
      console.log(`[Animations] Found ${this.clips.length} animation clips:`, this.clips.map(c => c.name));
    } else {
      this.mixer = null;
    }

    return this.getClipNames();
  }

  /**
   * Get names of available GLTF animation clips
   * @returns {string[]}
   */
  getClipNames() {
    return this.clips.map((clip, index) => clip.name || `Animation ${index + 1}`);
  }

  /**
   * Check if model has GLTF animations
   * @returns {boolean}
   */
  hasClips() {
    return this.clips.length > 0;
  }

  /**
   * Play a GLTF animation clip by name or index
   * @param {string|number} nameOrIndex
   * @param {object} options - { loop, timeScale, clampWhenFinished }
   */
  playClip(nameOrIndex, options = {}) {
    if (!this.mixer || this.clips.length === 0) {
      console.warn('No animation clips available');
      return null;
    }

    // Find the clip
    let clip;
    if (typeof nameOrIndex === 'number') {
      clip = this.clips[nameOrIndex];
    } else {
      clip = this.clips.find(c => c.name === nameOrIndex);
      if (!clip) {
        // Try matching by index in name
        const index = parseInt(nameOrIndex.replace('Animation ', '')) - 1;
        clip = this.clips[index];
      }
    }

    if (!clip) {
      console.warn(`Animation clip not found: ${nameOrIndex}`);
      return null;
    }

    // Stop current action if playing
    if (this.activeAction) {
      this.activeAction.fadeOut(0.2);
    }

    // Create and play the action
    const action = this.mixer.clipAction(clip);

    // Configure options
    if (options.loop === false) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = options.clampWhenFinished !== false;
    } else {
      action.setLoop(THREE.LoopRepeat);
    }

    if (options.timeScale !== undefined) {
      action.timeScale = options.timeScale;
    }

    action.reset().fadeIn(0.2).play();
    this.activeAction = action;

    return action;
  }

  /**
   * Stop the current GLTF animation
   */
  stopClip() {
    if (this.activeAction) {
      this.activeAction.fadeOut(0.3);
      this.activeAction = null;
    }
  }

  /**
   * Update the animation mixer - call this every frame
   */
  update() {
    if (this.mixer) {
      const delta = this.clock.getDelta();
      this.mixer.update(delta);
    }
  }

  /**
   * Play a behavior on a target (anime.js)
   * @param {string} name - behavior name
   * @param {THREE.Object3D} target - model or part to animate
   * @param {object} options - behavior-specific options
   */
  play(name, target, options = {}) {
    // Stop existing animation with same key
    const key = `${target.uuid}-${name}`;
    this.stop(key);

    const behavior = Behaviors[name];
    if (!behavior) {
      console.warn(`Unknown animation behavior: ${name}`);
      return null;
    }

    const anim = behavior(target, options);
    if (anim) {
      this.activeAnimations.set(key, { anim, target, name });
    }

    return anim;
  }

  /**
   * Stop a specific animation
   */
  stop(key) {
    const entry = this.activeAnimations.get(key);
    if (entry) {
      if (entry.anim.pause) entry.anim.pause();
      this.activeAnimations.delete(key);
    }
  }

  /**
   * Stop all animations on a target
   */
  stopAll(target) {
    for (const [key, entry] of this.activeAnimations) {
      if (entry.target === target || key.startsWith(target.uuid)) {
        if (entry.anim.pause) entry.anim.pause();
        this.activeAnimations.delete(key);
      }
    }
  }

  /**
   * Stop all animations globally (both anime.js and GLTF)
   */
  stopEverything() {
    // Stop anime.js animations
    for (const [key, entry] of this.activeAnimations) {
      if (entry.anim.pause) entry.anim.pause();
    }
    this.activeAnimations.clear();

    // Stop GLTF animations
    this.stopClip();
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
  }

  /**
   * Get available behavior names (anime.js)
   */
  getBehaviorNames() {
    return Object.keys(Behaviors);
  }
}

/**
 * Initialize spec-defined animations if present
 * @param {THREE.Object3D} model
 * @param {THREE.Scene} scene - Optional scene for environment effects
 * @returns {SpecAnimator|null}
 */
AnimationController.prototype.initSpecAnimator = function(model, scene = null) {
  // Dispose existing spec animator
  if (this.specAnimator) {
    this.specAnimator.dispose();
    this.specAnimator = null;
  }

  const spec = model.userData.spec;
  if (!spec?.animations) {
    return null;
  }

  // Check if it's the new animation format
  if (isNewAnimationFormat(spec.animations)) {
    this.specAnimator = new SpecAnimator(model, spec.animations, scene);
    return this.specAnimator;
  }

  // Old format - handled by existing behavior system
  return null;
};

// Store original update method
const originalUpdate = AnimationController.prototype.update;

/**
 * Extended update that includes spec animator
 */
AnimationController.prototype.update = function() {
  originalUpdate.call(this);

  if (this.specAnimator) {
    this.specAnimator.update();
  }
};

// Extend stopEverything to include spec animator
const originalStopEverything = AnimationController.prototype.stopEverything;

AnimationController.prototype.stopEverything = function() {
  originalStopEverything.call(this);

  if (this.specAnimator) {
    this.specAnimator.stopCurrentState();
  }
};

export { AnimationController, Behaviors, SpecAnimator, isNewAnimationFormat };
