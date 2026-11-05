// All scroll and load motion. Everything here is an enhancement: the page is
// laid out and readable before any of it runs, and none of it runs for
// visitors who ask for reduced motion.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => gsap.utils.toArray(selector, scope);

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------ smooth scroll */

function startLenis() {
  const lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  const raf = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  // In-page links glide instead of jumping, then hand focus to the section.
  const onClick = (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const hash = link.getAttribute('href');
    const target = hash === '#top' ? document.body : document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(hash === '#top' ? 0 : target, {
      duration: 1.5,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      onComplete: () => {
        if (target === document.body) return;
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      },
    });
    history.pushState(null, '', hash);
  };
  document.addEventListener('click', onClick);

  return {
    lenis,
    stop() {
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
    },
  };
}

/* --------------------------------------------------------------------- hero */

function hero(lenis) {
  const el = $('.hero');
  const stage = $('[data-hero-stage]', el);
  const title = $('[data-hero-title]', el);

  // One orchestrated moment on load: the headline rises line by line while the
  // ornament drops in on its twine (see hero-ornament.js).
  document.documentElement.classList.remove('is-loading');
  SplitText.create(title, {
    type: 'lines',
    mask: 'lines',
    linesClass: 'line',
    autoSplit: true,
    onSplit: (self) =>
      gsap.from(self.lines, { yPercent: 110, duration: 1.2, stagger: 0.1, ease: 'power4.out', delay: 0.15 }),
  });
  gsap.from($$('[data-hero-fade]', el), { opacity: 0, y: 18, duration: 0.9, stagger: 0.12, ease: 'power3.out', delay: 0.8 });
  gsap.from('[data-header]', { opacity: 0, duration: 0.9, ease: 'power2.out', delay: 0.5 });

  // Depth: the ornament drifts more slowly than the page as the hero leaves.
  gsap.to(stage, {
    yPercent: 12,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: true },
  });

  let ornament = null;
  let cancelled = false;
  if (!supportsWebGL()) {
    el.classList.add('hero--static');
  } else {
    // If WebGL is slow to arrive, show the plain image rather than an empty stage.
    const patience = setTimeout(() => el.classList.add('hero--static'), 3500);
    import('./hero-ornament.js')
      .then(({ createHeroOrnament }) =>
        createHeroOrnament({
          stage,
          canvas: $('[data-hero-canvas]', el),
          disc: $('[data-hero-disc]', el),
          lenis,
        }),
      )
      .then((instance) => {
        clearTimeout(patience);
        if (cancelled) return instance.dispose();
        ornament = instance;
        el.classList.remove('hero--static');
        el.classList.add('hero--webgl');
      })
      .catch(() => {
        clearTimeout(patience);
        el.classList.add('hero--static');
      });
  }

  return () => {
    cancelled = true;
    ornament?.dispose();
    el.classList.remove('hero--webgl');
    el.classList.add('hero--static');
  };
}

/* ------------------------------------------------------------ text reveals */

function textReveals() {
  $$('[data-split]').forEach((heading) => {
    SplitText.create(heading, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.15,
          stagger: 0.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
        }),
    });
  });

  gsap.set('[data-fade]', { opacity: 0, y: 18 });
  ScrollTrigger.batch('[data-fade]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.09, ease: 'power2.out', overwrite: true }),
  });
}

/* ----------------------------------------------------------- image reveals */

function imageReveals() {
  // Run a reveal once its photo has arrived, so a slow connection never opens
  // onto an empty frame.
  const whenLoaded = (img, play) => {
    if (!img || (img.complete && img.naturalWidth)) return play();
    img.addEventListener('load', play, { once: true });
    img.addEventListener('error', play, { once: true });
  };

  // Photos open through a growing circle, like looking at the end of a branch.
  $$('[data-reveal="circle"]').forEach((media) => {
    const img = $('img', media);
    const caption = media.parentElement.querySelector('.piece__caption');
    const reveal = gsap
      .timeline({ paused: true, onComplete: () => media.setAttribute('data-revealed', '') })
      .fromTo(
        media,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(75% at 50% 50%)', duration: 1.5, ease: 'power3.inOut', clearProps: 'clipPath' },
        0,
      )
      .fromTo(img, { scale: 1.28 }, { scale: 1, duration: 1.9, ease: 'power3.out' }, 0);
    if (caption) reveal.from(caption, { opacity: 0, y: 14, duration: 0.8, ease: 'power2.out' }, 0.55);
    ScrollTrigger.create({
      trigger: media,
      start: 'top 85%',
      once: true,
      onEnter: () => whenLoaded(img, () => reveal.play()),
    });
  });

  $$('[data-reveal="inset"]').forEach((media) => {
    const reveal = gsap.fromTo(
      media,
      { clipPath: 'inset(16% 12% 16% 12%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: 'power3.inOut', clearProps: 'clipPath', paused: true },
    );
    ScrollTrigger.create({
      trigger: media,
      start: 'top 82%',
      once: true,
      onEnter: () => whenLoaded($('img', media), () => reveal.play()),
    });
  });

  // Each photo sits in a slightly taller frame and drifts inside it.
  $$('[data-parallax]').forEach((inner) => {
    gsap.fromTo(
      inner,
      { yPercent: -5.5 },
      {
        yPercent: 5.5,
        ease: 'none',
        scrollTrigger: { trigger: inner.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

function hoverSheen() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!fine || !supportsWebGL()) return null;

  let sheen = null;
  let cancelled = false;
  const load = () =>
    import('./hover-sheen.js').then(({ createHoverSheen }) => {
      if (cancelled) return;
      sheen = createHoverSheen($$('.piece__inner'));
    });
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200));
  idle(load, { timeout: 4000 });

  return () => {
    cancelled = true;
    sheen?.dispose();
  };
}

/* ------------------------------------------------------------------- custom */

function custom() {
  gsap.from('[data-step]', {
    opacity: 0,
    y: 22,
    duration: 0.9,
    stagger: 0.14,
    ease: 'power2.out',
    scrollTrigger: { trigger: '.steps', start: 'top 84%', once: true },
  });

  // The preview text burns in from left to right the first time it is seen.
  gsap.fromTo(
    '.engraver__art',
    { clipPath: 'inset(0% 100% 0% 0%)' },
    {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.4,
      ease: 'power2.inOut',
      delay: 0.9,
      clearProps: 'clipPath',
      scrollTrigger: { trigger: '.engraver__media', start: 'top 85%', once: true },
    },
  );
}

/* ------------------------------------------------------------------ process */

function process() {
  const section = $('.process');
  const q = gsap.utils.selector(section);
  const steps = q('.process__step');
  const marks = q('[data-process-progress] span');
  const count = q('[data-process-count]')[0];
  const part = (id) => q(`#ps-${id}`)[0];
  const el = {
    slice: part('slice'),
    hang: part('hang'),
    shadow: part('shadow'),
    branch: part('branch'),
    laser: part('laser'),
    sand: part('sand'),
    burn: part('burn'),
    twine: part('twine'),
  };
  const twineLength = el.twine.getTotalLength();
  const finishedSlice = el.slice.getAttribute('transform');

  section.classList.add('is-pinned');

  // The scene's geometry is tweened as plain numbers and written straight to
  // SVG attributes, so every transform has an explicit, fixed origin.
  // Opening state: the slice is still the cut end of the branch.
  const scene = { x: 222, sx: 0.225, sy: 0.475, branchX: 0, shadow: 0.7, laserY: -200, sandX: -300, burn: 0, swing: 0 };
  const draw = () => {
    el.slice.setAttribute('transform', `translate(${scene.x} 0) scale(${scene.sx} ${scene.sy})`);
    el.branch.setAttribute('transform', `translate(${scene.branchX} 0)`);
    el.shadow.setAttribute('transform', `translate(334 366) scale(${scene.shadow}) translate(-334 -366)`);
    el.laser.setAttribute('transform', `translate(0 ${scene.laserY})`);
    el.sand.setAttribute('transform', `translate(${scene.sandX} 0)`);
    el.burn.setAttribute('height', Math.max(0, scene.burn));
    el.hang.setAttribute('transform', `rotate(${scene.swing} 320 -30)`);
  };
  const mark = () => {
    const t = timeline.time();
    const current = t < 0.5 ? 0 : t < 1.5 ? 1 : t < 2.4 ? 2 : t < 3.5 ? 3 : 4;
    marks.forEach((item, i) => item.classList.toggle('is-on', i <= current));
    count.textContent = `${current + 1} of ${steps.length}`;
  };

  gsap.set(steps.slice(1), { opacity: 0, y: 26 });
  gsap.set([el.shadow, el.laser, el.sand, part('hole'), el.twine], { opacity: 0 });
  gsap.set(part('rings'), { opacity: 0.3 });
  gsap.set(el.twine, { strokeDasharray: twineLength, strokeDashoffset: twineLength });
  draw();

  const swap = (from, to) =>
    gsap
      .timeline()
      .to(steps[from], { opacity: 0, y: -26, duration: 0.22, ease: 'power2.in' })
      .to(steps[to], { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });

  const timeline = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    onUpdate: () => {
      draw();
      mark();
    },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      // Five short steps: a shorter run on phones, where a pin is felt more.
      end: () => `+=${window.innerWidth < 900 ? 230 : 340}%`,
      pin: q('[data-process-pin]')[0],
      scrub: 0.7,
      anticipatePin: 1,
      // Measure the pin first so every trigger below it accounts for its spacer.
      refreshPriority: 1,
    },
  });

  timeline
    // 1 to 2: the branch slides away and the cut end turns to face us
    .to(scene, { branchX: -250, duration: 0.7 }, 0.1)
    .to(el.branch, { opacity: 0, duration: 0.7 }, 0.1)
    .to(scene, { x: 0, sx: 1, sy: 1, duration: 0.9 }, 0.1)
    .to(scene, { shadow: 1, duration: 0.6 }, 0.4)
    .to(el.shadow, { opacity: 1, duration: 0.6 }, 0.4)
    .add(swap(0, 1), 0.3)
    // 2 to 3: saw marks sand away and the growth rings come up
    .set(el.sand, { opacity: 1 }, 1.1)
    .to(scene, { sandX: 300, duration: 0.8, ease: 'none' }, 1.1)
    .to([part('saw'), part('rough')], { opacity: 0, duration: 0.7 }, 1.15)
    .to(part('rings'), { opacity: 1, duration: 0.7 }, 1.15)
    .set(el.sand, { opacity: 0 }, 1.92)
    .add(swap(1, 2), 1.3)
    // 3 to 4: the laser line passes down the face, leaving the design behind it
    .set(el.laser, { opacity: 1 }, 2.1)
    .to(scene, { burn: 400, laserY: 200, duration: 0.8, ease: 'none' }, 2.1)
    .to(el.laser, { opacity: 0, duration: 0.06 }, 2.9)
    .add(swap(2, 3), 2.2)
    // 4 to 5: drilled, strung on twine, and left to settle
    .to(scene, { sx: 0.92, sy: 0.92, duration: 0.5 }, 3.1)
    .to(part('hole'), { opacity: 1, duration: 0.2 }, 3.15)
    .set(el.twine, { opacity: 1 }, 3.2)
    .to(el.twine, { strokeDashoffset: 0, duration: 0.55, ease: 'power1.inOut' }, 3.2)
    .to(scene, { swing: 3.2, duration: 0.25, ease: 'sine.out' }, 3.55)
    .to(scene, { swing: 0, duration: 0.4, ease: 'sine.inOut' }, 3.8)
    .add(swap(3, 4), 3.3)
    .to({}, { duration: 0.3 });

  marks[0]?.classList.add('is-on');

  return () => {
    // Back to the finished piece for the static layout.
    section.classList.remove('is-pinned');
    marks.forEach((item) => item.classList.remove('is-on'));
    el.slice.setAttribute('transform', finishedSlice);
    [el.branch, el.shadow, el.laser, el.sand, el.hang].forEach((node) => node.removeAttribute('transform'));
    el.burn.setAttribute('height', 400);
  };
}

/* --------------------------------------------- pricing, how to buy, end */

function rules() {
  $$('[data-rule]').forEach((head) => {
    gsap
      .timeline({ scrollTrigger: { trigger: head, start: 'top 90%', once: true } })
      .fromTo(head, { '--line': 0 }, { '--line': 1, duration: 1.2, ease: 'power3.inOut' })
      .from(head.children, { opacity: 0, y: 14, duration: 0.8, stagger: 0.1, ease: 'power2.out' }, 0.15);
  });
}

function pricing() {
  $$('[data-price-row]').forEach((row) => {
    gsap
      .timeline({ scrollTrigger: { trigger: row, start: 'top 90%', once: true } })
      .fromTo(row, { '--line': 0 }, { '--line': 1, duration: 1.2, ease: 'power3.inOut' })
      .from(row.children, { opacity: 0, y: 16, duration: 0.8, stagger: 0.1, ease: 'power2.out' }, 0.3);
  });
}

function howToBuy() {
  // The walnut panel opens from a circle at its top edge as you arrive.
  gsap.fromTo(
    '[data-buy-inner]',
    { clipPath: 'circle(6% at 50% 0%)' },
    {
      clipPath: 'circle(150% at 50% 0%)',
      ease: 'power1.in',
      scrollTrigger: { trigger: '.buy', start: 'top bottom', end: 'top 15%', scrub: true },
    },
  );
}

function footer() {
  gsap.from('[data-footer-word]', {
    yPercent: 45,
    ease: 'none',
    scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}

/* --------------------------------------------------------------------- init */

export function initMotion() {
  const root = document.documentElement;
  let smooth = null;

  const media = gsap.matchMedia();

  media.add('(prefers-reduced-motion: reduce)', () => {
    root.classList.remove('motion', 'is-loading');
    $('.hero')?.classList.add('hero--static');
  });

  media.add('(prefers-reduced-motion: no-preference)', () => {
    root.classList.add('motion');
    smooth = startLenis();

    const cleanups = [
      hero(smooth.lenis),
      textReveals(),
      imageReveals(),
      hoverSheen(),
      rules(),
      custom(),
      process(),
      pricing(),
      howToBuy(),
      footer(),
    ];

    // Webfonts and lazy images can move things; measure again once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

    return () => {
      cleanups.forEach((cleanup) => cleanup?.());
      smooth.stop();
      smooth = null;
    };
  });

  return { getLenis: () => smooth?.lenis ?? null };
}
