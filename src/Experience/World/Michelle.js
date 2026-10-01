import * as THREE from "three/webgpu";
import { Experience } from "../Experience.js";

export class Michelle {
  /**
   * @param {THREE.Mesh} frame the "marco" mesh: Michelle stands on the sidewalk in front of it
   */
  constructor(frame) {
    this.experience = Experience.getInstance();

    const gltf = this.experience.resources.michelleModel;

    this.group = new THREE.Group();
    this.group.scale.setScalar(0.8);
    this.group.add(gltf.scene);
    frame.parent.add(this.group);

    this.setPosition(frame);

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    this.setAnimation(gltf);
    this.setDebug();

    this.experience.ticker.events.on("tick", () =>
      this.mixer.update(this.experience.ticker.delta),
    );
  }

  setPosition(frame) {
    frame.geometry.computeBoundingBox();

    const box = frame.geometry.boundingBox.clone().applyMatrix4(frame.matrix);
    const center = box.getCenter(new THREE.Vector3());

    this.group.position.set(center.x, 0, box.max.z + 0.5);
  }

  setAnimation(gltf) {
    this.mixer = new THREE.AnimationMixer(gltf.scene);

    const clip = THREE.AnimationClip.findByName(gltf.animations, "SambaDance");

    if (clip) this.mixer.clipAction(clip).reset().fadeIn(0.2).play();
  }

  setDebug() {
    const parameters = this.experience.rendering.createParameters("Michelle");

    if (!parameters) return;

    parameters.add(this.group, "visible").name("visible");
    parameters.add(this.group.position, "x", -2, 3, 0.01).name("x");
    parameters.add(this.group.position, "z", 0, 4, 0.01).name("z");
    parameters.add(this.group.rotation, "y", -Math.PI, Math.PI, 0.01).name("rotation");
  }
}
