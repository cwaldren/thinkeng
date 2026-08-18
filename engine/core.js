import * as THREE from "three";
import * as CANNON from "cannon-es";

export class Simulation {
  constructor(options = {}) {
    const {
      container = document.body,
      gravity = [0, -9.81, 0],
      clearColor = 0x111116,
      enableShadows = true,
    } = options;

    this.container = container;

    // 1. Setup Three.js Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // Cap pixel ratio to save fill rate on high-DPI/mobile displays.
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    const maxPR = isMobile ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPR));
    this.renderer.setClearColor(clearColor);

    if (enableShadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    this.container.appendChild(this.renderer.domElement);

    // 2. Setup Scene & Default Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0, 0);

    // 3. Setup Physics World
    this.world = new CANNON.World();
    this.world.gravity.set(gravity[0], gravity[1], gravity[2]);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    // Default Material Contacts
    const defaultMaterial = new CANNON.Material("default");
    const defaultContactMaterial = new CANNON.ContactMaterial(
      defaultMaterial,
      defaultMaterial,
      { friction: 0.3, restitution: 0.5 },
    );
    this.world.addContactMaterial(defaultContactMaterial);
    this.world.defaultContactMaterial = defaultContactMaterial;

    // State Tracking
    this.entities = new Set();
    this.clock = new THREE.Clock();
    this.isRunning = false;

    // 4. Default Ambient & Directional Lighting
    this.setupDefaultLights(enableShadows);

    // Handle Window Resize
    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", this._onResize);
  }

  setupDefaultLights(enableShadows) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    if (enableShadows) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 50;
      const d = 15;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
    }
    this.scene.add(dirLight);
  }

  /**
   * Adds an object to the simulation.
   * @param {THREE.Object3D} mesh - The visual representation
   * @param {CANNON.Body} [body] - Optional physics body
   * @param {Function} [updateFn] - Custom tick logic: (dt, entity, sim) => {}
   * @returns {Object} Entity handle
   */
  addEntity(mesh, body = null, updateFn = null) {
    const entity = { mesh, body, updateFn };

    if (mesh) {
      this.scene.add(mesh);
    }
    if (body) {
      this.world.addBody(body);
    }

    this.entities.add(entity);
    return entity;
  }

  /**
   * Safely removes an entity from visual and physics scenes, releasing GPU memory.
   */
  removeEntity(entity) {
    if (!entity) return;

    if (entity.mesh) {
      this.scene.remove(entity.mesh);
      entity.mesh.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }

    if (entity.body) {
      this.world.removeBody(entity.body);
    }

    if (Array.isArray(entity.children)) {
      for (const child of entity.children) {
        this.removeEntity(child);
      }
    }

    this.entities.delete(entity);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    this.renderer.setAnimationLoop(() => {
      // Clamp delta time to avoid physics explosion on tab-switch
      const dt = Math.min(this.clock.getDelta(), 0.1);

      // Step physics world at 60Hz rate
      this.world.step(1 / 60, dt, 3);

      // Sync visual transforms with physics bodies & execute update callbacks
      for (const entity of this.entities) {
        if (entity.body && entity.mesh) {
          entity.mesh.position.copy(entity.body.position);
          entity.mesh.quaternion.copy(entity.body.quaternion);
        }
        if (entity.updateFn) {
          entity.updateFn(dt, entity, this);
        }
      }

      this.renderer.render(this.scene, this.camera);
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
    this.isRunning = false;
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);

    // Clean up all entities
    for (const entity of Array.from(this.entities)) {
      this.removeEntity(entity);
    }

    this.renderer.dispose();
    if (this.renderer.domElement?.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
