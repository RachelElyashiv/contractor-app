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

// every key any screen actually calls must exist in every language
const srcFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
  d.isDirectory() ? srcFiles(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const code = srcFiles('src').filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
const used = new Map();
for (const f of code) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) {
    if (!used.has(m[1])) used.set(m[1], f);
  }
}
const missing = [...used].filter(([k]) => !base.includes(k));
check('every translation key the code calls exists in every language', missing.length === 0,
  missing.length
    ? 'missing: ' + missing.map(([k, f]) => `${k} (${f})`).join(', ')
    : `${used.size} keys used across ${code.length} files`);

// and nothing is defined but never used, which usually means a rename was missed.
// Some keys are reached through a variable (the tab bar holds them in a list),
// so a key counts as used if it appears quoted anywhere in the source.
const allCode = code.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const unused = base.filter(k => !used.has(k) && !allCode.includes(`'${k}'`) && !allCode.includes(`"${k}"`));
check('no translation key is left behind unused', unused.length === 0,
  unused.length ? unused.join(', ') : `all ${base.length} keys are referenced`);

// --- every modal can be dismissed with the phone's back button ---
// On Android a <Modal> without onRequestClose swallows the back press, which
// leaves the user stuck inside a form that covers the screen.
const screenFiles = srcFiles('src/screens').filter(f => f.endsWith('.js'));
const modals = [];
for (const f of screenFiles) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/<Modal\b[^>]*>/g)) {
    modals.push({ file: f, tag: m[0], ok: m[0].includes('onRequestClose') });
  }
}
check('every modal closes on the phone back button', modals.every(m => m.ok),
  modals.filter(m => !m.ok).map(m => m.file).join(', ') || `${modals.length} modals checked`);

// --- the screens keep clear of the status bar and the keyboard ---
const headers = [];
const bareHeaders = [];
for (const f of screenFiles) {
  const text = fs.readFileSync(f, 'utf8');
  headers.push(...(text.match(/styles\.header, \{ paddingTop: topInset/g) || []));
  bareHeaders.push(...(text.match(/style=\{styles\.header\}/g) || []));
}
check('every screen header is pushed below the status bar', bareHeaders.length === 0 && headers.length >= 8,
  `${headers.length} headers inset, ${bareHeaders.length} left bare`);

const bareOverlays = [];
for (const f of screenFiles) {
  bareOverlays.push(...(fs.readFileSync(f, 'utf8').match(/style=\{styles\.overlay\}/g) || []));
}
check('no modal sheet is left sitting under the keyboard', bareOverlays.length === 0,
  bareOverlays.length ? `${bareOverlays.length} overlays without keyboard padding` : 'all overlays lifted');

// --- the app ships its own icon, not the Expo template one ---
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
const iconBytes = fs.statSync(appJson.icon).size;
check('the app has a name people will recognise', appJson.name !== 'contractor-app' && appJson.name.length > 1,
  `name = ${appJson.name}`);
check('the icon file exists and is a real image', fs.existsSync(appJson.icon) && iconBytes > 1000,
  `${appJson.icon} (${iconBytes} bytes)`);
for (const key of ['foregroundImage', 'backgroundImage', 'monochromeImage']) {
  const p = appJson.android.adaptiveIcon[key];
  if (p && !fs.existsSync(p)) check(`adaptive icon ${key} exists`, false, p);
}
check('every icon path in app.json points at a file that exists',
  [appJson.icon, ...Object.values(appJson.android.adaptiveIcon).filter(v => String(v).startsWith('./'))]
    .every(p => fs.existsSync(p)),
  'icon, foreground, background, monochrome');

// --- every language uses the same {{placeholders}} for a given key ---
// A typo here does not crash; it silently drops a name or a number from the
// sentence, which is far harder to notice.
const placeholders = (text) =>
  [...String(text).matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map(m => m[1]).sort().join(',');
const valueAt = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const placeholderMismatches = [];
for (const key of base) {
  const want = placeholders(valueAt(parsed['he.json'], key));
  for (const f of files) {
    if (f === 'he.json') continue;
    const got = placeholders(valueAt(parsed[f], key));
    if (got !== want) placeholderMismatches.push(`${key} in ${f} (${got || 'none'} vs ${want || 'none'})`);
  }
}
check('every language fills the same placeholders', placeholderMismatches.length === 0,
  placeholderMismatches.slice(0, 6).join('; ') || 'checked every key in every language');

// --- no screen still carries text hardcoded in one language ---
// Comments are fine; anything a user can read has to come from the locales.
const HEBREW = /[\u05D0-\u05EA]/;
const hardcoded = [];
for (const f of code) {
  // the i18n module itself names each language in its own script, by design
  if (f.startsWith(path.join('src', 'i18n'))) continue;
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (HEBREW.test(line)) hardcoded.push(`${f}:${i + 1}`);
  });
}
check('no user-visible text is hardcoded in one language', hardcoded.length === 0,
  hardcoded.length ? hardcoded.slice(0, 8).join(', ') : `${code.length} source files are clean`);

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
