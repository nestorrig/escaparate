import * as THREE from "three/webgpu";
import gsap from "gsap";
import { Experience } from "../Experience.js";

const CLICK_TOLERANCE = 5;

/**
 * Hover pulses a skate's emissive, click makes it kickflip.
 * Each float gets `spin` (radians around the board's long axis) and `lift` (extra height) that Escaparate.update applies.
 */
export class SkatesInteraction {
  constructor(floats, tapeMotion) {
    this.experience = Experience.getInstance();
    this.canvas = this.experience.canvasElement;
    this.floats = floats;
    this.tapeMotion = tapeMotion;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerInside = false;
    this.downPosition = new THREE.Vector2();
    this.hovered = null;

    this.params = {
      color: new THREE.Color("#ffffff"),
      intensity: 2,
      pulseSpeed: 6,
      spinDuration: 0.9,
      lift: 0.18,
    };

    this.skates = floats.map((float) => {
      const mesh = float.object;

      // The three boards share one glb material; each needs its own to glow alone
      mesh.material = mesh.material.clone();
      mesh.material.emissive.copy(this.params.color);
      mesh.material.emissiveMap = mesh.material.map;
      mesh.material.emissiveIntensity = 0;

      float.spin = 0;
      float.lift = 0;

      return { mesh, float, hover: 0, timeline: null };
    });

    this.setEvents();
    this.setDebug();

    this.experience.ticker.events.on("tick", () => this.update());
  }

  setEvents() {
    this.canvas.addEventListener("pointermove", (event) => {
      this.setPointer(event);
      this.pointerInside = true;
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.pointerInside = false;
    });
    this.canvas.addEventListener("pointerdown", (event) => {
      this.downPosition.set(event.clientX, event.clientY);
    });
    // OrbitControls drags start with the same pointerdown, so only short presses count as clicks
    this.canvas.addEventListener("pointerup", (event) => {
      const moved = this.downPosition.distanceTo(
        new THREE.Vector2(event.clientX, event.clientY),
      );
      if (moved > CLICK_TOLERANCE) return;

      this.setPointer(event);
      const skate = this.intersect();
      if (skate) this.kickflip(skate);
    });
  }

  setPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  intersect() {
    this.raycaster.setFromCamera(this.pointer, this.experience.view.camera);
    const [hit] = this.raycaster.intersectObjects(
      this.skates.map((skate) => skate.mesh),
      false,
    );

    return hit && this.skates.find((skate) => skate.mesh === hit.object);
  }

  setHovered(skate) {
    if (skate === this.hovered) return;

    if (this.hovered)
      gsap.to(this.hovered, { hover: 0, duration: 0.4, ease: "power2.out" });
    if (skate) gsap.to(skate, { hover: 1, duration: 0.25, ease: "power2.out" });

    // Only when entering or leaving the skates, moving from one board to another keeps them stopped
    if (!skate !== !this.hovered)
      gsap.to(this.tapeMotion, {
        factor: skate ? 0 : 1,
        duration: skate ? 0.6 : 1.2,
        ease: skate ? "power2.out" : "power2.inOut",
        overwrite: true,
      });

    this.hovered = skate;
    this.canvas.style.cursor = skate ? "pointer" : "";
  }

  kickflip(skate) {
    if (skate.timeline?.isActive()) return;

    const { float } = skate;
    const { lift, spinDuration } = this.params;

    skate.timeline = gsap
      .timeline({ onComplete: () => (float.spin %= Math.PI * 2) })
      .to(float, { lift, duration: spinDuration * 0.4, ease: "power2.out" })
      .to(
        float,
        {
          spin: `+=${Math.PI * 2}`,
          duration: spinDuration,
          ease: "power2.inOut",
        },
        0,
      )
      .to(float, {
        lift: 0,
        duration: spinDuration * 0.6,
        ease: "bounce.out",
      });
  }

  update() {
    this.setHovered(this.pointerInside ? this.intersect() : null);

    const elapsed = this.experience.ticker.elapsed;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * this.params.pulseSpeed);

    for (const skate of this.skates) {
      skate.mesh.material.emissiveIntensity =
        skate.hover * this.params.intensity * (0.25 + 0.75 * pulse);
    }
  }

  setDebug() {
    const parameters =
      this.experience.rendering.createParameters("Skates interaccion");
    if (!parameters) return;

    parameters
      .addColor(this.params, "color")
      .name("emissive")
      .onChange(() => {
        for (const skate of this.skates)
          skate.mesh.material.emissive.copy(this.params.color);
      });
    parameters.add(this.params, "intensity", 0, 3, 0.01).name("intensidad");
    parameters
      .add(this.params, "pulseSpeed", 0, 20, 0.1)
      .name("velocidad pulso");
    parameters
      .add(this.params, "spinDuration", 0.2, 3, 0.01)
      .name("duracion giro");
    parameters.add(this.params, "lift", 0, 0.5, 0.01).name("salto");
  }
}
