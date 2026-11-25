# raytracer

[![Build and deploy](https://github.com/andrewmacheret/raytracer/actions/workflows/deploy.yml/badge.svg)](https://github.com/andrewmacheret/raytracer/actions/workflows/deploy.yml) [![Canary](https://github.com/andrewmacheret/raytracer/actions/workflows/canary.yml/badge.svg)](https://github.com/andrewmacheret/raytracer/actions/workflows/canary.yml) [![License](https://img.shields.io/badge/license-MIT-lightgray.svg)](https://github.com/andrewmacheret/raytracer/blob/master/LICENSE.md)

A simple ray tracer that renders a 3D scene in the browser, written in plain JavaScript and built with Vite.

See it running at [https://andrewmacheret.com/projects/raytracer/](https://andrewmacheret.com/projects/raytracer/).

![Rendered scene](public/screenshot.png?raw=true "Rendered scene")

- Drag (or use the arrow keys) to orbit the camera. Scroll, pinch, or press `+` and `-` to zoom.
- The picture is traced on a web worker per CPU thread. It shows big blocks first, then full detail, then keeps adding samples per pixel (16 in total) to smooth the edges.
- The Reflections slider sets how many times a ray can bounce off a shiny surface.
- Randomize drops a random set of mirror, glossy and matte spheres on the floor. Reset brings back the original scene. Save downloads the picture as a PNG.

## Run it locally

Needs [Node.js](https://nodejs.org/) 24.

```
npm install
npm run dev
```

The scene (camera, lights, spheres and the floor) is described in [app.properties](app.properties). Edit it and the page reloads with the new scene.

- `npm test` checks the scene loads, rays hit the right things, the camera orbits correctly and random spheres don't overlap.
- `npm run build` builds the site into `dist/`.

## Health check

[`/projects/raytracer/healthcheck/`](https://andrewmacheret.com/projects/raytracer/healthcheck/) checks the page and its scripts and styles. The Canary workflow (`.github/workflows/canary.yml`) opens it once a day, started by [andrewmacheret/canary](https://github.com/andrewmacheret/canary).

## Deploy

Pushing to `master` runs [GitHub Actions](.github/workflows/deploy.yml), which tests and builds the site, syncs `dist/` to `s3://andrewmacheret.com/projects/raytracer`, and clears the CloudFront cache. It signs in to AWS with GitHub OIDC using the role in the `AWS_ROLE_ARN` repo variable.
