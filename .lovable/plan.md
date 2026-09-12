# Rebuild the pre-made glass preset

## Goal
Make preset mode look like clear, borderless water resting over a video frame: transparent center, dimensional curved lensing at the edge, and no decorative glow or white outline.

## Changes
- Replace the current preset renderer instead of layering more effects onto it.
- Remove every explicit outer stroke, white hairline, bloom, halo, and hotspot from preset mode.
- Build depth from subtle inner refraction only: a restrained dark meniscus, soft directional distortion bands, and a faint lower caustic contained inside the shape.
- Keep the middle highly transparent so uploaded footage stays crisp and readable.
- Make Clear, Regular, and Frosted vary only in tint/frost strength while sharing the same clean optical structure.
- Keep the current width, height, color, dragging, preview, and transparent PNG export behavior unchanged.

## Technical details
- Draw all optical shading clipped inside the rounded shape; no stroke is drawn on the shape boundary.
- Use broad gradients rather than repeated concentric strokes, preventing the edge from reading as a border.
- Reduce preset canvas padding to shadow-only space and remove the preset shadow if it creates a visible halo.
- Verify the preset over a detailed background at desktop size, inspect the transparent export preview, and confirm no console errors.
