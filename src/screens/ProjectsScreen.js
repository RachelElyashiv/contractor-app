import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const BASE_URL = 'https://contractor-backend-production.up.railway.app/api/v1';

const DELIVERY_STATUS = {
  pending: { label: 'ממתין', color: '#ba7517', bg: '#faeeda' },
  arrived_ok: { label: '✓ הגיע תקין', color: '#1a6b4a', bg: '#e8f5ef' },
  arrived_damaged: { label: '⚠ הגיע פגום', color: '#a32d2d', bg: '#fcebeb' },
  not_arrived: { label: '✕ לא הגיע', color: '#555', bg: '#f0f0f0' },
};

export default function ProjectsScreen() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [addMaterialModal, setAddMaterialModal] = useState(false);
  const [matForm, setMatForm] = useState({ name: '', unit: 'יחידות', quantity: '', supplier: '' });
  const [form, setForm] = useState({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '' });

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectFiles(selectedProject.id);
      loadProjectMaterials(selectedProject.id);
    }
  }, [selectedProject]);

  async function loadProjects() {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Projects error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadProjectFiles(projectId) {
    setFilesLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/photos?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProjectFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Files error:', e);
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadProjectMaterials(projectId) {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/materials?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setProjectMaterials(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Materials error:', e);
    }
  }

  async function createProject() {
    if (!form.name || !form.clientName) return Alert.alert('שגיאה', 'מלא שם פרויקט ולקוח');
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, budget: Number(form.budget) || 0 }),
      });
      if (res.ok) {
        setModalVisible(false);
        setForm({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '' });
        loadProjects();
      }
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו ליצור פרויקט');
    }
  }

  async function addMaterial() {
    if (!matForm.name) return Alert.alert('שגיאה', 'מלא שם חומר');
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${BASE_URL}/materials`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...matForm,
          quantity: Number(matForm.quantity) || 0,
          projectId: selectedProject.id,
          deliveryStatus: 'pending',
        }),
      });
      if (res.ok) {
        setAddMaterialModal(false);
        setMatForm({ name: '', unit: 'יחידות', quantity: '', supplier: '' });
        loadProjectMaterials(selectedProject.id);
      }
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף חומר');
    }
  }

  async function updateDeliveryStatus(materialId, status) {
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${BASE_URL}/materials/${materialId}/delivery`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadProjectMaterials(selectedProject.id);
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן');
    }
  }

  function uploadMaterialImage(materialId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    document.body.appendChild(input);
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.body.removeChild(input);
      try {
        const token = await AsyncStorage.getItem('token');
        const formData = new FormData();
        formData.append('files', file);
        formData.append('projectId', selectedProject.id);
        formData.append('caption', `חומר-${materialId}`);
        const uploadRes = await fetch(`${BASE_URL}/photos/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          const uploaded = await uploadRes.json();
          const imageUrl = uploaded[0]?.url;
          if (imageUrl) {
            await fetch(`${BASE_URL}/materials/${materialId}/delivery`, {
              method: 'PATCH',
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'arrived_ok', imageUrl }),
            });
            loadProjectMaterials(selectedProject.id);
          }
        }
      } catch (err) {
        Alert.alert('שגיאה', 'שגיאה בהעלאת תמונה');
      }
    };
    input.click();
  }

  function uploadToProject(projectId, type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'pdf' ? '.pdf' : 'image/*';
    input.multiple = type !== 'pdf';
    document.body.appendChild(input);
    input.onchange = async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      document.body.removeChild(input);
      setUploading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
        formData.append('projectId', projectId);
        formData.append('caption', type === 'pdf' ? `PDF - ${files[0].name}` : '');
        const res = await fetch(`${BASE_URL}/photos/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          Alert.alert('הצלחה', 'הקבצים הועלו!');
          loadProjectFiles(projectId);
        }
      } catch (err) {
        Alert.alert('שגיאה', 'שגיאה בהעלאה');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function deleteFile(id) {
    const confirmed = window.confirm('האם למחוק קובץ זה?');
    if (!confirmed) return;
    try {
      const token = await AsyncStorage.getItem('token');
      await fetch(`${BASE_URL}/photos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadProjectFiles(selectedProject.id);
    } catch (e) {
      Alert.alert('שגיאה', 'שגיאה במחיקה');
    }
  }

  async function sendReport(project) {
    const userStr = await AsyncStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : {};
    const reportUrl = `https://contractor-backend-production.up.railway.app/api/v1/projects/${project.id}/report?ownerId=${userData.id}`;

    const msg = `שלום ${project.clientName}! 👋

הנה דוח מלא של הפרויקט שלכם:
🏗️ *${project.name}*
📊 התקדמות: *${project.progressPercent}%*
📍 ${project.city || ''} ${project.address ? '· ' + project.address : ''}

לצפייה בדוח המלא עם תמונות וחומרים:
${reportUrl}

לכל שאלה אנחנו זמינים! 🙏`;

    const phone = project.clientPhone?.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/972${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  }

  function sendWhatsApp(project) {
    const msg = `שלום ${project.clientName}! 👋

עדכון על הפרויקט שלכם:
🏗️ *${project.name}*
📍 ${project.city || ''} ${project.address ? '· ' + project.address : ''}
📊 התקדמות: *${project.progressPercent}%*
💰 תקציב: ₪${Number(project.budget).toLocaleString()}
📌 סטטוס: ${project.status === 'active' ? 'פעיל' : project.status === 'delayed' ? 'מאחר' : 'הושלם'}

לכל שאלה אנחנו זמינים! 🙏`;

    const phone = project.clientPhone?.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/972${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  }

  function isPdf(photo) {
    return photo.filename?.toLowerCase().endsWith('.pdf') || photo.caption?.toLowerCase().includes('pdf');
  }

  const statusColor = { active: '#1a6b4a', delayed: '#a32d2d', completed: '#185fa5', pending: '#ba7517' };
  const statusLabel = { active: 'פעיל', delayed: 'מאחר', completed: 'הושלם', pending: 'ממתין' };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  if (selectedProject) {
    const images = projectFiles.filter(p => !isPdf(p));
    const pdfs = projectFiles.filter(p => isPdf(p));

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedProject(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>→ חזור</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedProject.name}</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, activeTab === 'files' && styles.tabActive]} onPress={() => setActiveTab('files')}>
            <Text style={[styles.tabText, activeTab === 'files' && styles.tabTextActive]}>📁 קבצים</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'materials' && styles.tabActive]} onPress={() => setActiveTab('materials')}>
            <Text style={[styles.tabText, activeTab === 'materials' && styles.tabTextActive]}>📦 חומרים</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'files' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadToProject(selectedProject.id, 'image')} disabled={uploading}>
                <Text style={styles.uploadBtnText}>📸 העלה תמונות</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fcebeb' }]} onPress={() => uploadToProject(selectedProject.id, 'pdf')} disabled={uploading}>
                <Text style={[styles.uploadBtnText, { color: '#a32d2d' }]}>📄 העלה PDF</Text>
              </TouchableOpacity>
            </View>
            {filesLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : (
              <ScrollView>
                {images.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📸 תמונות ({images.length})</Text>
                    <View style={styles.grid}>
                      {images.map(photo => (
                        <View key={photo.id} style={styles.photoCard}>
                          <Image source={{ uri: `https://contractor-backend-production.up.railway.app/api/v1${photo.url}` }} style={styles.photo} resizeMode="cover" />
                          <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteFile(photo.id)}>
                            <Text style={styles.deleteBtnText}>✕</Text>
                          </TouchableOpacity>
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
                        <View style={styles.pdfIcon}><Text style={styles.pdfIconText}>PDF</Text></View>
                        <View style={styles.pdfInfo}>
                          <Text style={styles.pdfName}>{pdf.caption || pdf.filename}</Text>
                          <TouchableOpacity onPress={() => window.open(`https://contractor-backend-production.up.railway.app/api/v1${pdf.url}`, '_blank')}>
                            <Text style={styles.pdfOpen}>פתח קובץ</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.pdfDelete} onPress={() => deleteFile(pdf.id)}>
                          <Text style={styles.deleteBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {projectFiles.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>📁</Text>
                    <Text style={styles.emptyText}>אין קבצים לפרויקט זה</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {activeTab === 'materials' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddMaterialModal(true)}>
                <Text style={styles.uploadBtnText}>+ הוסף חומר</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => sendReport(selectedProject)}>
                <Text style={[styles.uploadBtnText, { color: '#1a6b4a' }]}>📲 שלח דוח</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {projectMaterials.map(m => {
                const status = DELIVERY_STATUS[m.deliveryStatus] || DELIVERY_STATUS.pending;
                return (
                  <View key={m.id} style={styles.materialCard}>
                    <View style={styles.materialTop}>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                      <Text style={styles.materialName}>{m.name}</Text>
                    </View>
                    {m.supplier && <Text style={styles.materialMeta}>ספק: {m.supplier}</Text>}
                    <Text style={styles.materialMeta}>כמות: {m.quantity} {m.unit}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
                      {m.deliveryImageUrl && (
                        <Image source={{ uri: `https://contractor-backend-production.up.railway.app/api/v1${m.deliveryImageUrl}` }} style={{ width: 80, height: 80, borderRadius: 8 }} resizeMode="cover" />
                      )}
                      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_ok')}>
                          <Text style={{ color: '#1a6b4a', fontSize: 12 }}>✓ הגיע תקין</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#fcebeb' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_damaged')}>
                          <Text style={{ color: '#a32d2d', fontSize: 12 }}>⚠ פגום</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => updateDeliveryStatus(m.id, 'not_arrived')}>
                          <Text style={{ color: '#555', fontSize: 12 }}>✕ לא הגיע</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => uploadMaterialImage(m.id)}>
                          <Text style={{ color: '#185fa5', fontSize: 12 }}>📷 תמונה</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
              {projectMaterials.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>אין חומרים לפרויקט זה</Text>
                  <Text style={styles.emptySub}>לחצי "+ הוסף חומר"</Text>
                </View>
              )}
            </ScrollView>

            <Modal visible={addMaterialModal} animationType="slide" transparent>
              <View style={styles.overlay}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>הוסף חומר לפרויקט</Text>
                  {[
                    { key: 'name', placeholder: 'שם חומר *' },
                    { key: 'unit', placeholder: 'יחידה (שקים, מטרים...)' },
                    { key: 'quantity', placeholder: 'כמות', keyboardType: 'numeric' },
                    { key: 'supplier', placeholder: 'ספק' },
                  ].map(f => (
                    <TextInput
                      key={f.key}
                      style={styles.input}
                      placeholder={f.placeholder}
                      value={matForm[f.key]}
                      onChangeText={v => setMatForm({ ...matForm, [f.key]: v })}
                      keyboardType={f.keyboardType || 'default'}
                      textAlign="right"
                    />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={addMaterial}>
                      <Text style={styles.btnPrimaryText}>הוסף</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddMaterialModal(false)}>
                      <Text style={styles.btnSecondaryText}>ביטול</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>פרויקטים</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ חדש</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProjects(); }} />}
      >
        {list.map(p => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: (statusColor[p.status] || '#888') + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor[p.status] || '#888' }]}>{statusLabel[p.status] || p.status}</Text>
              </View>
              <Text style={styles.projName}>{p.name}</Text>
            </View>
            <Text style={styles.client}>לקוח: {p.clientName}</Text>
            {p.city && <Text style={styles.meta}>📍 {p.city}{p.address ? ` · ${p.address}` : ''}</Text>}
            {p.budget > 0 && <Text style={styles.meta}>💰 ₪{Number(p.budget).toLocaleString()}</Text>}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${p.progressPercent}%`, backgroundColor: statusColor[p.status] || '#1a6b4a' }]} />
            </View>
            <Text style={styles.pct}>{p.progressPercent}% הושלם</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => { setSelectedProject(p); setActiveTab('files'); }}>
                <Text style={[styles.actionBtnText, { color: '#185fa5' }]}>📁 קבצים</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#faeeda' }]} onPress={() => { setSelectedProject(p); setActiveTab('materials'); }}>
                <Text style={[styles.actionBtnText, { color: '#ba7517' }]}>📦 חומרים</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => sendWhatsApp(p)}>
                <Text style={[styles.actionBtnText, { color: '#1a6b4a' }]}>📲 WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => sendReport(p)}>
                <Text style={[styles.actionBtnText, { color: '#185fa5' }]}>📋 דוח מלא</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {list.length === 0 && <Text style={styles.empty}>אין פרויקטים עדיין. לחץ + חדש להוסיף.</Text>}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>פרויקט חדש</Text>
            <ScrollView>
              {[
                { key: 'name', placeholder: 'שם פרויקט *' },
                { key: 'clientName', placeholder: 'שם לקוח *' },
                { key: 'clientPhone', placeholder: 'טלפון לקוח', keyboardType: 'phone-pad' },
                { key: 'city', placeholder: 'עיר' },
                { key: 'address', placeholder: 'כתובת' },
                { key: 'budget', placeholder: 'תקציב ₪', keyboardType: 'numeric' },
              ].map(f => (
                <TextInput
                  key={f.key}
                  style={styles.input}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChangeText={v => setForm({ ...form, [f.key]: v })}
                  keyboardType={f.keyboardType || 'default'}
                  textAlign="right"
                />
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnPrimary} onPress={createProject}>
                <Text style={styles.btnPrimaryText}>צור פרויקט</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'right' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 14 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8, marginLeft: 8 },
  backBtnText: { color: '#fff', fontSize: 14 },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a6b4a' },
  tabText: { fontSize: 14, color: '#888' },
  tabTextActive: { color: '#1a6b4a', fontWeight: '600' },
  uploadRow: { flexDirection: 'row', padding: 12, gap: 10 },
  uploadBtn: { flex: 1, backgroundColor: '#e8f5ef', padding: 12, borderRadius: 10, alignItems: 'center' },
  uploadBtnText: { color: '#1a6b4a', fontSize: 14, fontWeight: '500' },
  section: { margin: 12, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 10, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCard: { width: '47%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 8, position: 'relative' },
  photo: { width: '100%', height: 180 },
  deleteBtn: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.6)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  pdfCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  pdfIcon: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#fcebeb', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  pdfIconText: { fontSize: 11, fontWeight: 'bold', color: '#a32d2d' },
  pdfInfo: { flex: 1 },
  pdfName: { fontSize: 13, fontWeight: '500', color: '#1a1a1a', textAlign: 'right', marginBottom: 4 },
  pdfOpen: { fontSize: 12, color: '#1a6b4a', textAlign: 'right' },
  pdfDelete: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fcebeb', justifyContent: 'center', alignItems: 'center' },
  materialCard: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  materialTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  materialName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1, textAlign: 'right', marginRight: 8 },
  materialMeta: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 2 },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '500' },
  card: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  projName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1, textAlign: 'right', marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  client: { fontSize: 13, color: '#555', textAlign: 'right', marginBottom: 4 },
  meta: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 2 },
  progressBar: { height: 6, backgroundColor: '#eee', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  pct: { fontSize: 11, color: '#888', textAlign: 'left', marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});