---
name: do3
description: Turn an object description into a verified 3D asset in the active project. Use for object research, approved orthographic references, Blender or equivalent modeling, FBX/GLB/OBJ delivery, and local 3D inspection.
---

# Do3D

Carry the approved design through to a reimported project asset and a local preview. The main agent owns each handoff and all approvals and verification.

## 1. Research the object

Read the prompt, supplied files, and applicable workspace instructions. Find existing asset conventions before assigning work. In TREDICI, follow [its project-specific routing](references/tredici.md).

Spawn a research subagent with the user's prompt, relevant file paths, and research permissions. Ask for a concise brief covering overall dimensions and units, proportions, silhouette, major parts and placement, materials, colors, finish, visible details, and hidden or ambiguous features. Cite sources for external claims when research is permitted. For a fictional or original object, extract design intent and identify choices the user still needs to make. The main agent consolidates confirmed facts, estimates, and open questions. User-provided dimensions and design choices take priority.

## 2. Clarify the design

Ask one focused set of questions about unresolved choices that materially affect the object. Reuse confirmed details. Confirm dimensions and units, ask for user-defined dimensions when suitable measurements are unavailable, and ask about finish or appearance where it matters. Wait for the answers needed to generate the reference views. A choice the user explicitly delegates can be resolved and included in the design brief.

## 3. Produce references and wait for approval

Spawn an image-generation subagent. Give it the confirmed design brief, dimensions, axis/view definitions, relevant user reference paths, and an authorized output directory for this revision. Ask for separately saved and clearly labeled front, side, and top orthographic images on a neutral background. Add rear when it reveals additional features and the opposite side when the object is asymmetric. Keep proportions, colors, and part placement consistent. Use a shared generation pass or condition subsequent views on an internally checked first view when available.

Inspect the actual files side by side against the brief. Correct discrepancies that affect silhouette, scale, or construction. Dimensions from the confirmed brief govern interpretation. Show the images with view labels and ask the user to explicitly approve this reference set. If they request revisions, update the affected views, check the full set again, and present the revised set for approval.

**Construction gate.** Save presented images at revision-specific paths and record the exact presented revision and paths in the chat or a project-permitted handoff note. Preserve the files as presented. Require explicit user approval in the chat for that revision before starting construction or assigning it to a modeling subagent. Silence, time elapsed, and a subagent's recommendation cannot authorize construction. On resume, recover the approval and the corresponding files. Any material design or reference change after approval reopens this gate.

## 4. Agree on delivery and build

After reference approval, resolve anything still unspecified about export format and polygon class in one follow-up. Offer FBX, GLB, OBJ, or another supported format and use FBX if the user leaves the choice open. Ask for low-, mid-, or high-poly if still unspecified. Ask about an exact triangle budget or engine target only when it affects delivery and the user or project has yet to specify it.

Spawn a modeling subagent with the approved reference revision and its actual image paths, the agreed output paths, and one English modeling brief. Include:

- Purpose, approved dimensions and units, required parts, placement, silhouette, and proportions.
- Materials, colors, finish, PBR properties or the requested shading model, major construction forms, and the allocation of details to geometry or textures.
- Polygon class, agreed triangle budget if any, topology needs, and target application or engine.
- The active project's axes, pivot, scale, names, UVs, material and texture paths, export settings, and required checks.

Use Blender or another authorized modeling tool that supports the agreed format. Preserve existing project files and follow the project's asset organization.

Author PBR materials by default unless the user requests another shading model. Use the target project's PBR convention. Where the project leaves it open, use metallic–roughness with base color, metallic, and roughness. Use constant values for uniform surfaces and add maps where the material needs spatial detail. Follow the target application's color spaces and channel packing. Use generated textures only when the UV layout and resulting render can be checked. Include all files required by the export, such as OBJ material files and linked textures. Ask the modeler to return the source and export paths, texture paths, inspection renders, and measured results.

## 5. Verify the exported asset

The main agent inspects front, side, and top orthographic renders, plus rear and the opposite side where relevant. Compare with the approved set and check measured dimensions in the agreed units, silhouette, features, materials, face normals, topology, and the actual evaluated export triangle count. Inspect UVs and seams where relevant.

Reimport the exact delivery file into a fresh scene or independent import context. Check that it opens and that scale, axes, orientation, geometry, and supported material properties survive. For PBR, check the base color, metallic, and roughness or smoothness values and any exported maps the format supports. Verify that external textures resolve from the delivery location. Run applicable target-project import checks. Send concrete discrepancies to the modeling subagent, then repeat the affected checks on the revised export. Record pass, failure, or unavailable for each relevant check and disclose material or format limitations.

## 6. Open the preview and hand off

Launch the [bundled viewer](README.md#launch-the-viewer) with the verified GLB. For other formats, use a GLB made from the verified reimport, or from the same evaluated export geometry and materials. Check the preview against the deliverable for orientation, silhouette, parts, colors, and texture coverage. Keep the requested export as the deliverable. Use an approved preview location or a local temporary directory so preview files stay outside import folders.

Open the preview by default. When Python 3.9+ is available, use the bundled `viewer/launch.py` with the preview model path to open it already loaded. Otherwise open the bundled `viewer/index.html` directly and select the model through the browser if available and authorized. If automatic opening is unavailable, provide the HTML and model paths, brief opening instructions, and a rendered preview. Report the asset path, delivery format, dimensions and units, triangle count, preview, and relevant verification limitations. Offer to open the asset in Blender if available.

## Capability gaps

At the affected stage, state the unavailable capability. Use an authorized equivalent only if it preserves the stage's output and any approval gate. For example, the main agent can do the same delegated work when agent spawning is unavailable, or use authorized orthographic illustration tools if image generation is unavailable. Follow project rules for external research, generation, and sharing of reference inputs. If a stage still cannot produce its required output, identify what is missing and wait there.
