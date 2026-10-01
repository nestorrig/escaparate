import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import { Experience } from "./Experience.js";

// Starting camera position on mobile; the distance limits are relative to it
const MOBILE_CAMERA_POSITION = new THREE.Vector3(5, 1.24, 7.6);

// true: desktop orbits like mobile (starting from the glb camera). false: desktop uses the cursor parallax
const DESKTOP_ORBIT = false;

// Desktop camera presets; "outdoor" is filled from the glb camera in setFromCameras
const OUTDOOR_PARALLAX = { amplitudeX: 0.75, amplitudeY: 0.65, smoothing: 2.5 };

const INDOOR_VIEW = {
  position: new THREE.Vector3(0.471, 0.917, 3.427),
  target: new THREE.Vector3(0.434, 0.9, 0.843),
  parallax: { amplitudeX: 0.35, amplitudeY: 0.3, smoothing: 3 },
};

const VIEW_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * Orbit mode (always on mobile) rotates around the shop window and is kept from seeing past the facade.
 * Parallax mode (desktop with DESKTOP_ORBIT off) drifts the camera with the cursor while looking at a fixed point.
 */
export class View {
  constructor() {
    this.experience = Experience.getInstance();
    this.isMobile = this.experience.quality.isMobile;
    this.useOrbit = this.isMobile || DESKTOP_ORBIT;

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.experience.viewport.ratio,
      0.1,
      100,
    );
    this.camera.position.set(0, 1.6, this.isMobile ? 20 : 5.5);
    this.experience.scene.add(this.camera);

    this.target = new THREE.Vector3(0, 1, 0);
    this.previousPosition = this.camera.position.clone();
    this.cameraMoving = false;

    if (this.useOrbit) this.setControls();
    else this.setParallax();

    this.views = { indoor: INDOOR_VIEW };
    this.transition = null;
    if (!this.isMobile) this.setViewButtons();

    this.experience.ticker.events.on("tick", () => this.update(), 1);
    this.experience.viewport.events.on("change", () => this.resize());
  }

  setControls() {
    this.controls = new OrbitControls(
      this.camera,
      this.experience.canvasElement,
    );
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
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
      ...OUTDOOR_PARALLAX,
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

    if (this.useOrbit) {
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

      if (this.isMobile) this.camera.position.copy(MOBILE_CAMERA_POSITION);

      const radius = this.camera.position.distanceTo(this.target);
      this.controls.minDistance = radius * 0.05;
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

    this.views.outdoor = {
      position: (this.useOrbit
        ? this.camera.position
        : this.parallax.basePosition
      ).clone(),
      target: this.target.clone(),
      parallax: OUTDOOR_PARALLAX,
    };

    this.previousPosition.copy(this.camera.position);
    // this.logCamera();
  }

  setViewButtons() {
    this.viewButtons = [
      ...document.querySelectorAll(".camera-switch [data-view]"),
    ];
    document.querySelector(".camera-switch")?.removeAttribute("hidden");

    for (const button of this.viewButtons)
      button.addEventListener("click", () => this.goTo(button.dataset.view));

    const keys = { o: "outdoor", i: "indoor" };

    window.addEventListener("keydown", (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (event.target.closest?.("input, textarea, select, [contenteditable]"))
        return;

      const view = keys[event.key.toLowerCase()];
      if (view) this.goTo(view);
    });
  }

  goTo(name) {
    const view = this.views[name];
    if (!view) return;

    for (const button of this.viewButtons)
      button.setAttribute("aria-pressed", button.dataset.view === name);

    const position = this.useOrbit
      ? this.camera.position
      : this.parallax.basePosition;

    this.transition?.kill();
    if (this.useOrbit) this.controls.enabled = false;

    const ease = "power3.inOut";
    const duration = 1.6;

    this.transition = gsap
      .timeline({
        onComplete: () => {
          this.transition = null;
          if (!this.useOrbit) return;

          this.controls.enabled = true;
          this.controls.update();
          this.lastValidPosition.copy(this.camera.position);
        },
      })
      .to(position, { ...view.position, duration, ease }, 0)
      .to(this.target, { ...view.target, duration, ease }, 0);

    if (!this.useOrbit) {
      this.transition.to(
        this.parallax,
        { ...view.parallax, duration, ease },
        0,
      );

      const forward = view.target.clone().sub(view.position).normalize();
      this.parallax.right.crossVectors(forward, this.camera.up).normalize();
      this.parallax.up.crossVectors(this.parallax.right, forward).normalize();
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
    if (this.useOrbit) this.updateOrbit();
    else this.updateParallax();

    this.logWhenSettled();
  }

  updateOrbit() {
    if (this.transition) {
      this.camera.lookAt(this.target);
      return;
    }

    this.controls.update(this.experience.ticker.delta);

    if (!this.facade) return;

    if (!this.isViewInsideFacade()) this.clampToFacade();
    this.lastValidPosition.copy(this.camera.position);
  }

  /**
   * Logs once the camera stops moving, so damping has finished and the values are final
   */
  logWhenSettled() {
    const moved =
      this.camera.position.distanceToSquared(this.previousPosition) > 1e-10;
    this.previousPosition.copy(this.camera.position);

    if (moved) this.cameraMoving = true;
    else if (this.cameraMoving) {
      this.cameraMoving = false;
      //   this.logCamera();
    }
  }

  logCamera() {
    const format = (vector) =>
      vector
        .toArray()
        .map((value) => value.toFixed(3))
        .join(", ");

    console.log(
      `camera position: new THREE.Vector3(${format(this.camera.position)})\n` +
        `camera target:   new THREE.Vector3(${format(this.target)})`,
    );
  }

  updateParallax() {
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
    if (this.useOrbit) this.setControlsDebug();
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
