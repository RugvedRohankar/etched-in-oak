// On phones the hero ornament sits below the headline, so a strip of its own
// twine carries it up to the top of the page, and the swing turns around that
// top end. This keeps --twine-reach equal to the gap between the top of the
// hero and the top of the image (zero on larger screens, where the image
// already starts at the top).
export function initHero() {
  const hero = document.querySelector('.hero');
  const ornament = hero?.querySelector('[data-hero-ornament]');
  if (!ornament) return;

  const update = () => {
    hero.style.setProperty('--twine-reach', `${Math.max(0, Math.round(ornament.offsetTop))}px`);
  };
  new ResizeObserver(update).observe(hero);
  update();
}
