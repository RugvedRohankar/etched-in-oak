# Original product images

The product images exactly as they were before their backgrounds were removed
(November 2026). They are kept here, outside `public/`, so they are not deployed.

To undo the change, copy them back over the cut-out versions:

```bash
cp backups/original-product-images/products/*.webp public/products/
cp backups/original-product-images/images/collection/vinyl-record.webp public/images/collection/
```

The cards' shared background and sizes live in `index.html` and
`src/styles/main.css`; git history has their earlier versions.

Keep `products/peace-on-earth.webp`: `scripts/make-placeholders.mjs` reads it to
build the hero ornament's face.
