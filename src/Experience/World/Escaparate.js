import * as THREE from "three/webgpu";
import { texture, time, uniform, uv, vec2 } from "three/tsl";
import { Experience } from "../Experience.js";
import {
  createPixelMaterial,
  createTapeLayouts,
  createTapeParams,
  createTapesMaterial,
  createWallMaterial,
  randomizeTapes,
} from "./AnimatedMaterials.js";

const FLOATS = [
  {
    speed: 1.2,
    rotationIntensity: 0.63,
    floatIntensity: 0.6,
    floatingRange: [-0.07, 0.07],
  },
  {
    speed: 1.6,
    rotationIntensity: 0.25,
    floatIntensity: 0.65,
    floatingRange: [-0.08, 0.08],
  },
  {
    speed: 1.35,
    rotationIntensity: 0.35,
    floatIntensity: 0.55,
    floatingRange: [-0.065, 0.065],
  },
];

export class Escaparate {
  constructor(parent) {
    this.experience = Experience.getInstance();

    const gltf = this.experience.resources.escaparateModel;

    this.model = gltf.scene;
    parent.add(this.model);

    this.cameras = gltf.cameras ?? [];

    this.setMeshes();
    this.setTextures();
    this.setAnimatedMaterials();
    this.setFloats();

    this.anchors = {
      poster: this.poster,
      movil: this.skates[1],
    };

    this.experience.ticker.events.on("tick", () => this.update());
  }

  setMeshes() {
    this.model.traverse((child) => {
      if (!child.isMesh) return;

      child.receiveShadow = true;
    });

    // Each spot redraws its casters every frame, so only what sits under the spots casts shadows
    for (const name of ["Skates", "Cubos"])
      this.model.getObjectByName(name).traverse((child) => {
        if (child.isMesh) child.castShadow = true;
      });

    this.poster = this.model.getObjectByName("poster");
    this.letrero = this.model.getObjectByName("letrero");
    this.letreroBig = this.model.getObjectByName("letrero-big");
    this.frame = this.model.getObjectByName("marco");
    this.lamps = ["lampara", "lampara-small", "lampara-small1"].map((name) =>
      this.model.getObjectByName(name),
    );
    this.skates = this.model
      .getObjectByName("Skates")
      .children.filter((child) => child.isMesh);

    this.spots = this.model.getObjectByName("spots").children.map((group) => ({
      group,
      disc: group.children.find((child) => child.name.startsWith("Disco")),
    }));
  }

  /**
   * poster and letreros share their material with the walls in the glb, so each one gets its own
   */
  setTextures() {
    const resources = this.experience.resources;

    this.applyTexture(this.poster, resources.posterTexture);
    this.applyTexture(this.letrero, resources.letreroTexture);
    this.applyTexture(this.letreroBig, resources.letreroBigTexture);

    this.setLetreroBigScroll();
  }

  /**
   * construccion and the cubes share their glb materials with other meshes, so they get their own
   */
  setAnimatedMaterials() {
    const construccion = this.model.getObjectByName("construccion");
    const cubes = this.model
      .getObjectByName("Cubos")
      .children.filter((child) => child.isMesh);

    this.wall = createWallMaterial(construccion.material);
    construccion.material = this.wall.material;

    this.setTapes();

    // this.pixels = createPixelMaterial(cubes[0].material);
    // for (const cube of cubes) cube.material = this.pixels.material;

    const wall =
      this.experience.rendering.createParameters("Pared construccion");
    if (wall) {
      wall.addColor(this.wall.params.brickColor, "value").name("ladrillo");
      wall.addColor(this.wall.params.mortarColor, "value").name("junta");
      wall
        .add(this.wall.params.brickSize.value, "x", 0.05, 1, 0.01)
        .name("ancho");
      wall
        .add(this.wall.params.brickSize.value, "y", 0.02, 0.5, 0.01)
        .name("alto");
      wall
        .add(this.wall.params.mortarWidth, "value", 0, 0.03, 0.001)
        .name("grosor junta");
      wall
        .add(this.wall.params.variation, "value", 0, 0.5, 0.01)
        .name("variacion");
      wall.add(this.wall.params.pulse, "value", 0, 1, 0.01).name("pulso");
      wall.add(this.wall.params.speed, "value", 0, 5, 0.01).name("velocidad");
    }

    // const pixels = this.experience.rendering.createParameters("Cubos pixel");
    // if (pixels) {
    //   pixels.addColor(this.pixels.params.colorA, "value").name("color A");
    //   pixels.addColor(this.pixels.params.colorB, "value").name("color B");
    //   pixels.addColor(this.pixels.params.colorC, "value").name("color C");
    //   pixels
    //     .add(this.pixels.params.pixelSize, "value", 0.005, 0.2, 0.001)
    //     .name("tamaño");
    //   pixels
    //     .add(this.pixels.params.gap, "value", 0, 0.5, 0.01)
    //     .name("separacion");
    //   pixels
    //     .add(this.pixels.params.speed, "value", 0, 10, 0.01)
    //     .name("velocidad");
    // }
  }

  /**
   * A white and a black tape running across the shop window walls, folding around the corners.
   * The walls are listed from left to right as seen from inside; pared1 and construccion.1 form the back wall together.
   */
  setTapes() {
    const resources = this.experience.resources;

    this.tapeParams = createTapeParams([
      { map: resources.letreroParedTexture, tapeColor: "#111111" },
      { map: resources.letreroPared2Texture, tapeColor: "#ffffff" },
    ]);
    this.tapeLayouts = createTapeLayouts(this.tapeParams);

    const walls = [["pared3"], ["construccion1", "pared1"], ["pared2"]].map(
      (names) => {
        const meshes = names.map((name) => this.model.getObjectByName(name));

        const box = new THREE.Box3();
        for (const mesh of meshes) {
          mesh.updateWorldMatrix(true, false);
          mesh.geometry.computeBoundingBox();
          box.union(
            mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),
          );
        }

        const normal = new THREE.Vector3()
          .fromBufferAttribute(meshes[0].geometry.attributes.normal, 0)
          .transformDirection(meshes[0].matrixWorld);
        const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();

        // Left and right edges of the wall along its "right" direction
        const corners = [box.min, box.max].flatMap((a) =>
          [box.min, box.max].map((b) => new THREE.Vector3(a.x, box.min.y, b.z)),
        );
        const distances = corners.map((corner) => corner.dot(right));
        const origin = corners[distances.indexOf(Math.min(...distances))];
        const width = Math.max(...distances) - Math.min(...distances);

        return { meshes, box, right, origin, width };
      },
    );

    const strip = walls.reduce(
      (box, wall) => box.union(wall.box),
      new THREE.Box3(),
    );
    const centerY = (strip.min.y + strip.max.y) * 0.5;

    let start = 0;
    for (const { meshes, right, origin, width } of walls) {
      const material = createTapesMaterial(
        meshes[0].material,
        this.tapeParams,
        this.tapeLayouts,
        { origin, right, start, centerY },
      );
      for (const mesh of meshes) mesh.material = material;

      start += width;
    }

    const stripSize = { length: start, height: strip.max.y - strip.min.y };

    this.tapeLayout = {
      seed: 7,
      reacomodar: () => {
        this.tapeLayout.seed = Math.floor(Math.random() * 100000);
        randomizeTapes(this.tapeLayouts, stripSize, this.tapeLayout.seed);
        console.log("cintas seed:", this.tapeLayout.seed);
      },
    };
    randomizeTapes(this.tapeLayouts, stripSize, this.tapeLayout.seed);

    const parameters =
      this.experience.rendering.createParameters("Cintas paredes");
    if (parameters) {
      parameters
        .addColor(this.tapeParams.styles[0].tapeColor, "value")
        .name("cinta 1");
      parameters
        .addColor(this.tapeParams.styles[1].tapeColor, "value")
        .name("cinta 2");
      parameters
        .add(this.tapeParams.textHeight, "value", 0.02, 0.3, 0.001)
        .name("alto texto");
      parameters
        .add(this.tapeParams.padding, "value", 1, 2, 0.01)
        .name("margen cinta");
      parameters
        .add(this.tapeParams.speed, "value", -0.5, 0.5, 0.001)
        .name("velocidad");
      parameters.add(this.tapeLayout, "reacomodar").name("reacomodar");
    }
  }

  /**
   * letrero-big loops in x, scrolling to the right
   */
  setLetreroBigScroll() {
    const map = this.experience.resources.letreroBigTexture;
    map.wrapS = THREE.RepeatWrapping;
    map.needsUpdate = true;

    this.letreroBigSpeed = uniform(0.05);

    const material = new THREE.MeshStandardNodeMaterial({
      roughness: 1,
      metalness: 0,
    });
    material.colorNode = texture(
      map,
      uv().sub(vec2(time.mul(this.letreroBigSpeed), 0)),
    );
    this.letreroBig.material = material;

    const parameters =
      this.experience.rendering.createParameters("Letrero big");
    parameters
      ?.add(this.letreroBigSpeed, "value", -0.5, 0.5, 0.001)
      .name("velocidad");
  }

  applyTexture(mesh, texture) {
    this.normalizeUvs(mesh.geometry);

    mesh.material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1,
      metalness: 0,
    });
  }

  /**
   * The glb UVs of these planes are a sub-region of a shared unwrap; stretch them to 0-1 so the whole image fits
   */
  normalizeUvs(geometry) {
    const uv = geometry.attributes.uv;
    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);
    const point = new THREE.Vector2();

    for (let i = 0; i < uv.count; i++) {
      point.fromBufferAttribute(uv, i);
      min.min(point);
      max.max(point);
    }

    const size = max.clone().sub(min);

    for (let i = 0; i < uv.count; i++) {
      point.fromBufferAttribute(uv, i).sub(min).divide(size);
      uv.setXY(i, point.x, point.y);
    }

    uv.needsUpdate = true;
  }

  setFloats() {
    this.floats = this.skates.map((skate, index) => ({
      object: skate,
      ...FLOATS[index % FLOATS.length],
      offset: Math.random() * 10000,
      basePosition: skate.position.clone(),
      baseQuaternion: skate.quaternion.clone(),
      euler: new THREE.Euler(),
      quaternion: new THREE.Quaternion(),
    }));
  }

  update() {
    const elapsed = this.experience.ticker.elapsed;

    for (const float of this.floats) {
      const t = ((float.offset + elapsed) / 4) * float.speed;
      const sin = Math.sin(t);

      float.euler.set(
        (Math.cos(t) / 8) * float.rotationIntensity,
        (sin / 8) * float.rotationIntensity,
        (sin / 20) * float.rotationIntensity,
      );
      float.quaternion.setFromEuler(float.euler);
      float.object.quaternion
        .copy(float.baseQuaternion)
        .multiply(float.quaternion);

      const y = THREE.MathUtils.mapLinear(
        sin / 10,
        -0.1,
        0.1,
        float.floatingRange[0],
        float.floatingRange[1],
      );
      float.object.position.copy(float.basePosition);
      float.object.position.y += y * float.floatIntensity;
    }
  }
}
