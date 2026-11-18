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

Double-click [`viewer/index.html`](viewer/index.html) or open it from a WebGL 2 browser. No server, Node.js, or Internet connection is needed. Click **Try sample** for the built-in textured model, **Open model** for a GLB or self-contained glTF, or **Open folder** for a model with external textures or buffers. You can also drag a model onto the viewport.

Drag to orbit, scroll to zoom, and right-drag to pan. On touch screens, use one finger to orbit and two fingers to pinch or pan. **Lighting** switches between the original materials with studio lighting and an unlit view using their base colors and textures. **Wireframe** overlays triangle edges in either mode. **Reset view** reframes the model.

The viewer uses GLB or glTF 2.0. Keep external buffers and textures alongside the model or in its subfolders. Use standard PNG, JPEG, or WebP textures and export without Draco, Meshopt, or KTX2/Basis compression. The viewer inspects the default scene in its initial pose. For FBX, OBJ, or engine-specific materials, Do3D prepares and checks a GLB preview alongside the agreed delivery format.

### Optional launch from a model path

If Python 3.9+ is available, the launcher can open the viewer with a model already loaded. Run from the installed `do3` folder.

```sh
python viewer/launch.py "/absolute/path/to/model.glb"
```

The command writes a temporary HTML preview with the model data and opens it in the default browser. Use `--output preview.html` to keep that self-contained preview at a new path, or `--no-open` to print its path. The bundled viewer itself works directly in the browser without Python.

The bundled renderer is Three.js 0.183.2 under the MIT license. [Three.js package](https://www.npmjs.com/package/three/v/0.183.2) · [License](viewer/THIRD_PARTY_LICENSES.txt)
