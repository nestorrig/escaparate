import * as THREE from "three/webgpu";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { lights } from "three/tsl";
import { Experience } from "./Experience.js";

export const ENVIRONMENTS = {
  "Ferndale studio 02": "./hdri/ferndale_studio_02_1k.hdr",
  "Ferndale studio 03": "./hdri/ferndale_studio_03_1k.hdr",
  "Ferndale studio 12": "./hdri/ferndale_studio_12_1k.hdr",
  "Rogland clear night": "./hdri/rogland_clear_night_1k.hdr",
};

const STREET_MESHES = ["asfalto", "Plano", "Plano1"];

export const DEFAULT_ENVIRONMENT = "Ferndale studio 02";

export function setupEnvironmentTexture(texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
}

export class Lighting {
  constructor() {
    this.experience = Experience.getInstance();

    this.setEnvironment();
    this.setAmbient();
    this.setLamp();
    this.setDebug();
  }

  /**
   * The default HDRI comes with the initial resources; the others are loaded on demand and cached.
   * Its own loader keeps these loads out of the loading-bar manager.
   */
  setEnvironment() {
    this.environmentLoader = new HDRLoader();
    this.environmentTextures = new Map([
      [DEFAULT_ENVIRONMENT, this.experience.resources.environmentTexture],
    ]);

    this.environment = {
      name: DEFAULT_ENVIRONMENT,
      background: false,
    };

    this.experience.scene.environmentIntensity = 0.02;
    this.changeEnvironment(DEFAULT_ENVIRONMENT);
  }

  async changeEnvironment(name) {
    this.environment.name = name;

    const scene = this.experience.scene;

    if (!ENVIRONMENTS[name]) {
      scene.environment = null;
      this.updateBackground();
      return;
    }

    let texture = this.environmentTextures.get(name);

    if (!texture) {
      texture = await this.environmentLoader.loadAsync(ENVIRONMENTS[name]);
      setupEnvironmentTexture(texture);
      this.environmentTextures.set(name, texture);
    }

    // A newer selection may have happened while this one was loading
    if (this.environment.name !== name) return;

    scene.environment = texture;
    this.updateBackground();
  }

  updateBackground() {
    const scene = this.experience.scene;

    scene.background =
      this.environment.background && scene.environment
        ? scene.environment
        : this.experience.backgroundColor;
  }

  setAmbient() {
    this.ambient = new THREE.AmbientLight("#ffffff", 0);
    this.experience.scene.add(this.ambient);
  }

  /**
   * The "lampara" plane only glows; the light comes from one spot per skate, hanging from the lamp height
   */
  setLamp() {
    const escaparate = this.experience.world.escaparate;
    const lamp = escaparate.lamp;

    lamp.material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      side: THREE.DoubleSide,
    });
    lamp.castShadow = false;

    lamp.updateWorldMatrix(true, false);
    lamp.geometry.computeBoundingBox();
    const lampBox = lamp.geometry.boundingBox
      .clone()
      .applyMatrix4(lamp.matrixWorld);
    const height = 1.6;

    const shadowSize = Math.min(this.experience.quality.shadows, 1024);

    this.spots = {
      intensity: 4,
      angle: Math.PI / 7,
      penumbra: 0.6,
      radius: 4,
      castShadow: true,
    };
    this.spotLights = escaparate.skates.map((skate) => {
      const position = skate.getWorldPosition(new THREE.Vector3());

      const spot = new THREE.SpotLight("#ffffff", this.spots.intensity);
      spot.position.set(position.x, height, position.z);
      spot.target = skate;
      spot.angle = this.spots.angle;
      spot.penumbra = this.spots.penumbra;
      spot.decay = 2;
      spot.castShadow = true;
      spot.shadow.mapSize.set(shadowSize, shadowSize);
      spot.shadow.camera.near = 0.05;
      spot.shadow.camera.far = 3;
      spot.shadow.bias = -0.0005;
      spot.shadow.normalBias = 0.02;
      spot.shadow.radius = this.spots.radius;
      this.experience.scene.add(spot);

      return spot;
    });

    // The front spot's cone leaks through the shop window onto the street, so the street ignores the spots
    const streetLights = lights([this.ambient]);
    for (const name of STREET_MESHES)
      escaparate.model.getObjectByName(name).material.lightsNode = streetLights;
  }

  updateSpots() {
    for (const spot of this.spotLights) {
      spot.intensity = this.spots.intensity;
      spot.angle = this.spots.angle;
      spot.penumbra = this.spots.penumbra;
      spot.castShadow = this.spots.castShadow;
      spot.shadow.radius = this.spots.radius;
    }
  }

  setDebug() {
    const parameters = this.experience.rendering.createParameters("Lighting");

    if (!parameters) return;

    const environmentOptions = { Ninguno: "none" };
    for (const name of Object.keys(ENVIRONMENTS))
      environmentOptions[name] = name;

    parameters
      .add(this.environment, "name", environmentOptions)
      .name("hdri")
      .onChange((name) => this.changeEnvironment(name));
    parameters
      .add(this.environment, "background")
      .name("hdri de fondo")
      .onChange(() => this.updateBackground());
    parameters
      .add(this.experience.scene, "environmentIntensity", 0, 3, 0.01)
      .name("hdri intensidad");
    parameters.add(this.ambient, "intensity", 0, 3, 0.01).name("ambient");

    const spots = parameters.addFolder("Spots skates");
    const update = () => this.updateSpots();
    spots
      .add(this.spots, "intensity", 0, 20, 0.1)
      .name("intensidad")
      .onChange(update);
    spots
      .add(this.spots, "angle", 0.05, Math.PI / 3, 0.01)
      .name("apertura")
      .onChange(update);
    spots
      .add(this.spots, "penumbra", 0, 1, 0.01)
      .name("penumbra")
      .onChange(update);
    spots.add(this.spots, "castShadow").name("sombras").onChange(update);
    spots
      .add(this.spots, "radius", 0, 20, 0.1)
      .name("suavidad sombra")
      .onChange(update);
  }
}
