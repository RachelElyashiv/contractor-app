import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

/**
 * Normalises a picker asset into the shape React Native's FormData expects.
 * expo-image-picker and expo-document-picker both report a mime type and a
 * file name nowadays; the extension of the cache URI is only a fallback.
 */
export function toUploadFile(asset, fallbackMime) {
  const uri = asset.uri;
  const basename = decodeURIComponent((uri.split('?')[0].split('#')[0].split('/').pop() || ''));
  const dot = basename.lastIndexOf('.');
  const uriExt = dot > 0 ? basename.slice(dot + 1).toLowerCase() : '';
  const ext = /^[a-z0-9]{1,5}$/.test(uriExt) ? uriExt : '';

  let type = asset.mimeType || asset.type || '';
  // A picker sometimes reports the bare kind ("image") instead of a mime type.
  // For a photo the extension is the subtype, so it can be rebuilt. For a
  // document it cannot be guessed, and the generic type is the honest answer —
  // the server only needs to know it is not an image.
  if (!type.includes('/')) {
    type = ext && fallbackMime.startsWith('image/') ? `image/${ext}` : fallbackMime;
  }
  if (type === 'image/jpg') type = 'image/jpeg';

  // Prefer the name the picker gave, then the one in the URI, and only then a
  // generic one. The extension matters: the server routes on it.
  const subtype = type.split('/')[1] || '';
  const typeExt = /^[a-z0-9]{1,5}$/.test(subtype) ? subtype : '';
  const name =
    asset.fileName ||
    asset.name ||
    (ext ? basename : `file${typeExt ? '.' + typeExt : ''}`);

  return { uri, name, type };
}

/**
 * Uploads files and, on failure, throws an Error carrying whatever the server
 * actually said. Without this every problem looked identical in the app.
 */
export async function uploadFiles(files, extra = {}) {
  const token = await AsyncStorage.getItem('token');
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  Object.entries(extra).forEach(([key, value]) => {
    if (value) formData.append(key, String(value));
  });

  let res;
  try {
    res = await fetch(`${BASE_URL}/photos/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: formData,
    });
  } catch (e) {
    throw new Error(`אין חיבור לשרת (${e?.message || e})`);
  }

  if (res.ok) return res.json();

  let detail = `קוד שגיאה ${res.status}`;
  try {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      detail = parsed.message || parsed.detail || parsed.error || detail;
    } catch {
      if (body) detail = body.slice(0, 300);
    }
  } catch {
    // keep the status-code fallback
  }
  const error = new Error(Array.isArray(detail) ? detail.join(', ') : String(detail));
  error.status = res.status;
  throw error;
}
