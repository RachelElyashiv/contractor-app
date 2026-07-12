import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import PdfViewer from '../components/PdfViewer';

const BASE_URL = 'https://contractor-backend-production.up.railway.app/api/v1';
const isWeb = Platform.OS === 'web';

export default function PhotosScreen() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docViewer, setDocViewer] = useState({ visible: false, uri: '', title: '' });
  const fileInputRef = useRef(null);

  useEffect(() => { loadPhotos(); }, []);

  async function loadPhotos() {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/photos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPhotos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Photos error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // --- העלאה במחשב (web) ---
  async function handleFileChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const res = await fetch(`${BASE_URL}/photos/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) loadPhotos();
      else Alert.alert('שגיאה', 'לא הצלחנו להעלות');
    } catch (e) {
      Alert.alert('שגיאה', 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  // --- העלאה בטלפון (mobile) ---
  async function pickAndUploadMobile() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('הרשאה נדרשת', 'יש לאשר גישה לתמונות כדי להעלות');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      for (const asset of result.assets) {
        const uriParts = asset.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append('files', {
          uri: asset.uri,
          name: `photo.${fileType}`,
          type: `image/${fileType}`,
        });
      }
      const res = await fetch(`${BASE_URL}/photos/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) loadPhotos();
      else Alert.alert('שגיאה', 'לא הצלחנו להעלות');
    } catch (e) {
      Alert.alert('שגיאה', 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
    }
  }

  // --- צילום במצלמה (mobile) ---
  async function takePhotoMobile() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('הרשאה נדרשת', 'יש לאשר גישה למצלמה כדי לצלם');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      const asset = result.assets[0];
      const uriParts = asset.uri.split('.');
      const fileType = uriParts[uriParts.length - 1];
      formData.append('files', {
        uri: asset.uri,
        name: `photo.${fileType}`,
        type: `image/${fileType}`,
      });
      const res = await fetch(`${BASE_URL}/photos/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) loadPhotos();
      else Alert.alert('שגיאה', 'לא הצלחנו להעלות');
    } catch (e) {
      Alert.alert('שגיאה', 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
    }
  }

  // --- בחירה לפי פלטפורמה ---
  function handleUploadPress() {
    if (isWeb) {
      fileInputRef.current?.click();
    } else {
      // בטלפון: לתת בחירה בין גלריה למצלמה
      Alert.alert('הוספת תמונה', 'בחר מקור', [
        { text: 'גלריה', onPress: pickAndUploadMobile },
        { text: 'מצלמה', onPress: takePhotoMobile },
        { text: 'ביטול', style: 'cancel' },
      ]);
    }
  }

  function deletePhoto(id, filename) {
    if (isWeb) {
      const confirmed = window.confirm(`האם למחוק את "${filename}"?`);
      if (!confirmed) return;
      doDelete(id);
    } else {
      Alert.alert('מחיקת קובץ', `האם למחוק את "${filename}"?`, [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: () => doDelete(id) },
      ]);
    }
  }

  async function doDelete(id) {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/photos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) loadPhotos();
      else Alert.alert('שגיאה', 'לא הצלחנו למחוק');
    } catch (e) {
      Alert.alert('שגיאה', 'שגיאה במחיקה');
    }
  }

  function openFile(url, title) {
    setDocViewer({ visible: true, uri: url, title: title || 'תצוגת מסמך' });
  }

  function openExternally(url) {
    if (isWeb) window.open(url, '_blank');
    else Linking.openURL(url);
  }

  function isPdf(photo) {
    return photo.filename?.toLowerCase().endsWith('.pdf') ||
      photo.caption?.toLowerCase().includes('pdf');
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  const images = photos.filter(p => !isPdf(p));
  const pdfs = photos.filter(p => isPdf(p));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>קבצים ותמונות</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleUploadPress} disabled={uploading}>
          <Text style={styles.addBtnText}>{uploading ? 'מעלה...' : '+ העלה'}</Text>
        </TouchableOpacity>
      </View>

      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      )}

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPhotos(); }} />}
      >
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 תמונות שטח ({images.length})</Text>
            <View style={styles.grid}>
              {images.map(photo => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => deletePhoto(photo.id, photo.filename)}
                  >
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                  {photo.caption && <Text style={styles.caption}>{photo.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {pdfs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📄 קבצי PDF ({pdfs.length})</Text>
            {pdfs.map(pdf => (
              <View key={pdf.id} style={styles.pdfCard}>
                <View style={styles.pdfIcon}>
                  <Text style={styles.pdfIconText}>PDF</Text>
                </View>
                <View style={styles.pdfInfo}>
                  <Text style={styles.pdfName}>{pdf.caption || pdf.filename}</Text>
                  <TouchableOpacity onPress={() => openFile(pdf.url, pdf.caption || pdf.filename)}>
                    <Text style={styles.pdfOpen}>פתח קובץ</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.pdfDelete}
                  onPress={() => deletePhoto(pdf.id, pdf.filename)}
                >
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {photos.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>אין קבצים עדיין</Text>
            <Text style={styles.emptySub}>לחץ "+ העלה" להוסיף תמונות</Text>
          </View>
        )}
      </ScrollView>

      <PdfViewer
        visible={docViewer.visible}
        uri={docViewer.uri}
        title={docViewer.title}
        onShare={() => openExternally(docViewer.uri)}
        onClose={() => setDocViewer({ visible: false, uri: '', title: '' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 14 },
  section: { margin: 12, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 10, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: { width: '47%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 8, position: 'relative' },
  photo: { width: '100%', height: 200 },
  deleteBtn: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  caption: { fontSize: 11, color: '#555', padding: 6, textAlign: 'right' },
  pdfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  pdfIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#fcebeb', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  pdfIconText: { fontSize: 11, fontWeight: 'bold', color: '#a32d2d' },
  pdfInfo: { flex: 1 },
  pdfName: { fontSize: 13, fontWeight: '500', color: '#1a1a1a', textAlign: 'right', marginBottom: 4 },
  pdfOpen: { fontSize: 12, color: '#1a6b4a', textAlign: 'right' },
  pdfDelete: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fcebeb', justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4 },
});