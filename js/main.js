/**
 * main.js - Application entry point
 * Wires up viewer, controls, and UI
 */
import * as THREE from 'three';
import { Viewer } from './viewer.js';
import { LightingManager } from './lighting.js';
import { ModelBuilder, EXAMPLE_SPECS } from './builder.js';
import { AnimationController } from './animations.js';
import { ModelLoader } from './loader.js';
import { ModelExporter } from './exporter.js';
import { PostFXManager } from './postfx.js';
import { CameraSystem } from './camera.js';
import { flipNormalsOnObject } from './terrain/sampler.js';

class App {
  constructor() {
    this.viewer = null;
    this.lighting = null;
    this.builder = null;
    this.animator = null;
    this.loader = null;
    this.exporter = null;
    this.postfx = null;
    this.cameraSystem = null;

    this.init();
  }
  
  async init() {
    // Initialize viewer
    const viewport = document.getElementById('viewport');
    this.viewer = new Viewer(viewport);
    
    // Initialize subsystems
    this.lighting = new LightingManager(this.viewer.getScene(), this.viewer.getRenderer());
    this.builder = new ModelBuilder();
    this.animator = new AnimationController();
    this.loader = new ModelLoader();
    this.exporter = new ModelExporter();
    
    // Initialize post-processing
    this.postfx = new PostFXManager(
      this.viewer.getRenderer(),
      this.viewer.getScene(),
      this.viewer.getCamera()
    );
    
    // Register example specs
    for (const [name, spec] of Object.entries(EXAMPLE_SPECS)) {
      this.builder.registerSpec(spec);
    }
    
    // Apply default lighting
    this.lighting.reset();
    
    // Set up post-processing render callback with animation update
    this.viewer.setRenderCallback(() => {
      this.animator.update();
      this.postfx.render();
    });
    
    // Handle resize for post-processing
    window.addEventListener('resize', () => {
      const w = this.viewer.container.clientWidth;
      const h = this.viewer.container.clientHeight;
      this.postfx.resize(w, h);
    });

    // Initialize camera system for first-person photography
    this.cameraSystem = new CameraSystem(this.viewer, viewport);

    // Setup UI
    this.setupUI();
    
    // Load default model for testing
    this.loadSpec('simpleDrone');
    
    console.log('Samdin initialized');
  }
  
  setupUI() {
    // Model controls
    this.setupModelControls();

    // Lighting controls
    this.setupLightingControls();

    // Environment controls
    this.setupEnvironmentControls();

    // Camera controls
    this.setupCameraControls();

    // Post-processing controls
    this.setupPostControls();

    // Animation controls
    this.setupAnimationControls();

    // Spec editor
    this.setupSpecEditor();

    // Part library
    this.setupPartLibrary();
  }
  
  setupModelControls() {
    const fileInput = document.getElementById('file-input');
    const specFileInput = document.getElementById('spec-file-input');
    const btnLoad = document.getElementById('btn-load');
    const btnLoadSpec = document.getElementById('btn-load-spec');
    const btnPasteSpec = document.getElementById('btn-paste-spec');
    const btnExport = document.getElementById('btn-export');
    const specSelect = document.getElementById('spec-select');
    const btnBuild = document.getElementById('btn-build');
    const qualityTier = document.getElementById('quality-tier');

    // Quality tier — auto-rebuild current model on change
    this.builder.setQualityTier(qualityTier.value);
    qualityTier.addEventListener('change', async (e) => {
      this.builder.setQualityTier(e.target.value);
      const spec = this.viewer.currentModel?.userData?.spec;
      if (spec) {
        const model = await this.builder.build(spec);
        if (model) this.setModel(model, spec);
      }
    });

    // Terrain display mode — live toggle, no rebuild needed.
    const terrainMode = document.getElementById('terrain-mode');
    if (terrainMode) {
      terrainMode.addEventListener('change', (e) => {
        this.viewer.setTerrainDisplay(e.target.value);
      });
    }

    // Flip normals on current selection (or __terrain__ as default)
    const btnFlipNormals = document.getElementById('btn-flip-normals');
    if (btnFlipNormals) {
      btnFlipNormals.addEventListener('click', () => this.flipSelectedNormals());
    }

    // Save spec with persisted normal-flip state
    const btnSaveSpec = document.getElementById('btn-save-spec');
    if (btnSaveSpec) {
      btnSaveSpec.addEventListener('click', () => this.saveCurrentSpec());
    }

    // Paste modal elements
    const pasteModal = document.getElementById('paste-modal');
    const pasteTextarea = document.getElementById('paste-textarea');
    const pasteError = document.getElementById('paste-error');
    const btnPasteCancel = document.getElementById('btn-paste-cancel');
    const btnPasteBuild = document.getElementById('btn-paste-build');
    const modalBackdrop = pasteModal.querySelector('.modal-backdrop');

    // Populate spec dropdown
    const specs = this.builder.getSpecNames();
    for (const name of specs) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      specSelect.appendChild(opt);
    }

    // Load GLTF button
    btnLoad.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        this._showUploadProgress(file.name, 0);
        try {
          const model = await this.loader.loadFromFile(file, (pct) => {
            this._showUploadProgress(file.name, pct);
          });
          this._showUploadProgress(file.name, 100, 'done');
          this.setModel(model);
          if (this.cameraSystem) {
            const name = file.name.replace(/\.(gltf|glb)$/i, '');
            this.cameraSystem.setSpecName(name);
            this.cameraSystem.clearPhotos();
          }
          this._toast(`Loaded ${file.name}`, 'success');
        } catch (err) {
          console.error('Failed to load model:', err);
          this._showUploadProgress(file.name, 100, 'error');
          this._toast(`Failed to load ${file.name}`, 'error');
        }
      }
    });

    // Load Spec File button
    btnLoadSpec.addEventListener('click', () => specFileInput.click());

    specFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        this._showUploadProgress(file.name, 0);
        try {
          this._showUploadProgress(file.name, 30);
          const text = await file.text();
          this._showUploadProgress(file.name, 60);
          const spec = JSON.parse(text);
          if (!this.builder.canBuildSpec(spec)) {
            throw new Error('Spec is not buildable by the current viewer.');
          }
          this.builder.registerSpec(spec);
          this._showUploadProgress(file.name, 80);
          const model = await this.builder.build(spec);
          if (model) {
            this._showUploadProgress(file.name, 100, 'done');
            this.setModel(model, spec);
            if (this.cameraSystem) {
              this.cameraSystem.setSpecName(spec.name);
              this.cameraSystem.clearPhotos();
            }
            this._toast(`Loaded spec: ${spec.name}`, 'success');
          }
        } catch (err) {
          console.error('Failed to load spec file:', err);
          this._showUploadProgress(file.name, 100, 'error');
          this._toast(`Failed to load ${file.name}: ${err.message}`, 'error');
        }
      }
      specFileInput.value = '';
    });

    // Export button
    btnExport.addEventListener('click', async () => {
      if (this.viewer.currentModel) {
        await this.exporter.export(this.viewer.currentModel, { binary: true });
      }
    });

    // Build from spec
    btnBuild.addEventListener('click', () => {
      const specName = specSelect.value;
      if (specName) {
        this.loadSpec(specName);
      }
    });

    // Paste spec modal handlers
    const openPasteModal = () => {
      pasteModal.classList.remove('hidden');
      pasteTextarea.value = '';
      pasteError.textContent = '';
      pasteTextarea.focus();
    };

    const closePasteModal = () => {
      pasteModal.classList.add('hidden');
    };

    const buildFromPaste = async () => {
      const text = pasteTextarea.value.trim();
      if (!text) {
        pasteError.textContent = 'Please paste a spec JSON';
        return;
      }

      try {
        const spec = JSON.parse(text);
        if (!spec.name) {
          pasteError.textContent = 'Spec must have a "name" field';
          return;
        }
        if (!this.builder.canBuildSpec(spec)) {
          pasteError.textContent = 'Spec must be parts-based or top-level CSG';
          return;
        }

        this.builder.registerSpec(spec);
        const model = await this.builder.build(spec);
        if (model) {
          this.setModel(model, spec);
          // Update camera system
          if (this.cameraSystem) {
            this.cameraSystem.setSpecName(spec.name);
            this.cameraSystem.clearPhotos();
          }
          closePasteModal();
          console.log(`Built spec from paste: ${spec.name}`);
        }
      } catch (err) {
        pasteError.textContent = `JSON error: ${err.message}`;
      }
    };

    btnPasteSpec.addEventListener('click', openPasteModal);
    btnPasteCancel.addEventListener('click', closePasteModal);
    modalBackdrop.addEventListener('click', closePasteModal);
    btnPasteBuild.addEventListener('click', buildFromPaste);

    // Ctrl+Enter to build from paste modal
    pasteTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        buildFromPaste();
      }
      if (e.key === 'Escape') {
        closePasteModal();
      }
    });
  }
  
  setupLightingControls() {
    const lightingSelect = document.getElementById('lighting-select');
    const intensitySlider = document.getElementById('light-intensity');
    const azimuthSlider = document.getElementById('light-azimuth');
    const elevationSlider = document.getElementById('light-elevation');
    const lightColor = document.getElementById('light-color');
    const shadowQuality = document.getElementById('shadow-quality');
    const exposureSlider = document.getElementById('exposure');

    lightingSelect.addEventListener('change', (e) => {
      this.lighting.applyPreset(e.target.value);
    });

    intensitySlider.addEventListener('input', (e) => {
      this.lighting.setIntensity(parseFloat(e.target.value));
    });

    const updateKeyLight = () => {
      const azimuth = parseFloat(azimuthSlider.value);
      const elevation = parseFloat(elevationSlider.value);
      this.lighting.setKeyLightPosition(azimuth, elevation);
    };

    azimuthSlider.addEventListener('input', updateKeyLight);
    elevationSlider.addEventListener('input', updateKeyLight);

    lightColor.addEventListener('input', (e) => {
      this.lighting.setKeyLightColor(e.target.value);
    });

    shadowQuality.addEventListener('change', (e) => {
      this.lighting.setShadowQuality(e.target.value);
    });

    exposureSlider.addEventListener('input', (e) => {
      this.viewer.setExposure(parseFloat(e.target.value));
    });
  }
  
  setupEnvironmentControls() {
    const envSelect = document.getElementById('env-select');
    const envColor = document.getElementById('env-color');
    const envFloor = document.getElementById('env-floor');
    const envMapSelect = document.getElementById('env-map-select');
    const envMapIntensity = document.getElementById('env-map-intensity');
    const envIntensityGroup = document.getElementById('env-intensity-group');
    const envGroundReflect = document.getElementById('env-ground-reflect');

    const updateEnv = () => {
      this.viewer.setBackground(envSelect.value, envColor.value);
    };

    envSelect.addEventListener('change', updateEnv);
    envColor.addEventListener('input', updateEnv);

    envFloor.addEventListener('change', (e) => {
      this.viewer.setFloorVisible(e.target.checked);
    });

    envMapSelect.addEventListener('change', (e) => {
      this.lighting.setEnvironment(e.target.value);
      envIntensityGroup.style.display = e.target.value === 'none' ? 'none' : '';
    });

    envMapIntensity.addEventListener('input', (e) => {
      this.lighting.setEnvMapIntensity(parseFloat(e.target.value));
    });

    envGroundReflect.addEventListener('change', (e) => {
      this.viewer.setGroundReflective(e.target.checked);
    });
  }

  setupCameraControls() {
    const cameraMode = document.getElementById('camera-mode');
    const cameraSelect = document.getElementById('camera-select');
    const btnFit = document.getElementById('btn-fit');
    const btnScreenshot = document.getElementById('btn-screenshot');
    const camWireframe = document.getElementById('cam-wireframe');
    const camAutorotate = document.getElementById('cam-autorotate');
    const camRotateSpeed = document.getElementById('cam-rotate-speed');
    const fpSpeed = document.getElementById('fp-speed');
    const fpSpeedLabel = document.getElementById('fp-speed-label');
    const fpCrosshair = document.getElementById('fp-crosshair');
    const viewport = document.getElementById('viewport');

    // UI elements to show/hide based on mode
    const orbitControls = document.querySelectorAll('.orbit-controls');
    const fpControlsUI = document.querySelectorAll('.fp-controls');
    const fpHint = document.querySelectorAll('.fp-hint');

    // Camera mode switching
    cameraMode.addEventListener('change', (e) => {
      const mode = e.target.value;
      this.viewer.setControlMode(mode);

      // Toggle UI visibility
      orbitControls.forEach(el => el.style.display = mode === 'orbit' ? '' : 'none');
      fpControlsUI.forEach(el => el.style.display = mode === 'firstPerson' ? '' : 'none');
      fpHint.forEach(el => el.style.display = mode === 'firstPerson' ? '' : 'none');
    });

    // First-person speed control
    fpSpeed.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      fpSpeedLabel.textContent = speed.toFixed(1);
      this.viewer.setMoveSpeed(speed);
    });

    // Handle pointer lock events from viewer
    viewport.addEventListener('fpLocked', () => {
      fpCrosshair.classList.remove('hidden');
      viewport.classList.add('fp-active');
    });

    viewport.addEventListener('fpUnlocked', () => {
      fpCrosshair.classList.add('hidden');
      viewport.classList.remove('fp-active');
      // Reset mode selector to orbit if user pressed Escape
      cameraMode.value = 'orbit';
      orbitControls.forEach(el => el.style.display = '');
      fpControlsUI.forEach(el => el.style.display = 'none');
      fpHint.forEach(el => el.style.display = 'none');
      this.viewer.setControlMode('orbit');
      // Deactivate camera system when leaving first-person
      if (this.cameraSystem) {
        this.cameraSystem.deactivate();
      }
    });

    // Camera system controls
    const cameraAspect = document.getElementById('camera-aspect');
    const cameraFlash = document.getElementById('camera-flash');

    if (cameraAspect && this.cameraSystem) {
      cameraAspect.addEventListener('change', (e) => {
        this.cameraSystem.setAspectRatio(e.target.value);
      });
    }

    if (cameraFlash && this.cameraSystem) {
      cameraFlash.addEventListener('change', (e) => {
        this.cameraSystem.flashEnabled = e.target.checked;
      });
    }

    cameraSelect.addEventListener('change', (e) => {
      this.viewer.setCameraPreset(e.target.value);
    });

    btnFit.addEventListener('click', () => {
      this.viewer.fitToModel();
    });

    btnScreenshot.addEventListener('click', () => {
      this.viewer.takeScreenshot();
    });

    camWireframe.addEventListener('change', (e) => {
      this.postfx.wireframeBypass = e.target.checked;
      this.viewer.setWireframe(e.target.checked);
    });

    camAutorotate.addEventListener('change', (e) => {
      camRotateSpeed.disabled = !e.target.checked;
      this.viewer.setAutoRotate(e.target.checked);
    });

    camRotateSpeed.addEventListener('input', (e) => {
      this.viewer.setAutoRotateSpeed(parseFloat(e.target.value));
    });

    // Design grid toggle
    const camDesignGrid = document.getElementById('cam-design-grid');
    camDesignGrid.addEventListener('change', (e) => {
      this.viewer.setDesignGridVisible(e.target.checked);
    });

    // Part selection events (viewport already declared above)
    const partDetails = document.querySelector('.part-details');
    const noSelection = document.querySelector('.no-selection');
    const partName = document.getElementById('part-name');
    const partPosition = document.getElementById('part-position');
    const partGeometry = document.getElementById('part-geometry');

    viewport.addEventListener('partSelected', (e) => {
      const { name, position, geometry } = e.detail;
      partName.textContent = name;
      partPosition.textContent = position.map(v => v.toFixed(2)).join(', ');
      partGeometry.textContent = geometry;
      partDetails.style.display = 'block';
      noSelection.style.display = 'none';
    });

    viewport.addEventListener('partDeselected', () => {
      partDetails.style.display = 'none';
      noSelection.style.display = 'block';
    });

    // Transform events — update inspector with live values
    viewport.addEventListener('specChanged', (e) => {
      const selected = this.viewer.selectedPart;
      if (selected) {
        const pos = selected.getWorldPosition(new THREE.Vector3()).toArray();
        partPosition.textContent = pos.map(v => v.toFixed(2)).join(', ');
        // Update highlight box
        this.viewer.highlightBox.setFromObject(selected);
      }
      // Update spec editor if open
      const editorTextarea = document.getElementById('editor-textarea');
      const editorPanel = document.getElementById('editor-panel');
      if (e.detail?.spec && editorPanel && !editorPanel.classList.contains('hidden')) {
        editorTextarea.value = JSON.stringify(e.detail.spec, null, 2);
      }
    });

    viewport.addEventListener('partDeleted', () => {
      partDetails.style.display = 'none';
      noSelection.style.display = 'block';
      this.viewer.highlightBox.visible = false;
    });
  }

  setupPostControls() {
    const fxSsao = document.getElementById('fx-ssao');
    const fxSsaoRadius = document.getElementById('fx-ssao-radius');
    const fxBloom = document.getElementById('fx-bloom');
    const fxOutline = document.getElementById('fx-outline');
    const fxPixel = document.getElementById('fx-pixel');
    const fxPixelSize = document.getElementById('fx-pixel-size');
    const fxVignette = document.getElementById('fx-vignette');
    const fxVignetteIntensity = document.getElementById('fx-vignette-intensity');
    const fxChromatic = document.getElementById('fx-chromatic');
    const fxChromaticAmount = document.getElementById('fx-chromatic-amount');
    const fxGrain = document.getElementById('fx-grain');
    const fxGrainIntensity = document.getElementById('fx-grain-intensity');
    const fxScanlines = document.getElementById('fx-scanlines');
    const fxScanlinesIntensity = document.getElementById('fx-scanlines-intensity');
    const fxFxaa = document.getElementById('fx-fxaa');
    const fxColorgrade = document.getElementById('fx-colorgrade');
    const colorGradeControls = document.querySelector('.color-grade-controls');
    const fxHue = document.getElementById('fx-hue');
    const fxSaturation = document.getElementById('fx-saturation');
    const fxBrightness = document.getElementById('fx-brightness');
    const fxContrast = document.getElementById('fx-contrast');

    // SSAO
    fxSsao.addEventListener('change', (e) => {
      fxSsaoRadius.disabled = !e.target.checked;
      this.postfx.setSSAO(e.target.checked, { kernelRadius: parseInt(fxSsaoRadius.value) });
    });

    fxSsaoRadius.addEventListener('input', (e) => {
      this.postfx.setSSAO(true, { kernelRadius: parseInt(e.target.value) });
    });

    // DoF
    const fxDof = document.getElementById('fx-dof');
    const fxDofFocus = document.getElementById('fx-dof-focus');
    const fxDofAperture = document.getElementById('fx-dof-aperture');

    fxDof.addEventListener('change', (e) => {
      fxDofFocus.disabled = !e.target.checked;
      fxDofAperture.disabled = !e.target.checked;
      this.postfx.setDOF(e.target.checked, {
        focus: parseFloat(fxDofFocus.value),
        aperture: parseFloat(fxDofAperture.value)
      });
    });

    fxDofFocus.addEventListener('input', (e) => {
      this.postfx.setDOF(true, { focus: parseFloat(e.target.value) });
    });

    fxDofAperture.addEventListener('input', (e) => {
      this.postfx.setDOF(true, { aperture: parseFloat(e.target.value) });
    });

    // SSR
    const fxSsr = document.getElementById('fx-ssr');
    const fxSsrOpacity = document.getElementById('fx-ssr-opacity');

    fxSsr.addEventListener('change', (e) => {
      fxSsrOpacity.disabled = !e.target.checked;
      this.postfx.setSSR(e.target.checked, { opacity: parseFloat(fxSsrOpacity.value) });
    });

    fxSsrOpacity.addEventListener('input', (e) => {
      this.postfx.setSSR(true, { opacity: parseFloat(e.target.value) });
    });

    fxBloom.addEventListener('change', (e) => {
      this.postfx.setBloom(e.target.checked);
    });

    fxOutline.addEventListener('change', (e) => {
      this.postfx.setOutline(e.target.checked);
      // Set current model as outline target
      if (e.target.checked && this.viewer.currentModel) {
        const meshes = [];
        this.viewer.currentModel.traverse((child) => {
          if (child.isMesh) meshes.push(child);
        });
        this.postfx.setOutlineObjects(meshes);
      }
    });

    fxPixel.addEventListener('change', (e) => {
      fxPixelSize.disabled = !e.target.checked;
      this.postfx.setPixel(e.target.checked, { size: parseInt(fxPixelSize.value) });
    });

    fxPixelSize.addEventListener('input', (e) => {
      this.postfx.setPixel(true, { size: parseInt(e.target.value) });
    });

    // Vignette
    fxVignette.addEventListener('change', (e) => {
      fxVignetteIntensity.disabled = !e.target.checked;
      this.postfx.setVignette(e.target.checked, { intensity: parseFloat(fxVignetteIntensity.value) });
    });

    fxVignetteIntensity.addEventListener('input', (e) => {
      this.postfx.setVignette(true, { intensity: parseFloat(e.target.value) });
    });

    // Chromatic Aberration
    fxChromatic.addEventListener('change', (e) => {
      fxChromaticAmount.disabled = !e.target.checked;
      this.postfx.setChromatic(e.target.checked, { amount: parseFloat(fxChromaticAmount.value) });
    });

    fxChromaticAmount.addEventListener('input', (e) => {
      this.postfx.setChromatic(true, { amount: parseFloat(e.target.value) });
    });

    // Film Grain
    fxGrain.addEventListener('change', (e) => {
      fxGrainIntensity.disabled = !e.target.checked;
      this.postfx.setGrain(e.target.checked, { intensity: parseFloat(fxGrainIntensity.value) });
    });

    fxGrainIntensity.addEventListener('input', (e) => {
      this.postfx.setGrain(true, { intensity: parseFloat(e.target.value) });
    });

    // Scanlines
    fxScanlines.addEventListener('change', (e) => {
      fxScanlinesIntensity.disabled = !e.target.checked;
      this.postfx.setScanlines(e.target.checked, { intensity: parseFloat(fxScanlinesIntensity.value) });
    });

    fxScanlinesIntensity.addEventListener('input', (e) => {
      this.postfx.setScanlines(true, { intensity: parseFloat(e.target.value) });
    });

    // FXAA
    fxFxaa.addEventListener('change', (e) => {
      this.postfx.setFXAA(e.target.checked);
    });

    // Color Grading
    fxColorgrade.addEventListener('change', (e) => {
      colorGradeControls.style.display = e.target.checked ? 'block' : 'none';
      this.postfx.setColorGrade(e.target.checked, {
        hue: parseFloat(fxHue.value),
        saturation: parseFloat(fxSaturation.value),
        brightness: parseFloat(fxBrightness.value),
        contrast: parseFloat(fxContrast.value)
      });
    });

    const updateColorGrade = () => {
      this.postfx.setColorGrade(true, {
        hue: parseFloat(fxHue.value),
        saturation: parseFloat(fxSaturation.value),
        brightness: parseFloat(fxBrightness.value),
        contrast: parseFloat(fxContrast.value)
      });
    };

    fxHue.addEventListener('input', updateColorGrade);
    fxSaturation.addEventListener('input', updateColorGrade);
    fxBrightness.addEventListener('input', updateColorGrade);
    fxContrast.addEventListener('input', updateColorGrade);
  }
  
  setupAnimationControls() {
    const clipControls = document.getElementById('clip-controls');
    const clipSpeedGroup = document.getElementById('clip-speed-group');
    const clipSelect = document.getElementById('clip-select');
    const clipSpeed = document.getElementById('clip-speed');
    const clipSpeedLabel = document.getElementById('clip-speed-label');
    const animSelect = document.getElementById('anim-select');
    const btnPlay = document.getElementById('btn-play');
    const btnStop = document.getElementById('btn-stop');
    const stateSelect = document.getElementById('state-select');

    // Store references for later use
    this.clipControls = clipControls;
    this.clipSpeedGroup = clipSpeedGroup;
    this.clipSelect = clipSelect;

    // State selector for spec-defined animations
    if (stateSelect) {
      stateSelect.addEventListener('change', (e) => {
        if (e.target.value && this.animator.specAnimator) {
          this.animator.specAnimator.setState(e.target.value);
        }
      });
    }

    // GLTF clip selection
    clipSelect.addEventListener('change', (e) => {
      const clipName = e.target.value;
      if (clipName) {
        this.animator.playClip(clipName, { timeScale: parseFloat(clipSpeed.value) });
      } else {
        this.animator.stopClip();
      }
    });

    // Clip playback speed
    clipSpeed.addEventListener('input', (e) => {
      const speed = parseFloat(e.target.value);
      clipSpeedLabel.textContent = `${speed.toFixed(1)}x`;
      // Update current action if playing
      if (this.animator.activeAction) {
        this.animator.activeAction.timeScale = speed;
      }
    });

    // Anime.js behavior play
    btnPlay.addEventListener('click', () => {
      const behavior = animSelect.value;
      if (behavior && this.viewer.currentModel) {
        this.animator.play(behavior, this.viewer.currentModel);
      }
    });

    // Stop all animations
    btnStop.addEventListener('click', () => {
      this.animator.stopEverything();
      clipSelect.value = '';
      if (stateSelect) {
        stateSelect.value = '';
      }
    });
  }

  setupSpecEditor() {
    const editorPanel = document.getElementById('editor-panel');
    const editorTextarea = document.getElementById('editor-textarea');
    const editorLineNumbers = document.getElementById('editor-line-numbers');
    const editorStatus = document.getElementById('editor-status-text');
    const editorLivePreview = document.getElementById('editor-live-preview');
    const btnOpenEditor = document.getElementById('btn-open-editor');
    const btnEditorBuild = document.getElementById('btn-editor-build');
    const btnEditorClose = document.getElementById('btn-editor-close');

    let debounceTimer = null;

    // Update line numbers
    const updateLineNumbers = () => {
      const lines = editorTextarea.value.split('\n').length;
      let html = '';
      for (let i = 1; i <= lines; i++) {
        html += i + '\n';
      }
      editorLineNumbers.textContent = html;
    };

    // Sync scroll between textarea and line numbers
    editorTextarea.addEventListener('scroll', () => {
      editorLineNumbers.scrollTop = editorTextarea.scrollTop;
    });

    // Build from editor content
    const buildFromEditor = async () => {
      const text = editorTextarea.value.trim();
      if (!text) {
        editorStatus.textContent = 'Empty spec';
        editorStatus.className = 'error';
        return;
      }

      try {
        const spec = JSON.parse(text);
        if (!this.builder.canBuildSpec(spec)) {
          editorStatus.textContent = 'Spec must be parts-based or top-level CSG';
          editorStatus.className = 'error';
          return;
        }

        this.builder.registerSpec(spec);
        const model = await this.builder.build(spec);
        if (model) {
          this.setModel(model, spec);
          editorStatus.textContent = `Built: ${spec.name}`;
          editorStatus.className = 'success';
        }
      } catch (err) {
        editorStatus.textContent = `Error: ${err.message}`;
        editorStatus.className = 'error';
      }
    };

    // Handle input with debounced live preview
    editorTextarea.addEventListener('input', () => {
      updateLineNumbers();

      if (editorLivePreview.checked) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(buildFromEditor, 500);
      }
    });

    // Open editor
    btnOpenEditor.addEventListener('click', () => {
      editorPanel.classList.remove('hidden');
      updateLineNumbers();

      // Load current spec if available
      if (this.viewer.currentModel?.userData?.spec) {
        editorTextarea.value = JSON.stringify(this.viewer.currentModel.userData.spec, null, 2);
        updateLineNumbers();
      }
    });

    // Close editor
    btnEditorClose.addEventListener('click', () => {
      editorPanel.classList.add('hidden');
    });

    // Manual build button
    btnEditorBuild.addEventListener('click', buildFromEditor);

    // Tab key for indentation
    editorTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        editorTextarea.value = editorTextarea.value.substring(0, start) + '  ' + editorTextarea.value.substring(end);
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
        updateLineNumbers();
      }
    });
  }

  setupPartLibrary() {
    // Part templates for each type
    const PRIMITIVES = [
      { name: 'box', template: { type: 'box', params: [1, 1, 1] } },
      { name: 'sphere', template: { type: 'sphere', params: [0.5] } },
      { name: 'cylinder', template: { type: 'cylinder', params: [0.5, 0.5, 1, 16] } },
      { name: 'cone', template: { type: 'cone', params: [0.5, 1, 16] } },
      { name: 'torus', template: { type: 'torus', params: [0.5, 0.2, 16, 32] } },
      { name: 'capsule', template: { type: 'capsule', params: [0.3, 0.5, 8] } },
      { name: 'roundedBox', template: { type: 'roundedBox', params: [1, 1, 1, 0.1, 2] } },
      { name: 'plane', template: { type: 'plane', params: [2, 2] } },
      { name: 'group', template: { type: 'group' } }
    ];

    const PREFABS = [
      { name: 'tuk-tuk', template: { type: 'prefab', src: 'tuk-tuk' } },
      { name: 'motorbike', template: { type: 'prefab', src: 'motorbike' } },
      { name: 'street-lamp', template: { type: 'prefab', src: 'street-lamp' } },
      { name: 'street-vendor', template: { type: 'prefab', src: 'street-vendor' } },
      { name: 'seven-eleven', template: { type: 'prefab', src: 'seven-eleven' } },
      { name: 'catwalk-segment', template: { type: 'prefab', src: 'catwalk-segment' } },
      { name: 'pipe-rack', template: { type: 'prefab', src: 'pipe-rack' } },
      { name: 'factory-wall-bay', template: { type: 'prefab', src: 'factory-wall-bay' } },
      { name: 'broken-column', template: { type: 'prefab', src: 'broken-column' } },
      { name: 'arch-fragment', template: { type: 'prefab', src: 'arch-fragment' } },
      { name: 'machine-altar', template: { type: 'prefab', src: 'machine-altar' } },
      { name: 'hazard-gate', template: { type: 'prefab', src: 'hazard-gate' } }
    ];

    const CSG_PRIMITIVES = [
      { name: 'hollowBox', template: { type: 'hollowBox', params: [1, 1, 1, 0.1] } },
      { name: 'hollowCyl', template: { type: 'hollowCylinder', params: [0.5, 0.3, 1, 16] } },
      { name: 'tube', template: { type: 'tube', params: [0.5, 0.4, 1, 16] } },
      { name: 'ibeam', template: { type: 'ibeam', params: [0.5, 1, 2] } },
      { name: 'lbeam', template: { type: 'lbeam', params: [0.5, 1, 2] } },
      { name: 'channel', template: { type: 'channel', params: [0.5, 1, 2] } },
      { name: 'bracket', template: { type: 'bracket', params: [0.5, 0.5, 0.5, 0.08] } },
      { name: 'gear', template: { type: 'gear', params: [0.5, 0.1, 12, 0.15] } },
      { name: 'dome', template: { type: 'dome', params: [0.5, 0.05, 16] } },
      { name: 'arch', template: { type: 'arch', params: [1, 1.5, 0.3, 0.2, 16] } },
      { name: 'stairs', template: { type: 'stairs', params: [1, 1, 0.5, 5] } },
      { name: 'wedge', template: { type: 'wedge', params: [1, 0.5, 1] } },
      { name: 'prism', template: { type: 'prism', params: [0.5, 1, 6] } }
    ];

    // Populate grids
    const primitivesGrid = document.getElementById('primitives-grid');
    const prefabsGrid = document.getElementById('prefabs-grid');
    const csgGrid = document.getElementById('csg-grid');

    const createLibItem = (item, container) => {
      const el = document.createElement('div');
      el.className = 'lib-item';
      el.textContent = item.name;
      el.title = JSON.stringify(item.template, null, 2);

      el.addEventListener('click', async () => {
        const partDef = {
          name: `${item.name}_${Date.now() % 10000}`,
          ...item.template,
          position: [0, 0, 0]
        };
        const json = JSON.stringify(partDef, null, 2);

        try {
          await navigator.clipboard.writeText(json);
          el.classList.add('copied');
          setTimeout(() => el.classList.remove('copied'), 500);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      });

      container.appendChild(el);
    };

    PRIMITIVES.forEach(p => createLibItem(p, primitivesGrid));
    PREFABS.forEach(p => createLibItem(p, prefabsGrid));
    CSG_PRIMITIVES.forEach(p => createLibItem(p, csgGrid));

    // Tab switching
    const tabs = document.querySelectorAll('.lib-tab');
    const panels = document.querySelectorAll('.lib-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.querySelector(`[data-panel="${target}"]`).classList.add('active');
      });
    });
  }

  /**
   * Build and load a model from spec name
   */
  async loadSpec(name) {
    const model = await this.builder.buildByName(name);
    if (model) {
      this.setModel(model, model.userData?.spec || this.builder.specs.get(name) || null);
      // Update camera system with spec name and clear photos
      if (this.cameraSystem) {
        this.cameraSystem.setSpecName(name);
        this.cameraSystem.clearPhotos();
      }
    }
  }
  
  /**
   * Set the current model and update UI
   */
  setModel(model, explicitSpec = null) {
    // Stop any running animations
    this.animator.stopEverything();

    const spec = explicitSpec || model?.userData?.spec || null;
    this.applySpecSettings(spec);

    // Add to viewer
    const info = this.viewer.addModel(model);

    // Set model for animation controller and get clip names
    const clipNames = this.animator.setModel(model);

    // Update animation clip dropdown
    this.updateClipDropdown(clipNames);

    // Initialize spec animations if present
    const specAnimator = this.animator.initSpecAnimator(model, this.viewer.getScene());
    this.updateStateDropdown(specAnimator);

    const cameraSpec = spec?.scene?.camera || null;
    if (cameraSpec?.preset) {
      this.viewer.setCameraPreset(cameraSpec);
      if (cameraSpec.fit) {
        setTimeout(() => this.viewer.fitToModel(), 550);
      }
    } else if (cameraSpec?.fit) {
      this.viewer.fitToModel();
    }

    // Update outline pass objects if outline is enabled
    if (this.postfx.enabled.outline) {
      const meshes = [];
      model.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
      this.postfx.setOutlineObjects(meshes);
    }

    // Update info display
    document.getElementById('info-tris').textContent = info.tris;
    document.getElementById('info-verts').textContent = info.verts;
    document.getElementById('info-objects').textContent = info.objects;
  }

  /**
   * Flip normals on the current selection, or on the generated terrain mesh
   * if nothing is selected. Toggles userData.normalsFlipped so the state can
   * be persisted via saveCurrentSpec().
   */
  flipSelectedNormals() {
    const model = this.viewer?.currentModel;
    if (!model) {
      console.warn('[flipNormals] no model loaded');
      return;
    }

    let target = this.viewer.selectedPart || null;
    let label = target?.name || null;

    if (!target) {
      model.traverse((child) => {
        if (!target && child.name === '__terrain__') target = child;
      });
      label = '__terrain__ (default)';
    }

    if (!target) {
      console.warn('[flipNormals] no selection and no __terrain__ mesh present');
      return;
    }

    flipNormalsOnObject(target);
    console.log(
      `[flipNormals] flipped ${label} — userData.normalsFlipped=${!!target.userData.normalsFlipped}`
    );
  }

  /**
   * Download the current spec as JSON, persisting any runtime normal-flip
   * state. Writes scene.terrain.flipNormals for the generated terrain, and
   * part.flipNormals for individual parts with userData.normalsFlipped.
   */
  saveCurrentSpec() {
    const model = this.viewer?.currentModel;
    const spec = model?.userData?.spec;
    if (!spec) {
      console.warn('[saveSpec] no spec attached to current model');
      return;
    }

    const out = JSON.parse(JSON.stringify(spec));

    // Generated terrain → scene.terrain.flipNormals
    let terrainMesh = null;
    model.traverse((child) => {
      if (!terrainMesh && child.name === '__terrain__') terrainMesh = child;
    });
    if (terrainMesh) {
      out.scene = out.scene || {};
      out.scene.terrain = out.scene.terrain || {};
      out.scene.terrain.flipNormals = !!terrainMesh.userData.normalsFlipped;
    }

    // Per-part flips
    if (Array.isArray(out.parts)) {
      const flippedByName = new Map();
      model.traverse((child) => {
        if (child === terrainMesh) return;
        if (!child.name) return;
        if (child.userData?.normalsFlipped) {
          flippedByName.set(child.name, true);
        }
      });
      for (const part of out.parts) {
        if (part?.name && flippedByName.has(part.name)) {
          part.flipNormals = true;
        } else if (part && part.flipNormals === true && !flippedByName.has(part.name)) {
          // Was flipped in spec, now toggled off — clear the flag
          delete part.flipNormals;
        }
      }
    }

    const json = JSON.stringify(out, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${out.name || 'spec'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`[saveSpec] downloaded ${a.download}`);
  }

  applySpecSettings(spec) {
    this.viewer.resetSceneSettings();
    this.lighting.reset();
    this.postfx.reset();

    const scene = spec?.scene || null;
    if (!scene) {
      this.syncSceneControls();
      return;
    }

    if (scene.background) {
      this.viewer.setBackground(scene.background);
    }

    if (scene.floor) {
      this.viewer.setFloorVisible(scene.floor.visible !== false);
    }

    if (scene.fog) {
      this.viewer.setFog(scene.fog);
    }

    if (scene.toneMapping) {
      this.viewer.setToneMapping(scene.toneMapping);
    }

    if (scene.exposure !== undefined) {
      this.viewer.setExposure(scene.exposure);
    }

    if (scene.quality) {
      this.builder.setQualityTier(scene.quality);
      const qel = document.getElementById('quality-tier');
      if (qel) qel.value = scene.quality;
    }

    if (scene.lighting) {
      this.lighting.applyConfig(scene.lighting);
      if (scene.lighting.environment) {
        this.lighting.setEnvironment(scene.lighting.environment);
      }
      if (scene.lighting.envMapIntensity !== undefined) {
        this.lighting.setEnvMapIntensity(scene.lighting.envMapIntensity);
      }
    }

    if (scene.ground) {
      this.viewer.setGroundReflective(scene.ground.reflective === true);
    }

    if (scene.postfx) {
      this.postfx.applyConfig(scene.postfx);
    }

    if (scene.terrain && scene.terrain.enabled) {
      const mode = scene.terrain.display || 'terrain';
      this.viewer.setTerrainDisplay(mode);
      const tel = document.getElementById('terrain-mode');
      if (tel) tel.value = mode;
    }

    this.syncSceneControls(scene);
  }

  syncSceneControls(scene = null) {
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined) el.value = value;
    };
    const setChecked = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined) el.checked = !!value;
    };

    const background = scene?.background || { type: 'solid', color: '#1a1a2e' };
    setValue('env-select', background.type || 'solid');
    setValue('env-color', background.color || '#1a1a2e');
    setChecked('env-floor', scene?.floor?.visible !== false);

    const lighting = scene?.lighting || { preset: 'studio', intensity: 1, shadowQuality: 'medium' };
    if (lighting.preset) setValue('lighting-select', lighting.preset);
    if (lighting.intensity !== undefined) setValue('light-intensity', lighting.intensity);
    if (lighting.shadowQuality) setValue('shadow-quality', lighting.shadowQuality);
    setValue('env-map-select', lighting.environment || 'none');
    const envIG = document.getElementById('env-intensity-group');
    if (envIG) envIG.style.display = lighting.environment && lighting.environment !== 'none' ? '' : 'none';
    if (lighting.envMapIntensity !== undefined) setValue('env-map-intensity', lighting.envMapIntensity);
    if (scene?.exposure !== undefined) setValue('exposure', scene.exposure);

    const postfx = scene?.postfx || {};
    setChecked('fx-ssao', postfx.ssao?.enabled);
    setChecked('fx-dof', postfx.dof?.enabled);
    setChecked('fx-ssr', postfx.ssr?.enabled);
    setChecked('fx-bloom', postfx.bloom?.enabled);
    setChecked('fx-outline', postfx.outline?.enabled);
    if (postfx.dof?.focus !== undefined) setValue('fx-dof-focus', postfx.dof.focus);
    if (postfx.dof?.aperture !== undefined) setValue('fx-dof-aperture', postfx.dof.aperture);
    if (postfx.ssr?.opacity !== undefined) setValue('fx-ssr-opacity', postfx.ssr.opacity);
    setChecked('fx-pixel', postfx.pixel?.enabled);
    setChecked('fx-vignette', postfx.vignette?.enabled);
    setChecked('fx-chromatic', postfx.chromatic?.enabled);
    setChecked('fx-grain', postfx.grain?.enabled);
    setChecked('fx-scanlines', postfx.scanlines?.enabled);
    setChecked('fx-fxaa', typeof postfx.fxaa === 'object' ? postfx.fxaa.enabled : postfx.fxaa);
    setChecked('fx-colorgrade', postfx.colorGrade?.enabled);

    if (postfx.ssao?.kernelRadius !== undefined) setValue('fx-ssao-radius', postfx.ssao.kernelRadius);
    if (postfx.pixel?.size !== undefined) setValue('fx-pixel-size', postfx.pixel.size);
    if (postfx.vignette?.intensity !== undefined) setValue('fx-vignette-intensity', postfx.vignette.intensity);
    if (postfx.chromatic?.amount !== undefined) setValue('fx-chromatic-amount', postfx.chromatic.amount);
    if (postfx.grain?.intensity !== undefined) setValue('fx-grain-intensity', postfx.grain.intensity);
    if (postfx.scanlines?.intensity !== undefined) setValue('fx-scanlines-intensity', postfx.scanlines.intensity);
    if (postfx.colorGrade?.hue !== undefined) setValue('fx-hue', postfx.colorGrade.hue);
    if (postfx.colorGrade?.saturation !== undefined) setValue('fx-saturation', postfx.colorGrade.saturation);
    if (postfx.colorGrade?.brightness !== undefined) setValue('fx-brightness', postfx.colorGrade.brightness);
    if (postfx.colorGrade?.contrast !== undefined) setValue('fx-contrast', postfx.colorGrade.contrast);
  }

  /**
   * Update the GLTF animation clip dropdown
   */
  updateClipDropdown(clipNames) {
    // Clear existing options (except first "select" option)
    while (this.clipSelect.options.length > 1) {
      this.clipSelect.remove(1);
    }

    if (clipNames.length > 0) {
      // Add clip options
      for (const name of clipNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        this.clipSelect.appendChild(opt);
      }

      // Show clip controls
      this.clipControls.style.display = '';
      this.clipSpeedGroup.style.display = '';
    } else {
      // Hide clip controls if no animations
      this.clipControls.style.display = 'none';
      this.clipSpeedGroup.style.display = 'none';
    }

    // Reset selection
    this.clipSelect.value = '';
  }

  /**
   * Update the animation state dropdown for spec-defined animations
   * @param {SpecAnimator|null} specAnimator
   */
  updateStateDropdown(specAnimator) {
    const stateSelect = document.getElementById('state-select');
    const stateControls = document.getElementById('state-controls');

    if (!stateSelect || !stateControls) {
      console.warn('[App] State controls not found in DOM');
      return;
    }

    // Clear existing options except the placeholder
    while (stateSelect.options.length > 1) {
      stateSelect.remove(1);
    }

    if (specAnimator) {
      const states = specAnimator.getStateNames();

      // Add state options
      states.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        stateSelect.appendChild(opt);
      });

      // Show controls if there are states
      stateControls.style.display = states.length > 0 ? '' : 'none';

      // Auto-play idle or default state
      if (states.includes('idle')) {
        specAnimator.setState('idle');
        stateSelect.value = 'idle';
      } else if (states.includes('default')) {
        specAnimator.setState('default');
        stateSelect.value = 'default';
      }
    } else {
      // Hide state controls if no spec animator
      stateControls.style.display = 'none';
    }

    // Reset selection
    stateSelect.value = stateSelect.value || '';
  }

  _showUploadProgress(filename, percent, state) {
    const el = document.getElementById('upload-progress');
    const nameEl = document.getElementById('upload-filename');
    const pctEl = document.getElementById('upload-percent');
    const barEl = document.getElementById('upload-bar-fill');

    el.classList.add('active');
    nameEl.textContent = filename;
    pctEl.textContent = `${Math.round(percent)}%`;
    barEl.style.width = `${percent}%`;
    barEl.classList.remove('done', 'error');
    if (state) barEl.classList.add(state);

    if (state === 'done' || state === 'error') {
      clearTimeout(this._uploadHideTimer);
      this._uploadHideTimer = setTimeout(() => {
        el.classList.remove('active');
      }, 2500);
    }
  }

  _toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }
}

// Start app when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
