# Illustration masters

`masters/` holds the untouched 1536x1024 PNGs. They are not shipped; `public/art/` gets WebP exports only.

## Export recipe

1. White-point normalise (paper becomes #FFFFFF, so `mix-blend-mode: multiply` in site.css makes the
   paper take the canvas colour in light and `--art-backing` in dark):

   ```sh
   python3 design/art/normalise.py /tmp/art-norm design/art/masters/*.png   # needs numpy + pillow
   ```

   Images named in `FLIP` inside normalise.py are mirrored horizontally at this step (currently
   athlete-c2-w, so its trend line descends left to right on /glp-1). Never flip with CSS.

2. Encode 768w and 1536w WebP per image (`public/art/<name>-<w>.webp`), budget 1536w <= 180 KB:

   ```sh
   cwebp -q 80 -m 6 -sharp_yuv -af /tmp/art-norm/<name>.png -o public/art/<name>-1536.webp
   cwebp -q 80 -m 6 -sharp_yuv -af -resize 768 512 /tmp/art-norm/<name>.png -o public/art/<name>-768.webp
   ```

   athlete-c4-lift uses -q 75 to stay under budget.

Real-ESRGAN x4plus was tried for a 2x tier and rejected for all six: it smooths the print grain and adds
edge halos. Do not add a 2304w export from an AI upscale.
