import { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

// In-app document viewer (native). Shows an invoice built from `html`, or a
// remote file at `uri`. Remote PDFs are rendered through Google's viewer so
// they display inside the app instead of being downloaded. Images load directly.
export default function PdfViewer({ visible, onClose, html, uri, title, onShare }) {
  const [loading, setLoading] = useState(true);

  const cleanUri = (uri || '').split('?')[0].toLowerCase();
  const isPdf = cleanUri.endsWith('.pdf') || (uri || '').includes('/raw/');
  const source = html
    ? { html }
    : { uri: isPdf ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(uri)}` : uri };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>✕ סגור</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || 'תצוגת מסמך'}</Text>
          {onShare ? (
            <TouchableOpacity onPress={onShare} style={styles.btn}>
              <Text style={styles.btnText}>📤 שתף</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.btn} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          {visible ? (
            <WebView
              key={html ? 'html' : uri}
              source={source}
              style={{ flex: 1, backgroundColor: '#fff' }}
              originWhitelist={['*']}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
            />
          ) : null}
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#1a6b4a" />
            </View>
          )}
        </View>
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
  loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
});
