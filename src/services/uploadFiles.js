import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';
import { t } from '../i18n';
import { BASE_URL, reportUnauthorized } from './api';

const isWeb = Platform.OS === 'web';
const UPLOAD_URL = `${BASE_URL}/photos/upload`;

/**
 * Normalises a picker asset into the shape an upload needs.
 * expo-image-picker and expo-document-picker both report a mime type and a
 * file name nowadays; the extension of the cache URI is only a fallback.
 */
export function toUploadFile(asset, fallbackMime) {
  const uri = asset?.uri;
  const safeUri = typeof uri === 'string' ? uri : '';
  const rawName = safeUri.split('?')[0].split('#')[0].split('/').pop() || '';
  let basename = rawName;
  try {
    basename = decodeURIComponent(rawName);
  } catch {
    // a stray % in the name is not worth failing an upload over
  }
  const dot = basename.lastIndexOf('.');
  const uriExt = dot > 0 ? basename.slice(dot + 1).toLowerCase() : '';
  const ext = /^[a-z0-9]{1,5}$/.test(uriExt) ? uriExt : '';

  let type = asset?.mimeType || asset?.type || '';
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
    asset?.fileName ||
    asset?.name ||
    (ext ? basename : `file${typeExt ? '.' + typeExt : ''}`);

  return { uri: safeUri, name, type };
}

/** Pulls the clearest message out of whatever the server sent back. */
function describe(status, body) {
  if (status === 401 || status === 403) return t('photos.errors.sessionExpired');
  try {
    const parsed = JSON.parse(body);
    const message = parsed.message || parsed.detail || parsed.error;
    if (message) return Array.isArray(message) ? message.join(', ') : String(message);
  } catch {
    if (body) return String(body).slice(0, 300);
  }
  return t('photos.errors.statusCode', { status });
}

function failure(status, body) {
  // a dead session has to clear itself here too, or the next upload fails the
  // same way with no explanation
  if (status === 401 || status === 403) reportUnauthorized();
  const error = new Error(describe(status, body));
  error.status = status;
  return error;
}

/**
 * Uploads one file from the device.
 *
 * Expo SDK 56 dropped the old convention of handing React Native's FormData a
 * plain {uri, name, type} object: the networking layer now rejects it with
 * "Unsupported FormDataPart implementation". expo-file-system's File carries
 * out the multipart request natively instead, which is also what the SDK
 * documents for uploading a file off the filesystem.
 */
async function uploadOneNative(file, extra, token) {
  if (!file.uri) throw new Error(t('photos.errors.noFilePath', { name: file.name }));

  // The native uploader names the part after the file on disk, which for a
  // picked document is a cache name, not what the person chose. The real name
  // travels as a form field instead — it is added to the body before the file,
  // so the server has it by the time it stores the record.
  const parameters = { originalName: file.name };
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') parameters[key] = String(value);
  });

  let result;
  try {
    result = await new File(file.uri).upload(UPLOAD_URL, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'files',
      mimeType: file.type,
      parameters,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (e) {
    throw new Error(t('photos.errors.noConnection', { detail: e?.message || e }));
  }

  if (result.status < 200 || result.status >= 300) throw failure(result.status, result.body);

  try {
    const parsed = JSON.parse(result.body);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

/** The browser hands over real File objects, which FormData takes as they are. */
async function uploadAllWeb(files, extra, token) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.append(key, String(value));
  });

  let res;
  try {
    res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: formData,
    });
  } catch (e) {
    throw new Error(t('photos.errors.noConnection', { detail: e?.message || e }));
  }

  if (!res.ok) throw failure(res.status, await res.text().catch(() => ''));
  return res.json();
}

/**
 * Uploads files and, on failure, throws an Error carrying whatever the server
 * actually said. Without this every problem looked identical in the app.
 */
export async function uploadFiles(files, extra = {}) {
  const token = await AsyncStorage.getItem('token');
  if (!token) throw failure(401, '');

  if (isWeb) return uploadAllWeb(files, extra, token);

  // one request per file: the native uploader sends a single file at a time
  const saved = [];
  for (const file of files) {
    saved.push(...(await uploadOneNative(file, extra, token)));
  }
  return saved;
}
