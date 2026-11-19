// Wood choice on the product cards; plywood is chosen by default. Picking a
// wood swaps in that wood's photo when there is one (the build looks for
// <name>-walnut.webp, see vite.config.js) and shows only the card details
// marked data-for-wood for it, such as a different price. Every Buy button
// goes to the same store page, so the card also asks for the wood in the
// order notes.
export function initWood() {
  document.querySelectorAll('[data-wood]').forEach((group) => {
    const card = group.closest('.piece');
    const img = card.querySelector('[data-wood-image]');
    const photos = { plywood: img.getAttribute('src'), walnut: img.dataset.walnutSrc || null };

    const show = (wood) => {
      const next = photos[wood] || photos.plywood;
      if (img.getAttribute('src') !== next) img.setAttribute('src', next);
      card.querySelectorAll('[data-for-wood]').forEach((el) => {
        el.hidden = el.dataset.forWood !== wood;
      });
    };

    group.addEventListener('change', (event) => show(event.target.value));
    show(group.querySelector('input:checked')?.value ?? 'plywood');
  });
}
