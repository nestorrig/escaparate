import * as THREE from "three/webgpu";
import { RectAreaLightTexturesLib } from "three/addons/lights/RectAreaLightTexturesLib.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { lights } from "three/tsl";
import { Experience } from "./Experience.js";

const glowMaterial = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  side: THREE.DoubleSide,
});

export const ENVIRONMENTS = {
  "Ferndale studio 02": "./hdri/ferndale_studio_02_1k.hdr",
  "Ferndale studio 03": "./hdri/ferndale_studio_03_1k.hdr",
  "Ferndale studio 12": "./hdri/ferndale_studio_12_1k.hdr",
  "Rogland clear night": "./hdri/rogland_clear_night_1k.hdr",
};

const STREET_MESHES = ["asfalto", "Plano", "Plano1"];

// Every spot light renders its own shadow map each frame
const LIT_SPOTS = ["spot3"];

export const DEFAULT_ENVIRONMENT = "Rogland clear night";

export function setupEnvironmentTexture(texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;
}

export class Lighting {
  constructor() {
    this.experience = Experience.getInstance();

    this.setEnvironment();
    this.setAmbient();
    this.setLamps();
    this.setSpots();
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

    this.experience.scene.environmentIntensity = 0.05;
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
    this.ambient = new THREE.AmbientLight("#ffffff", 0.1);
    this.experience.scene.add(this.ambient);
  }

  /**
   * A white area light on each "lampara" plane of the model, all of them horizontal and pointing down
   */
  setLamps() {
    THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());

    const intensities = {
      lampara: 2,
      "lampara-small": 10.2,
      "lampara-small1": 10.4,
    };

    this.lamps = this.experience.world.escaparate.lamps.map((lamp) => {
      lamp.material = glowMaterial;
      lamp.castShadow = false;

      lamp.geometry.computeBoundingBox();
      const box = lamp.geometry.boundingBox.clone().applyMatrix4(lamp.matrix);
      const size = box.getSize(new THREE.Vector3());

      const light = new THREE.RectAreaLight(
        "#ffffff",
        intensities[lamp.name],
        size.x,
        size.z,
      );
      box.getCenter(light.position);
      light.rotation.x = -Math.PI / 2;
      light.name = lamp.name;
      lamp.parent.add(light);

      return light;
    });
  }

  /**
   * One spot per "spots" group of the model, placed at its disc and pointing straight down
   */
  setSpots() {
    const escaparate = this.experience.world.escaparate;
    const shadowSize = Math.min(this.experience.quality.shadows, 1024);

    this.spots = {
      intensity: 2.5,
      angle: 0.9,
      penumbra: 0.8,
      radius: 4,
      castShadow: true,
    };

    escaparate.model.updateWorldMatrix(true, true);

    for (const { group, disc } of escaparate.spots) {
      group.traverse((child) => {
        child.castShadow = false;
      });
      disc.material = glowMaterial;
      group.visible = LIT_SPOTS.includes(group.name);
    }

    const litSpots = escaparate.spots.filter(({ group }) =>
      LIT_SPOTS.includes(group.name),
    );

    this.spotLights = litSpots.map(({ disc }) => {
      const position = new THREE.Vector3();
      disc.geometry.computeBoundingBox();
      disc.geometry.boundingBox.getCenter(position);
      disc.localToWorld(position);
      position.y -= 0.005;

      const spot = new THREE.SpotLight("#ffffff", this.spots.intensity);
      spot.position.copy(position);
      spot.target.position.copy(position).y -= 1;
      this.experience.scene.add(spot.target);
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
    const streetLights = lights([this.ambient, ...this.lamps]);
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

    const lamps = parameters.addFolder("Lamparas");
    for (const lamp of this.lamps)
      lamps.add(lamp, "intensity", 0, 30, 0.1).name(lamp.name);

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
