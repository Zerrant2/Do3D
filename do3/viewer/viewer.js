import * as THREE from 'three';
import { OrbitControls } from './vendor/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/loaders/GLTFLoader.js';
import { RoomEnvironment } from './vendor/environments/RoomEnvironment.js';

const viewport = document.querySelector('#viewport');
const filename = document.querySelector('#filename');
const status = document.querySelector('#status');
const lighting = document.querySelector('#lighting');
const wireframe = document.querySelector('#wireframe');
const reset = document.querySelector('#reset');

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

async function loadModel(url) {
  const failures = new Set();
  const manager = new THREE.LoadingManager();
  manager.onError = failedUrl => failures.add(
    failedUrl.startsWith('blob:') || failedUrl.startsWith('data:') ?
      'embedded resource' : decodeURI(failedUrl.split('/').at(-1)),
  );
  const loader = new GLTFLoader(manager);
  try {
    const gltf = await loader.loadAsync(url);
    if (failures.size) throw new Error('A resource failed to load.');
    return gltf.scene;
  } catch (error) {
    if (failures.size) {
      throw new Error('Could not load ' + [...failures].join(', ') + '. ' + error.message);
    }
    throw error;
  }
}

function showModel(model) {
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

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    throw new Error('WebGL 2 is unavailable. Try a browser with hardware acceleration.');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  viewport.append(renderer.domElement);

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, 0.04).texture;
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

  const observer = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = viewport;
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    if (!status.hidden) {
      frame();
      status.hidden = true;
    }
    draw();
  });
  observer.observe(viewport);

  const unlit = new Map();
  function basic(material) {
    if (!unlit.has(material)) unlit.set(material, unlitMaterial(material));
    return unlit.get(material);
  }
  lighting.addEventListener('click', () => {
    const lit = lighting.getAttribute('aria-pressed') === 'false';
    lighting.setAttribute('aria-pressed', lit);
    for (const entry of meshes) {
      const { mesh, original } = entry;
      if (lit) mesh.material = original;
      else mesh.material = entry.unlit ??= Array.isArray(original) ? original.map(basic) : basic(original);
    }
    draw();
  });

  let overlays;
  wireframe.addEventListener('click', () => {
    const show = wireframe.getAttribute('aria-pressed') === 'false';
    wireframe.setAttribute('aria-pressed', show);
    overlays ??= addWireframes(meshes);
    overlays.forEach(overlay => { overlay.visible = show; });
    draw();
  });
  reset.addEventListener('click', () => {
    frame();
    draw();
  });

  const triangles = meshes.reduce((count, { mesh }) => count + triangleCount(mesh), 0);
  document.querySelector('#metrics').textContent = triangles.toLocaleString() +
    (triangles === 1 ? ' triangle' : ' triangles');
  [lighting, wireframe, reset].forEach(button => { button.disabled = false; });
}

async function start() {
  const response = await fetch('./model.json');
  if (!response.ok) throw new Error('Could not reach the preview server. Run launch.mjs to start it.');
  const config = await response.json();
  filename.textContent = config.name;
  filename.title = config.name;
  if (config.error) throw new Error(config.error);
  showModel(await loadModel(config.modelUrl));
}

start().catch(error => {
  status.dataset.error = '';
  status.setAttribute('role', 'alert');
  status.textContent = 'Unable to display the model. ' + error.message;
});
