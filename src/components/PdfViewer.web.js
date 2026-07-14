import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// In-app document viewer (web). Invoices (html) render in an iframe via srcDoc.
// For remote files we fetch the bytes and re-serve them as an in-memory PDF blob
// so the browser shows them inline in its native viewer — many uploaded files
// (e.g. Cloudinary "raw" PDFs) are otherwise served with an attachment
// disposition that makes the browser download them instead of displaying them.
// If the fetch is blocked (CORS), we fall back to Google's embedded viewer.
export default function PdfViewer({ visible, onClose, html, uri, title }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  const cleanUri = (uri || '').split('?')[0].toLowerCase();
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic|svg)$/.test(cleanUri);
  const needsFetch = visible && !!uri && !html && !isImage;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setBlobUrl(null);
    setFailed(false);
    if (needsFetch) {
      fetch(uri)
        .then((r) => {
          if (!r.ok) throw new Error('http ' + r.status);
          return r.arrayBuffer();
        })
        .then((buf) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
          setBlobUrl(objectUrl);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsFetch, uri]);

  const gview = uri ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}` : undefined;
  const frameSrc = html
    ? undefined
    : isImage
      ? uri
      : blobUrl || (failed ? gview : undefined);
  const loading = needsFetch && !blobUrl && !failed;

  function openExternal() {
    if (html) {
      const frame = document.querySelector('iframe[title="doc-preview"]');
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      } catch {
        /* fall through */
      }
    }
    if (uri) window.open(uri, '_blank');
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>✕ סגור</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || 'תצוגת מסמך'}</Text>
          <TouchableOpacity onPress={openExternal} style={styles.btn}>
            <Text style={styles.btnText}>{html ? '🖨 הדפס' : '↗ פתח'}</Text>
          </TouchableOpacity>
        </View>
        {visible && (html || frameSrc) ? (
          <iframe
            title="doc-preview"
            srcDoc={html || undefined}
            src={frameSrc}
            style={{ width: '100%', height: 'calc(100vh - 56px)', border: 'none', display: 'block', background: '#fff' }}
          />
        ) : loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#1a6b4a" />
            <Text style={styles.loaderText}>טוען מסמך…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#1a6b4a',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, textAlign: 'center' },
  btn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, minWidth: 72, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { color: '#555', fontSize: 14 },
});
