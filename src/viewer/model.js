import { LoaderUtils, LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const resourceBase = 'https://do3d.invalid/model/';
const decoder = new TextDecoder();
const unsupportedExtensions = new Set([
  'KHR_draco_mesh_compression', 'EXT_meshopt_compression',
  'KHR_texture_basisu', 'EXT_texture_avif',
]);

export const isModel = name => /\.(glb|gltf)$/i.test(name);

export function embeddedFile(name, data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name);
}

function manifestFrom(bytes, modelPath) {
  if (/\.gltf$/i.test(modelPath)) return JSON.parse(decoder.decode(bytes));
  const header = new DataView(bytes);
  if (header.byteLength < 20 || header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== header.byteLength ||
      header.getUint32(16, true) !== 0x4e4f534a ||
      header.getUint32(12, true) > header.byteLength - 20) {
    throw new Error('Invalid GLB 2.0 header.');
  }
  return JSON.parse(decoder.decode(new Uint8Array(bytes, 20, header.getUint32(12, true))));
}

function relativePath(uri) {
  if (typeof uri !== 'string' || !uri || /^[a-z][a-z\d+.-]*:|^[/\\]|[?#]/i.test(uri)) {
    throw new Error('Resources must use relative paths inside the model folder.');
  }
  const parts = [];
  for (const raw of uri.split('/')) {
    const part = decodeURIComponent(raw);
    if (/[/:\\\x00-\x1f]/.test(part)) throw new Error('Invalid resource path.');
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) throw new Error('Resources must stay inside the model folder.');
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  if (!parts.length) throw new Error('Invalid resource path.');
  return parts.join('/');
}

export async function loadModel(files, modelPath) {
  const model = files.get(modelPath);
  const bytes = await model.arrayBuffer();
  const manifest = manifestFrom(bytes, modelPath);
  if (manifest.asset?.version !== '2.0') throw new Error('Expected a glTF 2.0 asset.');
  const unsupported = (manifest.extensionsRequired ?? []).find(name => unsupportedExtensions.has(name));
  if (unsupported) throw new Error('Re-export without ' + unsupported + ' for this viewer.');

  const directory = modelPath.slice(0, modelPath.lastIndexOf('/') + 1);
  const resources = new Map();
  const labels = new Map();
  const failures = new Set();
  try {
    for (const resource of [...(manifest.buffers ?? []), ...(manifest.images ?? [])]) {
      const { uri } = resource;
      if (uri === undefined || (typeof uri === 'string' && /^data:/i.test(uri))) continue;
      const path = relativePath(uri);
      const request = LoaderUtils.resolveURL(uri, resourceBase);
      if (resources.has(request)) continue;
      const file = files.get(directory + path);
      if (!file) throw new Error('Missing ' + uri + '. Open the model folder with its linked files.');
      const url = URL.createObjectURL(file);
      resources.set(request, url);
      labels.set(url, uri);
    }

    const manager = new LoadingManager();
    manager.setURLModifier(url => {
      if (resources.has(url)) return resources.get(url);
      if (/^(blob:|data:)/i.test(url)) return url;
      const label = url.startsWith(resourceBase) ? url.slice(resourceBase.length) : url;
      throw new Error('Resource was not selected. ' + label);
    });
    manager.onError = url => failures.add(labels.get(url) ?? 'embedded resource');
    try {
      const gltf = await new GLTFLoader(manager).parseAsync(bytes, resourceBase);
      if (failures.size) throw new Error('A resource could not be decoded.');
      return gltf.scene;
    } catch (error) {
      if (failures.size) throw new Error('Could not load ' + [...failures].join(', ') + '. ' + error.message);
      throw error;
    }
  } finally {
    for (const url of resources.values()) URL.revokeObjectURL(url);
  }
}
