import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Experience } from "./Experience.js";

// Starting camera position on mobile; the distance limits are relative to it
const MOBILE_CAMERA_POSITION = new THREE.Vector3(5, 1.24, 7.6);

const VIEW_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * Mobile orbits around the shop window and is kept from seeing past the facade.
 * Desktop has no controls: the camera drifts with the cursor (parallax) while looking at a fixed point.
 */
export class View {
  constructor() {
    this.experience = Experience.getInstance();
    this.isMobile = this.experience.quality.isMobile;

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.experience.viewport.ratio,
      0.1,
      100,
    );
    this.camera.position.set(0, 1.6, this.isMobile ? 20 : 5.5);
    this.experience.scene.add(this.camera);

    this.target = new THREE.Vector3(0, 1, 0);

    if (this.isMobile) this.setControls();
    else this.setParallax();

    this.experience.ticker.events.on("tick", () => this.update(), 1);
    this.experience.viewport.events.on("change", () => this.resize());
  }

  setControls() {
    this.controls = new OrbitControls(
      this.camera,
      this.experience.canvasElement,
    );
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minAzimuthAngle = -Math.PI / 5;
    this.controls.maxAzimuthAngle = Math.PI / 5;
    this.controls.minPolarAngle = Math.PI / 3;
    this.controls.maxPolarAngle = Math.PI / 1.9;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 16;
    this.controls.target = this.target;

    this.facade = null;
    this.lastValidPosition = new THREE.Vector3();
    this.cornerDirection = new THREE.Vector3();
  }

  setParallax() {
    this.parallax = {
      amplitudeX: 0.75,
      amplitudeY: 0.65,
      smoothing: 2.5,
      basePosition: this.camera.position.clone(),
      right: new THREE.Vector3(1, 0, 0),
      up: new THREE.Vector3(0, 1, 0),
      pointer: new THREE.Vector2(),
      current: new THREE.Vector2(),
    };

    window.addEventListener("pointermove", (event) => {
      const { width, height } = this.experience.viewport;
      this.parallax.pointer.set(
        (event.clientX / width) * 2 - 1,
        -(event.clientY / height) * 2 + 1,
      );
    });
    document.documentElement.addEventListener("mouseleave", () =>
      this.parallax.pointer.set(0, 0),
    );
  }

  /**
   * Uses the cameras authored in the glb: the first one on desktop, the second (further away) on mobile.
   * Desktop looks where the authored camera reaches the facade depth; mobile orbits around the shop window itself.
   */
  setFromCameras(cameras, escaparate) {
    const source = (this.isMobile && cameras[1]) || cameras[0];

    if (!source) return;

    source.updateWorldMatrix(true, false);

    const position = source.getWorldPosition(new THREE.Vector3());
    const forward = source.getWorldDirection(new THREE.Vector3());
    const facadeZ = 0.85;
    const distance = forward.z < 0 ? (position.z - facadeZ) / -forward.z : 5;

    this.camera.position.copy(position);
    if (source.isPerspectiveCamera) this.camera.fov = source.fov;
    this.camera.updateProjectionMatrix();

    if (this.isMobile) {
      const focus = this.getWorldBox([
        escaparate.frame,
        escaparate.letrero,
        escaparate.letreroBig,
      ]);
      focus.getCenter(this.target);
      this.target.z = facadeZ;

      this.facade = this.getWorldBox([
        escaparate.model.getObjectByName("construccion"),
      ]);

      this.camera.position.copy(MOBILE_CAMERA_POSITION);

      const radius = this.camera.position.distanceTo(this.target);
      this.controls.minDistance = radius * 0.5;
      this.controls.maxDistance = radius * 3.8;
      this.controls.update();
      this.lastValidPosition.copy(this.camera.position);
    } else {
      this.target.copy(position).addScaledVector(forward, distance);

      const { parallax } = this;
      parallax.basePosition.copy(position);
      parallax.right.crossVectors(forward, this.camera.up).normalize();
      parallax.up.crossVectors(parallax.right, forward).normalize();

      this.camera.lookAt(this.target);
    }
  }

  getWorldBox(objects) {
    const box = new THREE.Box3();
    for (const object of objects) {
      object.updateWorldMatrix(true, false);
      box.expandByObject(object);
    }
    return box;
  }

  /**
   * Every corner of the view has to land on the facade: nothing past its sides or above its top.
   * Below the facade is the street, which is fine to see.
   */
  isViewInsideFacade() {
    const { facade, camera } = this;
    const frontZ = facade.max.z;

    if (camera.position.z <= frontZ) return false;

    camera.updateMatrixWorld();

    for (const [x, y] of VIEW_CORNERS) {
      const direction = this.cornerDirection
        .set(x, y, 0.5)
        .unproject(camera)
        .sub(camera.position);

      if (direction.z >= 0) return false;

      const t = (frontZ - camera.position.z) / direction.z;
      const hitX = camera.position.x + direction.x * t;
      const hitY = camera.position.y + direction.y * t;

      if (hitX < facade.min.x || hitX > facade.max.x || hitY > facade.max.y)
        return false;
    }

    return true;
  }

  /**
   * Binary search between the last valid position and the rejected one, so the camera stops right at the edge
   */
  clampToFacade() {
    const camera = this.camera;
    const rejected = camera.position.clone();
    let inside = 0;
    let outside = 1;

    for (let i = 0; i < 8; i++) {
      const middle = (inside + outside) * 0.5;
      camera.position.lerpVectors(this.lastValidPosition, rejected, middle);
      camera.lookAt(this.target);

      if (this.isViewInsideFacade()) inside = middle;
      else outside = middle;
    }

    camera.position.lerpVectors(this.lastValidPosition, rejected, inside);
    camera.lookAt(this.target);
  }

  update() {
    if (this.isMobile) {
      this.controls.update(this.experience.ticker.delta);

      if (!this.facade) return;

      if (!this.isViewInsideFacade()) this.clampToFacade();
      this.lastValidPosition.copy(this.camera.position);
      return;
    }

    const { parallax } = this;
    const lerp =
      1 - Math.exp(-parallax.smoothing * this.experience.ticker.delta);
    parallax.current.lerp(parallax.pointer, lerp);

    this.camera.position
      .copy(parallax.basePosition)
      .addScaledVector(parallax.right, parallax.current.x * parallax.amplitudeX)
      .addScaledVector(parallax.up, parallax.current.y * parallax.amplitudeY);
    this.camera.lookAt(this.target);
  }

  setDebug() {
    if (this.isMobile) this.setControlsDebug();
    else this.setParallaxDebug();
  }

  /**
   * Called after setFromCameras, which overrides the distance limits
   */
  setControlsDebug() {
    const parameters =
      this.experience.rendering.createParameters("Camara limites");

    if (!parameters) return;

    const controls = this.controls;
    const degrees = {};

    for (const key of [
      "minAzimuthAngle",
      "maxAzimuthAngle",
      "minPolarAngle",
      "maxPolarAngle",
    ])
      Object.defineProperty(degrees, key, {
        get: () => THREE.MathUtils.radToDeg(controls[key]),
        set: (value) => {
          controls[key] = THREE.MathUtils.degToRad(value);
        },
      });

    parameters
      .add(degrees, "minAzimuthAngle", -180, 0, 1)
      .name("azimut min (°)");
    parameters
      .add(degrees, "maxAzimuthAngle", 0, 180, 1)
      .name("azimut max (°)");
    parameters.add(degrees, "minPolarAngle", 0, 180, 1).name("polar min (°)");
    parameters.add(degrees, "maxPolarAngle", 0, 180, 1).name("polar max (°)");
    parameters
      .add(controls, "minDistance", 0.5, 20, 0.01)
      .name("distancia min");
    parameters
      .add(controls, "maxDistance", 0.5, 30, 0.01)
      .name("distancia max");
  }

  setParallaxDebug() {
    const parameters =
      this.experience.rendering.createParameters("Camara parallax");

    if (!parameters) return;

    parameters
      .add(this.parallax, "amplitudeX", 0, 1.5, 0.01)
      .name("amplitud x");
    parameters.add(this.parallax, "amplitudeY", 0, 1, 0.01).name("amplitud y");
    parameters.add(this.parallax, "smoothing", 0.5, 15, 0.1).name("suavizado");
  }

  resize() {
    this.camera.aspect = this.experience.viewport.ratio;
    this.camera.updateProjectionMatrix();
  }
}
