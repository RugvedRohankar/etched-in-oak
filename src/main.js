import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/tinos/latin-400.css';
import '@fontsource/tinos/latin-400-italic.css';
import '@fontsource/playfair-display/latin-900.css';
import 'lenis/dist/lenis.css';
import './styles/main.css';

import processScene from './process-scene.svg?raw';
import { initNav } from './js/nav.js';
import { initHero } from './js/hero.js';
import { initWood } from './js/wood.js';
import { initEngraver } from './js/engraver.js';
import { initMotion } from './js/motion.js';

// The process illustration is decorative, so it is injected rather than
// sitting in the HTML. Its box is reserved in CSS, so nothing shifts.
document.querySelector('[data-process-visual]').innerHTML = processScene;

initHero();
initWood();
initEngraver();

const motion = initMotion();
initNav(motion);
