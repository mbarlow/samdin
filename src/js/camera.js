/**
 * camera.js - First-person camera photography system
 * Handles viewfinder, screenshots, polaroid gallery, and export
 */
import * as THREE from 'three';

const ASPECT_RATIOS = {
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2
};

class CameraSystem {
  constructor(viewer, container) {
    this.viewer = viewer;
    this.container = container;

    // State
    this.isActive = false;           // Right mouse held
    this.viewfinderSize = 0.4;       // 40% of viewport (0.1 to 0.9)
    this.aspectRatio = '1:1';
    this.flashEnabled = true;
    this.photos = [];                // Array of captured photos
    this.currentSpecName = 'untitled';

    // DOM elements (created in init)
    this.viewfinder = null;
    this.polaroidStrip = null;
    this.flashOverlay = null;
    this.expandedView = null;

    this.init();
  }

  init() {
    this.createViewfinder();
    this.createPolaroidStrip();
    this.createFlashOverlay();
    this.createExpandedView();
    this.setupEventListeners();
  }

  createViewfinder() {
    this.viewfinder = document.createElement('div');
    this.viewfinder.id = 'camera-viewfinder';
    this.viewfinder.className = 'hidden';
    this.viewfinder.innerHTML = `
      <div class="vf-frame">
        <div class="vf-corner vf-tl"></div>
        <div class="vf-corner vf-tr"></div>
        <div class="vf-corner vf-bl"></div>
        <div class="vf-corner vf-br"></div>
        <div class="vf-grid"></div>
        <div class="vf-info">
          <span class="vf-ratio">1:1</span>
          <span class="vf-flash">FLASH</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.viewfinder);
  }

  createPolaroidStrip() {
    this.polaroidStrip = document.createElement('div');
    this.polaroidStrip.id = 'polaroid-strip';
    this.polaroidStrip.innerHTML = `
      <div class="polaroid-container"></div>
      <button id="export-photos" class="hidden" title="Export all photos">Export</button>
    `;
    document.body.appendChild(this.polaroidStrip);

    // Export button handler
    const exportBtn = this.polaroidStrip.querySelector('#export-photos');
    exportBtn.addEventListener('click', () => this.exportAllPhotos());
  }

  createFlashOverlay() {
    this.flashOverlay = document.createElement('div');
    this.flashOverlay.id = 'camera-flash';
    this.flashOverlay.className = 'hidden';
    document.body.appendChild(this.flashOverlay);
  }

  createExpandedView() {
    this.expandedView = document.createElement('div');
    this.expandedView.id = 'photo-expanded';
    this.expandedView.className = 'hidden';
    this.expandedView.innerHTML = `
      <div class="expanded-backdrop"></div>
      <div class="expanded-content">
        <img src="" alt="Expanded photo">
        <div class="expanded-caption"></div>
        <button class="expanded-close">X</button>
      </div>
    `;
    document.body.appendChild(this.expandedView);

    // Close handlers
    const backdrop = this.expandedView.querySelector('.expanded-backdrop');
    const closeBtn = this.expandedView.querySelector('.expanded-close');
    backdrop.addEventListener('click', () => this.closeExpandedView());
    closeBtn.addEventListener('click', () => this.closeExpandedView());
  }

  setupEventListeners() {
    const viewport = this.container;

    // Right mouse button events
    viewport.addEventListener('mousedown', (e) => this.onMouseDown(e));
    viewport.addEventListener('mouseup', (e) => this.onMouseUp(e));
    viewport.addEventListener('contextmenu', (e) => this.onContextMenu(e));

    // Scroll wheel for viewfinder size
    viewport.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // F key for flash toggle
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    // ESC to close expanded view
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.expandedView.classList.contains('hidden')) {
        this.closeExpandedView();
      }
    });
  }

  onMouseDown(e) {
    // Only activate in first-person mode with right click
    if (e.button !== 2) return;
    if (this.viewer.getControlMode() !== 'firstPerson') return;
    if (!this.viewer.isPointerLocked()) return;

    this.isActive = true;
    this.showViewfinder();
  }

  onMouseUp(e) {
    if (e.button !== 2) return;
    if (!this.isActive) return;

    this.isActive = false;
    this.takePhoto();
    this.hideViewfinder();
  }

  onContextMenu(e) {
    // Prevent context menu in first-person mode
    if (this.viewer.getControlMode() === 'firstPerson') {
      e.preventDefault();
    }
  }

  onWheel(e) {
    if (!this.isActive) return;

    e.preventDefault();

    // Adjust viewfinder size
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    this.viewfinderSize = Math.max(0.1, Math.min(0.9, this.viewfinderSize + delta));
    this.updateViewfinderSize();
  }

  onKeyDown(e) {
    // F key toggles flash when viewfinder is active
    if (e.key === 'f' || e.key === 'F') {
      if (this.isActive) {
        this.flashEnabled = !this.flashEnabled;
        this.updateFlashIndicator();
      }
    }
  }

  showViewfinder() {
    this.viewfinder.classList.remove('hidden');
    this.updateViewfinderSize();
    this.updateFlashIndicator();
    this.updateRatioDisplay();
  }

  hideViewfinder() {
    this.viewfinder.classList.add('hidden');
  }

  updateViewfinderSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ratio = ASPECT_RATIOS[this.aspectRatio];

    // Calculate dimensions based on viewport percentage and aspect ratio
    let width, height;
    const maxDim = Math.min(vw, vh) * this.viewfinderSize;

    if (ratio >= 1) {
      // Wider than tall
      width = maxDim * ratio;
      height = maxDim;
      // Clamp to viewport
      if (width > vw * this.viewfinderSize) {
        width = vw * this.viewfinderSize;
        height = width / ratio;
      }
    } else {
      // Taller than wide
      height = maxDim;
      width = maxDim * ratio;
    }

    const frame = this.viewfinder.querySelector('.vf-frame');
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
  }

  updateFlashIndicator() {
    const flashEl = this.viewfinder.querySelector('.vf-flash');
    flashEl.classList.toggle('active', this.flashEnabled);
  }

  updateRatioDisplay() {
    const ratioEl = this.viewfinder.querySelector('.vf-ratio');
    ratioEl.textContent = this.aspectRatio;
  }

  setAspectRatio(ratio) {
    if (ASPECT_RATIOS[ratio]) {
      this.aspectRatio = ratio;
      this.updateViewfinderSize();
      this.updateRatioDisplay();
    }
  }

  setSpecName(name) {
    this.currentSpecName = name || 'untitled';
  }

  async takePhoto() {
    const camera = this.viewer.getCamera();
    const renderer = this.viewer.getRenderer();

    // Get camera position and rotation
    const pos = camera.position.clone();
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const yaw = THREE.MathUtils.radToDeg(euler.y);
    const pitch = THREE.MathUtils.radToDeg(euler.x);

    // Calculate viewfinder bounds
    const frame = this.viewfinder.querySelector('.vf-frame');
    const frameRect = frame.getBoundingClientRect();
    const canvasRect = renderer.domElement.getBoundingClientRect();

    // Flash effect
    if (this.flashEnabled) {
      await this.triggerFlash();
    }

    // Capture the frame
    renderer.preserveDrawingBuffer = true;

    // Render one frame
    if (this.viewer.renderCallback) {
      this.viewer.renderCallback();
    } else {
      renderer.render(this.viewer.getScene(), camera);
    }

    // Get full canvas data
    const fullCanvas = renderer.domElement;

    // Create a canvas for the cropped region
    const cropCanvas = document.createElement('canvas');
    const ctx = cropCanvas.getContext('2d');

    // Calculate crop region (account for pixel ratio)
    const pixelRatio = renderer.getPixelRatio();
    const cropX = (frameRect.left - canvasRect.left) * pixelRatio;
    const cropY = (frameRect.top - canvasRect.top) * pixelRatio;
    const cropW = frameRect.width * pixelRatio;
    const cropH = frameRect.height * pixelRatio;

    cropCanvas.width = frameRect.width;
    cropCanvas.height = frameRect.height;

    // Draw cropped region
    ctx.drawImage(
      fullCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, frameRect.width, frameRect.height
    );

    // Create polaroid canvas with caption
    const polaroidCanvas = this.createPolaroidCanvas(cropCanvas, pos, yaw, pitch);

    // Store photo data
    const photoData = {
      id: Date.now(),
      imageData: polaroidCanvas.toDataURL('image/png'),
      cropData: cropCanvas.toDataURL('image/png'),
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { yaw, pitch },
      aspectRatio: this.aspectRatio,
      timestamp: new Date(),
      specName: this.currentSpecName
    };

    this.photos.push(photoData);

    // Add to polaroid strip
    this.addPolaroidToStrip(photoData);

    // Copy to clipboard
    await this.copyToClipboard(polaroidCanvas);

    renderer.preserveDrawingBuffer = false;
  }

  createPolaroidCanvas(imageCanvas, pos, yaw, pitch) {
    const padding = 12;
    const captionHeight = 50;
    const polaroidCanvas = document.createElement('canvas');
    const ctx = polaroidCanvas.getContext('2d');

    polaroidCanvas.width = imageCanvas.width + padding * 2;
    polaroidCanvas.height = imageCanvas.height + padding * 2 + captionHeight;

    // White background (polaroid frame)
    ctx.fillStyle = '#f5f5f0';
    ctx.fillRect(0, 0, polaroidCanvas.width, polaroidCanvas.height);

    // Subtle shadow/border effect
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, polaroidCanvas.width - 1, polaroidCanvas.height - 1);

    // Draw the photo
    ctx.drawImage(imageCanvas, padding, padding);

    // Caption text
    ctx.fillStyle = '#333';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';

    const captionY = imageCanvas.height + padding + 20;
    const posText = `x:${pos.x.toFixed(1)} y:${pos.y.toFixed(1)} z:${pos.z.toFixed(1)}`;
    const rotText = `yaw:${yaw.toFixed(0)}° pitch:${pitch.toFixed(0)}°`;

    ctx.fillText(posText, polaroidCanvas.width / 2, captionY);
    ctx.fillText(rotText, polaroidCanvas.width / 2, captionY + 16);

    return polaroidCanvas;
  }

  async triggerFlash() {
    // Add bright light to scene temporarily
    const scene = this.viewer.getScene();
    const flashLight = new THREE.PointLight(0xffffff, 50, 100);
    const camera = this.viewer.getCamera();
    flashLight.position.copy(camera.position);
    scene.add(flashLight);

    // Show flash overlay
    this.flashOverlay.classList.remove('hidden');
    this.flashOverlay.classList.add('flash-active');

    // Wait for flash effect
    await new Promise(resolve => setTimeout(resolve, 100));

    // Remove flash
    scene.remove(flashLight);
    flashLight.dispose();

    this.flashOverlay.classList.remove('flash-active');
    this.flashOverlay.classList.add('hidden');
  }

  addPolaroidToStrip(photoData) {
    const container = this.polaroidStrip.querySelector('.polaroid-container');
    const exportBtn = this.polaroidStrip.querySelector('#export-photos');

    const polaroid = document.createElement('div');
    polaroid.className = 'polaroid-thumb';
    polaroid.dataset.photoId = photoData.id;
    polaroid.innerHTML = `
      <img src="${photoData.cropData}" alt="Photo">
      <div class="polaroid-caption">
        ${photoData.position.x.toFixed(1)}, ${photoData.position.y.toFixed(1)}, ${photoData.position.z.toFixed(1)}
      </div>
    `;

    polaroid.addEventListener('click', () => this.expandPhoto(photoData));

    container.appendChild(polaroid);

    // Show export button when we have photos
    exportBtn.classList.remove('hidden');

    // Scroll to newest photo
    container.scrollLeft = container.scrollWidth;

    // Animate in
    requestAnimationFrame(() => {
      polaroid.classList.add('visible');
    });
  }

  async expandPhoto(photoData) {
    const img = this.expandedView.querySelector('img');
    const caption = this.expandedView.querySelector('.expanded-caption');

    img.src = photoData.imageData;
    caption.innerHTML = `
      <strong>${photoData.specName}</strong><br>
      Position: x:${photoData.position.x.toFixed(2)} y:${photoData.position.y.toFixed(2)} z:${photoData.position.z.toFixed(2)}<br>
      Rotation: yaw:${photoData.rotation.yaw.toFixed(1)}° pitch:${photoData.rotation.pitch.toFixed(1)}°<br>
      Aspect: ${photoData.aspectRatio}
    `;

    this.expandedView.classList.remove('hidden');

    // Copy to clipboard
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const tempImg = new Image();

    await new Promise((resolve) => {
      tempImg.onload = resolve;
      tempImg.src = photoData.imageData;
    });

    canvas.width = tempImg.width;
    canvas.height = tempImg.height;
    ctx.drawImage(tempImg, 0, 0);

    await this.copyToClipboard(canvas);
  }

  closeExpandedView() {
    this.expandedView.classList.add('hidden');
  }

  async copyToClipboard(canvas) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      console.log('Photo copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }

  async exportAllPhotos() {
    if (this.photos.length === 0) return;

    // Generate filenames and trigger downloads
    for (const photo of this.photos) {
      const timestamp = photo.timestamp;
      const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}${timestamp.getMinutes().toString().padStart(2, '0')}${timestamp.getSeconds().toString().padStart(2, '0')}`;
      const filename = `${photo.specName}_${timeStr}.png`;

      // Create download link
      const link = document.createElement('a');
      link.download = filename;
      link.href = photo.imageData;
      link.click();

      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  clearPhotos() {
    this.photos = [];
    const container = this.polaroidStrip.querySelector('.polaroid-container');
    container.innerHTML = '';
    const exportBtn = this.polaroidStrip.querySelector('#export-photos');
    exportBtn.classList.add('hidden');
  }

  /**
   * Clean up when switching modes or leaving first-person
   */
  deactivate() {
    this.isActive = false;
    this.hideViewfinder();
  }
}

export { CameraSystem, ASPECT_RATIOS };
