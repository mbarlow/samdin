/**
 * exporter.js - GLTF/GLB export functionality
 */
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

class ModelExporter {
  constructor() {
    this.exporter = new GLTFExporter();
  }
  
  /**
   * Export model as GLTF (JSON) or GLB (binary)
   * @param {THREE.Object3D} model
   * @param {object} options - { binary: true/false, name: 'model' }
   */
  async export(model, options = {}) {
    const binary = options.binary ?? true;
    const name = options.name || model.name || 'model';
    
    return new Promise((resolve, reject) => {
      this.exporter.parse(
        model,
        (result) => {
          if (binary) {
            // GLB binary
            const blob = new Blob([result], { type: 'application/octet-stream' });
            this.downloadBlob(blob, `${name}.glb`);
            resolve({ success: true, format: 'glb' });
          } else {
            // GLTF JSON
            const json = JSON.stringify(result, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            this.downloadBlob(blob, `${name}.gltf`);
            resolve({ success: true, format: 'gltf' });
          }
        },
        (error) => {
          console.error('Export failed:', error);
          reject(error);
        },
        { binary }
      );
    });
  }
  
  /**
   * Trigger browser download
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export { ModelExporter };
