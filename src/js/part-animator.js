/**
 * part-animator.js - Handles animations on individual named parts
 * Provides hover, rotate, translate, and glow animations
 */
import * as THREE from 'three';

/**
 * Animates individual parts of a model by name
 */
class PartAnimator {
  constructor(partsMap) {
    // Map of part name -> THREE.Object3D
    this.partsMap = partsMap;

    // Active animations: partName -> { type, state, originalValues }
    this.activeAnimations = new Map();

    // Elapsed time tracking
    this.elapsed = 0;
  }

  /**
   * Get a part by name
   * @param {string} partName
   * @returns {THREE.Object3D|null}
   */
  getPart(partName) {
    return this.partsMap.get(partName) || null;
  }

  /**
   * Hover animation - oscillate Y position
   * @param {string} partName
   * @param {object} options - { amplitude, frequency }
   */
  hover(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const amplitude = options.amplitude || 0.02;
    const frequency = options.frequency || 0.5;

    this.activeAnimations.set(partName, {
      type: 'hover',
      part,
      amplitude,
      frequency,
      baseY: part.position.y,
      phase: 0
    });
  }

  /**
   * Continuous rotation animation
   * @param {string} partName
   * @param {object} options - { axis, speed } (speed in degrees per second)
   */
  rotateContinuous(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const axis = options.axis || 'y';
    const speed = (options.speed || 30) * (Math.PI / 180); // Convert to radians/sec

    this.activeAnimations.set(partName, {
      type: 'rotateContinuous',
      part,
      axis,
      speed
    });
  }

  /**
   * Rotate to a target angle over duration
   * @param {string} partName
   * @param {object} options - { axis, target, duration }
   */
  rotateTo(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const axis = options.axis || 'y';
    const target = (options.target || 0) * (Math.PI / 180);
    const duration = options.duration || 0.5;

    this.activeAnimations.set(partName, {
      type: 'rotateTo',
      part,
      axis,
      startRotation: part.rotation[axis],
      targetRotation: target,
      duration,
      progress: 0
    });
  }

  /**
   * Translate to a position over duration
   * @param {string} partName
   * @param {object} options - { to: [x, y, z], duration }
   */
  translateTo(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const to = options.to || [0, 0, 0];
    const duration = options.duration || 0.5;

    this.activeAnimations.set(partName, {
      type: 'translateTo',
      part,
      startPosition: part.position.clone(),
      targetPosition: new THREE.Vector3(to[0], to[1], to[2]),
      duration,
      progress: 0
    });
  }

  /**
   * Glow pulse - animate emissive intensity
   * @param {string} partName
   * @param {object} options - { min, max, frequency, color }
   */
  glowPulse(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const minIntensity = options.min !== undefined ? options.min : 0.5;
    const maxIntensity = options.max !== undefined ? options.max : 2.0;
    const frequency = options.frequency || 0.3;
    const color = options.color ? new THREE.Color(options.color) : null;

    // Find all emissive materials in the part
    const materials = [];
    const originalColors = [];
    part.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (mat.emissive) {
            materials.push(mat);
            originalColors.push(mat.emissive.clone());
          }
        });
      }
    });

    if (materials.length === 0) {
      console.warn(`[PartAnimator] No emissive materials found on: ${partName}`);
      return;
    }

    // Apply color change immediately if specified
    if (color) {
      materials.forEach(mat => mat.emissive.copy(color));
    }

    this.activeAnimations.set(partName, {
      type: 'glowPulse',
      part,
      materials,
      originalColors,
      minIntensity,
      maxIntensity,
      frequency,
      color,
      phase: 0
    });
  }

  /**
   * Scale pulse animation
   * @param {string} partName
   * @param {object} options - { min, max, frequency }
   */
  scalePulse(partName, options = {}) {
    const part = this.getPart(partName);
    if (!part) {
      console.warn(`[PartAnimator] Part not found: ${partName}`);
      return;
    }

    const min = options.min || 0.9;
    const max = options.max || 1.1;
    const frequency = options.frequency || 0.5;

    this.activeAnimations.set(partName, {
      type: 'scalePulse',
      part,
      min,
      max,
      frequency,
      baseScale: part.scale.clone(),
      phase: 0
    });
  }

  /**
   * Stop animation on a specific part
   * @param {string} partName
   */
  stopPart(partName) {
    const anim = this.activeAnimations.get(partName);
    if (!anim) return;

    // Restore original values based on animation type
    switch (anim.type) {
      case 'hover':
        anim.part.position.y = anim.baseY;
        break;
      case 'glowPulse':
        // Restore original emissive colors
        anim.materials.forEach((mat, i) => {
          mat.emissive.copy(anim.originalColors[i]);
          mat.emissiveIntensity = 1;
        });
        break;
      case 'scalePulse':
        anim.part.scale.copy(anim.baseScale);
        break;
    }

    this.activeAnimations.delete(partName);
  }

  /**
   * Stop all active animations
   */
  stopAll() {
    for (const partName of this.activeAnimations.keys()) {
      this.stopPart(partName);
    }
  }

  /**
   * Update all active animations
   * @param {number} delta - Time since last frame in seconds
   */
  update(delta) {
    this.elapsed += delta;

    for (const [partName, anim] of this.activeAnimations) {
      switch (anim.type) {
        case 'hover':
          this.updateHover(anim, delta);
          break;
        case 'rotateContinuous':
          this.updateRotateContinuous(anim, delta);
          break;
        case 'rotateTo':
          this.updateRotateTo(anim, delta);
          break;
        case 'translateTo':
          this.updateTranslateTo(anim, delta);
          break;
        case 'glowPulse':
          this.updateGlowPulse(anim, delta);
          break;
        case 'scalePulse':
          this.updateScalePulse(anim, delta);
          break;
      }
    }
  }

  updateHover(anim, delta) {
    anim.phase += delta * anim.frequency * Math.PI * 2;
    const offset = Math.sin(anim.phase) * anim.amplitude;
    anim.part.position.y = anim.baseY + offset;
  }

  updateRotateContinuous(anim, delta) {
    anim.part.rotation[anim.axis] += anim.speed * delta;
  }

  updateRotateTo(anim, delta) {
    anim.progress += delta / anim.duration;
    if (anim.progress >= 1) {
      anim.part.rotation[anim.axis] = anim.targetRotation;
      // Mark as complete - could be removed or converted to static
    } else {
      // Ease in-out
      const t = anim.progress;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      anim.part.rotation[anim.axis] =
        anim.startRotation + (anim.targetRotation - anim.startRotation) * ease;
    }
  }

  updateTranslateTo(anim, delta) {
    anim.progress += delta / anim.duration;
    if (anim.progress >= 1) {
      anim.part.position.copy(anim.targetPosition);
    } else {
      // Ease in-out
      const t = anim.progress;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      anim.part.position.lerpVectors(anim.startPosition, anim.targetPosition, ease);
    }
  }

  updateGlowPulse(anim, delta) {
    anim.phase += delta * anim.frequency * Math.PI * 2;
    const t = (Math.sin(anim.phase) + 1) / 2; // 0 to 1
    const intensity = anim.minIntensity + (anim.maxIntensity - anim.minIntensity) * t;

    anim.materials.forEach(mat => {
      mat.emissiveIntensity = intensity;
    });
  }

  updateScalePulse(anim, delta) {
    anim.phase += delta * anim.frequency * Math.PI * 2;
    const t = (Math.sin(anim.phase) + 1) / 2; // 0 to 1
    const scale = anim.min + (anim.max - anim.min) * t;

    anim.part.scale.set(
      anim.baseScale.x * scale,
      anim.baseScale.y * scale,
      anim.baseScale.z * scale
    );
  }

  /**
   * Dispose and clean up
   */
  dispose() {
    this.stopAll();
    this.partsMap.clear();
  }
}

export { PartAnimator };
