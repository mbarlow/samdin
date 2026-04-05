/**
 * loader.js - GLTF/GLB import functionality
 */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

class ModelLoader {
  constructor() {
    this.gltfLoader = new GLTFLoader();
    
    // Setup DRACO decoder for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
  }
  
  /**
   * Load GLTF/GLB from URL
   * @param {string} url
   * @returns {Promise<THREE.Group>}
   */
  async loadFromURL(url) {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          model.userData.animations = gltf.animations;
          resolve(model);
        },
        (progress) => {
          // Could emit progress events here
        },
        (error) => {
          console.error('Load failed:', error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Load GLTF/GLB from File object (from file input)
   * @param {File} file
   * @returns {Promise<THREE.Group>}
   */
  async loadFromFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileSize = file.size;

      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 70));
        }
      };

      reader.onload = async (event) => {
        if (onProgress) onProgress(75);
        const arrayBuffer = event.target.result;

        this.gltfLoader.parse(
          arrayBuffer,
          '', // path for relative resources
          (gltf) => {
            if (onProgress) onProgress(95);
            const model = gltf.scene;
            model.name = file.name.replace(/\.(gltf|glb)$/i, '');
            model.userData.animations = gltf.animations;
            resolve(model);
          },
          (error) => {
            console.error('Parse failed:', error);
            reject(error);
          }
        );
      };

      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsArrayBuffer(file);
    });
  }
}

export { ModelLoader };
