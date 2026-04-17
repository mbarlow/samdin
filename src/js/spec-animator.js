/**
 * spec-animator.js - Main orchestrator for spec-defined animations
 * Parses animation states from spec files and coordinates per-part animations
 */
import * as THREE from 'three';
import { PartAnimator } from './part-animator.js';
import { EnvironmentFX } from './environment-fx.js';

/**
 * Orchestrates spec-defined animation states
 */
class SpecAnimator {
  /**
   * @param {THREE.Object3D} model - The model to animate
   * @param {object} animationsDef - Animation definitions from spec
   * @param {THREE.Scene} scene - Scene for environment effects (optional)
   */
  constructor(model, animationsDef, scene = null) {
    this.model = model;
    this.animationsDef = animationsDef;
    this.scene = scene;

    // Build parts map from model
    this.partsMap = this.buildPartsMap(model);

    // Create animators
    this.partAnimator = new PartAnimator(this.partsMap);
    this.environmentFX = scene ? new EnvironmentFX(scene) : null;

    // Current state
    this.currentState = null;
    this.stateNames = Object.keys(animationsDef);

    // Time tracking
    this.clock = new THREE.Clock();

    console.log(`[SpecAnimator] Initialized with ${this.stateNames.length} states:`, this.stateNames);
    console.log(`[SpecAnimator] Found ${this.partsMap.size} named parts`);
  }

  /**
   * Build a map of part names to Object3D references
   * @param {THREE.Object3D} model
   * @returns {Map<string, THREE.Object3D>}
   */
  buildPartsMap(model) {
    const map = new Map();

    model.traverse((child) => {
      if (child.name) {
        map.set(child.name, child);
      }
    });

    return map;
  }

  /**
   * Get available state names
   * @returns {string[]}
   */
  getStateNames() {
    return this.stateNames;
  }

  /**
   * Transition to a named animation state
   * @param {string} stateName
   */
  setState(stateName) {
    const stateDef = this.animationsDef[stateName];
    if (!stateDef) {
      console.warn(`[SpecAnimator] Unknown state: ${stateName}`);
      return;
    }

    console.log(`[SpecAnimator] Transitioning to state: ${stateName}`);

    // Stop current state animations
    this.stopCurrentState();

    // Apply new state
    this.currentState = stateName;

    // Process part animations
    if (stateDef.parts) {
      this.applyPartAnimations(stateDef.parts);
    }

    // Process environment effects
    if (stateDef.environment && this.environmentFX) {
      this.applyEnvironmentEffects(stateDef.environment);
    }
  }

  /**
   * Stop all animations from current state
   */
  stopCurrentState() {
    this.partAnimator.stopAll();
    if (this.environmentFX) {
      this.environmentFX.clearAll();
    }
  }

  /**
   * Apply part animations from state definition
   * @param {object} partsDef - Map of partName -> animation config
   */
  applyPartAnimations(partsDef) {
    for (const [partName, animConfig] of Object.entries(partsDef)) {
      this.applyPartAnimation(partName, animConfig);
    }
  }

  /**
   * Apply a single part animation
   * @param {string} partName
   * @param {object} config - Animation configuration
   */
  applyPartAnimation(partName, config) {
    // Handle shorthand string values (e.g., "pulse")
    if (typeof config === 'string') {
      config = { [config]: {} };
    }

    // Process each animation type in the config
    for (const [animType, options] of Object.entries(config)) {
      switch (animType) {
        case 'hover':
          this.partAnimator.hover(partName,
            typeof options === 'object' ? options : {});
          break;

        case 'rotate':
          if (options.speed !== undefined) {
            // Continuous rotation
            this.partAnimator.rotateContinuous(partName, options);
          } else if (options.target !== undefined) {
            // Rotate to target
            this.partAnimator.rotateTo(partName, options);
          }
          break;

        case 'translate':
          this.partAnimator.translateTo(partName, options);
          break;

        case 'glow':
          if (typeof options === 'string') {
            // Shorthand: "glow": "pulse"
            this.partAnimator.glowPulse(partName, {});
          } else {
            this.partAnimator.glowPulse(partName, options);
          }
          break;

        case 'scale':
          this.partAnimator.scalePulse(partName, options);
          break;

        // Direct property setters (not animations)
        case 'min':
        case 'max':
        case 'frequency':
        case 'color':
        case 'axis':
        case 'speed':
        case 'amplitude':
        case 'to':
        case 'duration':
        case 'target':
          // These are options, not animation types - skip
          break;

        default:
          console.warn(`[SpecAnimator] Unknown animation type: ${animType} for part ${partName}`);
      }
    }

    // Handle combined glow config at root level
    if (config.glow && typeof config.glow === 'string' && config.glow === 'pulse') {
      const glowOptions = {
        min: config.min,
        max: config.max,
        frequency: config.frequency,
        color: config.color
      };
      this.partAnimator.glowPulse(partName, glowOptions);
    }
  }

  /**
   * Apply environment effects from state definition
   * @param {object} envDef - Map of effectId -> effect config
   */
  applyEnvironmentEffects(envDef) {
    for (const [effectId, effectConfig] of Object.entries(envDef)) {
      const type = effectConfig.type;

      switch (type) {
        case 'radial_wave':
          this.environmentFX.addRadialWave(effectId, {
            color: effectConfig.color,
            radius: effectConfig.radius,
            speed: effectConfig.speed,
            duration: effectConfig.duration,
            looping: effectConfig.looping
          });
          break;

        case 'holographic_grid':
          this.environmentFX.addHolographicGrid(effectId, {
            color: effectConfig.color,
            size: effectConfig.size,
            divisions: effectConfig.divisions,
            pulseSpeed: effectConfig.pulseSpeed
          });
          break;

        case 'particle_field':
          this.environmentFX.addParticleField(effectId, {
            color: effectConfig.color,
            count: effectConfig.count,
            size: effectConfig.size,
            spread: effectConfig.spread,
            speed: effectConfig.speed
          });
          break;

        case 'pulsing_light':
          this.environmentFX.addPulsingLight(effectId, {
            color: effectConfig.color,
            intensity: effectConfig.intensity,
            position: effectConfig.position,
            frequency: effectConfig.frequency
          });
          break;

        default:
          console.warn(`[SpecAnimator] Unknown environment effect type: ${type}`);
      }
    }
  }

  /**
   * Update all animations - call each frame
   * @param {number} delta - Time since last frame (optional, auto-calculated if not provided)
   */
  update(delta) {
    if (delta === undefined) {
      delta = this.clock.getDelta();
    }

    this.partAnimator.update(delta);

    if (this.environmentFX) {
      this.environmentFX.update(delta);
    }
  }

  /**
   * Get current state name
   * @returns {string|null}
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Check if a part exists in the model
   * @param {string} partName
   * @returns {boolean}
   */
  hasPart(partName) {
    return this.partsMap.has(partName);
  }

  /**
   * Get list of all part names in the model
   * @returns {string[]}
   */
  getPartNames() {
    return Array.from(this.partsMap.keys());
  }

  /**
   * Clean up and dispose
   */
  dispose() {
    this.stopCurrentState();
    this.partAnimator.dispose();
    if (this.environmentFX) {
      this.environmentFX.dispose();
    }
  }
}

/**
 * Check if an animations definition is the new spec format
 * @param {object} animationsDef
 * @returns {boolean}
 */
function isNewAnimationFormat(animationsDef) {
  if (!animationsDef || typeof animationsDef !== 'object') {
    return false;
  }

  const firstValue = Object.values(animationsDef)[0];

  // New format has objects with 'parts' or 'environment' keys
  // Old format has arrays of behavior names
  return firstValue &&
         typeof firstValue === 'object' &&
         !Array.isArray(firstValue) &&
         (firstValue.parts !== undefined || firstValue.environment !== undefined);
}

export { SpecAnimator, isNewAnimationFormat };
