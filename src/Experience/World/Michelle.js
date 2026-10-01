import * as THREE from "three/webgpu";
import { Experience } from "../Experience.js";

export class Michelle {
  constructor(parent) {
    this.experience = Experience.getInstance();

    const gltf = this.experience.resources.michelleModel;

    this.group = new THREE.Group();
    this.group.position.set(-0.6, -0.24, -0.5);
    this.group.add(gltf.scene);
    parent.add(this.group);

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
      }
    });

    this.setAnimation(gltf);
    this.setShadow(parent);

    this.experience.ticker.events.on("tick", () =>
      this.mixer.update(this.experience.ticker.delta),
    );
  }

  setAnimation(gltf) {
    this.mixer = new THREE.AnimationMixer(gltf.scene);

    const clip = THREE.AnimationClip.findByName(gltf.animations, "SambaDance");

    if (clip) this.mixer.clipAction(clip).reset().fadeIn(0.2).play();
  }

  /**
   * Stand-in for drei ContactShadows: a plane that only shows received shadows
   */
  setShadow(parent) {
    const material = new THREE.ShadowNodeMaterial({ opacity: 0.55 });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;

    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), material);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0, -0.44, 0);
    this.shadow.receiveShadow = true;
    parent.add(this.shadow);
  }
}
