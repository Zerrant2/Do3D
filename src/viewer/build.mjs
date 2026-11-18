import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const source = filename => new URL(filename, import.meta.url);
const bundle = filename => source('../../do3/viewer/' + filename);
const [template, styles, sample, license, script] = await Promise.all([
  readFile(source('index.template.html'), 'utf8'),
  readFile(source('viewer.css'), 'utf8'),
  readFile(bundle('sample.glb')),
  readFile(bundle('THIRD_PARTY_LICENSES.txt'), 'utf8'),
  build({
    entryPoints: [fileURLToPath(source('viewer.js'))],
    bundle: true,
    write: false,
    minify: true,
    legalComments: 'inline',
    format: 'iife',
    target: 'es2022',
    platform: 'browser',
  }),
]);

const html = template
  .replace('<!-- STYLES -->', () => styles)
  .replace('<!-- SAMPLE -->', () => sample.toString('base64'))
  .replace('<!-- LICENSE -->', () => license.trim())
  .replace('/* VIEWER */', () => script.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await writeFile(bundle('index.html'), html);
