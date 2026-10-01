import * as THREE from "three/webgpu";

import { Events } from "./Events.js";
import { Quality } from "./Quality.js";
import { Ticker } from "./Ticker.js";
import { Viewport } from "./Viewport.js";
import { ResourcesLoader } from "./ResourcesLoader.js";
import { Rendering } from "./Rendering.js";
import { View } from "./View.js";
import {
  Lighting,
  ENVIRONMENTS,
  DEFAULT_ENVIRONMENT,
  setupEnvironmentTexture,
} from "./Lighting.js";
import { Overlay } from "./Overlay.js";
import { World } from "./World/World.js";

export class Experience {
  static getInstance() {
    return Experience.instance;
  }

  constructor() {
    if (Experience.instance) return Experience.instance;

    Experience.instance = this;

    this.init();
  }

  async init() {
    this.domElement = document.querySelector(".experience");
    this.canvasElement = this.domElement.querySelector("canvas.webgl");

    this.events = new Events();
    this.sceneReady = false;

    this.scene = new THREE.Scene();
    this.backgroundColor = new THREE.Color("#004bff");
    this.scene.background = this.backgroundColor;

    this.quality = new Quality();
    this.ticker = new Ticker();
    this.viewport = new Viewport(this.domElement);
    this.resourcesLoader = new ResourcesLoader();
    this.rendering = new Rendering();
    await this.rendering.setRenderer();

    this.view = new View();
    this.overlay = new Overlay();
    this.rendering.start();

    this.resourcesLoader.events.on("ended", () => {
      this.overlay.reveal();

      window.setTimeout(() => {
        this.sceneReady = true;
        this.events.trigger("ready");
      }, 1500);
    });

    this.resources = await this.resourcesLoader.load([
      ["escaparateModel", "./models/escaparate_2_v4.glb", "gltf"],
      ["michelleModel", "./models/Michelle.glb", "gltf"],
      [
        "posterTexture",
        "./textures/poster.png",
        "texture",
        this.setupColorTexture,
      ],
      [
        "letreroTexture",
        "./textures/letrero.png",
        "texture",
        this.setupColorTexture,
      ],
      [
        "letreroBigTexture",
        "./textures/letrero-big.png",
        "texture",
        this.setupColorTexture,
      ],
      [
        "letreroParedTexture",
        "./textures/letrero_pared1.png",
        "texture",
        this.setupColorTexture,
      ],
      [
        "letreroPared2Texture",
        "./textures/letrero_pared2.png",
        "texture",
        this.setupColorTexture,
      ],
      [
        "environmentTexture",
        ENVIRONMENTS[DEFAULT_ENVIRONMENT],
        "hdr",
        setupEnvironmentTexture,
      ],
    ]);

    this.world = new World();
    this.lighting = new Lighting();
    this.view.setFromCameras(
      this.world.escaparate.cameras,
      this.world.escaparate,
    );
    this.view.setDebug();
  }

  setupColorTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.anisotropy = 8;
  }
}
