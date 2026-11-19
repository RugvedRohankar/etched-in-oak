import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { STORE_URL } from './src/store.js';

// Walnut photos are optional: for a card image /products/<name>.webp, a file
// public/products/<name>-walnut.webp is used when someone picks walnut. This
// finds the ones that exist and tells the card (data-walnut-src), so the page
// never has to guess at files that aren't there.
function walnutImages() {
  let base = '/';
  let publicDir = 'public';
  return {
    name: 'walnut-images',
    configResolved(config) {
      base = config.base;
      publicDir = config.publicDir;
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<img data-wood-image src="(\/[^"]+)\.webp"/g, (tag, path) => {
          const walnut = `${path}-walnut.webp`;
          if (!existsSync(join(publicDir, walnut))) return tag;
          return `${tag} data-walnut-src="${base.replace(/\/$/, '')}${walnut}"`;
        }),
    },
  };
}

// The site is served from https://<user>.github.io/etched-in-oak/ on GitHub Pages.
export default defineConfig({
  base: '/etched-in-oak/',
  plugins: [
    {
      name: 'store-url',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replaceAll('%STORE_URL%', STORE_URL),
      },
    },
    walnutImages(),
  ],
});
