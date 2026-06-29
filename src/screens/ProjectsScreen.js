import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
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
import { apartments as apartmentsApi, materials as materialsApi, projects as projectsApi, workers as workersApi } from '../services/api';

const BASE_URL = 'https://contractor-backend-production.up.railway.app/api/v1';

const DELIVERY_STATUS = {
  pending: { label: 'ממתין', color: '#ba7517', bg: '#faeeda' },
  arrived_ok: { label: '✓ הגיע תקין', color: '#1a6b4a', bg: '#e8f5ef' },
  arrived_damaged: { label: '⚠ הגיע פגום', color: '#a32d2d', bg: '#fcebeb' },
  not_arrived: { label: '✕ לא הגיע', color: '#555', bg: '#f0f0f0' },
};

const statusColor = { active: '#1a6b4a', delayed: '#a32d2d', completed: '#185fa5', pending: '#ba7517' };
const statusLabel = { active: 'פעיל', delayed: 'מאחר', completed: 'הושלם', pending: 'ממתין' };

async function getToken() {
  return AsyncStorage.getItem('token');
}

async function apiFetch(path, opts = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return res;
}

export default function ProjectsScreen() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Project detail state
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [addMaterialModal, setAddMaterialModal] = useState(false);
  const [matForm, setMatForm] = useState({ name: '', unit: 'יחידות', quantity: '', supplier: '' });

  // Apartments state
  const [projectApartments, setProjectApartments] = useState([]);
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [addApartmentModal, setAddApartmentModal] = useState(false);
  const [aptForm, setAptForm] = useState({ name: '', number: '', description: '' });

  // Apartment detail state
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [aptTab, setAptTab] = useState('plans');
  const [aptFiles, setAptFiles] = useState([]);
  const [aptMaterials, setAptMaterials] = useState([]);
  const [aptWorkers, setAptWorkers] = useState([]);
  const [aptFilesLoading, setAptFilesLoading] = useState(false);
  const [addAptMaterialModal, setAddAptMaterialModal] = useState(false);
  const [aptMatForm, setAptMatForm] = useState({ name: '', unit: 'יחידות', quantity: '', supplier: '' });
  const [progressModal, setProgressModal] = useState(false);
  const [progressValue, setProgressValue] = useState('');

  const [form, setForm] = useState({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '', apartmentCount: '' });
  const [aptMatError, setAptMatError] = useState('');
  const [aptMatSubmitting, setAptMatSubmitting] = useState(false);

  // Add worker from apartment
  const [addWorkerModal, setAddWorkerModal] = useState(false);
  const [workerForm, setWorkerForm] = useState({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState(null); // { message }
  const pendingDeleteFn = useRef(null);

  function askDelete(message, fn) {
    pendingDeleteFn.current = fn;
    setConfirmDelete({ message });
  }

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectFiles(selectedProject.id);
      loadProjectMaterials(selectedProject.id);
      loadProjectApartments(selectedProject.id);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedApartment) {
      loadApartmentFiles(selectedApartment.id);
      loadApartmentMaterials(selectedApartment.id);
      loadApartmentWorkers(selectedApartment.id);
    }
  }, [selectedApartment]);

  async function loadProjects() {
    try {
      const res = await apiFetch('/projects');
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
      const res = await apiFetch(`/photos?projectId=${projectId}`);
      const data = await res.json();
      setProjectFiles(Array.isArray(data) ? data : []);
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadProjectMaterials(projectId) {
    try {
      const res = await apiFetch(`/materials?projectId=${projectId}`);
      const data = await res.json();
      setProjectMaterials(Array.isArray(data) ? data : []);
    } catch (e) { console.log(e); }
  }

  async function loadProjectApartments(projectId) {
    setApartmentsLoading(true);
    try {
      const res = await apartmentsApi.getByProject(projectId);
      setProjectApartments(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log(e); } finally {
      setApartmentsLoading(false);
    }
  }

  async function loadApartmentFiles(apartmentId) {
    setAptFilesLoading(true);
    try {
      const res = await apiFetch(`/photos?apartmentId=${apartmentId}`);
      const data = await res.json();
      setAptFiles(Array.isArray(data) ? data : []);
    } finally {
      setAptFilesLoading(false);
    }
  }

  async function loadApartmentMaterials(apartmentId) {
    try {
      const res = await apiFetch(`/materials?apartmentId=${apartmentId}`);
      const data = await res.json();
      setAptMaterials(Array.isArray(data) ? data : []);
    } catch (e) { console.log(e); }
  }

  async function loadApartmentWorkers(apartmentId) {
    try {
      const res = await workersApi.getToday(selectedProject?.id, apartmentId);
      setAptWorkers(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log(e); }
  }

  async function createProject() {
    if (!form.name || !form.clientName) return Alert.alert('שגיאה', 'מלא שם פרויקט ולקוח');
    try {
      const { apartmentCount, ...projectData } = form;
      const res = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ ...projectData, budget: Number(projectData.budget) || 0 }),
      });
      if (res.ok) {
        const project = await res.json();
        const count = parseInt(apartmentCount) || 0;
        if (count > 0 && project?.id) {
          await Promise.all(
            Array.from({ length: count }, (_, i) =>
              apartmentsApi.create({ name: `דירה ${i + 1}`, number: String(i + 1), projectId: project.id })
            )
          );
        }
        setModalVisible(false);
        setForm({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '', apartmentCount: '' });
        loadProjects();
      }
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו ליצור פרויקט'); }
  }

  async function addMaterial() {
    if (!matForm.name) return Alert.alert('שגיאה', 'מלא שם חומר');
    try {
      const res = await apiFetch('/materials', {
        method: 'POST',
        body: JSON.stringify({ ...matForm, quantity: Number(matForm.quantity) || 0, projectId: selectedProject.id, deliveryStatus: 'pending' }),
      });
      if (res.ok) {
        setAddMaterialModal(false);
        setMatForm({ name: '', unit: 'יחידות', quantity: '', supplier: '' });
        loadProjectMaterials(selectedProject.id);
      }
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו להוסיף חומר'); }
  }

  async function addAptMaterial() {
    if (!aptMatForm.name) { setAptMatError('חובה למלא שם חומר'); return; }
    setAptMatError('');
    setAptMatSubmitting(true);
    try {
      const res = await apiFetch('/materials', {
        method: 'POST',
        body: JSON.stringify({
          ...aptMatForm,
          quantity: Number(aptMatForm.quantity) || 0,
          projectId: selectedProject.id,
          apartmentId: selectedApartment.id,
          deliveryStatus: 'pending',
        }),
      });
      if (res.ok) {
        setAddAptMaterialModal(false);
        setAptMatForm({ name: '', unit: 'יחידות', quantity: '', supplier: '' });
        loadApartmentMaterials(selectedApartment.id);
      } else {
        const body = await res.json().catch(() => ({}));
        setAptMatError(body?.message || `שגיאה ${res.status}`);
      }
    } catch (e) { setAptMatError('אין חיבור לשרת'); }
    finally { setAptMatSubmitting(false); }
  }

  async function createApartment() {
    if (!aptForm.name) return Alert.alert('שגיאה', 'מלא שם דירה');
    try {
      await apartmentsApi.create({ ...aptForm, projectId: selectedProject.id });
      setAddApartmentModal(false);
      setAptForm({ name: '', number: '', description: '' });
      loadProjectApartments(selectedProject.id);
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו להוסיף דירה'); }
  }

  function deleteApartment(aptId) {
    askDelete('האם למחוק דירה זו?', async () => {
      try { await apartmentsApi.delete(aptId); loadProjectApartments(selectedProject.id); }
      catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקה'); }
    });
  }

  function deleteProject(projectId) {
    askDelete('האם למחוק פרויקט זה?', async () => {
      try { await projectsApi.delete(projectId); loadProjects(); }
      catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקת פרויקט'); }
    });
  }

  function deleteMaterial(materialId, isApt = false) {
    askDelete('האם למחוק חומר זה?', async () => {
      try {
        await materialsApi.delete(materialId);
        if (isApt) loadApartmentMaterials(selectedApartment.id);
        else loadProjectMaterials(selectedProject.id);
      } catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקת חומר'); }
    });
  }

  async function updateApartmentProgress() {
    const pct = Number(progressValue);
    if (isNaN(pct) || pct < 0 || pct > 100) return Alert.alert('שגיאה', 'הכנס מספר בין 0 ל-100');
    try {
      await apartmentsApi.update(selectedApartment.id, { progressPercent: pct });
      setSelectedApartment(prev => ({ ...prev, progressPercent: pct }));
      setProgressModal(false);
      loadProjectApartments(selectedProject.id);
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לעדכן'); }
  }

  async function markWorkerForApartment(workerId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await workersApi.markAttendance(workerId, {
        date: today,
        status: 'present',
        checkIn: new Date().toTimeString().slice(0, 5),
        hoursWorked: 8,
        projectId: selectedProject.id,
        apartmentId: selectedApartment.id,
      });
      loadApartmentWorkers(selectedApartment.id);
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לרשום נוכחות'); }
  }

  async function addWorkerToApartment() {
    if (!workerForm.firstName || !workerForm.lastName) return Alert.alert('שגיאה', 'מלא שם פרטי ומשפחה');
    try {
      const res = await apiFetch('/workers', {
        method: 'POST',
        body: JSON.stringify({ ...workerForm, dailyRate: Number(workerForm.dailyRate) || 0 }),
      });
      if (res.ok) {
        const newWorker = await res.json();
        // mark attendance for this apartment immediately
        const today = new Date().toISOString().split('T')[0];
        await workersApi.markAttendance(newWorker.id, {
          date: today, status: 'present',
          checkIn: new Date().toTimeString().slice(0, 5),
          hoursWorked: 8,
          projectId: selectedProject.id,
          apartmentId: selectedApartment.id,
        });
        setAddWorkerModal(false);
        setWorkerForm({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
        loadApartmentWorkers(selectedApartment.id);
      }
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו להוסיף עובד'); }
  }

  async function updateDeliveryStatus(materialId, status, isApt = false) {
    try {
      await apiFetch(`/materials/${materialId}/delivery`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (isApt) loadApartmentMaterials(selectedApartment.id);
      else loadProjectMaterials(selectedProject.id);
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לעדכן'); }
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
        const token = await getToken();
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
      } catch (err) { Alert.alert('שגיאה', 'שגיאה בהעלאה'); }
      finally { setUploading(false); }
    };
    input.click();
  }

  function uploadToApartment(apartmentId, type) {
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
        const token = await getToken();
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
        formData.append('apartmentId', apartmentId);
        formData.append('projectId', selectedProject.id);
        formData.append('caption', type === 'pdf' ? `תוכנית PDF - ${files[0].name}` : 'תוכנית דירה');
        const res = await fetch(`${BASE_URL}/photos/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          Alert.alert('הצלחה', 'הקבצים הועלו!');
          loadApartmentFiles(apartmentId);
        }
      } catch (err) { Alert.alert('שגיאה', 'שגיאה בהעלאה'); }
      finally { setUploading(false); }
    };
    input.click();
  }

  function deleteFile(id, isApt = false) {
    askDelete('האם למחוק קובץ זה?', async () => {
      try {
        await apiFetch(`/photos/${id}`, { method: 'DELETE' });
        if (isApt) loadApartmentFiles(selectedApartment.id);
        else loadProjectFiles(selectedProject.id);
      } catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקה'); }
    });
  }

  async function sendReport(project) {
    const userStr = await AsyncStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : {};
    const reportUrl = `${BASE_URL}/projects/${project.id}/report?ownerId=${userData.id}`;
    const msg = `שלום ${project.clientName}! 👋\n\nהנה דוח מלא של הפרויקט:\n🏗️ *${project.name}*\n📊 התקדמות: *${project.progressPercent}%*\n📍 ${project.city || ''}\n\n${reportUrl}\n\nלכל שאלה אנחנו זמינים! 🙏`;
    const phone = project.clientPhone?.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/972${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  function isPdf(photo) {
    return photo.filename?.toLowerCase().endsWith('.pdf') || photo.caption?.toLowerCase().includes('pdf');
  }

  function renderMaterialCard(m, isApt = false) {
    const status = DELIVERY_STATUS[m.deliveryStatus] || DELIVERY_STATUS.pending;
    return (
      <View key={m.id} style={styles.materialCard}>
        <View style={styles.materialTop}>
          <TouchableOpacity style={styles.deleteSmallBtn} onPress={() => deleteMaterial(m.id, isApt)}>
            <Text style={styles.deleteSmallText}>🗑</Text>
          </TouchableOpacity>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Text style={styles.materialName}>{m.name}</Text>
        </View>
        {!!m.supplier && <Text style={styles.materialMeta}>ספק: {m.supplier}</Text>}
        <Text style={styles.materialMeta}>כמות: {m.quantity} {m.unit}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_ok', isApt)}>
            <Text style={{ color: '#1a6b4a', fontSize: 12 }}>✓ הגיע תקין</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#fcebeb' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_damaged', isApt)}>
            <Text style={{ color: '#a32d2d', fontSize: 12 }}>⚠ פגום</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => updateDeliveryStatus(m.id, 'not_arrived', isApt)}>
            <Text style={{ color: '#555', fontSize: 12 }}>✕ לא הגיע</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderFileGallery(files, isApt = false) {
    const images = files.filter(p => !isPdf(p));
    const pdfs = files.filter(p => isPdf(p));
    return (
      <ScrollView>
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 תמונות ({images.length})</Text>
            <View style={styles.grid}>
              {images.map(photo => (
                <View key={photo.id} style={styles.photoCard}>
                  <Image source={{ uri: photo.url }} style={styles.photo} resizeMode="cover" />
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteFile(photo.id, isApt)}>
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
                  <TouchableOpacity onPress={() => window.open(pdf.url, '_blank')}>
                    <Text style={styles.pdfOpen}>פתח קובץ</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.pdfDelete} onPress={() => deleteFile(pdf.id, isApt)}>
                  <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {files.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>אין קבצים עדיין</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const confirmModalJsx = (
    <Modal visible={!!confirmDelete} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#1a1a1a' }}>{confirmDelete?.message}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#fcebeb', padding: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={() => { const fn = pendingDeleteFn.current; pendingDeleteFn.current = null; setConfirmDelete(null); fn?.(); }}>
              <Text style={{ color: '#a32d2d', fontWeight: '600', fontSize: 15 }}>מחק</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#f0f0f0', padding: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={() => { pendingDeleteFn.current = null; setConfirmDelete(null); }}>
              <Text style={{ color: '#555', fontSize: 15 }}>ביטול</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  // ── APARTMENT DETAIL VIEW ───────────────────────────────────────────────
  if (selectedApartment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedApartment(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>→ חזור</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>🏠 {selectedApartment.name}</Text>
          <TouchableOpacity onPress={() => { setProgressValue(String(selectedApartment.progressPercent || 0)); setProgressModal(true); }} style={styles.progressEditBtn}>
            <Text style={styles.progressEditText}>{selectedApartment.progressPercent || 0}%</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressBarHeader}>
          <View style={[styles.progressFillHeader, { width: `${selectedApartment.progressPercent || 0}%` }]} />
        </View>

        <View style={styles.tabRow}>
          {[['plans', '📋 תוכנית'], ['materials', '📦 חומרים'], ['workers', '👷 עובדים']].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.tab, aptTab === key && styles.tabActive]} onPress={() => setAptTab(key)}>
              <Text style={[styles.tabText, aptTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {aptTab === 'plans' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadToApartment(selectedApartment.id, 'image')} disabled={uploading}>
                <Text style={styles.uploadBtnText}>📸 תמונות</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fcebeb' }]} onPress={() => uploadToApartment(selectedApartment.id, 'pdf')} disabled={uploading}>
                <Text style={[styles.uploadBtnText, { color: '#a32d2d' }]}>📄 תוכנית PDF</Text>
              </TouchableOpacity>
            </View>
            {aptFilesLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : renderFileGallery(aptFiles, true)}
          </View>
        )}

        {aptTab === 'materials' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddAptMaterialModal(true)}>
                <Text style={styles.uploadBtnText}>+ הוסף חומר</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {aptMaterials.map(m => renderMaterialCard(m, true))}
              {aptMaterials.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>אין חומרים לדירה זו</Text>
                </View>
              )}
            </ScrollView>
            <Modal visible={addAptMaterialModal} animationType="slide" transparent>
              <View style={styles.overlay}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>הוסף חומר לדירה</Text>
                  {[
                    { key: 'name', placeholder: 'שם חומר *' },
                    { key: 'unit', placeholder: 'יחידה (שקים, מטרים...)' },
                    { key: 'quantity', placeholder: 'כמות', keyboardType: 'numeric' },
                    { key: 'supplier', placeholder: 'ספק' },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholder={f.placeholder} value={aptMatForm[f.key]}
                      onChangeText={v => setAptMatForm({ ...aptMatForm, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
                  ))}
                  {aptMatError ? <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{aptMatError}</Text> : null}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.btnPrimary, aptMatSubmitting && { opacity: 0.6 }]} onPress={addAptMaterial} disabled={aptMatSubmitting}>
                      <Text style={styles.btnPrimaryText}>{aptMatSubmitting ? 'שולח...' : 'הוסף'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => { setAddAptMaterialModal(false); setAptMatError(''); }}>
                      <Text style={styles.btnSecondaryText}>ביטול</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}

        {aptTab === 'workers' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddWorkerModal(true)}>
                <Text style={styles.uploadBtnText}>+ הוסף עובד לדירה</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
            <Text style={styles.sectionTitle}>עובדים ב{selectedApartment.name} היום</Text>
            {aptWorkers.map(w => {
              const present = w.todayAttendance?.status === 'present' && w.todayAttendance?.apartmentId === selectedApartment.id;
              return (
                <View key={w.id} style={[styles.card, { marginBottom: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.avatar, { backgroundColor: present ? '#e8f5ef' : '#f5f5f5' }]}>
                      <Text style={[styles.avatarText, { color: present ? '#1a6b4a' : '#888' }]}>
                        {w.firstName?.[0]}{w.lastName?.[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.workerName}>{w.firstName} {w.lastName}</Text>
                      <Text style={styles.workerRole}>{w.role || 'פועל'}</Text>
                    </View>
                    {present ? (
                      <View style={styles.presentBadge}><Text style={styles.presentText}>נוכח ✓</Text></View>
                    ) : (
                      <TouchableOpacity style={styles.markBtn} onPress={() => markWorkerForApartment(w.id)}>
                        <Text style={styles.markBtnText}>סמן נוכח</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {aptWorkers.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>👷</Text>
                <Text style={styles.emptyText}>אין עובדים רשומים</Text>
                <Text style={styles.emptySub}>לחצי "+ הוסף עובד לדירה"</Text>
              </View>
            )}
            </ScrollView>

            <Modal visible={addWorkerModal} animationType="slide" transparent>
              <View style={styles.overlay}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>הוסף עובד לדירה</Text>
                  {[
                    { key: 'firstName', placeholder: 'שם פרטי *' },
                    { key: 'lastName', placeholder: 'שם משפחה *' },
                    { key: 'phone', placeholder: 'טלפון', keyboardType: 'phone-pad' },
                    { key: 'role', placeholder: 'תפקיד (בנאי, חשמלאי...)' },
                    { key: 'dailyRate', placeholder: 'שכר יומי ₪', keyboardType: 'numeric' },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholder={f.placeholder}
                      value={workerForm[f.key]}
                      onChangeText={v => setWorkerForm({ ...workerForm, [f.key]: v })}
                      keyboardType={f.keyboardType || 'default'} textAlign="right" />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={addWorkerToApartment}>
                      <Text style={styles.btnPrimaryText}>הוסף עובד</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddWorkerModal(false)}>
                      <Text style={styles.btnSecondaryText}>ביטול</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}

        {/* Progress modal */}
        <Modal visible={progressModal} animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={[styles.modal, { paddingBottom: 30 }]}>
              <Text style={styles.modalTitle}>עדכן אחוז התקדמות</Text>
              <TextInput style={styles.input} placeholder="0-100" value={progressValue}
                onChangeText={setProgressValue} keyboardType="numeric" textAlign="right" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnPrimary} onPress={updateApartmentProgress}>
                  <Text style={styles.btnPrimaryText}>עדכן</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setProgressModal(false)}>
                  <Text style={styles.btnSecondaryText}>ביטול</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {confirmModalJsx}
      </View>
    );
  }

  // ── PROJECT DETAIL VIEW ─────────────────────────────────────────────────
  if (selectedProject) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedProject(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>→ חזור</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedProject.name}</Text>
        </View>

        <View style={styles.tabRow}>
          {[['files', '📁 קבצים'], ['materials', '📦 חומרים'], ['apartments', '🏠 דירות']].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'files' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadToProject(selectedProject.id, 'image')} disabled={uploading}>
                <Text style={styles.uploadBtnText}>📸 תמונות</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fcebeb' }]} onPress={() => uploadToProject(selectedProject.id, 'pdf')} disabled={uploading}>
                <Text style={[styles.uploadBtnText, { color: '#a32d2d' }]}>📄 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => sendReport(selectedProject)}>
                <Text style={[styles.uploadBtnText, { color: '#185fa5' }]}>📲 דוח</Text>
              </TouchableOpacity>
            </View>
            {filesLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : renderFileGallery(projectFiles, false)}
          </View>
        )}

        {activeTab === 'materials' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddMaterialModal(true)}>
                <Text style={styles.uploadBtnText}>+ הוסף חומר</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {projectMaterials.map(m => renderMaterialCard(m, false))}
              {projectMaterials.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>אין חומרים לפרויקט זה</Text>
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
                    <TextInput key={f.key} style={styles.input} placeholder={f.placeholder} value={matForm[f.key]}
                      onChangeText={v => setMatForm({ ...matForm, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
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

        {activeTab === 'apartments' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddApartmentModal(true)}>
                <Text style={styles.uploadBtnText}>+ הוסף דירה</Text>
              </TouchableOpacity>
            </View>
            {apartmentsLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : (
              <ScrollView>
                {projectApartments.map(apt => (
                  <TouchableOpacity key={apt.id} onPress={() => { setSelectedApartment(apt); setAptTab('plans'); }} style={styles.aptCard}>
                    <View style={styles.aptCardTop}>
                      <View style={styles.aptIcon}><Text style={styles.aptIconText}>🏠</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aptName}>{apt.name}{apt.number ? ` (${apt.number})` : ''}</Text>
                        {apt.description ? <Text style={styles.aptDesc}>{apt.description}</Text> : null}
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${apt.progressPercent || 0}%` }]} />
                        </View>
                        <Text style={styles.pct}>{apt.progressPercent || 0}% הושלם</Text>
                      </View>
                      <TouchableOpacity onPress={() => deleteApartment(apt.id)} style={styles.pdfDelete}>
                        <Text style={styles.deleteBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
                {projectApartments.length === 0 && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyIcon}>🏠</Text>
                    <Text style={styles.emptyText}>אין דירות לפרויקט זה</Text>
                    <Text style={styles.emptySub}>לחצי "+ הוסף דירה"</Text>
                  </View>
                )}
              </ScrollView>
            )}
            <Modal visible={addApartmentModal} animationType="slide" transparent>
              <View style={styles.overlay}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>דירה חדשה</Text>
                  {[
                    { key: 'name', placeholder: 'שם דירה *' },
                    { key: 'number', placeholder: 'מספר דירה / קומה' },
                    { key: 'description', placeholder: 'תיאור (אופציונלי)' },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholder={f.placeholder} value={aptForm[f.key]}
                      onChangeText={v => setAptForm({ ...aptForm, [f.key]: v })} textAlign="right" />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={createApartment}>
                      <Text style={styles.btnPrimaryText}>הוסף דירה</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddApartmentModal(false)}>
                      <Text style={styles.btnSecondaryText}>ביטול</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}
        {confirmModalJsx}
      </View>
    );
  }

  // ── PROJECTS LIST ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>פרויקטים</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ חדש</Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProjects(); }} />}>
        {list.map(p => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: (statusColor[p.status] || '#888') + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor[p.status] || '#888' }]}>{statusLabel[p.status] || p.status}</Text>
              </View>
              <Text style={styles.projName}>{p.name}</Text>
            </View>
            <Text style={styles.client}>לקוח: {p.clientName}</Text>
            {!!p.city && <Text style={styles.meta}>📍 {p.city}{p.address ? ` · ${p.address}` : ''}</Text>}
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
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => { setSelectedProject(p); setActiveTab('apartments'); }}>
                <Text style={[styles.actionBtnText, { color: '#1a6b4a' }]}>🏠 דירות</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fcebeb' }]} onPress={() => deleteProject(p.id)}>
                <Text style={[styles.actionBtnText, { color: '#a32d2d' }]}>🗑 מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {list.length === 0 && <Text style={styles.emptyList}>אין פרויקטים עדיין. לחץ + חדש להוסיף.</Text>}
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
                { key: 'apartmentCount', placeholder: 'מספר דירות בפרויקט', keyboardType: 'numeric' },
              ].map(f => (
                <TextInput key={f.key} style={styles.input} placeholder={f.placeholder} value={form[f.key]}
                  onChangeText={v => setForm({ ...form, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
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
      {confirmModalJsx}
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
  progressEditBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 4 },
  progressEditText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  progressBarHeader: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressFillHeader: { height: '100%', backgroundColor: '#a3d9b0' },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a6b4a' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#1a6b4a', fontWeight: '600' },
  uploadRow: { flexDirection: 'row', padding: 10, gap: 8 },
  uploadBtn: { flex: 1, backgroundColor: '#e8f5ef', padding: 11, borderRadius: 10, alignItems: 'center' },
  uploadBtnText: { color: '#1a6b4a', fontSize: 13, fontWeight: '500' },
  section: { margin: 12, marginBottom: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', margin: 12, textAlign: 'right' },
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
  deleteSmallBtn: { padding: 4, marginLeft: 6 },
  deleteSmallText: { fontSize: 16 },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '500' },
  aptCard: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  aptCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  aptIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#e8f5ef', justifyContent: 'center', alignItems: 'center' },
  aptIconText: { fontSize: 22 },
  aptName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  aptDesc: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 2 },
  card: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  projName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', flex: 1, textAlign: 'right', marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  client: { fontSize: 13, color: '#555', textAlign: 'right', marginBottom: 4 },
  meta: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 2 },
  progressBar: { height: 6, backgroundColor: '#eee', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#1a6b4a' },
  pct: { fontSize: 11, color: '#888', textAlign: 'left', marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  actionBtnText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  emptySub: { fontSize: 13, color: '#888', marginTop: 4, textAlign: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#555', textAlign: 'center' },
  emptyList: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  avatarText: { fontSize: 15, fontWeight: '600' },
  workerName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', textAlign: 'right' },
  workerRole: { fontSize: 12, color: '#888', textAlign: 'right' },
  presentBadge: { backgroundColor: '#e8f5ef', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  presentText: { color: '#1a6b4a', fontSize: 12, fontWeight: '500' },
  markBtn: { backgroundColor: '#1a6b4a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  markBtnText: { color: '#fff', fontSize: 12 },
});
