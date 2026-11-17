import { createReadStream } from 'node:fs';
import { open, readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

const usage = 'Usage: node launch.mjs <model.glb|model.gltf> [--port 0] [--no-open]';
const assetBase = 'http://localhost/asset/';
const staticFiles = new Map([
  ['/', 'index.html'],
  ...[
    'viewer.css', 'viewer.js', 'vendor/three.module.min.js',
    'vendor/three.core.min.js', 'vendor/controls/OrbitControls.js',
    'vendor/loaders/GLTFLoader.js', 'vendor/utils/BufferGeometryUtils.js',
    'vendor/utils/SkeletonUtils.js', 'vendor/environments/RoomEnvironment.js',
  ].map(file => ['/' + file, file]),
].map(([url, file]) => [url, new URL(file, import.meta.url)]));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const assetTypes = {
  '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function existingFile(file) {
  const resolved = await realpath(file);
  if (!(await stat(resolved)).isFile()) throw new Error('Expected a regular file.');
  return resolved;
}

function resourcePath(uri, modelUrl) {
  if (typeof uri !== 'string' || !uri || uri.startsWith('/') || uri.includes('\\')) {
    throw new Error('Use a relative resource path inside the model directory.');
  }
  const url = new URL(uri, assetBase + modelUrl);
  if (!url.href.startsWith(assetBase) || url.search || url.hash) {
    throw new Error('Use a relative resource path inside the model directory.');
  }
  const parts = url.href.slice(assetBase.length).split('/').map(decodeURIComponent);
  if (parts.some(part => !part || /[/:\\\x00-\x1f]/.test(part) || part === '.' || part === '..')) {
    throw new Error('Invalid resource path.');
  }
  return { url: url.pathname, parts };
}

async function readAssetManifest(file) {
  if (path.extname(file).toLowerCase() === '.gltf') {
    return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  }
  // GLB starts with a 12-byte header followed by its JSON chunk.
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(20);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const length = header.readUInt32LE(12);
    const { size } = await handle.stat();
    if (bytesRead !== header.length || header.toString('ascii', 0, 4) !== 'glTF' ||
        header.readUInt32LE(4) !== 2 || header.toString('ascii', 16, 20) !== 'JSON' ||
        header.readUInt32LE(8) !== size || length > size - header.length) {
      throw new Error('Invalid GLB 2.0 header.');
    }
    const chunk = Buffer.alloc(length);
    if ((await handle.read(chunk, 0, length, header.length)).bytesRead !== length) {
      throw new Error('Incomplete GLB JSON chunk.');
    }
    return JSON.parse(chunk.toString('utf8'));
  } finally {
    await handle.close();
  }
}

async function prepareAsset(input) {
  const name = path.basename(input);
  const modelUrl = '/asset/' + encodeURIComponent(name);
  const files = new Map();
  try {
    if (!/\.(glb|gltf)$/i.test(name)) throw new Error('Choose a .glb or .gltf file.');
    const file = await existingFile(input).catch(() => {
      throw new Error('Model file is missing or unreadable.');
    });
    const directory = await realpath(path.dirname(input));
    const manifest = await readAssetManifest(file);
    if (manifest.asset?.version !== '2.0') throw new Error('Expected a glTF 2.0 asset.');
    const compressed = (manifest.extensionsRequired ?? []).find(extension => [
      'KHR_draco_mesh_compression', 'EXT_meshopt_compression',
      'KHR_texture_basisu', 'EXT_texture_avif',
    ].includes(extension));
    if (compressed) throw new Error('Re-export without ' + compressed + ' for this viewer.');

    const errors = [];
    for (const resource of [...(manifest.buffers ?? []), ...(manifest.images ?? [])]) {
      const uri = resource.uri;
      if (uri === undefined || /^data:/i.test(uri)) continue;
      try {
        const target = resourcePath(uri, encodeURIComponent(name));
        const resolved = await existingFile(path.join(directory, ...target.parts));
        const relative = path.relative(directory, resolved);
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
          throw new Error('Resource is outside the model directory.');
        }
        if (target.url === modelUrl) throw new Error('A resource points to the model file.');
        files.set(target.url, resolved);
      } catch (error) {
        errors.push(uri + ' (' + (error.code ? 'missing or unreadable' : error.message) + ')');
      }
    }
    if (errors.length) throw new Error('Required resources could not load. ' + errors.join(', '));
    files.set(modelUrl, file);
    return { config: { name, modelUrl }, files };
  } catch (error) {
    return { config: { name, error: error.message }, files: new Map() };
  }
}

function openBrowser(url) {
  const [command, args] = {
    win32: ['rundll32.exe', ['url.dll,FileProtocolHandler', url]],
    darwin: ['open', [url]],
  }[process.platform] ?? ['xdg-open', [url]];
  const browser = spawn(command, args, { stdio: 'ignore', windowsHide: true });
  const fallback = () => console.error('Open the printed viewer URL in a browser.');
  browser.on('error', fallback);
  browser.on('exit', code => { if (code !== 0) fallback(); });
  browser.unref();
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { port: { type: 'string', default: '0' }, 'no-open': { type: 'boolean' }, help: { type: 'boolean' } },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const port = Number(values.port);
  if (positionals.length !== 1 || !/^\d+$/.test(values.port) || port > 65535) {
    throw new Error(usage);
  }
  const { config, files } = await prepareAsset(path.resolve(positionals[0]));
  if (config.error) console.error(config.name + ' — ' + config.error);

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data:; frame-ancestors 'none'; base-uri 'none'");
    if (request.headers.host !== '127.0.0.1:' + server.address().port) {
      response.writeHead(403).end('Open the printed loopback URL.');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed.');
      return;
    }
    const url = request.url;
    if (url === '/model.json') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(config));
      return;
    }
    const staticFile = staticFiles.get(url);
    const file = staticFile ?? files.get(url);
    if (!file) {
      response.writeHead(404).end('File is not part of this preview.');
      return;
    }
    try {
      const extension = path.extname(decodeURIComponent(url)).toLowerCase();
      const contentType = url === '/' ? types['.html'] : (staticFile ? types : assetTypes)[extension];
      const { size } = await stat(file);
      response.writeHead(200, { 'Content-Type': contentType ?? 'application/octet-stream', 'Content-Length': size });
      if (request.method === 'HEAD') response.end();
      else await pipeline(createReadStream(file), response);
    } catch {
      if (response.headersSent) response.destroy();
      else response.writeHead(404).end('Preview file is missing or unreadable.');
    }
  });
  server.on('error', error => {
    console.error('Unable to start the viewer. ' + error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    console.log('Do3D viewer: ' + url);
    if (!values['no-open']) openBrowser(url);
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
