// Hover treatment for collection photos: a band of light crosses the piece and
// the image bends very slightly under the pointer, like looking through a lens.
// One shared WebGL canvas moves to whichever tile is hovered, so the cost is a
// single small context no matter how many tiles there are.

import { LinearFilter, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Texture, Vector2, Vector3, WebGLRenderer } from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform vec2 uImg;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uTime;
  uniform float uSheen;
  uniform vec3 uBg;
  uniform float uContain;
  varying vec2 vUv;

  // Same fit as the photo's CSS object-fit (cover or contain). With contain,
  // anything outside the photo shows the frame colour, and so do the photo's
  // transparent parts.
  vec2 fit(vec2 uv) {
    float box = uRes.x / uRes.y;
    float img = uImg.x / uImg.y;
    vec2 scale = (uContain > 0.5) == (box > img) ? vec2(box / img, 1.0) : vec2(1.0, img / box);
    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 uv = vUv;
    vec2 toMouse = uv - uMouse;
    toMouse.x *= uRes.x / uRes.y;
    float dist = length(toMouse);

    float lens = smoothstep(0.5, 0.0, dist) * uHover;
    uv -= (uv - uMouse) * lens * 0.05;
    uv += 0.0022 * uHover * vec2(sin(uv.y * 17.0 + uTime * 1.5), cos(uv.x * 15.0 + uTime * 1.2));

    vec2 st = fit(uv);
    bool inside = all(greaterThanEqual(st, vec2(0.0))) && all(lessThanEqual(st, vec2(1.0)));
    vec4 photo = inside ? texture2D(uTex, st) : vec4(uBg, 1.0); // premultiplied
    vec3 color = photo.rgb + uBg * (1.0 - photo.a);

    float band = (vUv.x + (1.0 - vUv.y) * 0.55) - uSheen;
    color += exp(-band * band * 34.0) * 0.17 * vec3(1.0, 0.93, 0.8);
    color += smoothstep(0.55, 0.0, dist) * 0.045 * uHover * vec3(1.0, 0.9, 0.74);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createHoverSheen(tiles) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const uniforms = {
    uTex: { value: null },
    uRes: { value: new Vector2(1, 1) },
    uImg: { value: new Vector2(1, 1) },
    uMouse: { value: new Vector2(0.5, 0.5) },
    uHover: { value: 0 },
    uTime: { value: 0 },
    uSheen: { value: -0.7 },
    uBg: { value: new Vector3(1, 1, 1) },
    uContain: { value: 0 },
  };
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const textures = new Map();
  const pointer = new Vector2(0.5, 0.5);
  let active = null;
  let hoverTarget = 0;
  let frame = 0;
  let last = 0;

  function textureFor(img) {
    let texture = textures.get(img);
    if (!texture) {
      texture = new Texture(img);
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;
      // Premultiplied, so filtering never pulls dark fringes into cut-out edges.
      texture.premultiplyAlpha = true;
      texture.needsUpdate = true;
      textures.set(img, texture);
    }
    return texture;
  }

  function track(inner, event) {
    const rect = inner.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * (1 - Math.exp(-dt * 6));
    uniforms.uMouse.value.lerp(pointer, 1 - Math.exp(-dt * 9));
    uniforms.uSheen.value = Math.min(2.4, uniforms.uSheen.value + dt * 1.45);
    uniforms.uTime.value += dt;
    renderer.render(scene, camera);
    if (hoverTarget === 0 && uniforms.uHover.value < 0.01) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function enter(inner, event) {
    const img = inner.querySelector('img');
    // Wait until the photo has loaded and its reveal has finished.
    if (!img?.complete || !img.naturalWidth || !inner.parentElement.hasAttribute('data-revealed')) return;
    active = inner;
    inner.appendChild(canvas);
    renderer.setSize(inner.clientWidth, inner.clientHeight, false);
    uniforms.uRes.value.set(inner.clientWidth, inner.clientHeight);
    uniforms.uImg.value.set(img.naturalWidth, img.naturalHeight);
    const [r, g, b] = getComputedStyle(inner.parentElement).backgroundColor.match(/[\d.]+/g).map(Number);
    uniforms.uBg.value.set(r / 255, g / 255, b / 255);
    uniforms.uContain.value = getComputedStyle(img).objectFit === 'contain' ? 1 : 0;
    uniforms.uTex.value = textureFor(img);
    uniforms.uSheen.value = -0.7;
    track(inner, event);
    uniforms.uMouse.value.copy(pointer);
    hoverTarget = 1;
    renderer.render(scene, camera);
    canvas.classList.add('is-on');
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function leave(inner) {
    if (active !== inner) return;
    hoverTarget = 0;
    canvas.classList.remove('is-on');
  }

  const listeners = tiles.map((inner) => {
    const onEnter = (event) => enter(inner, event);
    const onMove = (event) => active === inner && track(inner, event);
    const onLeave = () => leave(inner);
    inner.addEventListener('pointerenter', onEnter);
    inner.addEventListener('pointermove', onMove);
    inner.addEventListener('pointerleave', onLeave);
    return () => {
      inner.removeEventListener('pointerenter', onEnter);
      inner.removeEventListener('pointermove', onMove);
      inner.removeEventListener('pointerleave', onLeave);
    };
  });

  return {
    dispose() {
      cancelAnimationFrame(frame);
      listeners.forEach((remove) => remove());
      canvas.remove();
      textures.forEach((texture) => texture.dispose());
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
