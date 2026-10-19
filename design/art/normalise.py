"""White-point normalise: divide each channel by the measured paper colour, clip to 255.
Paper = bright near-neutral pixels (min channel > 215, chroma < 18); median per channel.
Images listed in FLIP are mirrored horizontally (masters stay untouched).
Usage: normalise.py <out_dir> <master.png>..."""
import os, sys
import numpy as np
from PIL import Image

# athlete-c2-w (/glp-1): mirrored so its trend line descends left to right next to "fast loss" copy.
FLIP = {'athlete-c2-w'}

out = sys.argv[1]
for p in sys.argv[2:]:
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    mx, mn = a.max(2), a.min(2)
    paper = np.median(a[(mn > 215) & (mx - mn < 18)], 0)
    n = np.clip(a * (255.0 / paper), 0, 255).round().astype(np.uint8)
    if os.path.splitext(os.path.basename(p))[0] in FLIP:
        n = n[:, ::-1]
    Image.fromarray(n).save(os.path.join(out, os.path.basename(p)))
    print(os.path.basename(p), 'paper', paper.tolist())
