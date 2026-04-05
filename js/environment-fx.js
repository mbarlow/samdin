/**
 * environment-fx.js - Scene-level visual effects
 * Provides radial waves, holographic grids, and other ambient effects
 */
import * as THREE from 'three';

/**
 * Manages scene-level visual effects
 */
class EnvironmentFX {
  constructor(scene) {
    this.scene = scene;
    this.effects = new Map();
    this.elapsed = 0;
  }

  /**
   * Add an expanding radial wave effect
   * @param {string} id - Unique effect ID
   * @param {object} options - { color, radius, speed, origin, duration }
   */
  addRadialWave(id, options = {}) {
    const color = new THREE.Color(options.color || '#4488ff');
    const maxRadius = options.radius || 5;
    const speed = options.speed || 2;
    const origin = options.origin || [0, 0.01, 0];
    const duration = options.duration || 2; // Seconds before repeating
    const ringWidth = options.ringWidth || 0.1;

    // Create ring geometry
    const geometry = new THREE.RingGeometry(0.1, 0.1 + ringWidth, 64);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(origin[0], origin[1], origin[2]);

    this.scene.add(ring);

    this.effects.set(id, {
      type: 'radialWave',
      mesh: ring,
      material,
      maxRadius,
      speed,
      duration,
      ringWidth,
      progress: 0,
      looping: options.looping !== false
    });
  }

  /**
   * Add a holographic grid effect
   * @param {string} id - Unique effect ID
   * @param {object} options - { color, size, divisions, pulseSpeed }
   */
  addHolographicGrid(id, options = {}) {
    const color = new THREE.Color(options.color || '#00ffff');
    const size = options.size || 10;
    const divisions = options.divisions || 20;
    const pulseSpeed = options.pulseSpeed || 0.5;

    const grid = new THREE.GridHelper(size, divisions, color, color);
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.material.depthWrite = false;
    grid.position.y = 0.01;

    this.scene.add(grid);

    this.effects.set(id, {
      type: 'holographicGrid',
      mesh: grid,
      pulseSpeed,
      baseOpacity: 0.3,
      phase: 0
    });
  }

  /**
   * Add a particle field effect
   * @param {string} id - Unique effect ID
   * @param {object} options - { color, count, size, spread, speed }
   */
  addParticleField(id, options = {}) {
    const color = new THREE.Color(options.color || '#ffffff');
    const count = options.count || 100;
    const size = options.size || 0.02;
    const spread = options.spread || 5;
    const speed = options.speed || 0.5;

    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = Math.random() * spread;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;

      velocities.push({
        x: (Math.random() - 0.5) * speed * 0.1,
        y: Math.random() * speed,
        z: (Math.random() - 0.5) * speed * 0.1
      });
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: size,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    this.scene.add(particles);

    this.effects.set(id, {
      type: 'particleField',
      mesh: particles,
      velocities,
      spread,
      speed
    });
  }

  /**
   * Add a pulsing light effect
   * @param {string} id - Unique effect ID
   * @param {object} options - { color, intensity, position, frequency }
   */
  addPulsingLight(id, options = {}) {
    const color = new THREE.Color(options.color || '#ffffff');
    const intensity = options.intensity || 2;
    const position = options.position || [0, 2, 0];
    const frequency = options.frequency || 0.5;

    const light = new THREE.PointLight(color, intensity, 10);
    light.position.set(position[0], position[1], position[2]);

    this.scene.add(light);

    this.effects.set(id, {
      type: 'pulsingLight',
      light,
      baseIntensity: intensity,
      frequency,
      phase: 0
    });
  }

  /**
   * Remove a specific effect
   * @param {string} id
   */
  removeEffect(id) {
    const effect = this.effects.get(id);
    if (!effect) return;

    if (effect.mesh) {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry?.dispose();
      effect.mesh.material?.dispose();
    }
    if (effect.light) {
      this.scene.remove(effect.light);
    }

    this.effects.delete(id);
  }

  /**
   * Clear all effects
   */
  clearAll() {
    for (const id of this.effects.keys()) {
      this.removeEffect(id);
    }
  }

  /**
   * Update all active effects
   * @param {number} delta - Time since last frame in seconds
   */
  update(delta) {
    this.elapsed += delta;

    for (const [id, effect] of this.effects) {
      switch (effect.type) {
        case 'radialWave':
          this.updateRadialWave(effect, delta);
          break;
        case 'holographicGrid':
          this.updateHolographicGrid(effect, delta);
          break;
        case 'particleField':
          this.updateParticleField(effect, delta);
          break;
        case 'pulsingLight':
          this.updatePulsingLight(effect, delta);
          break;
      }
    }
  }

  updateRadialWave(effect, delta) {
    effect.progress += delta / effect.duration;

    if (effect.progress >= 1) {
      if (effect.looping) {
        effect.progress = 0;
      } else {
        effect.material.opacity = 0;
        return;
      }
    }

    const currentRadius = effect.progress * effect.maxRadius;

    // Update ring geometry
    effect.mesh.geometry.dispose();
    effect.mesh.geometry = new THREE.RingGeometry(
      Math.max(0.01, currentRadius),
      currentRadius + effect.ringWidth,
      64
    );

    // Fade out as it expands
    effect.material.opacity = 0.8 * (1 - effect.progress);
  }

  updateHolographicGrid(effect, delta) {
    effect.phase += delta * effect.pulseSpeed * Math.PI * 2;
    const t = (Math.sin(effect.phase) + 1) / 2;
    effect.mesh.material.opacity = effect.baseOpacity * (0.5 + t * 0.5);
  }

  updateParticleField(effect, delta) {
    const positions = effect.mesh.geometry.attributes.position.array;
    const velocities = effect.velocities;
    const spread = effect.spread;

    for (let i = 0; i < velocities.length; i++) {
      // Update position
      positions[i * 3] += velocities[i].x * delta;
      positions[i * 3 + 1] += velocities[i].y * delta;
      positions[i * 3 + 2] += velocities[i].z * delta;

      // Wrap around
      if (positions[i * 3 + 1] > spread) {
        positions[i * 3 + 1] = 0;
        positions[i * 3] = (Math.random() - 0.5) * spread;
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      }
    }

    effect.mesh.geometry.attributes.position.needsUpdate = true;
  }

  updatePulsingLight(effect, delta) {
    effect.phase += delta * effect.frequency * Math.PI * 2;
    const t = (Math.sin(effect.phase) + 1) / 2;
    effect.light.intensity = effect.baseIntensity * (0.5 + t * 0.5);
  }

  /**
   * Dispose all effects and clean up
   */
  dispose() {
    this.clearAll();
  }
}

export { EnvironmentFX };
