import * as THREE from "three/webgpu";
import {
  Fn,
  cos,
  floor,
  fract,
  hash,
  max,
  min,
  mix,
  normalWorld,
  positionWorld,
  select,
  sin,
  smoothstep,
  step,
  texture,
  time,
  uniform,
  vec2,
} from "three/tsl";

/**
 * World-space coordinates on the plane of each face, picked from the dominant normal axis,
 * so the patterns keep their size on every side of a box
 */
const facePosition = Fn(() => {
  const n = normalWorld.abs();
  const p = positionWorld;

  return select(
    n.x.greaterThan(max(n.y, n.z)),
    p.zy,
    select(n.y.greaterThan(n.z), p.xz, p.xy),
  );
});

// hash() goes through a uint, so cells are kept positive
const cellHash = (cell, seed = 0) =>
  hash(cell.x.add(1000).mul(127.1).add(cell.y.add(1000).mul(311.7)).add(seed));

/**
 * Running bond bricks with a light pulse travelling diagonally across the wall
 */
export function createWallMaterial(source) {
  const params = {
    brickColor: uniform(source.color.clone()),
    mortarColor: uniform(source.color.clone().multiplyScalar(0.45)),
    brickSize: uniform(new THREE.Vector2(0.24, 0.09)),
    mortarWidth: uniform(0.008),
    variation: uniform(0.6),
    pulse: uniform(0),
    speed: uniform(0),
  };

  const material = new THREE.MeshStandardNodeMaterial({
    roughness: source.roughness,
    metalness: 0,
  });

  material.colorNode = Fn(() => {
    const p = facePosition().div(params.brickSize).toVar();
    p.x.addAssign(floor(p.y).mod(2).mul(0.5));

    const cell = floor(p);
    const local = fract(p);

    const edge = min(
      min(local.x, local.x.oneMinus()).mul(params.brickSize.x),
      min(local.y, local.y.oneMinus()).mul(params.brickSize.y),
    );
    const halfMortar = params.mortarWidth.mul(0.5);
    const brickMask = smoothstep(halfMortar, halfMortar.add(0.002), edge);

    const random = cellHash(cell);
    const wave = sin(
      time
        .mul(params.speed)
        .sub(cell.x.mul(0.35).add(cell.y.mul(0.6)))
        .add(random.mul(2)),
    )
      .mul(0.5)
      .add(0.5)
      .pow(6);

    const brightness = random
      .sub(0.5)
      .mul(params.variation.mul(2))
      .add(1)
      .add(wave.mul(params.pulse));

    return mix(
      params.mortarColor,
      params.brickColor.mul(brightness),
      brickMask,
    );
  })();

  return { material, params };
}

/**
 * Shared by every taped wall, so a single set of controls drives all of them.
 * Each style pairs a looping text texture with the tape color behind it.
 */
export function createTapeParams(styles) {
  for (const { map } of styles) {
    map.wrapS = THREE.RepeatWrapping;
    map.needsUpdate = true;
  }

  return {
    styles: styles.map(({ map, tapeColor }) => ({
      map,
      aspect: map.image.width / map.image.height,
      tapeColor: uniform(new THREE.Color(tapeColor)),
    })),
    textHeight: uniform(0.12),
    padding: uniform(1.15),
    speed: uniform(0.08),
  };
}

/**
 * One tape per style, shared by all the walls so each tape runs across them.
 * The layout lives in uniforms, randomized from the outside.
 */
export function createTapeLayouts(params) {
  return params.styles.map((style, index) => ({
    center: uniform(new THREE.Vector2()),
    angle: uniform(0),
    phase: uniform(0),
    speedScale: uniform(1),
    scroll: uniform(0),
    style: uniform(index),
  }));
}

/**
 * The scroll is integrated on the CPU instead of using `time` in the shader,
 * so changing the speed (or `factor`) slows the tapes down instead of jumping them.
 */
export function updateTapes(params, layouts, delta, factor = 1) {
  for (const layout of layouts)
    layout.scroll.value +=
      delta * params.speed.value * layout.speedScale.value * factor;
}

/**
 * Tapes over a vertical wall that is part of a row of walls unfolded into a single strip.
 * "right" is the horizontal direction of the wall as seen from the side it faces, "origin" its left edge
 * and "start" the length of the walls before it, so a straight tape on the strip folds around the corners.
 */
export function createTapesMaterial(
  source,
  params,
  layouts,
  { origin, right, start, centerY },
) {
  const material = new THREE.MeshStandardNodeMaterial({
    roughness: source.roughness,
    metalness: 0,
  });

  const wallColor = uniform(source.color.clone());
  const wallOrigin = uniform(origin);
  const wallRight = uniform(right);
  const wallStart = uniform(start);
  const stripCenterY = uniform(centerY);

  const tape = (base, layout) => {
    const offset = positionWorld.sub(wallOrigin);
    const q = vec2(
      offset.dot(wallRight).add(wallStart),
      positionWorld.y.sub(stripCenterY),
    ).sub(layout.center);
    const along = vec2(cos(layout.angle), sin(layout.angle));
    const across = vec2(sin(layout.angle).negate(), cos(layout.angle));

    const u = q.dot(along);
    const v = q.dot(across);

    const scroll = layout.scroll.add(layout.phase);
    // flipY is off, so the top of the image is at v = 0
    const textV = v.div(params.textHeight).negate().add(0.5);

    const [first, second] = params.styles.map(({ map, aspect }) =>
      texture(
        map,
        vec2(u.div(params.textHeight.mul(aspect)).sub(scroll), textV),
      ),
    );
    const text = mix(first, second, layout.style);
    const tapeColor = mix(
      params.styles[0].tapeColor,
      params.styles[1].tapeColor,
      layout.style,
    );

    const halfText = params.textHeight.mul(0.5);
    const textMask = step(v.abs(), halfText);
    const tapeMask = step(v.abs(), halfText.mul(params.padding));

    const withTape = mix(base, tapeColor, tapeMask);
    return mix(withTape, text.rgb, text.a.mul(textMask));
  };

  material.colorNode = Fn(() =>
    layouts.reduce((color, layout) => tape(color, layout), wallColor),
  )();

  return material;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random crossing point, slopes, phases and speeds for the tapes of a strip of walls.
 * Both tapes go through the same point with opposite slopes, steep enough to look random
 * but never leaving the walls at the ends of the strip.
 */
export function randomizeTapes(layouts, { length, height }, seed) {
  const random = mulberry32(seed);
  const range = (min, max) => min + random() * (max - min);

  const center = new THREE.Vector2(
    range(0.3, 0.7) * length,
    range(-0.15, 0.15) * height,
  );
  const farthest = Math.max(center.x, length - center.x);
  const room = height * 0.42 - Math.abs(center.y);
  const maxAngle = Math.atan(room / farthest);

  const firstSign = random() < 0.5 ? 1 : -1;

  layouts.forEach((layout, index) => {
    const sign = index % 2 === 0 ? firstSign : -firstSign;

    layout.center.value.copy(center);
    layout.angle.value = sign * range(0.45, 1) * maxAngle;
    layout.phase.value = random();
    layout.speedScale.value = range(0.6, 1.4) * (random() < 0.3 ? -1 : 1);
  });
}

/**
 * Square pixels that switch between three colors, each one at its own pace
 */
export function createPixelMaterial(source) {
  const params = {
    colorA: uniform(source.color.clone()),
    colorB: uniform(new THREE.Color("#004bff")),
    colorC: uniform(new THREE.Color("#7fb0ff")),
    pixelSize: uniform(0.03),
    gap: uniform(0.08),
    speed: uniform(1.5),
  };

  const material = new THREE.MeshStandardNodeMaterial({
    roughness: source.roughness,
    metalness: 0,
  });

  material.colorNode = Fn(() => {
    const p = facePosition().div(params.pixelSize);
    const cell = floor(p);
    const local = fract(p);

    const step = floor(time.mul(params.speed).add(cellHash(cell).mul(10)));
    const value = cellHash(cell, step.mul(74.7));

    const pixel = select(
      value.lessThan(0.6),
      params.colorA,
      select(value.lessThan(0.85), params.colorB, params.colorC),
    );

    const edge = min(
      min(local.x, local.x.oneMinus()),
      min(local.y, local.y.oneMinus()),
    );
    const grid = smoothstep(
      params.gap.mul(0.5),
      params.gap.mul(0.5).add(0.02),
      edge,
    );

    return pixel.mul(mix(0.8, 1, grid));
  })();

  return { material, params };
}
