import fs from 'fs';
import path from 'path';

const results = [];
const check = (name, ok, detail) => { results.push(ok); console.log(`${ok?'PASS':'FAIL'}  ${name}${detail?'\n        '+detail:''}`); };

// --- toUploadFile, lifted from the source so we test the shipped logic ---
const src = fs.readFileSync('src/services/uploadFiles.js', 'utf8');
const fnSrc = src.slice(src.indexOf('export function toUploadFile'), src.indexOf('/**\n * Uploads files'));
const toUploadFile = new Function('return ' + fnSrc.replace('export function', 'function') + '; ')();

const gallery = toUploadFile({ uri: 'file:///data/.../ImagePicker/abc-1.jpeg', mimeType: 'image/jpeg', fileName: 'IMG_0042.jpeg' }, 'image/jpeg');
check('gallery photo keeps its name and type', gallery.name === 'IMG_0042.jpeg' && gallery.type === 'image/jpeg', JSON.stringify(gallery));

const camera = toUploadFile({ uri: 'file:///cache/Camera/x.jpg' }, 'image/jpeg');
check('camera shot with no metadata falls back to the uri extension, as image/jpeg not image/jpg',
  camera.type === 'image/jpeg' && camera.name === 'x.jpg', JSON.stringify(camera));

const doc = toUploadFile({ uri: 'file:///cache/DocumentPicker/p.pdf', name: 'תוכנית קומה 3.pdf', mimeType: 'application/pdf' }, 'application/octet-stream');
check('document keeps its hebrew name and pdf type', doc.name === 'תוכנית קומה 3.pdf' && doc.type === 'application/pdf', JSON.stringify(doc));

const dwg = toUploadFile({ uri: 'file:///cache/plan.dwg', name: 'plan.dwg' }, 'application/octet-stream');
check('a dwg with no reported mime type still gets a type', dwg.type === 'application/octet-stream' && dwg.name === 'plan.dwg', JSON.stringify(dwg));

const bare = toUploadFile({ uri: 'content://media/external/images/media/1234', mimeType: 'image' }, 'image/jpeg');
check('a content:// uri with a bare kind does not produce a broken mime type', bare.type.includes('/'), JSON.stringify(bare));

// --- translations ---
const dir = 'src/i18n/locales';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) =>
  v && typeof v === 'object' ? flat(v, p + k + '.') : [p + k]);
let parsed = {};
let allOk = true;
for (const f of files) {
  try { parsed[f] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { allOk = false; console.log('  bad json:', f, e.message); }
}
check(`all ${files.length} translation files are valid json`, allOk && files.length === 12, files.join(' '));

const base = flat(parsed['he.json']).sort();
const mismatched = files.filter(f => JSON.stringify(flat(parsed[f]).sort()) !== JSON.stringify(base));
check('every language has exactly the same keys as hebrew', mismatched.length === 0,
  mismatched.length ? 'differ: ' + mismatched.join(', ') : `${base.length} keys x ${files.length} languages`);

// keys the screens actually call
const screens = ['src/screens/PhotosScreen.js'];
const used = new Set();
for (const s of screens) {
  const text = fs.readFileSync(s, 'utf8');
  for (const m of text.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
}
const missing = [...used].filter(k => !base.includes(k));
check('every translation key the photos screen calls exists', missing.length === 0,
  missing.length ? 'missing: ' + missing.join(', ') : `${used.size} keys checked`);

// --- no stale backend url anywhere ---
const grep = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? grep(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const hits = grep('src').filter(f => /\.(js|jsx|ts|tsx)$/.test(f))
  .filter(f => /railway|up\.railway\.app|localhost:3000/.test(fs.readFileSync(f, 'utf8')));
check('no stale backend address left in the app', hits.length === 0, hits.join(', ') || 'clean');

const baseUrls = grep('src').filter(f => /\.(js|jsx|ts|tsx)$/.test(f))
  .filter(f => /BASE_URL\s*=/.test(fs.readFileSync(f, 'utf8')));
check('BASE_URL is defined in exactly one place', baseUrls.length === 1, baseUrls.join(', '));

console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
