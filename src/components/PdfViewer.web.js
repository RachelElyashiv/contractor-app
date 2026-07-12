import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// In-app document viewer (web). Browsers render PDFs and images inside an
// iframe, so the file is shown in a full-screen modal instead of downloaded.
export default function PdfViewer({ visible, onClose, html, uri, title }) {
  function print() {
    const frame = document.querySelector('iframe[title="doc-preview"]');
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      if (uri) window.open(uri, '_blank');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>✕ סגור</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || 'תצוגת מסמך'}</Text>
          <TouchableOpacity onPress={print} style={styles.btn}>
            <Text style={styles.btnText}>🖨 הדפס</Text>
          </TouchableOpacity>
        </View>
        {visible ? (
          <iframe
            title="doc-preview"
            srcDoc={html || undefined}
            src={html ? undefined : uri}
            style={{ width: '100%', height: 'calc(100vh - 56px)', border: 'none', display: 'block', background: '#fff' }}
          />
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
});
