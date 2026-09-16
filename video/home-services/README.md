# Volimox home-services explainer

This directory contains the deterministic HTML motion source for the 24.5-second
home-services explainer. It is designed to work without audio and to lead into
the real missed-call/SMS demo.

## Render

Run `render.mjs` with Node and a `NODE_PATH` that contains Playwright, then use
FFmpeg to assemble the generated `frames/frame-%05d.png` sequence at 30 fps.

Final delivery files live in `public/video/`:

- `volimox-home-services-demo.mp4`
- `volimox-home-services-demo.webm`
- `volimox-home-services-demo-poster.jpg`

The opening image was generated specifically for this project with the built-in
image generation tool. The phone, SMS, workflow and lead-card scenes are native
HTML/CSS motion graphics matching the live Volimox experience.
