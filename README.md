# raytracer

[![Build and deploy](https://github.com/andrewmacheret/raytracer/actions/workflows/deploy.yml/badge.svg)](https://github.com/andrewmacheret/raytracer/actions/workflows/deploy.yml) [![License](https://img.shields.io/badge/license-MIT-lightgray.svg)](https://github.com/andrewmacheret/raytracer/blob/master/LICENSE.md)

A simple ray tracer that renders a 3D scene in the browser, written in plain JavaScript and built with Vite.

See it running at [https://andrewmacheret.com/projects/raytracer/](https://andrewmacheret.com/projects/raytracer/).

![Rendered scene](public/screenshot.png?raw=true "Rendered scene")

## Run it locally

Needs [Node.js](https://nodejs.org/) 24.

```
npm install
npm run dev
```

The scene (camera, lights, spheres and the floor) is described in [app.properties](app.properties). Edit it and the page reloads with the new scene.

- `npm test` checks the scene loads and that rays hit the right things.
- `npm run build` builds the site into `dist/`.

## Deploy

Pushing to `master` runs [GitHub Actions](.github/workflows/deploy.yml), which tests and builds the site, syncs `dist/` to `s3://andrewmacheret.com/projects/raytracer`, and clears the CloudFront cache. It signs in to AWS with GitHub OIDC using the role in the `AWS_ROLE_ARN` repo variable.
