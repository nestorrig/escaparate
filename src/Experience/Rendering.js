import * as THREE from "three/webgpu";
import { Inspector } from "three/addons/inspector/Inspector.js";
import { Experience } from "./Experience.js";

export class Rendering {
  constructor() {
    this.experience = Experience.getInstance();
  }

  async setRenderer() {
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.experience.canvasElement,
      powerPreference: "high-performance",
      antialias: this.experience.quality.antialias,
    });
    this.renderer.setSize(
      this.experience.viewport.width,
      this.experience.viewport.height,
    );
    this.renderer.setPixelRatio(this.experience.viewport.pixelRatio);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    if (location.hash.match(/inspector/i)) {
      this.inspector = new Inspector();
      this.renderer.inspector = this.inspector;
    }

    this.renderer.setAnimationLoop((elapsed) =>
      this.experience.ticker.update(elapsed),
    );

    await this.renderer.init();

    this.setDebug();
  }

  setDebug() {
    const parameters = this.createParameters("Rendering");

    if (!parameters) return;

    parameters
      .add(this.renderer, "toneMapping", {
        None: THREE.NoToneMapping,
        Linear: THREE.LinearToneMapping,
        Reinhard: THREE.ReinhardToneMapping,
        Cineon: THREE.CineonToneMapping,
        "ACES Filmic": THREE.ACESFilmicToneMapping,
        AgX: THREE.AgXToneMapping,
        Neutral: THREE.NeutralToneMapping,
      })
      .name("toneMapping");
    parameters
      .add(this.renderer, "toneMappingExposure", 0, 3, 0.01)
      .name("exposure");
  }

  /**
   * Returns an Inspector parameters group, or null when the inspector is disabled
   */
  createParameters(name) {
    return this.inspector ? this.inspector.createParameters(name) : null;
  }

  start() {
    this.experience.ticker.events.on("tick", () => this.render(), 998);
    this.experience.viewport.events.on("change", () => this.resize());
  }

  resize() {
    this.renderer.setSize(
      this.experience.viewport.width,
      this.experience.viewport.height,
    );
    this.renderer.setPixelRatio(this.experience.viewport.pixelRatio);
  }

  render() {
    this.renderer.render(this.experience.scene, this.experience.view.camera);
  }
}
