/**
 * viewer.js - Core Three.js scene setup
 * Handles scene, camera, renderer, controls, and render loop
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformController } from './transform.js';
import { applyDisplayMode as applyTerrainDisplayMode } from './terrain-compositor.js';

// Camera preset positions
const CAMERA_PRESETS = {
  front: { position: [0, 1, 5], target: [0, 0.5, 0] },
  back: { position: [0, 1, -5], target: [0, 0.5, 0] },
  left: { position: [-5, 1, 0], target: [0, 0.5, 0] },
  right: { position: [5, 1, 0], target: [0, 0.5, 0] },
  top: { position: [0, 6, 0.01], target: [0, 0, 0] },
  threeQuarter: { position: [3, 2, 4], target: [0, 0.5, 0] },
  lowAngle: { position: [3, 0.3, 3], target: [0, 1, 0] },
  highAngle: { position: [2, 5, 2], target: [0, 0, 0] }
};

class Viewer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.currentModel = null;
    this.floor = null;
    this.lights = [];
    this.backgroundTexture = null;
    this.renderCallback = null;
    this.wireframeMode = false;
    this.autoRotate = false;
    this.autoRotateSpeed = 1.0;
    this.designGrid = null;
    this.axesHelper = null;
    this.selectedPart = null;
    this.highlightBox = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.transformController = null;

    // First-person controls
    this.fpControls = null;
    this.controlMode = 'orbit'; // 'orbit' or 'firstPerson'
    this.moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
    this.moveSpeed = 5.0;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.prevTime = performance.now();
    this.fpEuler = new THREE.Euler(0, 0, 0, 'YXZ'); // Manual euler for first-person
    this.fpMouseHandler = null; // Bound mouse handler for first-person
    this.fpLockChangeHandler = null; // Pointer lock change handler
    this.fpAnimating = false; // Flag to ignore mouse during orientation animation

    this.init();
  }
  
  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    // Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(3, 2, 4);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.container.appendChild(this.renderer.domElement);
    
    // Orbit Controls (default)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 50;
    this.controls.target.set(0, 0.5, 0);

    // First-Person Controls (keyboard handlers)
    this.setupFirstPersonControls();

    // Floor
    this.createFloor();

    // Design grid (hidden by default)
    this.createDesignGrid();

    // Part selection/highlighting
    this.setupPartSelection();

    // Transform controller (Blender-style hotkeys)
    this.transformController = new TransformController({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      orbitControls: this.controls,
      container: this.container
    });

    // Select part by name (from duplicate)
    this.container.addEventListener('selectPartByName', (e) => {
      const name = e.detail.name;
      if (this.currentModel) {
        this.currentModel.traverse(child => {
          if (child.name === name && child.isMesh) {
            this.selectPart(child);
          }
        });
      }
    });

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    // Start render loop
    this.animate();
  }
  
  createFloor() {
    // Grid helper
    const gridSize = 10;
    const gridDivisions = 20;
    const grid = new THREE.GridHelper(gridSize, gridDivisions, 0x2a2a3a, 0x1a1a24);
    grid.position.y = 0;
    this.scene.add(grid);

    // Shadow-receiving plane
    const planeGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    this.floor = new THREE.Mesh(planeGeo, planeMat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Reflective ground plane (hidden by default)
    const reflectGeo = new THREE.PlaneGeometry(gridSize, gridSize);
    const reflectMat = new THREE.MeshStandardMaterial({
      color: 0x111114,
      roughness: 0.35,
      metalness: 0.6,
      envMapIntensity: 0.8
    });
    this.groundReflect = new THREE.Mesh(reflectGeo, reflectMat);
    this.groundReflect.rotation.x = -Math.PI / 2;
    this.groundReflect.position.y = -0.001;
    this.groundReflect.receiveShadow = true;
    this.groundReflect.visible = false;
    this.scene.add(this.groundReflect);

    this.grid = grid;
  }

  setFloorVisible(visible) {
    this.floor.visible = visible;
    this.grid.visible = visible;
  }

  setGroundReflective(enabled) {
    this.groundReflect.visible = enabled;
    if (enabled) {
      // Hide the shadow-only floor when reflective ground is on
      this.floor.visible = false;
    } else {
      this.floor.visible = document.getElementById('env-floor')?.checked !== false;
    }
  }

  /**
   * Create a design grid overlay with axes and measurements
   */
  createDesignGrid() {
    const group = new THREE.Group();
    group.name = 'designGrid';

    // Main grid (larger, more visible)
    const gridSize = 20;
    const gridDivisions = 20;
    const mainGrid = new THREE.GridHelper(gridSize, gridDivisions, 0x444466, 0x333344);
    mainGrid.position.y = 0.001;
    group.add(mainGrid);

    // Sub-grid (finer divisions)
    const subGrid = new THREE.GridHelper(gridSize, gridDivisions * 4, 0x222233, 0x222233);
    subGrid.position.y = 0.0005;
    group.add(subGrid);

    // Axes helper (RGB = XYZ)
    const axesHelper = new THREE.AxesHelper(5);
    axesHelper.position.y = 0.002;
    group.add(axesHelper);
    this.axesHelper = axesHelper;

    // Add measurement markers every 1 unit on X and Z
    const markerMaterial = new THREE.LineBasicMaterial({ color: 0x6666aa });
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      // X axis markers
      const xPoints = [
        new THREE.Vector3(i, 0.003, -0.1),
        new THREE.Vector3(i, 0.003, 0.1)
      ];
      const xGeom = new THREE.BufferGeometry().setFromPoints(xPoints);
      const xLine = new THREE.Line(xGeom, markerMaterial);
      group.add(xLine);

      // Z axis markers
      const zPoints = [
        new THREE.Vector3(-0.1, 0.003, i),
        new THREE.Vector3(0.1, 0.003, i)
      ];
      const zGeom = new THREE.BufferGeometry().setFromPoints(zPoints);
      const zLine = new THREE.Line(zGeom, markerMaterial);
      group.add(zLine);
    }

    this.designGrid = group;
    this.designGrid.visible = false;
    this.scene.add(this.designGrid);
  }

  /**
   * Toggle design grid visibility
   */
  setDesignGridVisible(visible) {
    if (!this.designGrid) {
      this.createDesignGrid();
    }
    this.designGrid.visible = visible;
  }

  /**
   * Setup part highlighting/selection
   */
  setupPartSelection() {
    // Create highlight box helper
    this.highlightBox = new THREE.BoxHelper(new THREE.Mesh(), 0x00ff00);
    this.highlightBox.visible = false;
    this.scene.add(this.highlightBox);

    // Mouse event handlers
    this.container.addEventListener('click', (e) => this.onPartClick(e));
    this.container.addEventListener('mousemove', (e) => this.onPartHover(e));
  }

  /**
   * Handle part click for selection
   */
  onPartClick(event) {
    if (!this.currentModel) return;
    if (this.controlMode === 'firstPerson') return; // Disable in FP mode

    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.currentModel, true);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this.selectPart(mesh);
    } else {
      this.deselectPart();
    }
  }

  /**
   * Handle part hover for highlighting
   */
  onPartHover(event) {
    if (!this.currentModel || this.selectedPart) return;
    if (this.controlMode === 'firstPerson') return; // Disable in FP mode

    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.currentModel, true);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this.highlightPart(mesh);
    } else {
      this.unhighlightPart();
    }
  }

  /**
   * Update mouse position for raycasting
   */
  updateMousePosition(event) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Select a part and show info
   */
  selectPart(mesh) {
    this.selectedPart = mesh;
    this.highlightBox.setFromObject(mesh);
    this.highlightBox.material.color.setHex(0x00ff00);
    this.highlightBox.visible = true;

    // Notify transform controller
    if (this.transformController) {
      this.transformController.setSelectedPart(mesh);
    }

    // Dispatch custom event with part info
    const event = new CustomEvent('partSelected', {
      detail: {
        name: mesh.name || 'unnamed',
        position: mesh.getWorldPosition(new THREE.Vector3()).toArray(),
        geometry: mesh.geometry?.type || 'unknown',
        material: mesh.material?.type || 'unknown'
      }
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Deselect current part
   */
  deselectPart() {
    this.selectedPart = null;
    this.highlightBox.visible = false;

    // Notify transform controller
    if (this.transformController) {
      this.transformController.clearSelection();
    }

    const event = new CustomEvent('partDeselected');
    this.container.dispatchEvent(event);
  }

  /**
   * Highlight part on hover
   */
  highlightPart(mesh) {
    this.highlightBox.setFromObject(mesh);
    this.highlightBox.material.color.setHex(0x4a9eff);
    this.highlightBox.visible = true;
  }

  /**
   * Remove hover highlight
   */
  unhighlightPart() {
    if (!this.selectedPart) {
      this.highlightBox.visible = false;
    }
  }
  
  setBackground(type, color) {
    const config = typeof type === 'object'
      ? type
      : { type, color };
    const c = new THREE.Color(config.color || '#1a1a2e');
    const c2 = new THREE.Color(config.color2 || '#06070b');

    if (this.backgroundTexture) {
      this.backgroundTexture.dispose();
      this.backgroundTexture = null;
    }
    
    switch (config.type) {
      case 'solid':
        this.scene.background = c;
        break;
      case 'gradient':
        // Create gradient texture
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, c.getStyle());
        gradient.addColorStop(1, c2.getStyle());
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);
        const tex = new THREE.CanvasTexture(canvas);
        this.backgroundTexture = tex;
        this.scene.background = tex;
        break;
      case 'void':
        this.scene.background = new THREE.Color(0x000000);
        break;
      default:
        this.scene.background = c;
    }
  }

  /**
   * Apply scene fog from a spec config.
   * @param {object|null} fogConfig
   */
  setFog(fogConfig = null) {
    if (!fogConfig || fogConfig.enabled === false) {
      this.scene.fog = null;
      return;
    }

    const color = new THREE.Color(fogConfig.color || '#101218');
    const type = fogConfig.type || 'linear';

    if (type === 'exp2') {
      this.scene.fog = new THREE.FogExp2(color, fogConfig.density ?? 0.02);
      return;
    }

    this.scene.fog = new THREE.Fog(
      color,
      fogConfig.near ?? 6,
      fogConfig.far ?? 40
    );
  }

  /**
   * Set renderer tone mapping mode by name.
   * @param {string} toneMapping
   */
  setToneMapping(toneMapping = 'ACESFilmic') {
    const toneMappings = {
      none: THREE.NoToneMapping,
      linear: THREE.LinearToneMapping,
      reinhard: THREE.ReinhardToneMapping,
      cineon: THREE.CineonToneMapping,
      acesfilmic: THREE.ACESFilmicToneMapping,
      neutral: THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping
    };

    const key = String(toneMapping).toLowerCase();
    this.renderer.toneMapping = toneMappings[key] || THREE.ACESFilmicToneMapping;
  }

  /**
   * Reset scene-wide renderer/view settings before loading a new spec.
   */
  resetSceneSettings() {
    this.setBackground({ type: 'solid', color: '#1a1a2e' });
    this.setFloorVisible(true);
    this.setFog(null);
    this.setToneMapping('ACESFilmic');
    this.setExposure(1);
  }
  
  addModel(model) {
    console.log('[Viewer] addModel called with:', model);

    // Remove existing model
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
    }

    this.currentModel = model;

    // Count meshes
    let meshCount = 0;
    model.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        console.log('[Viewer] Found mesh:', child.name, 'geometry:', child.geometry);
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    console.log('[Viewer] Total meshes found:', meshCount);

    // Center and scale model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    console.log('[Viewer] Bounding box:', { center: center.toArray(), size: size.toArray() });
    
    // Move model to center on floor
    model.position.x = -center.x;
    model.position.z = -center.z;
    model.position.y = -box.min.y;
    
    // Adjust camera if model is large
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 3) {
      this.camera.position.multiplyScalar(maxDim / 3);
    }
    
    this.scene.add(model);
    this.controls.target.set(0, size.y / 2, 0);
    
    return this.getModelInfo(model);
  }
  
  getModelInfo(model) {
    let tris = 0;
    let verts = 0;
    let objects = 0;
    
    model.traverse((child) => {
      if (child.isMesh) {
        objects++;
        const geo = child.geometry;
        if (geo.index) {
          tris += geo.index.count / 3;
        } else if (geo.attributes.position) {
          tris += geo.attributes.position.count / 3;
        }
        if (geo.attributes.position) {
          verts += geo.attributes.position.count;
        }
      }
    });
    
    return { tris: Math.floor(tris), verts, objects };
  }
  
  clearModel() {
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }
  }
  
  onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());

    const time = performance.now();
    const delta = (time - this.prevTime) / 1000;
    this.prevTime = time;

    // Update controls based on mode
    if (this.controlMode === 'firstPerson') {
      this.updateFirstPersonMovement(delta);
    } else {
      this.controls.update();
    }

    // Use external render callback if set (for post-processing)
    if (this.renderCallback) {
      this.renderCallback();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  // For post-processing, expose renderer
  getRenderer() {
    return this.renderer;
  }
  
  getScene() {
    return this.scene;
  }
  
  getCamera() {
    return this.camera;
  }
  
  /**
   * Set external render callback (for post-processing)
   */
  setRenderCallback(callback) {
    this.renderCallback = callback;
  }

  /**
   * Set camera to a preset position
   * @param {string} presetName - Name of the camera preset
   */
  setCameraPreset(presetName) {
    const config = typeof presetName === 'object' && presetName !== null
      ? presetName
      : { preset: presetName };
    const preset = CAMERA_PRESETS[config.preset];
    if (!preset) {
      console.warn(`Unknown camera preset: ${config.preset}`);
      return;
    }

    // Animate camera to new position
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos = new THREE.Vector3(...preset.position);
    const endTarget = new THREE.Vector3(...preset.target);
    const positionOffset = config.positionOffset || [0, 0, 0];
    const targetOffset = config.targetOffset || [0, 0, 0];
    endPos.add(new THREE.Vector3(...positionOffset));
    endTarget.add(new THREE.Vector3(...targetOffset));

    // Scale positions based on model size
    if (this.currentModel && config.scaleToModel !== false) {
      const box = new THREE.Box3().setFromObject(this.currentModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = Math.max(1, maxDim / 2) * (config.distanceMultiplier ?? 1);
      endPos.multiplyScalar(scale);
    }

    const duration = 500;
    const startTime = performance.now();

    const animateCamera = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

      this.camera.position.lerpVectors(startPos, endPos, eased);
      this.controls.target.lerpVectors(startTarget, endTarget, eased);
      this.controls.update();

      if (t < 1) {
        requestAnimationFrame(animateCamera);
      }
    };

    animateCamera();
  }

  /**
   * Get available camera preset names
   */
  getCameraPresetNames() {
    return Object.keys(CAMERA_PRESETS);
  }

  /**
   * Set the terrain display mode for the current model.
   * Modes: "primitives" | "terrain" | "both". Structures are always visible.
   * @param {string} mode
   */
  setTerrainDisplay(mode) {
    this.terrainDisplayMode = mode;
    if (this.currentModel) {
      applyTerrainDisplayMode(this.currentModel, mode);
    }
  }

  /**
   * Returns the terrain display mode currently active on the model, if any.
   */
  getTerrainDisplay() {
    return this.currentModel?.userData?.terrainDisplay
      || this.terrainDisplayMode
      || null;
  }

  /**
   * Toggle wireframe mode
   * @param {boolean} enabled
   */
  setWireframe(enabled) {
    this.wireframeMode = enabled;
    if (this.currentModel) {
      this.currentModel.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.wireframe = enabled);
          } else {
            child.material.wireframe = enabled;
          }
        }
      });
    }
  }

  /**
   * Toggle auto-rotation
   * @param {boolean} enabled
   */
  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = this.autoRotateSpeed;
  }

  /**
   * Set auto-rotation speed
   * @param {number} speed - Rotation speed (default 2.0)
   */
  setAutoRotateSpeed(speed) {
    this.autoRotateSpeed = speed;
    this.controls.autoRotateSpeed = speed;
  }

  /**
   * Take a screenshot and download it
   * @param {string} filename - Name for the downloaded file
   */
  takeScreenshot(filename = 'samdin-screenshot.png') {
    // Need to render one frame with preserveDrawingBuffer
    this.renderer.preserveDrawingBuffer = true;

    // Render the scene
    if (this.renderCallback) {
      this.renderCallback();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    // Get canvas data
    const dataURL = this.renderer.domElement.toDataURL('image/png');

    // Create download link
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();

    // Reset preserveDrawingBuffer
    this.renderer.preserveDrawingBuffer = false;
  }

  /**
   * Reset camera to default position
   */
  resetCamera() {
    this.setCameraPreset('threeQuarter');
  }

  /**
   * Fit camera to model bounds
   */
  fitToModel() {
    if (!this.currentModel) return;

    const box = new THREE.Box3().setFromObject(this.currentModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate ideal camera distance
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

    // Set camera position
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * Set exposure/tone mapping exposure
   * @param {number} exposure - Exposure value (0.1 to 3.0)
   */
  setExposure(exposure) {
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Setup first-person keyboard controls
   */
  setupFirstPersonControls() {
    // Keyboard event handlers
    const onKeyDown = (event) => {
      if (this.controlMode !== 'firstPerson') return;

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveState.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveState.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveState.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveState.right = true;
          break;
        case 'Space':
          this.moveState.up = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.moveState.down = true;
          break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.moveState.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.moveState.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.moveState.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.moveState.right = false;
          break;
        case 'Space':
          this.moveState.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.moveState.down = false;
          break;
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  }

  /**
   * Set camera control mode
   * @param {string} mode - 'orbit' or 'firstPerson'
   */
  setControlMode(mode) {
    const wasFirstPerson = this.controlMode === 'firstPerson';
    this.controlMode = mode;

    if (mode === 'firstPerson') {
      // Disable orbit controls
      this.controls.enabled = false;

      // Position camera at human eye height, behind the model looking at origin
      const eyeHeight = 1.7;
      const distanceFromOrigin = 4;

      this.camera.position.set(0, eyeHeight, distanceFromOrigin);

      // Calculate euler angles to look at model center
      const target = new THREE.Vector3(0, 0.5, 0);
      const direction = target.clone().sub(this.camera.position).normalize();

      // Calculate yaw (rotation around Y) - atan2 of x/z
      const yaw = Math.atan2(-direction.x, -direction.z);

      // Calculate pitch (rotation around X) - asin of y component
      const pitch = Math.asin(direction.y);

      // Set our manual euler for first-person control
      this.fpEuler.set(pitch, yaw, 0, 'YXZ');

      // Apply to camera
      this.camera.quaternion.setFromEuler(this.fpEuler);

      // Setup manual pointer lock handling (not using PointerLockControls)
      this.setupManualPointerLock();

      // Request pointer lock
      this.renderer.domElement.requestPointerLock();
    } else {
      // If we were in first-person, exit pointer lock
      if (wasFirstPerson && document.pointerLockElement) {
        document.exitPointerLock();
      }

      // Remove manual mouse handler
      if (this.fpMouseHandler) {
        document.removeEventListener('mousemove', this.fpMouseHandler);
        this.fpMouseHandler = null;
      }

      // Re-enable orbit controls
      this.controls.enabled = true;

      // Reset movement state
      this.moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

      // Update orbit controls target to current view direction
      const direction = new THREE.Vector3();
      this.camera.getWorldDirection(direction);
      this.controls.target.copy(this.camera.position).add(direction.multiplyScalar(5));
      this.controls.update();
    }

    // Dispatch mode change event
    this.container.dispatchEvent(new CustomEvent('controlModeChanged', { detail: { mode } }));
  }

  /**
   * Setup manual pointer lock handling for first-person mode
   */
  setupManualPointerLock() {
    const minPolarAngle = -Math.PI / 2 + 0.1; // Prevent looking straight up
    const maxPolarAngle = Math.PI / 2 - 0.1;  // Prevent looking straight down

    // Target euler angles to look at model center
    const target = new THREE.Vector3(0, 0.5, 0);
    const direction = target.clone().sub(this.camera.position).normalize();
    const targetYaw = Math.atan2(-direction.x, -direction.z);
    const targetPitch = Math.asin(direction.y);

    // Flag to control mouse input during animation
    this.fpAnimating = true;

    // Mouse move handler
    this.fpMouseHandler = (event) => {
      if (document.pointerLockElement !== this.renderer.domElement) return;
      if (this.controlMode !== 'firstPerson') return;
      if (this.fpAnimating) return; // Ignore mouse during animation

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      // Update euler angles based on mouse movement
      this.fpEuler.y -= movementX * 0.002; // Yaw
      this.fpEuler.x -= movementY * 0.002; // Pitch

      // Clamp pitch
      this.fpEuler.x = Math.max(minPolarAngle, Math.min(maxPolarAngle, this.fpEuler.x));

      // Apply to camera
      this.camera.quaternion.setFromEuler(this.fpEuler);
    };

    document.addEventListener('mousemove', this.fpMouseHandler);

    // Pointer lock change handler (one-time setup)
    const onLockChange = () => {
      if (document.pointerLockElement === this.renderer.domElement) {
        this.container.dispatchEvent(new CustomEvent('fpLocked'));

        // Animate camera orientation to look at model center
        this.animateCameraToTarget(targetPitch, targetYaw, 400);
      } else {
        if (this.controlMode === 'firstPerson') {
          this.container.dispatchEvent(new CustomEvent('fpUnlocked'));
        }
      }
    };

    // Remove old listener and add new
    document.removeEventListener('pointerlockchange', this.fpLockChangeHandler);
    this.fpLockChangeHandler = onLockChange;
    document.addEventListener('pointerlockchange', onLockChange);
  }

  /**
   * Animate camera euler angles to target orientation
   */
  animateCameraToTarget(targetPitch, targetYaw, duration) {
    const startPitch = this.fpEuler.x;
    const startYaw = this.fpEuler.y;
    const startTime = performance.now();

    const animate = () => {
      if (this.controlMode !== 'firstPerson') return;

      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      // Interpolate euler angles
      this.fpEuler.x = startPitch + (targetPitch - startPitch) * eased;
      this.fpEuler.y = startYaw + (targetYaw - startYaw) * eased;

      // Apply to camera
      this.camera.quaternion.setFromEuler(this.fpEuler);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete, allow mouse input
        this.fpAnimating = false;
      }
    };

    animate();
  }

  /**
   * Get current control mode
   * @returns {string} 'orbit' or 'firstPerson'
   */
  getControlMode() {
    return this.controlMode;
  }

  /**
   * Set first-person movement speed
   * @param {number} speed - Movement speed (units per second)
   */
  setMoveSpeed(speed) {
    this.moveSpeed = speed;
  }

  /**
   * Check if pointer is locked (first-person active)
   * @returns {boolean}
   */
  isPointerLocked() {
    return document.pointerLockElement === this.renderer.domElement;
  }

  /**
   * Update first-person movement (called in animate loop)
   */
  updateFirstPersonMovement(delta) {
    if (this.controlMode !== 'firstPerson' || !this.isPointerLocked()) return;

    // Calculate movement direction relative to camera orientation
    const speed = this.moveSpeed * delta;

    // Get forward and right vectors from camera (ignoring pitch for movement)
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    // Forward is negative Z in camera space, projected onto XZ plane
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // Right is perpendicular to forward on XZ plane
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Apply movement based on keys
    if (this.moveState.forward) {
      this.camera.position.addScaledVector(forward, speed);
    }
    if (this.moveState.backward) {
      this.camera.position.addScaledVector(forward, -speed);
    }
    if (this.moveState.right) {
      this.camera.position.addScaledVector(right, speed);
    }
    if (this.moveState.left) {
      this.camera.position.addScaledVector(right, -speed);
    }
    if (this.moveState.up) {
      this.camera.position.y += speed;
    }
    if (this.moveState.down) {
      this.camera.position.y -= speed;
    }
  }
}

export { Viewer, CAMERA_PRESETS };
