# Do3D

Do3D takes an object description through design clarification, approval of orthographic references, modeling, reimport checks, and interactive preview. Materials use PBR by default. You can request a different shading model in your prompt.

## Install and invoke

Copy this entire `do3` folder to one of these locations:

- Personal installation for all projects. Use `~/.agents/skills/do3` (on Windows, `%USERPROFILE%\.agents\skills\do3`).
- Project installation. Use `<project>/.agents/skills/do3`.

Open a chat in the target project and select **Do3D** from the skill picker. In Codex CLI or IDE, type `$do3` and select the skill. Restart the client if the new skill does not appear. [Codex skill installation and invocation](https://learn.chatgpt.com/docs/build-skills)

```text
$do3 Build a 240 × 75 × 25 mm matte plum pencil tray with a deeper well on the right. Deliver a low-poly GLB.
```

Codex CLI 0.162.1 discovered the workspace installation and showed **Do3D** in the `$do3` picker. The CLI rejected `/do3` as an unrecognized command. The documented legacy command syntax is `/prompts:<name>`. [Custom prompts documentation](https://learn.chatgpt.com/docs/custom-prompts)

## Launch the viewer

Use Node.js 20 or newer and a WebGL 2 browser. From the installed `do3` folder, run:

```sh
node viewer/launch.mjs "/absolute/path/to/model.glb"
```

The launcher opens the default browser. Keep it running while you inspect the model and press Ctrl+C to stop it. Add `--no-open` to print the URL without opening it, or `--port 8765` to choose the port. It binds to `127.0.0.1` and serves the viewer, selected model, and its referenced resources. All viewer libraries are bundled.

Try the included textured sample from the same folder:

```sh
node viewer/launch.mjs viewer/sample.glb
```

Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, use one finger to orbit and two fingers to pinch or pan. **Lighting** switches between the original materials with studio lighting and an unlit view using their base colors and textures. **Wireframe** overlays triangle edges in either mode. **Reset view** reframes the model.

The viewer uses GLB or glTF 2.0. Keep external buffers and textures alongside the model or in its subfolders. Use standard PNG, JPEG, or WebP textures and export without Draco, Meshopt, or KTX2/Basis compression. The viewer inspects the default scene in its initial pose. For FBX, OBJ, or engine-specific materials, Do3D prepares and checks a GLB preview alongside the agreed delivery format.

The bundled renderer is Three.js 0.183.2 under the MIT license. [Three.js package](https://www.npmjs.com/package/three/v/0.183.2) · [License](viewer/vendor/LICENSE)
