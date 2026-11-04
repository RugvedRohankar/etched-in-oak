// The 3D hero ornament. The product photo is the front of a thin wooden slab
// cut to the ornament's traced outline (disc, tab and hole), with light
// plywood edges. One jute twine runs from above the page, over the tab and
// through the hole. It hangs as a calm pendulum: a slow sway of a couple of
// degrees, and a small turn toward the mouse, never more than about 17°.
// No scene lights: the shaders share one light direction, so the face at rest
// shows the photo exactly as shot.

import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineCurve3,
  Mesh,
  NoColorSpace,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  Shape,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import gsap from 'gsap';
import { HERO_OUTLINE } from '../hero-outline.js';

const FOV = 28;
const { size: PHOTO, points: OUTLINE, hole: HOLE, face: FACE, tabTop: TAB_TOP } = HERO_OUTLINE;
// About 6 mm of wood on an ornament about 90 mm across.
const THICKNESS = 0.067 * FACE.r * 2;
// Where the twine joins the ornament: on the turning axis, a little above the
// tab, halfway through the wood. Photo pixels.
const JOIN = { y: TAB_TOP - 59, z: -THICKNESS / 2 };
const LIMIT = { swing: 0.07, turn: 0.3, tilt: 0.12 }; // radians, about 4°, 17° and 7°
const LIGHT = new Vector3(-0.45, 0.6, 0.66).normalize(); // toward the light: upper left, in front
const SHADOW = 'rgb(32, 20, 12)'; // same as the static drop shadow
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/* ---------------------------------------------------------------- shaders */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFacing;
  void main() {
    vUv = uv;
    vFacing = normal.z;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const lighting = /* glsl */ `
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFacing;
  float diffuse(vec3 n) { return max(dot(n, uLight), 0.0); }
  float sheen(vec3 n, float power) {
    vec3 h = normalize(uLight + normalize(vView));
    return pow(max(dot(n, h), 0.0), power);
  }
`;

// Front and back faces. The front is the photo; at rest it is lit at exactly
// 1.0 so it matches the static image, and turning it brightens or dims it a
// little, with a soft highlight when it catches the light.
const faceShader = /* glsl */ `
  ${lighting}
  uniform sampler2D uPhoto;
  uniform vec3 uBack;
  uniform float uRest;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = vFacing > 0.5 ? texture2D(uPhoto, vUv, -0.6).rgb : uBack;
    float light = 0.9 + 0.1 * diffuse(n) / uRest;
    gl_FragColor = vec4(base * light + vec3(1.0, 0.96, 0.88) * sheen(n, 40.0) * 0.16, 1.0);
  }
`;

// The cut edge: light plywood with two faint glue lines through its thickness.
const edgeShader = /* glsl */ `
  ${lighting}
  uniform float uDepth;
  void main() {
    vec3 n = normalize(vNormal);
    float across = clamp((1.0 - vUv.y) / uDepth, 0.0, 1.0);
    float glue = 1.0 - 0.2 * (smoothstep(0.06, 0.0, abs(across - 0.333)) + smoothstep(0.06, 0.0, abs(across - 0.667)));
    float grain = 1.0 + 0.035 * sin(vUv.x * 180.0 + sin(vUv.x * 41.0) * 2.0);
    vec3 ply = vec3(0.882, 0.792, 0.651) * glue * grain;
    gl_FragColor = vec4(ply * (0.55 + 0.5 * diffuse(n)) + vec3(1.0, 0.95, 0.85) * sheen(n, 24.0) * 0.08, 1.0);
  }
`;

const twineShader = /* glsl */ `
  ${lighting}
  uniform sampler2D uRope;
  uniform vec2 uRepeat;
  uniform float uOffset;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 base = texture2D(uRope, vec2(vUv.x * uRepeat.x + uOffset, vUv.y * uRepeat.y)).rgb;
    gl_FragColor = vec4(base * (0.62 + 0.5 * diffuse(n)) + vec3(1.0, 0.95, 0.85) * sheen(n, 16.0) * 0.06, 1.0);
  }
`;

const shadowShader = /* glsl */ `
  uniform sampler2D uShadow;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(vec3(32.0, 20.0, 12.0) / 255.0, texture2D(uShadow, vUv).a * uOpacity);
  }
`;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* ------------------------------------------------------------- geometry */

// The ornament's outline in photo UV units (0-1, y up), so the extruded front
// face's UVs line up with the photo by construction.
function ornamentGeometry() {
  const shape = new Shape();
  for (let i = 0; i < OUTLINE.length; i += 2) {
    const u = OUTLINE[i] / PHOTO;
    const v = 1 - OUTLINE[i + 1] / PHOTO;
    if (i === 0) shape.moveTo(u, v);
    else shape.lineTo(u, v);
  }
  const hole = new Path();
  hole.absarc(HOLE.x / PHOTO, 1 - HOLE.y / PHOTO, HOLE.r / PHOTO, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, { depth: THICKNESS / PHOTO, bevelEnabled: false, curveSegments: 48 });
}

// A tube whose radius can change along its length (the twine squeezes as it
// goes through the hole and ends inside it).
function ropeGeometry(curve, radiusAt, segments, radial = 12) {
  const frames = curve.computeFrenetFrames(segments, false);
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  const point = new Vector3();
  const n = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point);
    const r = radiusAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const sin = Math.sin(a);
      const cos = -Math.cos(a);
      n.set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z).normalize();
      position.push(point.x + r * n.x, point.y + r * n.y, point.z + r * n.z);
      normal.push(n.x, n.y, n.z);
      uv.push(t, j / radial);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setIndex(index);
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/* -------------------------------------------------------------- textures */

// Two twisted strands of jute, tileable: u runs along the twine (one lay of
// the twist), v runs around it. Same colours as the static twine.
function ropeTexture() {
  const W = 128;
  const H = 128;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const groove = [141, 107, 71];
  const light = [207, 174, 133];
  let seed = 11;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const fibres = new Float32Array(W * H);
  for (let k = 0; k < 700; k++) {
    // Short fibres follow the strands, which run diagonally across the tile.
    const x0 = random() * W;
    const y0 = random() * H;
    const length = 5 + random() * 16;
    const amount = (random() - 0.45) * 0.5;
    for (let s = 0; s < length; s++) {
      const x = Math.floor(x0 + s) % W;
      const y = Math.floor(y0 + s) % H;
      fibres[y * W + x] += amount;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const strand = ((y / H - x / W + 2) * 2) % 1;
      const round = Math.pow(Math.sin(Math.PI * strand), 0.7);
      const f = clamp(round + fibres[y * W + x], 0, 1.15);
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) image.data[i + c] = clamp(groove[c] + (light[c] - groove[c]) * f, 0, 255);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

// The ornament's silhouette, softly blurred, as the shadow it casts on the
// wall. Same offset, blur and strength as the static image's drop shadow.
const SHADOW_SCALE = 0.4;
const SHADOW_MARGIN = 56;
function shadowTexture() {
  const size = Math.ceil(PHOTO * SHADOW_SCALE) + SHADOW_MARGIN * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const path = new Path2D();
  for (let i = 0; i < OUTLINE.length; i += 2) {
    const x = OUTLINE[i] * SHADOW_SCALE + SHADOW_MARGIN;
    const y = OUTLINE[i + 1] * SHADOW_SCALE + SHADOW_MARGIN;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  path.moveTo((HOLE.x + HOLE.r) * SHADOW_SCALE + SHADOW_MARGIN, HOLE.y * SHADOW_SCALE + SHADOW_MARGIN);
  path.arc(HOLE.x * SHADOW_SCALE + SHADOW_MARGIN, HOLE.y * SHADOW_SCALE + SHADOW_MARGIN, HOLE.r * SHADOW_SCALE, 0, Math.PI * 2);
  // Draw the shape off the canvas and keep only its shadow, which works in
  // every browser (canvas blur filters do not).
  const away = size * 2;
  ctx.shadowColor = SHADOW;
  ctx.shadowBlur = 0.0375 * FACE.r * 2 * SHADOW_SCALE * 2;
  ctx.shadowOffsetX = away;
  ctx.translate(-away, 0);
  ctx.fill(path, 'evenodd');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  return { texture, size: size / SHADOW_SCALE };
}

/* ----------------------------------------------------------------- scene */

export async function createHeroOrnament({ stage, canvas, photo }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const photoTexture = await new TextureLoader().loadAsync(photo.currentSrc || photo.src);
  photoTexture.colorSpace = NoColorSpace; // sampled as stored, so colours match the <img>
  photoTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const fraction = (name) => parseFloat(getComputedStyle(stage).getPropertyValue(name));
  const twineRadius = (fraction('--photo-twine-w') * PHOTO) / 2; // photo pixels

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 8000);
  const shared = { uLight: { value: LIGHT } };

  const faceMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: faceShader,
    uniforms: {
      ...shared,
      uPhoto: { value: photoTexture },
      uBack: { value: new Vector3(0.86, 0.76, 0.61) },
      uRest: { value: LIGHT.z },
    },
  });
  const edgeMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader: edgeShader,
    uniforms: { ...shared, uDepth: { value: THICKNESS / PHOTO } },
  });
  const rope = ropeTexture();
  const ropeUniforms = (repeat, offset = 0) => ({
    ...shared,
    uRope: { value: rope },
    uRepeat: { value: new Vector2(repeat, 1) },
    uOffset: { value: offset },
  });
  const upperMaterial = new ShaderMaterial({ vertexShader, fragmentShader: twineShader, uniforms: ropeUniforms(1) });
  const lowerMaterial = new ShaderMaterial({ vertexShader, fragmentShader: twineShader, uniforms: ropeUniforms(1) });
  const shadow = shadowTexture();
  const shadowMaterial = new ShaderMaterial({
    vertexShader: shadowVertex,
    fragmentShader: shadowShader,
    uniforms: { uShadow: { value: shadow.texture }, uOpacity: { value: 0.28 } },
    transparent: true,
    depthWrite: false,
  });

  // The twine from the join, over the top of the tab, down the front and
  // through the hole. Photo pixels, y up, origin at the join.
  const local = (y, z) => new Vector3(0, JOIN.y - y, z - JOIN.z);
  const front = twineRadius * 0.8;
  const lowerCurve = new CatmullRomCurve3(
    [
      local(JOIN.y, JOIN.z),
      local(JOIN.y + 24, JOIN.z),
      local(TAB_TOP - 12, -THICKNESS * 0.35),
      local(TAB_TOP + 8, front * 0.5),
      local(TAB_TOP + 32, front),
      local(HOLE.y - 12, front * 0.75),
      local(HOLE.y, 0),
      local(HOLE.y + 2, -THICKNESS * 0.7),
      local(HOLE.y + 4, -THICKNESS - twineRadius),
    ],
    false,
    'centripetal',
  );
  // Full thickness until the twine reaches the hole, then squeezed into it.
  const squeeze = HOLE.r * 0.82;
  const intoHole = 0.66;
  const lowerRadius = (t) =>
    t < intoHole ? twineRadius - (twineRadius - squeeze) * clamp((t - intoHole + 0.12) / 0.12, 0, 1) : squeeze * (1 - (t - intoHole) / (1 - intoHole)) ** 0.6;
  const geometries = [
    ornamentGeometry(),
    ropeGeometry(new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, -1, 0)), () => 1, 4),
    ropeGeometry(lowerCurve, lowerRadius, 140),
    new PlaneGeometry(1, 1),
  ];
  const [slabGeo, upperGeo, lowerGeo, shadowGeo] = geometries;

  // pivot (swings) > ornament (turns and tilts about the join) > slab + lower twine
  const pivot = new Group();
  const ornament = new Group();
  const slab = new Mesh(slabGeo, [faceMaterial, edgeMaterial]);
  const upper = new Mesh(upperGeo, upperMaterial);
  const lower = new Mesh(lowerGeo, lowerMaterial);
  const shadowMesh = new Mesh(shadowGeo, shadowMaterial);
  ornament.add(slab, lower);
  pivot.add(ornament, upper);
  scene.add(shadowMesh, pivot);

  const pitch = twineRadius * 2 * 1.15; // one lay of the twist, photo pixels
  lowerMaterial.uniforms.uRepeat.value.x = lowerCurve.getLength() / pitch;

  let scale = 1;
  let shadowOffset = { x: 0, y: 0 };
  // The shadow sits on a "wall" far enough back that no part of the turning
  // ornament reaches it; it is scaled up to cancel the perspective, so it
  // lands exactly where the static drop shadow does.
  let shadowZ = 0;
  let shadowGrow = 1;
  const faceCentre = new Vector3();
  const world = new Vector3();

  // One scene unit is one CSS pixel at the ornament's front face, so at rest
  // the 3D ornament sits exactly where the static image does.
  function layout() {
    const c = canvas.getBoundingClientRect();
    const p = photo.getBoundingClientRect();
    if (!c.width || !c.height || !p.width) return;
    renderer.setSize(c.width, c.height, false);
    const distance = c.height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.aspect = c.width / c.height;
    camera.position.set(0, 0, distance);
    camera.near = distance / 20;
    camera.far = distance * 3;
    camera.updateProjectionMatrix();

    scale = p.width / PHOTO;
    const toX = (x) => x - (c.left + c.width / 2);
    const toY = (y) => c.top + c.height / 2 - y;
    const joinX = toX(p.left + HOLE.x * scale);
    const joinY = toY(p.top + JOIN.y * scale);
    const pivotY = toY(c.top) + FACE.r * scale * 0.6; // just above the canvas
    const length = pivotY - joinY;

    pivot.position.set(joinX, pivotY, JOIN.z * scale);
    ornament.position.set(0, -length, 0);
    slab.scale.setScalar(p.width);
    slab.position.set(-HOLE.x * scale, -(PHOTO - JOIN.y) * scale, -(THICKNESS / 2) * scale);
    lower.scale.setScalar(scale);
    upper.scale.set(twineRadius * scale, length, twineRadius * scale);
    const upperRepeat = length / (pitch * scale);
    upperMaterial.uniforms.uRepeat.value.x = upperRepeat;
    lowerMaterial.uniforms.uOffset.value = upperRepeat % 1;

    faceCentre.set((FACE.x - HOLE.x) * scale, (JOIN.y - FACE.y) * scale, (THICKNESS / 2) * scale);
    shadowZ = -FACE.r * 2 * scale * 0.4;
    shadowGrow = (distance - shadowZ) / distance;
    // Offset of the photo's centre from the face's centre, plus the cast offset.
    shadowOffset = {
      x: (PHOTO / 2 - FACE.x) * scale + 0.026 * FACE.r * 2 * scale,
      y: -(PHOTO / 2 - FACE.y) * scale - 0.045 * FACE.r * 2 * scale,
    };
  }

  // Pendulum state, all small: swing about the pivot, turn about the twine,
  // tilt toward or away from the viewer.
  let swing = 0;
  let swingV = 0;
  let turn = 0;
  let turnV = 0;
  let tilt = 0;
  let tiltV = 0;
  let aimTurn = 0;
  let aimTilt = 0;
  let clock = 0;

  function tick(_time, deltaMs) {
    const dt = Math.min(0.033, (deltaMs || 16.7) / 1000);
    clock += dt;
    swingV += (-9 * (swing - 0.035 * Math.sin(clock * 0.75)) - 1.8 * swingV) * dt;
    turnV += (-6 * (turn - aimTurn - 0.045 * Math.sin(clock * 0.45 + 1)) - 3 * turnV) * dt;
    tiltV += (-6 * (tilt - aimTilt) - 3 * tiltV) * dt;
    swing = clamp(swing + swingV * dt, -LIMIT.swing, LIMIT.swing);
    turn = clamp(turn + turnV * dt, -LIMIT.turn, LIMIT.turn);
    tilt = clamp(tilt + tiltV * dt, -LIMIT.tilt, LIMIT.tilt);

    pivot.rotation.z = swing;
    ornament.rotation.set(tilt, turn, 0);

    // The shadow follows the ornament across the wall and narrows as it turns.
    ornament.updateWorldMatrix(true, false);
    world.copy(faceCentre);
    ornament.localToWorld(world);
    shadowMesh.position.set(
      (world.x + shadowOffset.x) * shadowGrow,
      (world.y + shadowOffset.y) * shadowGrow,
      shadowZ,
    );
    shadowMesh.scale.set(
      shadow.size * scale * shadowGrow * Math.cos(turn),
      shadow.size * scale * shadowGrow * Math.cos(tilt),
      1,
    );
    renderer.render(scene, camera);
  }

  // A small turn toward the mouse; it drifts back to facing front when the
  // mouse leaves the window.
  const onPointer = (event) => {
    if (event.pointerType !== 'mouse') return;
    const p = photo.getBoundingClientRect();
    const dx = event.clientX - (p.left + p.width * fraction('--photo-x'));
    const dy = event.clientY - (p.top + p.width * fraction('--photo-y'));
    aimTurn = clamp(dx / (window.innerWidth * 0.5), -1, 1) * 0.22;
    aimTilt = clamp(dy / (window.innerHeight * 0.5), -1, 1) * 0.09;
  };
  const onLeave = () => {
    aimTurn = 0;
    aimTilt = 0;
  };

  let running = false;
  const start = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    gsap.ticker.remove(tick);
  };

  // Only render while the hero is on screen.
  const visibility = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
    rootMargin: '80px',
  });
  const resize = new ResizeObserver(layout);

  layout();
  tick(0, 16.7);
  start();

  visibility.observe(stage);
  resize.observe(stage);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);

  return {
    dispose() {
      stop();
      visibility.disconnect();
      resize.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      geometries.forEach((geometry) => geometry.dispose());
      [faceMaterial, edgeMaterial, upperMaterial, lowerMaterial, shadowMaterial].forEach((material) => material.dispose());
      [photoTexture, rope, shadow.texture].forEach((texture) => texture.dispose());
      renderer.dispose();
    },
  };
}
