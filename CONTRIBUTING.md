# Contributing to Do3D

The skill lives in [`do3`](do3/). The viewer source lives in [`src/viewer`](src/viewer/). The build inlines the renderer, UI, license, and textured sample into a single [`index.html`](do3/viewer/index.html).

If you change the viewer source or sample, rebuild from the repository root with Node.js 20+ and npm.

```sh
npm ci
npm run build
```

Commit the source changes together with the generated HTML. Open the generated HTML from disk and try the sample. For changes to asset loading, also try a glTF with separate resources and confirm that a missing texture or buffer produces a readable error. Check the lighting and wireframe controls in both lighting modes.

The development tools are only used to build the HTML. The installed skill and the standalone viewer ship with the generated file.
