# Do3D

**From an object description to a verified 3D asset.** Do3D is a Codex skill with a standalone offline viewer. Describe the object, approve its orthographic references, and inspect the finished model before handing it off.

[Install the skill](#install-the-skill) · [Open the offline viewer](#open-the-offline-viewer) · [Read the workflow](do3/SKILL.md)

![Do3D offline viewer displaying a textured GLB sample](docs/viewer.png)

## Install the skill

In Codex, ask `$skill-installer` to install `do3` from `Zerrant2/Do3D`. For a manual install, copy the entire [`do3` folder](do3/) into your personal `~/.agents/skills` directory or your project's `.agents/skills` directory.

Open Codex in your project and select **Do3D** from the skill picker. In Codex CLI, type `$do3` and select the skill.

```text
$do3 Build a matte plum pencil tray, 240 × 75 × 25 mm, with a deeper well on the right. Deliver a low-poly GLB.
```

The skill waits for explicit approval of the reference set before construction, uses PBR materials by default, and reimports the export to check dimensions, orientation, geometry, and materials. It follows the active project's asset rules, including the [TREDICI conventions](do3/references/tredici.md) when applicable.

## Open the offline viewer

Open [`do3/viewer/index.html`](do3/viewer/index.html) in a WebGL 2 browser. If you're viewing the file on GitHub, use **Download raw file** first. Everything needed to render is inside the HTML, including a textured demo. Click **Try sample** to see it.

| To do this | Use this control |
| --- | --- |
| Load a self-contained GLB | **Open model** or drag the file into the viewport |
| Load a glTF with separate textures or buffers | **Open folder** and select the folder containing the model and its linked files |
| Inspect from another angle | Drag to orbit, scroll to zoom, or right-drag to pan |
| Inspect the base colors and textures | Turn **Lighting** off |
| Inspect triangle edges in either lighting mode | Turn **Wireframe** on |
| Return to the initial framing | **Reset view** |

The viewer works from a local file. It requires no server, Node.js, or Internet connection. See the [viewer guide](do3/README.md#launch-the-viewer) for supported glTF options and the optional command-line launcher.

## Development and documentation

- [Skill and viewer guide](do3/README.md)
- [Viewer source and build steps](CONTRIBUTING.md)
- [Bundled Three.js license](do3/viewer/THIRD_PARTY_LICENSES.txt)
