// The hero ornament: a thin walnut disc hanging on twine, drawn in WebGL.
// It is a small damped pendulum. Scrolling and the pointer nudge it, and it
// always settles back. One mesh, one texture, no shadow maps.

import {
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import gsap from 'gsap';

const FOV = 28;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function softShadowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.24, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(32, 18, 8, 1)');
  gradient.addColorStop(1, 'rgba(32, 18, 8, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

// A unit disc facing the camera, with a slightly uneven bark edge.
function sliceGeometry() {
  const geometry = new CylinderGeometry(1, 1, 0.13, 96, 1);
  geometry.rotateX(Math.PI / 2);
  const { position, normal, uv } = geometry.attributes;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const facing = normal.getZ(i);
    // Map the photo straight onto both faces before the edge is roughened.
    if (facing > 0.9) uv.setXY(i, x * 0.5 + 0.5, y * 0.5 + 0.5);
    else if (facing < -0.9) uv.setXY(i, -x * 0.5 + 0.5, y * 0.5 + 0.5);
    const a = Math.atan2(y, x);
    const k = 1 + 0.018 * Math.sin(3 * a + 1.3) + 0.011 * Math.sin(7 * a + 0.4) + 0.006 * Math.sin(13 * a + 2.1);
    position.setXY(i, x * k, y * k);
  }
  return geometry;
}

export async function createHeroOrnament({ stage, canvas, disc, lenis }) {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  const faceTexture = await new TextureLoader().loadAsync(disc.currentSrc || disc.src);
  faceTexture.colorSpace = SRGBColorSpace;
  faceTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 8000);
  scene.add(new HemisphereLight(0xfff6e6, 0x8a6a4a, 2.1));
  const key = new DirectionalLight(0xfff1dc, 2);
  key.position.set(-0.7, 1, 1.4);
  scene.add(key);

  const face = new MeshStandardMaterial({ map: faceTexture, roughness: 0.74, metalness: 0 });
  const bark = new MeshStandardMaterial({ color: 0x2c1d13, roughness: 1, metalness: 0 });
  const jute = new MeshStandardMaterial({ color: 0xb99a68, roughness: 1, metalness: 0 });
  const shadowTexture = softShadowTexture();
  const shadowMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.3 });

  const geometries = [
    sliceGeometry(),
    new TorusGeometry(0.125, 0.013, 8, 40).rotateY(Math.PI / 2),
    new CylinderGeometry(0.012, 0.012, 1, 8),
    new PlaneGeometry(1, 1),
  ];
  const [sliceGeo, loopGeo, twineGeo, shadowGeo] = geometries;

  // pivot (swings) > ornament (twists on the twine) > slice + loop
  const pivot = new Group();
  const ornament = new Group();
  const slice = new Mesh(sliceGeo, [bark, face, face]);
  const loop = new Mesh(loopGeo, jute);
  loop.position.y = 0.905; // through the drilled hole at 0.78 and over the top edge
  const twine = new Mesh(twineGeo, jute);
  const shadow = new Mesh(shadowGeo, shadowMaterial);
  ornament.add(slice, loop);
  pivot.add(ornament, twine);
  scene.add(shadow, pivot);

  let radius = 100;
  let base = { x: 0, y: 0 };
  const drop = { y: 0 };

  // One scene unit is one CSS pixel at the ornament's depth, so the disc can be
  // placed exactly where the fallback image sits.
  function layout() {
    const c = canvas.getBoundingClientRect();
    const d = disc.getBoundingClientRect();
    if (!c.width || !c.height || !d.width) return;
    renderer.setSize(c.width, c.height, false);
    const distance = c.height / 2 / Math.tan((FOV * Math.PI) / 360);
    camera.aspect = c.width / c.height;
    camera.position.set(0, 0, distance);
    camera.near = distance / 20;
    camera.far = distance * 3;
    camera.updateProjectionMatrix();

    radius = d.width / 2;
    const cx = d.left + radius - (c.left + c.width / 2);
    const cy = c.top + c.height / 2 - (d.top + radius);
    const length = c.height / 2 - cy + radius * 0.6; // the pivot sits just above the canvas
    base = { x: cx, y: cy + length };
    ornament.position.set(0, -length, 0);
    ornament.scale.setScalar(radius);
    const twineLength = length - radius * 1.02;
    twine.scale.set(radius, twineLength, radius);
    twine.position.set(0, -twineLength / 2, 0);
    shadow.scale.setScalar(radius * 2.9);
  }

  // Pendulum state: theta swings side to side, phi twists around the twine.
  let theta = 0.38;
  let thetaV = 0;
  let phi = -0.95;
  let phiV = 0;
  let kick = 0;
  let twist = 0;
  let lean = 0;
  let clock = 0;
  const world = new Vector3();

  function tick(_time, deltaMs) {
    const dt = Math.min(0.033, (deltaMs || 16.7) / 1000);
    clock += dt;
    const restTheta = 0.015 * Math.sin(clock * 0.9);
    const restPhi = 0.11 * Math.sin(clock * 0.55 + 1) + lean;
    thetaV += (-11 * (theta - restTheta) - 1.3 * thetaV + kick) * dt;
    phiV += (-6 * (phi - restPhi) - 1.15 * phiV + twist) * dt;
    theta = clamp(theta + thetaV * dt, -0.5, 0.5);
    phi = clamp(phi + phiV * dt, -1.2, 1.2);
    kick *= Math.exp(-dt * 8);
    twist *= Math.exp(-dt * 8);

    pivot.position.set(base.x, base.y + drop.y, 0);
    pivot.rotation.z = theta;
    ornament.rotation.y = phi;
    ornament.getWorldPosition(world);
    shadow.position.set(world.x + radius * 0.12, world.y - radius * 0.17, -radius * 0.6);
    renderer.render(scene, camera);
  }

  const onScroll = ({ velocity }) => {
    kick = clamp(kick + velocity * 0.03, -7, 7);
    twist = clamp(twist + velocity * 0.05, -9, 9);
  };

  let lastX = null;
  const onPointer = (event) => {
    if (event.pointerType === 'touch') return;
    const d = disc.getBoundingClientRect();
    const r = d.width / 2;
    const dx = event.clientX - (d.left + r);
    const dy = event.clientY - (d.top + r);
    const near = clamp(1.7 - Math.hypot(dx, dy) / r, 0, 1);
    if (lastX !== null) kick = clamp(kick + (event.clientX - lastX) * 0.02 * near, -7, 7);
    lastX = event.clientX;
    lean = clamp(dx / r, -1, 1) * 0.2 * near;
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
  // Start high and swung out, then let the pendulum settle.
  drop.y = canvas.getBoundingClientRect().height * 0.75;
  const entrance = gsap.to(drop, { y: 0, duration: 1.5, ease: 'power3.out', delay: 0.1 });
  tick(0, 16.7);
  start();

  visibility.observe(stage);
  resize.observe(stage);
  lenis?.on('scroll', onScroll);
  window.addEventListener('pointermove', onPointer, { passive: true });

  return {
    dispose() {
      stop();
      entrance.kill();
      visibility.disconnect();
      resize.disconnect();
      lenis?.off('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      geometries.forEach((geometry) => geometry.dispose());
      [face, bark, jute, shadowMaterial].forEach((material) => material.dispose());
      faceTexture.dispose();
      shadowTexture.dispose();
      renderer.dispose();
    },
  };
}
