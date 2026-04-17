/**
 * transform.js - Blender-style modal transform hotkeys
 * G=translate, R=rotate, S=scale, X/Y/Z=axis constrain, X=delete, Shift+D=duplicate
 */
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

class TransformController {
  constructor({ scene, camera, renderer, orbitControls, container }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.orbitControls = orbitControls;
    this.container = container;

    // State
    this.mode = null; // null | 'translate' | 'rotate' | 'scale'
    this.axis = null;
    this.selectedPart = null;
    this.undoStack = []; // { type, name, position, rotation, scale, partDef?, parent?, mesh? }
    this.redoStack = [];
    this.maxUndo = 50;
    this.preTransformState = null;

    // Snap settings
    this.gridSize = { translate: 0.25, rotate: 15, scale: 0.1 };

    // TransformControls gizmo
    this.gizmo = new TransformControls(camera, renderer.domElement);
    this.gizmo.setSize(0.75);
    this.scene.add(this.gizmo.getHelper());

    // Prevent orbit while dragging gizmo
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
    });

    // Track ctrl state for snapping
    this._ctrlHeld = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onClick = this._onClick.bind(this);

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    this.container.addEventListener('click', this._onClick);
  }

  setSelectedPart(mesh) {
    this.selectedPart = mesh;
    // Cancel any active transform when selection changes
    if (this.mode) {
      this._cancelTransform();
    }
  }

  clearSelection() {
    if (this.mode) {
      this._cancelTransform();
    }
    this.selectedPart = null;
  }

  // ── Hotkey handler ──

  _onKeyDown(event) {
    // Ignore when typing in inputs/textareas
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    this._ctrlHeld = event.ctrlKey || event.metaKey;

    // Update snap while in transform mode
    if (this.mode && this._ctrlHeld) {
      this._updateSnap(true);
    }

    // Ctrl+Z / Ctrl+Shift+Z
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this._redo();
      } else {
        this._undo();
      }
      return;
    }

    if (!this.selectedPart) return;

    const key = event.key.toLowerCase();

    // In transform mode
    if (this.mode) {
      if (key === 'x') { this._constrainAxis('x'); return; }
      if (key === 'y') { this._constrainAxis('y'); return; }
      if (key === 'z') { this._constrainAxis('z'); return; }
      if (key === 'escape') { this._cancelTransform(); return; }
      if (key === 'enter') { this._confirmTransform(); return; }
      return;
    }

    // Not in transform mode
    if (key === 'g') {
      this._enterMode('translate');
    } else if (key === 'r') {
      this._enterMode('rotate');
    } else if (key === 's') {
      this._enterMode('scale');
    } else if (key === 'x') {
      this._deleteSelected();
    } else if (key === 'd' && event.shiftKey) {
      event.preventDefault();
      this._duplicateSelected();
    }
  }

  _onKeyUp(event) {
    this._ctrlHeld = event.ctrlKey || event.metaKey;
    if (this.mode && !this._ctrlHeld) {
      this._updateSnap(false);
    }
  }

  _onClick(_event) {
    // Confirm transform on click if gizmo is active but not being dragged
    if (this.mode && !this.gizmo.dragging) {
      // Only confirm if we actually moved (not the initial click)
      if (this.preTransformState) {
        const pos = this.selectedPart.position;
        const pre = this.preTransformState;
        const moved = pos.x !== pre.position.x || pos.y !== pre.position.y || pos.z !== pre.position.z ||
          this.selectedPart.rotation.x !== pre.rotation.x ||
          this.selectedPart.scale.x !== pre.scale.x;
        if (moved) {
          this._confirmTransform();
        }
      }
    }
  }

  // ── Transform modes ──

  _enterMode(mode) {
    if (!this.selectedPart) return;

    // Save pre-transform snapshot
    this.preTransformState = this._snapshot(this.selectedPart);

    this.mode = mode;
    this.axis = null;

    // Attach gizmo
    this.gizmo.setMode(mode);
    this.gizmo.attach(this.selectedPart);

    // Show all axes initially
    this.gizmo.showX = true;
    this.gizmo.showY = true;
    this.gizmo.showZ = true;

    // Disable orbit
    this.orbitControls.enabled = false;

    // Apply snap if ctrl already held
    this._updateSnap(this._ctrlHeld);

    this.container.dispatchEvent(new CustomEvent('transformModeChanged', {
      detail: { mode }
    }));
  }

  _constrainAxis(axis) {
    if (!this.mode) return;
    this.axis = axis;
    this.gizmo.showX = axis === 'x';
    this.gizmo.showY = axis === 'y';
    this.gizmo.showZ = axis === 'z';
  }

  _confirmTransform() {
    if (!this.mode || !this.selectedPart) return;

    // Push undo
    this._pushUndo({
      type: 'transform',
      name: this.selectedPart.name,
      ...this.preTransformState
    });

    // Sync to spec
    this._syncToSpec(this.selectedPart);

    // Clean up
    this.gizmo.detach();
    this.mode = null;
    this.axis = null;
    this.preTransformState = null;
    this.orbitControls.enabled = true;

    this.container.dispatchEvent(new CustomEvent('transformModeChanged', {
      detail: { mode: null }
    }));
  }

  _cancelTransform() {
    if (!this.mode || !this.selectedPart || !this.preTransformState) {
      this.gizmo.detach();
      this.mode = null;
      this.axis = null;
      this.preTransformState = null;
      this.orbitControls.enabled = true;
      return;
    }

    // Restore pre-transform state
    const s = this.preTransformState;
    this.selectedPart.position.set(s.position.x, s.position.y, s.position.z);
    this.selectedPart.rotation.set(s.rotation.x, s.rotation.y, s.rotation.z);
    this.selectedPart.scale.set(s.scale.x, s.scale.y, s.scale.z);

    this.gizmo.detach();
    this.mode = null;
    this.axis = null;
    this.preTransformState = null;
    this.orbitControls.enabled = true;

    this.container.dispatchEvent(new CustomEvent('transformModeChanged', {
      detail: { mode: null }
    }));
  }

  _updateSnap(enabled) {
    if (enabled) {
      this.gizmo.setTranslationSnap(this.gridSize.translate);
      this.gizmo.setRotationSnap(THREE.MathUtils.degToRad(this.gridSize.rotate));
      this.gizmo.setScaleSnap(this.gridSize.scale);
    } else {
      this.gizmo.setTranslationSnap(null);
      this.gizmo.setRotationSnap(null);
      this.gizmo.setScaleSnap(null);
    }
  }

  // ── Delete ──

  _deleteSelected() {
    if (!this.selectedPart) return;

    // Find spec part definition
    const model = this._getModel();
    const partDef = this._findSpecPart(this.selectedPart.name);

    // Push undo with full part info for restore
    this._pushUndo({
      type: 'delete',
      name: this.selectedPart.name,
      ...this._snapshot(this.selectedPart),
      partDef: partDef ? JSON.parse(JSON.stringify(partDef)) : null,
      parentName: this.selectedPart.parent?.name || null,
      mesh: this.selectedPart
    });

    // Remove from parent
    const parent = this.selectedPart.parent;
    if (parent) {
      parent.remove(this.selectedPart);
    }

    // Remove from model.userData.parts if it exists
    if (model?.userData?.parts) {
      const idx = model.userData.parts.indexOf(this.selectedPart);
      if (idx !== -1) model.userData.parts.splice(idx, 1);
    }

    // Remove from spec
    if (model?.userData?.spec?.parts && partDef) {
      const specParts = model.userData.spec.parts;
      const si = specParts.indexOf(partDef);
      if (si !== -1) specParts.splice(si, 1);
    }

    this.container.dispatchEvent(new CustomEvent('partDeleted', {
      detail: { name: this.selectedPart.name }
    }));

    this._dispatchSpecChanged();
    this.selectedPart = null;
  }

  // ── Duplicate ──

  _duplicateSelected() {
    if (!this.selectedPart) return;

    const model = this._getModel();
    const clone = this.selectedPart.clone(true);

    // Generate unique name
    const baseName = this.selectedPart.name.replace(/_copy\d*$/, '');
    let suffix = 1;
    const existingNames = new Set();
    if (model) {
      model.traverse(c => existingNames.add(c.name));
    }
    let newName = `${baseName}_copy`;
    while (existingNames.has(newName)) {
      suffix++;
      newName = `${baseName}_copy${suffix}`;
    }
    clone.name = newName;

    // Offset position
    clone.position.x += 0.5;

    // Add to same parent
    const parent = this.selectedPart.parent;
    if (parent) {
      parent.add(clone);
    }

    // Add to model.userData.parts
    if (model?.userData?.parts) {
      model.userData.parts.push(clone);
    }

    // Clone spec part definition
    const partDef = this._findSpecPart(this.selectedPart.name);
    if (partDef && model?.userData?.spec?.parts) {
      const clonedDef = JSON.parse(JSON.stringify(partDef));
      clonedDef.name = newName;
      if (clonedDef.position) {
        clonedDef.position[0] = (clonedDef.position[0] || 0) + 0.5;
      } else {
        clonedDef.position = [clone.position.x, clone.position.y, clone.position.z];
      }
      model.userData.spec.parts.push(clonedDef);
    }

    // Push undo
    this._pushUndo({
      type: 'duplicate',
      name: newName,
      ...this._snapshot(clone)
    });

    this._dispatchSpecChanged();

    // Select the clone
    this.container.dispatchEvent(new CustomEvent('selectPartByName', {
      detail: { name: newName }
    }));
  }

  // ── Undo / Redo ──

  _pushUndo(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxUndo) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  _undo() {
    if (this.undoStack.length === 0) return;
    const entry = this.undoStack.pop();

    if (entry.type === 'transform') {
      const mesh = this._findMeshByName(entry.name);
      if (mesh) {
        // Save current state for redo
        this.redoStack.push({
          type: 'transform',
          name: entry.name,
          ...this._snapshot(mesh)
        });
        // Restore
        mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
        mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
        mesh.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);
        this._syncToSpec(mesh);
      }
    } else if (entry.type === 'delete') {
      // Restore deleted part
      const model = this._getModel();
      const mesh = entry.mesh;
      if (mesh) {
        // Re-add to parent
        const parent = entry.parentName ? this._findMeshByName(entry.parentName) : model;
        if (parent) {
          parent.add(mesh);
        }
        // Re-add to userData.parts
        if (model?.userData?.parts) {
          model.userData.parts.push(mesh);
        }
        // Re-add spec part
        if (entry.partDef && model?.userData?.spec?.parts) {
          model.userData.spec.parts.push(entry.partDef);
        }
        this.redoStack.push(entry);
        this._dispatchSpecChanged();
      }
    } else if (entry.type === 'duplicate') {
      // Undo duplicate = delete the clone
      const mesh = this._findMeshByName(entry.name);
      if (mesh) {
        const model = this._getModel();
        if (mesh.parent) mesh.parent.remove(mesh);
        if (model?.userData?.parts) {
          const idx = model.userData.parts.indexOf(mesh);
          if (idx !== -1) model.userData.parts.splice(idx, 1);
        }
        if (model?.userData?.spec?.parts) {
          const si = model.userData.spec.parts.findIndex(p => p.name === entry.name);
          if (si !== -1) model.userData.spec.parts.splice(si, 1);
        }
        this.redoStack.push({ ...entry, mesh });
        this._dispatchSpecChanged();
      }
    }
  }

  _redo() {
    if (this.redoStack.length === 0) return;
    const entry = this.redoStack.pop();

    if (entry.type === 'transform') {
      const mesh = this._findMeshByName(entry.name);
      if (mesh) {
        this.undoStack.push({
          type: 'transform',
          name: entry.name,
          ...this._snapshot(mesh)
        });
        mesh.position.set(entry.position.x, entry.position.y, entry.position.z);
        mesh.rotation.set(entry.rotation.x, entry.rotation.y, entry.rotation.z);
        mesh.scale.set(entry.scale.x, entry.scale.y, entry.scale.z);
        this._syncToSpec(mesh);
      }
    } else if (entry.type === 'delete') {
      // Redo delete = remove again
      const mesh = entry.mesh;
      if (mesh && mesh.parent) {
        const model = this._getModel();
        mesh.parent.remove(mesh);
        if (model?.userData?.parts) {
          const idx = model.userData.parts.indexOf(mesh);
          if (idx !== -1) model.userData.parts.splice(idx, 1);
        }
        if (model?.userData?.spec?.parts && entry.partDef) {
          const si = model.userData.spec.parts.indexOf(entry.partDef);
          if (si !== -1) model.userData.spec.parts.splice(si, 1);
        }
        this.undoStack.push(entry);
        this._dispatchSpecChanged();
      }
    } else if (entry.type === 'duplicate') {
      // Redo duplicate = re-add the clone
      const mesh = entry.mesh;
      if (mesh) {
        const model = this._getModel();
        const parent = model; // Add to model root
        if (parent) parent.add(mesh);
        if (model?.userData?.parts) {
          model.userData.parts.push(mesh);
        }
        const partDef = this._findSpecPart(entry.name);
        if (!partDef && model?.userData?.spec?.parts) {
          // Re-create spec entry
          model.userData.spec.parts.push({
            name: entry.name,
            position: [mesh.position.x, mesh.position.y, mesh.position.z],
            rotation: [
              THREE.MathUtils.radToDeg(mesh.rotation.x),
              THREE.MathUtils.radToDeg(mesh.rotation.y),
              THREE.MathUtils.radToDeg(mesh.rotation.z)
            ],
            scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z]
          });
        }
        this.undoStack.push(entry);
        this._dispatchSpecChanged();
      }
    }
  }

  // ── Helpers ──

  _snapshot(mesh) {
    return {
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone()
    };
  }

  _getModel() {
    // Walk up from selectedPart to find root model, or use scene children
    let node = this.selectedPart;
    while (node?.parent && node.parent !== this.scene) {
      node = node.parent;
    }
    return node;
  }

  _findMeshByName(name) {
    let found = null;
    this.scene.traverse(child => {
      if (child.name === name) found = child;
    });
    return found;
  }

  _findSpecPart(name) {
    const model = this._getModel();
    if (!model?.userData?.spec?.parts) return null;
    return model.userData.spec.parts.find(p => p.name === name) || null;
  }

  _syncToSpec(mesh) {
    const partDef = this._findSpecPart(mesh.name);
    if (partDef) {
      partDef.position = [
        parseFloat(mesh.position.x.toFixed(4)),
        parseFloat(mesh.position.y.toFixed(4)),
        parseFloat(mesh.position.z.toFixed(4))
      ];
      partDef.rotation = [
        parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.x).toFixed(2)),
        parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.y).toFixed(2)),
        parseFloat(THREE.MathUtils.radToDeg(mesh.rotation.z).toFixed(2))
      ];
      partDef.scale = [
        parseFloat(mesh.scale.x.toFixed(4)),
        parseFloat(mesh.scale.y.toFixed(4)),
        parseFloat(mesh.scale.z.toFixed(4))
      ];
    }
    this._dispatchSpecChanged();
  }

  _dispatchSpecChanged() {
    const model = this._getModel();
    const spec = model?.userData?.spec || null;
    this.container.dispatchEvent(new CustomEvent('specChanged', {
      detail: { spec }
    }));
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.container.removeEventListener('click', this._onClick);
    this.gizmo.detach();
    this.scene.remove(this.gizmo.getHelper());
    this.gizmo.dispose();
  }
}

export { TransformController };
