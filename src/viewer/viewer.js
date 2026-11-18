import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { embeddedFile, isModel, loadModel } from './model.js';

const viewport = document.querySelector('#viewport');
const filename = document.querySelector('#filename');
const status = document.querySelector('#status');
const lighting = document.querySelector('#lighting');
const wireframe = document.querySelector('#wireframe');
const reset = document.querySelector('#reset');
const panel = document.querySelector('#panel');
const hint = document.querySelector('#hint');
const sample = document.querySelector('#sample');
const modelList = document.querySelector('#model-list');
const metrics = document.querySelector('#metrics');
const filesInput = document.querySelector('#files');
const folderInput = document.querySelector('#folder');

let renderer;
let closeModel;
let selection = new Map();
let generation = 0;

function unlitMaterial(source) {
  if (source.isMeshBasicMaterial) return source;
  return new THREE.MeshBasicMaterial({
    color: source.color,
    map: source.map,
    vertexColors: source.vertexColors,
    side: source.side,
    opacity: source.opacity,
    transparent: source.transparent || source.transmission > 0,
    alphaMap: source.alphaMap,
    alphaTest: source.alphaTest,
    depthWrite: source.depthWrite,
    toneMapped: false,
  });
}

function addWireframes(meshes) {
  // Reuse each mesh's geometry and deformation state so edges track its surface.
  const edges = new THREE.MeshBasicMaterial({
    color: 0xe0d7ff,
    wireframe: true,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    toneMapped: false,
  });
  edges.onBeforeCompile = shader => {
    // Bias edge depth slightly so coplanar triangles do not break up the overlay.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\ngl_Position.z -= 0.0000008 * gl_Position.w;',
    );
  };
  return meshes.map(({ mesh, original }) => {
    const overlay = mesh.clone(false);
    overlay.material = Array.isArray(original) ? original.map(() => edges) : edges;
    overlay.position.set(0, 0, 0);
    overlay.quaternion.identity();
    overlay.scale.set(1, 1, 1);
    overlay.matrixAutoUpdate = true;
    overlay.renderOrder = 10;
    mesh.add(overlay);
    return overlay;
  });
}

function triangleCount(mesh) {
  const vertices = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
  return vertices / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
}

function disposeObjects(root, extra = []) {
  const resources = new Set(extra);
  root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.skeleton) resources.add(object.skeleton);
    for (const material of [object.material].flat().filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.add(value);
      }
    }
  });
  const images = new Set();
  for (const resource of resources) {
    if (resource.isTexture && typeof ImageBitmap !== 'undefined' && resource.source.data instanceof ImageBitmap) {
      images.add(resource.source.data);
    }
    resource.dispose();
  }
  for (const image of images) image.close();
}

function mountModel(model) {
  const meshes = [];
  model.traverse(mesh => {
    if (mesh.isMesh && mesh.geometry.attributes.position) {
      meshes.push({ mesh, original: mesh.material });
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  if (!meshes.length || box.isEmpty() || !Number.isFinite(sphere.radius) || sphere.radius <= 0) {
    throw new Error('The scene has no mesh with valid dimensions.');
  }
  const scene = new THREE.Scene();
  scene.add(model);

  if (!renderer) {
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      throw new Error('WebGL 2 is unavailable. Try a browser with hardware acceleration.');
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    viewport.append(renderer.domElement);
  }
  renderer.domElement.hidden = false;

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, 0.04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 0.85;
  environment.dispose();
  pmrem.dispose();

  const { center, radius } = sphere;
  const light = new THREE.DirectionalLight(0xfff5ec, 1.65);
  light.position.copy(center).addScaledVector(new THREE.Vector3(3, 5, 4), radius);
  light.target.position.copy(center);
  scene.add(light, light.target);
  const grid = new THREE.GridHelper(radius * 4.5, 24, 0x727895, 0x62677f);
  grid.position.set(center.x, box.min.y - radius * 0.012, center.z);
  grid.material.transparent = true;
  grid.material.opacity = 0.29;
  grid.material.depthWrite = false;
  scene.add(grid);

  const camera = new THREE.PerspectiveCamera(37);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = radius * 0.025;
  const draw = () => renderer.render(scene, camera);
  controls.addEventListener('change', draw);

  function frame() {
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
    const limiting = Math.min(vertical, Math.atan(Math.tan(vertical) * camera.aspect));
    const distance = radius * 1.08 / Math.sin(limiting);
    camera.near = radius * 0.001;
    camera.far = Math.max(distance + radius * 10, radius * 120);
    controls.maxDistance = camera.far * 0.85;
    camera.updateProjectionMatrix();
    camera.position.copy(center).addScaledVector(new THREE.Vector3(1.5, 0.95, 2.1).normalize(), distance);
    controls.target.copy(center);
    controls.update();
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = viewport;
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    draw();
  }
  resize();
  frame();
  draw();
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);

  const unlit = new Map();
  function basic(material) {
    if (!unlit.has(material)) unlit.set(material, unlitMaterial(material));
    return unlit.get(material);
  }
  const events = new AbortController();
  const listener = { signal: events.signal };
  lighting.addEventListener('click', () => {
    const lit = lighting.getAttribute('aria-pressed') === 'false';
    lighting.setAttribute('aria-pressed', lit);
    for (const entry of meshes) {
      const { mesh, original } = entry;
      if (lit) mesh.material = original;
      else mesh.material = entry.unlit ??= Array.isArray(original) ? original.map(basic) : basic(original);
    }
    draw();
  }, listener);

  let overlays;
  wireframe.addEventListener('click', () => {
    const show = wireframe.getAttribute('aria-pressed') === 'false';
    wireframe.setAttribute('aria-pressed', show);
    overlays ??= addWireframes(meshes);
    overlays.forEach(overlay => { overlay.visible = show; });
    draw();
  }, listener);
  reset.addEventListener('click', () => {
    frame();
    draw();
  }, listener);

  const triangles = meshes.reduce((count, { mesh }) => count + triangleCount(mesh), 0);
  metrics.textContent = triangles.toLocaleString() + (triangles === 1 ? ' triangle' : ' triangles');
  [lighting, wireframe, reset].forEach(button => { button.disabled = false; });
  return () => {
    events.abort();
    observer.disconnect();
    controls.dispose();
    for (const { mesh, original } of meshes) mesh.material = original;
    disposeObjects(scene, unlit.values());
    environmentMap.dispose();
    renderer.domElement.hidden = true;
  };
}

function begin(name = 'Model viewer') {
  generation++;
  closeModel?.();
  closeModel = undefined;
  filename.textContent = filename.title = name;
  lighting.setAttribute('aria-pressed', 'true');
  wireframe.setAttribute('aria-pressed', 'false');
  [lighting, wireframe, reset].forEach(button => { button.disabled = true; });
  metrics.textContent = '';
  panel.hidden = false;
  delete panel.dataset.error;
  status.setAttribute('role', 'status');
  status.textContent = 'Loading model…';
  hint.textContent = '';
  sample.hidden = true;
  return generation;
}

function showError(error) {
  panel.dataset.error = '';
  status.setAttribute('role', 'alert');
  status.textContent = 'Unable to display the model';
  hint.textContent = error.message;
  sample.hidden = false;
}

async function display(files, path) {
  const current = begin(files.get(path).name);
  let model;
  try {
    model = await loadModel(files, path);
    if (current !== generation) {
      disposeObjects(model);
      return;
    }
    closeModel = mountModel(model);
    panel.hidden = true;
  } catch (error) {
    if (model) disposeObjects(model);
    if (current === generation) showError(error);
  }
}

function openSelection(files) {
  modelList.hidden = true;
  modelList.replaceChildren();
  selection = files;
  const models = [...files.keys()].filter(isModel).sort();
  if (!models.length) {
    begin();
    showError(new Error('Choose a .glb or .gltf file.'));
    return;
  }
  if (models.length > 1) {
    modelList.replaceChildren(...models.map(path => new Option(path, path)));
    modelList.hidden = false;
  }
  return display(files, models[0]);
}

function openFiles(fileList) {
  if (!fileList.length) return;
  const files = new Map(Array.from(fileList, file => [file.webkitRelativePath || file.name, file]));
  openSelection(files);
}

document.querySelector('#open-model').addEventListener('click', () => filesInput.click());
const openFolder = document.querySelector('#open-folder');
openFolder.hidden = !('webkitdirectory' in folderInput);
openFolder.addEventListener('click', () => folderInput.click());
for (const input of [filesInput, folderInput]) {
  input.addEventListener('change', () => {
    openFiles(input.files);
    input.value = '';
  });
}
modelList.addEventListener('change', () => display(selection, modelList.value));
sample.addEventListener('click', () => {
  const model = embeddedFile('sample.glb', document.querySelector('#sample-model').textContent);
  openSelection(new Map([[model.name, model]]));
});
window.addEventListener('dragover', event => {
  if (!event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  viewport.dataset.drop = '';
});
window.addEventListener('dragleave', event => {
  if (!event.relatedTarget) delete viewport.dataset.drop;
});
window.addEventListener('drop', event => {
  event.preventDefault();
  delete viewport.dataset.drop;
  openFiles(event.dataTransfer.files);
});
const startup = document.querySelector('#startup-model');
try {
  const config = JSON.parse(startup.textContent);
  if (config) {
    const files = new Map(config.files.map(([path, data]) =>
      [path, embeddedFile(path.split('/').at(-1), data)]));
    selection = files;
    display(files, config.model);
  }
} catch (error) {
  begin();
  showError(error);
} finally {
  startup.remove();
}
