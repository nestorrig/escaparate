import * as THREE from "three/webgpu";
import { RectAreaLightTexturesLib } from "three/addons/lights/RectAreaLightTexturesLib.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { normalWorld, positionWorld, smoothstep, uniform } from "three/tsl";
import { Experience } from "./Experience.js";

export const ENVIRONMENTS = {
  "Ferndale studio 02": "./hdri/ferndale_studio_02_1k.hdr",
  "Ferndale studio 03": "./hdri/ferndale_studio_03_1k.hdr",
  "Ferndale studio 12": "./hdri/ferndale_studio_12_1k.hdr",
  "Rogland clear night": "./hdri/rogland_clear_night_1k.hdr",
};

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
   * White area light matching the "lampara" plane of the model, pointing down
   */
  setLamp() {
    THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());

    const lamp = this.experience.world.escaparate.lamp;

    lamp.geometry.computeBoundingBox();

    const box = lamp.geometry.boundingBox.clone().applyMatrix4(lamp.matrix);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    this.lamp = new THREE.RectAreaLight("#ffffff", 2.5, size.x, size.z);
    this.lamp.position.copy(center);
    this.lamp.rotation.x = -Math.PI / 2;
    lamp.parent.add(this.lamp);

    lamp.material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      side: THREE.DoubleSide,
    });
    lamp.castShadow = false;

    this.setLampShadow(lamp.parent, center);
  }

  /**
   * RectAreaLight can't cast shadows, so a spot light at the same place, pointing down, provides them.
   * The spot has no intensity: it only renders the shadow map, and the shadow catchers darken the shadowed areas.
   */
  setLampShadow(parent, center) {
    const shadowSize = Math.min(this.experience.quality.shadows, 2048);

    this.lampShadow = new THREE.SpotLight("#ffffff", 0);
    this.lampShadow.position.copy(center);
    this.lampShadow.position.y -= 0.02;
    this.lampShadow.target.position.set(center.x, center.y - 1, center.z);
    this.lampShadow.angle = Math.PI / 2.5;
    this.lampShadow.castShadow = true;
    this.lampShadow.shadow.mapSize.set(shadowSize, shadowSize);
    this.lampShadow.shadow.camera.near = 0.05;
    this.lampShadow.shadow.camera.far = 3;
    this.lampShadow.shadow.bias = -0.0005;
    this.lampShadow.shadow.normalBias = 0.02;
    this.lampShadow.shadow.radius = 20;
    parent.add(this.lampShadow, this.lampShadow.target);

    this.setShadowCatchers();
  }

  /**
   * A shadow-only copy over every mesh of the escaparate, so the shadows add no light
   */
  setShadowCatchers() {
    const escaparate = this.experience.world.escaparate;

    this.lampShadow.updateWorldMatrix(true, false);
    const lightPosition = uniform(
      this.lampShadow.getWorldPosition(new THREE.Vector3()),
    );
    const toSurface = positionWorld.sub(lightPosition).normalize();

    // The shadow mask alone also darkens surfaces outside the spot cone or facing away from it
    const cone = smoothstep(
      Math.cos(this.lampShadow.angle),
      Math.cos(this.lampShadow.angle * 0.9),
      toSurface.y.negate(),
    );
    const facing = smoothstep(0, 0.2, normalWorld.dot(toSurface.negate()));

    this.shadowOpacity = uniform(0.6);
    this.shadowCatcherMaterial = new THREE.ShadowNodeMaterial({
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.shadowCatcherMaterial.opacityNode = this.shadowOpacity
      .mul(cone)
      .mul(facing);
    this.shadowCatchers = [];

    const meshes = [];
    escaparate.model.traverse((child) => {
      if (child.isMesh && child !== escaparate.lamp) meshes.push(child);
    });

    for (const mesh of meshes) {
      const catcher = new THREE.Mesh(mesh.geometry, this.shadowCatcherMaterial);
      catcher.receiveShadow = true;
      catcher.renderOrder = 1;
      mesh.add(catcher);
      this.shadowCatchers.push(catcher);
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
    parameters.add(this.lamp, "intensity", 0, 30, 0.1).name("lampara");

    const lampShadow = parameters.addFolder("Sombras lampara");
    lampShadow
      .add(this.lampShadow, "castShadow")
      .name("activas")
      .onChange((active) => {
        for (const catcher of this.shadowCatchers) catcher.visible = active;
      });
    lampShadow.add(this.shadowOpacity, "value", 0, 1, 0.01).name("oscuridad");
    lampShadow
      .add(this.lampShadow.shadow, "radius", 0, 20, 0.1)
      .name("suavidad");
  }
}
