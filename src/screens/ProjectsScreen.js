import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import PdfViewer from '../components/PdfViewer';
import { BASE_URL, apartments as apartmentsApi, materials as materialsApi, projects as projectsApi, workers as workersApi } from '../services/api';
import { toUploadFile, uploadFiles } from '../services/uploadFiles';
import { useLanguage } from '../i18n/LanguageContext';
import { useTopInset } from '../hooks/useTopInset';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

const isWeb = Platform.OS === 'web';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

// Open a URL (web opens a new tab, native uses the OS handler)
function openUrl(url) {
  if (isWeb) window.open(url, '_blank');
  else Linking.openURL(url);
}

// Native file pickers — return RN-style file objects compatible with FormData
async function pickImagesNative(t, multiple = true) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { Alert.alert(t('common.permissionRequired'), t('photos.errors.needGalleryPermission')); return null; }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    quality: 0.7,
  });
  if (result.canceled) return null;
  return result.assets.map(a => toUploadFile(a, 'image/jpeg'));
}

async function pickDocsNative(mime = '*/*') {
  const result = await DocumentPicker.getDocumentAsync({ type: mime, multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  return (result.assets || []).map(a => toUploadFile(a, 'application/octet-stream'));
}

// Web file picker — returns a Promise resolving to a FileList
function pickFilesWeb(accept, multiple = false) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.multiple = multiple;
    document.body.appendChild(input);
    input.onchange = (e) => { const f = e.target.files; document.body.removeChild(input); resolve(f); };
    input.click();
  });
}

const DELIVERY_STATUS = {
  pending: { key: 'projects.delivery.pending', color: '#ba7517', bg: '#faeeda' },
  arrived_ok: { key: 'projects.delivery.arrivedOk', color: '#1a6b4a', bg: '#e8f5ef' },
  arrived_damaged: { key: 'projects.delivery.arrivedDamaged', color: '#a32d2d', bg: '#fcebeb' },
  not_arrived: { key: 'projects.delivery.notArrived', color: '#555', bg: '#f0f0f0' },
};

const statusColor = { active: '#1a6b4a', delayed: '#a32d2d', completed: '#185fa5', pending: '#ba7517' };
const STATUS_KEY = { active: 'projects.status.active', delayed: 'projects.status.delayed', completed: 'projects.status.completed', pending: 'projects.status.pending' };

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

export default function ProjectsScreen({ pendingCreate, onClearPendingCreate } = {}) {
  const topInset = useTopInset();
  const keyboardHeight = useKeyboardHeight();
  const { t, lang } = useLanguage();
  // dates in the card follow the chosen language
  const dateLocale = { he: 'he-IL', ar: 'ar', en: 'en-GB', es: 'es', pt: 'pt', ru: 'ru', uk: 'uk', ro: 'ro', pl: 'pl', tr: 'tr', fr: 'fr', de: 'de' }[lang] || 'en-GB';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (pendingCreate) { setModalVisible(true); onClearPendingCreate?.(); }
  }, [pendingCreate]);
  const [projectError, setProjectError] = useState('');
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Project detail state
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [projectFiles, setProjectFiles] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [addMaterialModal, setAddMaterialModal] = useState(false);
  const [matForm, setMatForm] = useState({ name: '', unit: '', quantity: '', unitPrice: '', supplier: '' });

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
  const [aptMatForm, setAptMatForm] = useState({ name: '', unit: '', quantity: '', unitPrice: '', supplier: '' });
  const [progressModal, setProgressModal] = useState(false);
  const [progressValue, setProgressValue] = useState('');

  const [form, setForm] = useState({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '', apartmentCount: '', endDate: '' });
  const [aptMatError, setAptMatError] = useState('');
  const [aptMatSubmitting, setAptMatSubmitting] = useState(false);

  // Add worker from apartment
  const [addWorkerModal, setAddWorkerModal] = useState(false);
  const [workerForm, setWorkerForm] = useState({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });

  // In-app document viewer
  const [docViewer, setDocViewer] = useState({ visible: false, uri: '', title: '' });

  // Confirm delete dialog
  const [confirmDelete, setConfirmDelete] = useState(null); // { message }
  const pendingDeleteFn = useRef(null);

  function askDelete(message, fn) {
    pendingDeleteFn.current = fn;
    setConfirmDelete({ message });
  }

  useEffect(() => { loadProjects(); }, []);

  // Android back button: close popups, then step back apartment -> project -> list
  useEffect(() => {
    const onBack = () => {
      if (docViewer.visible) { setDocViewer({ visible: false, uri: '', title: '' }); return true; }
      if (confirmDelete) { setConfirmDelete(null); return true; }
      if (progressModal) { setProgressModal(false); return true; }
      if (addWorkerModal) { setAddWorkerModal(false); return true; }
      if (addAptMaterialModal) { setAddAptMaterialModal(false); return true; }
      if (addApartmentModal) { setAddApartmentModal(false); return true; }
      if (addMaterialModal) { setAddMaterialModal(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      if (selectedApartment) { setSelectedApartment(null); return true; }
      if (selectedProject) { setSelectedProject(null); return true; }
      return false; // nothing open — let the app-level handler go to dashboard
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [docViewer.visible, confirmDelete, progressModal, addWorkerModal, addAptMaterialModal, addApartmentModal, addMaterialModal, modalVisible, selectedApartment, selectedProject]);

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
    } catch (e) { console.log('loadProjectFiles error:', e); }
    finally { setFilesLoading(false); }
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
      const arr = Array.isArray(res.data) ? res.data : [];
      // Sort by apartment number so they always appear in order (1,2,3...)
      arr.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
      setProjectApartments(arr);
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
    } catch (e) { console.log('loadApartmentFiles error:', e); }
    finally { setAptFilesLoading(false); }
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
    if (!form.name || !form.clientName) { setProjectError(t('projects.errors.nameAndClientRequired')); return; }
    setProjectError('');
    setProjectSubmitting(true);
    try {
      const { apartmentCount, endDate, ...projectData } = form;
      let parsedEndDate = null;
      if (endDate) {
        const parts = endDate.split('/');
        if (parts.length === 3) parsedEndDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
      const res = await apiFetch('/projects', {
        method: 'POST',
        body: JSON.stringify({ ...projectData, budget: Number(projectData.budget) || 0, ...(parsedEndDate ? { endDate: parsedEndDate } : {}) }),
      });
      if (res.ok) {
        const project = await res.json();
        const count = parseInt(apartmentCount) || 0;
        if (count > 0 && project?.id) {
          // Create one at a time (in order) so numbering stays 1,2,3... and never races
          for (let i = 0; i < count; i++) {
            await apartmentsApi.create({ name: t('projects.apartmentNumbered', { number: i + 1 }), number: String(i + 1), projectId: project.id });
          }
        }
        setModalVisible(false);
        setProjectError('');
        setForm({ name: '', clientName: '', clientPhone: '', address: '', city: '', budget: '', apartmentCount: '', endDate: '' });
        loadProjects();
      } else {
        const body = await res.json().catch(() => ({}));
        setProjectError(body?.message ? String(body.message) : t('projects.errors.serverStatus', { status: res.status }));
      }
    } catch (e) {
      setProjectError(t('projects.errors.noConnection'));
    } finally {
      setProjectSubmitting(false);
    }
  }

  async function addMaterial() {
    if (!matForm.name) return Alert.alert(t('common.error'), t('materials.errors.nameRequired'));
    try {
      const res = await apiFetch('/materials', {
        method: 'POST',
        body: JSON.stringify({ ...matForm, unit: matForm.unit || t('materials.defaultUnit'), quantity: Number(matForm.quantity) || 0, unitPrice: Number(matForm.unitPrice) || 0, projectId: selectedProject.id, deliveryStatus: 'pending' }),
      });
      if (res.ok) {
        setAddMaterialModal(false);
        setMatForm({ name: '', unit: '', quantity: '', unitPrice: '', supplier: '' });
        loadProjectMaterials(selectedProject.id);
      }
    } catch (e) { Alert.alert(t('common.error'), t('projects.errors.addMaterialFailed')); }
  }

  async function addAptMaterial() {
    if (!aptMatForm.name) { setAptMatError(t('materials.errors.nameRequired')); return; }
    setAptMatError('');
    setAptMatSubmitting(true);
    try {
      const res = await apiFetch('/materials', {
        method: 'POST',
        body: JSON.stringify({
          ...aptMatForm,
          unit: aptMatForm.unit || t('materials.defaultUnit'),
          quantity: Number(aptMatForm.quantity) || 0,
          unitPrice: Number(aptMatForm.unitPrice) || 0,
          projectId: selectedProject.id,
          apartmentId: selectedApartment.id,
          deliveryStatus: 'pending',
        }),
      });
      if (res.ok) {
        setAddAptMaterialModal(false);
        setAptMatForm({ name: '', unit: '', quantity: '', unitPrice: '', supplier: '' });
        loadApartmentMaterials(selectedApartment.id);
      } else {
        const body = await res.json().catch(() => ({}));
        setAptMatError(body?.message || t('projects.errors.serverStatus', { status: res.status }));
      }
    } catch (e) { setAptMatError(t('projects.errors.noConnection')); }
    finally { setAptMatSubmitting(false); }
  }

  async function createApartment() {
    if (!aptForm.name) return Alert.alert(t('common.error'), t('projects.errors.apartmentNameRequired'));
    try {
      await apartmentsApi.create({ ...aptForm, projectId: selectedProject.id });
      setAddApartmentModal(false);
      setAptForm({ name: '', number: '', description: '' });
      loadProjectApartments(selectedProject.id);
    } catch (e) { Alert.alert(t('common.error'), t('projects.errors.addApartmentFailed')); }
  }

  function deleteApartment(aptId) {
    askDelete(t('projects.confirmDeleteApartment'), async () => {
      try { await apartmentsApi.delete(aptId); loadProjectApartments(selectedProject.id); }
      catch (e) { Alert.alert(t('common.error'), t('projects.errors.deleteFailed')); }
    });
  }

  function deleteProject(projectId) {
    askDelete(t('projects.confirmDeleteProject'), async () => {
      try { await projectsApi.delete(projectId); loadProjects(); }
      catch (e) { Alert.alert(t('common.error'), t('projects.errors.deleteProjectFailed')); }
    });
  }

  function deleteMaterial(materialId, isApt = false) {
    askDelete(t('materials.confirmDelete'), async () => {
      try {
        await materialsApi.delete(materialId);
        if (isApt) loadApartmentMaterials(selectedApartment.id);
        else loadProjectMaterials(selectedProject.id);
      } catch (e) { Alert.alert(t('common.error'), t('materials.errors.deleteFailed')); }
    });
  }

  async function updateApartmentProgress() {
    const pct = Number(progressValue);
    if (isNaN(pct) || pct < 0 || pct > 100) return Alert.alert(t('common.error'), t('projects.errors.percentRange'));
    try {
      await apartmentsApi.update(selectedApartment.id, { progressPercent: pct });
      setSelectedApartment(prev => ({ ...prev, progressPercent: pct }));
      setProgressModal(false);
      loadProjectApartments(selectedProject.id);
    } catch (e) { Alert.alert(t('common.error'), t('workers.errors.updateFailed')); }
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
    } catch (e) { Alert.alert(t('common.error'), t('workers.errors.attendanceFailed')); }
  }

  async function addWorkerToApartment() {
    if (!workerForm.firstName || !workerForm.lastName) return Alert.alert(t('common.error'), t('workers.errors.nameRequired'));
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
    } catch (e) { Alert.alert(t('common.error'), t('projects.errors.addWorkerFailed')); }
  }

  async function updateDeliveryStatus(materialId, status, isApt = false) {
    try {
      await apiFetch(`/materials/${materialId}/delivery`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (isApt) loadApartmentMaterials(selectedApartment.id);
      else loadProjectMaterials(selectedProject.id);
    } catch (e) { Alert.alert(t('common.error'), t('workers.errors.updateFailed')); }
  }

  async function doUpload(files, projectId, apartmentId, caption) {
    setUploading(true);
    setUploadError('');
    try {
      await uploadFiles(Array.from(files), { projectId, apartmentId, caption });
      return true;
    } catch (err) {
      setUploadError(err?.message || t('photos.errors.uploadFailed'));
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function uploadToProject(projectId, type) {
    const files = isWeb
      ? await pickFilesWeb(type === 'pdf' ? '' : 'image/*', type !== 'pdf')
      : type === 'pdf' ? await pickDocsNative('*/*') : await pickImagesNative(t, true);
    if (!files || files.length === 0) return;
    const ok = await doUpload(files, projectId, null, type === 'pdf' ? 'PDF' : '');
    if (ok) loadProjectFiles(projectId);
  }

  async function uploadToApartment(apartmentId, type) {
    const files = isWeb
      ? await pickFilesWeb(type === 'pdf' ? '' : 'image/*', type !== 'pdf')
      : type === 'pdf' ? await pickDocsNative('*/*') : await pickImagesNative(t, true);
    if (!files || files.length === 0) return;
    const ok = await doUpload(files, selectedProject.id, apartmentId, type === 'pdf' ? t('projects.captions.planPdf') : t('projects.captions.apartmentPlan'));
    if (ok) loadApartmentFiles(apartmentId);
  }

  async function uploadMaterialFile(materialId, type, isApt = false) {
    const files = isWeb
      ? await pickFilesWeb(type === 'image' ? 'image/*' : '', false)
      : type === 'image' ? await pickImagesNative(t, false) : await pickDocsNative('*/*');
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadFiles([files[0]], {
        projectId: selectedProject?.id,
        caption: type === 'image' ? t('materials.deliveryPhoto') : t('materials.deliveryNote'),
      });
      const url = uploaded[0]?.url;
      if (url) {
        const field = type === 'image' ? 'deliveryImageUrl' : 'imageUrl';
        await apiFetch(`/materials/${materialId}`, {
          method: 'PATCH',
          body: JSON.stringify({ [field]: url }),
        });
        if (isApt) loadApartmentMaterials(selectedApartment.id);
        else loadProjectMaterials(selectedProject.id);
      } else {
        setUploadError(t('materials.errors.noUrlFromServer'));
      }
    } catch (err) {
      setUploadError(err?.message || t('photos.errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function deleteFile(id, isApt = false) {
    askDelete(t('projects.confirmDeleteFile'), async () => {
      try {
        await apiFetch(`/photos/${id}`, { method: 'DELETE' });
        if (isApt) loadApartmentFiles(selectedApartment.id);
        else loadProjectFiles(selectedProject.id);
      } catch (e) { Alert.alert(t('common.error'), t('projects.errors.deleteFailed')); }
    });
  }

  async function sendReport(project) {
    const userStr = await AsyncStorage.getItem('user');
    const userData = userStr ? JSON.parse(userStr) : {};
    const reportUrl = `${BASE_URL}/projects/${project.id}/report?ownerId=${userData.id}`;
    const msg = [
      t('projects.report.greeting', { name: project.clientName }),
      '',
      t('projects.report.intro'),
      `🏗️ *${project.name}*`,
      `📊 ${t('projects.report.progress', { percent: project.progressPercent })}`,
      `📍 ${project.city || ''}`,
      '',
      reportUrl,
      '',
      t('projects.report.closing'),
    ].join('\n');
    const phone = project.clientPhone?.replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/972${phone.startsWith('0') ? phone.slice(1) : phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    openUrl(url);
  }

  // Anything that is not a picture is a document. Checking for .pdf alone meant
  // a DWG or Word plan was treated as an image and drawn as an empty tile.
  function fileExt(photo) {
    const name = (photo.filename || '').toLowerCase();
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot + 1) : '';
    return /^[a-z0-9]{1,5}$/.test(ext) ? ext : '';
  }

  function isImage(photo) {
    const ext = fileExt(photo);
    if (ext) return IMAGE_EXTENSIONS.includes(ext);
    // Cloudinary keeps everything that is not a picture under /raw/
    return !(photo.url || '').includes('/raw/');
  }

  function openDocument(photo) {
    const label = photo.caption || photo.filename;
    // Only a PDF can be shown in the in-app viewer; hand the rest to the phone.
    if (fileExt(photo) === 'pdf') setDocViewer({ visible: true, uri: photo.url, title: label });
    else openUrl(photo.url);
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
            <Text style={[styles.statusText, { color: status.color }]}>{t(status.key)}</Text>
          </View>
          <Text style={styles.materialName}>{m.name}</Text>
        </View>
        {!!m.supplier && <Text style={styles.materialMeta}>{t('materials.supplier', { name: m.supplier })}</Text>}
        <Text style={styles.materialMeta}>{t('projects.quantityOf', { quantity: m.quantity, unit: m.unit })}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_ok', isApt)}>
            <Text style={{ color: '#1a6b4a', fontSize: 12 }}>{t('projects.delivery.arrivedOk')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#fcebeb' }]} onPress={() => updateDeliveryStatus(m.id, 'arrived_damaged', isApt)}>
            <Text style={{ color: '#a32d2d', fontSize: 12 }}>{t('projects.delivery.damagedShort')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => updateDeliveryStatus(m.id, 'not_arrived', isApt)}>
            <Text style={{ color: '#555', fontSize: 12 }}>{t('projects.delivery.notArrived')}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#e6f1fb', flex: 1 }]} onPress={() => uploadMaterialFile(m.id, 'image', isApt)}>
            <Text style={{ color: '#185fa5', fontSize: 12, textAlign: 'center' }}>📸 {t('materials.deliveryPhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f5f0ff', flex: 1 }]} onPress={() => uploadMaterialFile(m.id, 'pdf', isApt)}>
            <Text style={{ color: '#6b35a0', fontSize: 12, textAlign: 'center' }}>📄 {t('materials.deliveryNote')}</Text>
          </TouchableOpacity>
        </View>
        {!!m.deliveryImageUrl && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: '#888', textAlign: 'right', marginBottom: 4 }}>📸 {t('materials.deliveryPhoto')}</Text>
            <Image source={{ uri: m.deliveryImageUrl }} style={{ width: '100%', height: 160, borderRadius: 8 }} resizeMode="cover" />
          </View>
        )}
        {!!m.imageUrl && (
          m.imageUrl.toLowerCase().includes('.pdf') || m.imageUrl.includes('/raw/') ? (
            <TouchableOpacity onPress={() => setDocViewer({ visible: true, uri: m.imageUrl, title: t('materials.deliveryNote') })} style={{ marginTop: 8, padding: 10, backgroundColor: '#f5f0ff', borderRadius: 8 }}>
              <Text style={{ color: '#6b35a0', fontSize: 13, textAlign: 'right' }}>📄 {t('materials.openDeliveryNote')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: '#888', textAlign: 'right', marginBottom: 4 }}>📄 {t('materials.deliveryNote')}</Text>
              <Image source={{ uri: m.imageUrl }} style={{ width: '100%', height: 160, borderRadius: 8 }} resizeMode="cover" />
            </View>
          )
        )}
      </View>
    );
  }

  function renderFileGallery(files, isApt = false) {
    const images = files.filter(isImage);
    const pdfs = files.filter(p => !isImage(p));
    return (
      <ScrollView>
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 {t('photos.siteImages', { count: images.length })}</Text>
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
            <Text style={styles.sectionTitle}>📄 {t('photos.pdfFiles', { count: pdfs.length })}</Text>
            {pdfs.map(pdf => (
              <View key={pdf.id} style={styles.pdfCard}>
                <View style={styles.pdfIcon}><Text style={styles.pdfIconText}>{(fileExt(pdf) || t('photos.file')).toUpperCase()}</Text></View>
                <View style={styles.pdfInfo}>
                  <Text style={styles.pdfName}>{pdf.caption || pdf.filename}</Text>
                  <TouchableOpacity onPress={() => openDocument(pdf)}>
                    <Text style={styles.pdfOpen}>{t('photos.openFile')}</Text>
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
            <Text style={styles.emptyText}>{t('photos.empty')}</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const confirmModalJsx = (
    <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24 }}>
          <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#1a1a1a' }}>{confirmDelete?.message}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#fcebeb', padding: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={() => { const fn = pendingDeleteFn.current; pendingDeleteFn.current = null; setConfirmDelete(null); fn?.(); }}>
              <Text style={{ color: '#a32d2d', fontWeight: '600', fontSize: 15 }}>{t('common.delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, backgroundColor: '#f0f0f0', padding: 14, borderRadius: 10, alignItems: 'center' }}
              onPress={() => { pendingDeleteFn.current = null; setConfirmDelete(null); }}>
              <Text style={{ color: '#555', fontSize: 15 }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const docViewerJsx = (
    <PdfViewer
      visible={docViewer.visible}
      uri={docViewer.uri}
      title={docViewer.title}
      onShare={() => openUrl(docViewer.uri)}
      onClose={() => setDocViewer({ visible: false, uri: '', title: '' })}
    />
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  // ── APARTMENT DETAIL VIEW ───────────────────────────────────────────────
  if (selectedApartment) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <TouchableOpacity onPress={() => setSelectedApartment(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>→ {t('projects.back')}</Text>
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
          {[['plans', `📋 ${t('projects.tabs.plans')}`], ['materials', `📦 ${t('nav.materials')}`], ['workers', `👷 ${t('nav.workers')}`]].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.tab, aptTab === key && styles.tabActive]} onPress={() => setAptTab(key)}>
              <Text style={[styles.tabText, aptTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {aptTab === 'plans' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadToApartment(selectedApartment.id, 'image')} disabled={uploading}>
                <Text style={styles.uploadBtnText}>{uploading ? t('photos.uploading') : `📸 ${t('nav.photos')}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fcebeb' }]} onPress={() => uploadToApartment(selectedApartment.id, 'pdf')} disabled={uploading}>
                <Text style={[styles.uploadBtnText, { color: '#a32d2d' }]}>📄 {t('projects.captions.planPdf')}</Text>
              </TouchableOpacity>
            </View>
            {!!uploadError && <Text style={{ color: '#a32d2d', textAlign: 'center', padding: 8 }}>{uploadError}</Text>}
            {aptFilesLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : renderFileGallery(aptFiles, true)}
          </View>
        )}

        {aptTab === 'materials' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddAptMaterialModal(true)}>
                <Text style={styles.uploadBtnText}>+ {t('materials.addMaterial')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {aptMaterials.map(m => renderMaterialCard(m, true))}
              {aptMaterials.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>{t('projects.noMaterialsForApartment')}</Text>
                </View>
              )}
            </ScrollView>
            <Modal visible={addAptMaterialModal} animationType="slide" transparent onRequestClose={() => setAddAptMaterialModal(false)}>
              <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>{t('projects.addMaterialToApartment')}</Text>
                  {[
                    { key: 'name', placeholder: t('materials.fields.name') },
                    { key: 'unit', placeholder: t('materials.fields.unit') },
                    { key: 'quantity', placeholder: t('invoices.fields.quantity'), keyboardType: 'numeric' },
                    { key: 'unitPrice', placeholder: t('materials.fields.unitPrice'), keyboardType: 'numeric' },
                    { key: 'supplier', placeholder: t('materials.fields.supplier') },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder} value={aptMatForm[f.key]}
                      onChangeText={v => setAptMatForm({ ...aptMatForm, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
                  ))}
                  {aptMatError ? <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{aptMatError}</Text> : null}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.btnPrimary, aptMatSubmitting && { opacity: 0.6 }]} onPress={addAptMaterial} disabled={aptMatSubmitting}>
                      <Text style={styles.btnPrimaryText}>{aptMatSubmitting ? t('common.submitting') : t('projects.add')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => { setAddAptMaterialModal(false); setAptMatError(''); }}>
                      <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
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
                <Text style={styles.uploadBtnText}>+ {t('projects.addWorkerToApartment')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
            <Text style={styles.sectionTitle}>{t('projects.workersInApartmentToday', { name: selectedApartment.name })}</Text>
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
                      <Text style={styles.workerRole}>{w.role || t('workers.defaultRole')}</Text>
                    </View>
                    {present ? (
                      <View style={styles.presentBadge}><Text style={styles.presentText}>{t('workers.present')} ✓</Text></View>
                    ) : (
                      <TouchableOpacity style={styles.markBtn} onPress={() => markWorkerForApartment(w.id)}>
                        <Text style={styles.markBtnText}>{t('workers.markPresent')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
            {aptWorkers.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>👷</Text>
                <Text style={styles.emptyText}>{t('projects.noWorkersListed')}</Text>
                <Text style={styles.emptySub}>{t('projects.addWorkerHint')}</Text>
              </View>
            )}
            </ScrollView>

            <Modal visible={addWorkerModal} animationType="slide" transparent onRequestClose={() => setAddWorkerModal(false)}>
              <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>{t('projects.addWorkerToApartment')}</Text>
                  {[
                    { key: 'firstName', placeholder: t('workers.fields.firstName') },
                    { key: 'lastName', placeholder: t('workers.fields.lastName') },
                    { key: 'phone', placeholder: t('workers.fields.phone'), keyboardType: 'phone-pad' },
                    { key: 'role', placeholder: t('workers.fields.role') },
                    { key: 'dailyRate', placeholder: t('workers.fields.dailyRate'), keyboardType: 'numeric' },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder}
                      value={workerForm[f.key]}
                      onChangeText={v => setWorkerForm({ ...workerForm, [f.key]: v })}
                      keyboardType={f.keyboardType || 'default'} textAlign="right" />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={addWorkerToApartment}>
                      <Text style={styles.btnPrimaryText}>{t('workers.addWorker')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddWorkerModal(false)}>
                      <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}

        {/* Progress modal */}
        <Modal visible={progressModal} animationType="slide" transparent onRequestClose={() => setProgressModal(false)}>
          <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
            <View style={[styles.modal, { paddingBottom: 30 }]}>
              <Text style={styles.modalTitle}>{t('projects.updateProgress')}</Text>
              <TextInput style={styles.input} placeholderTextColor="#9a9a9a" placeholder="0-100" value={progressValue}
                onChangeText={setProgressValue} keyboardType="numeric" textAlign="right" />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnPrimary} onPress={updateApartmentProgress}>
                  <Text style={styles.btnPrimaryText}>{t('projects.update')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setProgressModal(false)}>
                  <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        {confirmModalJsx}
        {docViewerJsx}
      </View>
    );
  }

  // ── PROJECT DETAIL VIEW ─────────────────────────────────────────────────
  if (selectedProject) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <TouchableOpacity onPress={() => setSelectedProject(null)} style={styles.backBtn}>
            <Text style={styles.backBtnText}>→ {t('projects.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{selectedProject.name}</Text>
        </View>

        <View style={styles.tabRow}>
          {[['files', `📁 ${t('projects.tabs.files')}`], ['materials', `📦 ${t('nav.materials')}`], ['apartments', `🏠 ${t('projects.tabs.apartments')}`]].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.tab, activeTab === key && styles.tabActive]} onPress={() => setActiveTab(key)}>
              <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'files' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => uploadToProject(selectedProject.id, 'image')} disabled={uploading}>
                <Text style={styles.uploadBtnText}>{uploading ? t('photos.uploading') : `📸 ${t('nav.photos')}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fcebeb' }]} onPress={() => uploadToProject(selectedProject.id, 'pdf')} disabled={uploading}>
                <Text style={[styles.uploadBtnText, { color: '#a32d2d' }]}>📄 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => sendReport(selectedProject)}>
                <Text style={[styles.uploadBtnText, { color: '#185fa5' }]}>📲 {t('projects.report.button')}</Text>
              </TouchableOpacity>
            </View>
            {!!uploadError && <Text style={{ color: '#a32d2d', textAlign: 'center', padding: 8 }}>{uploadError}</Text>}
            {filesLoading ? <ActivityIndicator style={{ marginTop: 40 }} color="#1a6b4a" /> : renderFileGallery(projectFiles, false)}
          </View>
        )}

        {activeTab === 'materials' && (
          <View style={{ flex: 1 }}>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => setAddMaterialModal(true)}>
                <Text style={styles.uploadBtnText}>+ {t('materials.addMaterial')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {projectMaterials.map(m => renderMaterialCard(m, false))}
              {projectMaterials.length === 0 && (
                <View style={styles.empty}>
                  <Text style={styles.emptyIcon}>📦</Text>
                  <Text style={styles.emptyText}>{t('projects.noMaterialsForProject')}</Text>
                </View>
              )}
            </ScrollView>
            <Modal visible={addMaterialModal} animationType="slide" transparent onRequestClose={() => setAddMaterialModal(false)}>
              <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>{t('projects.addMaterialToProject')}</Text>
                  {[
                    { key: 'name', placeholder: t('materials.fields.name') },
                    { key: 'unit', placeholder: t('materials.fields.unit') },
                    { key: 'quantity', placeholder: t('invoices.fields.quantity'), keyboardType: 'numeric' },
                    { key: 'unitPrice', placeholder: t('materials.fields.unitPrice'), keyboardType: 'numeric' },
                    { key: 'supplier', placeholder: t('materials.fields.supplier') },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder} value={matForm[f.key]}
                      onChangeText={v => setMatForm({ ...matForm, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={addMaterial}>
                      <Text style={styles.btnPrimaryText}>{t('projects.add')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddMaterialModal(false)}>
                      <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
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
                <Text style={styles.uploadBtnText}>+ {t('projects.addApartment')}</Text>
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
                        <Text style={styles.pct}>{apt.progressPercent || 0}% {t('projects.done')}</Text>
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
                    <Text style={styles.emptyText}>{t('materials.noApartmentsForProject')}</Text>
                    <Text style={styles.emptySub}>{t('projects.addApartmentHint')}</Text>
                  </View>
                )}
              </ScrollView>
            )}
            <Modal visible={addApartmentModal} animationType="slide" transparent onRequestClose={() => setAddApartmentModal(false)}>
              <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
                <View style={styles.modal}>
                  <Text style={styles.modalTitle}>{t('projects.newApartment')}</Text>
                  {[
                    { key: 'name', placeholder: t('projects.fields.apartmentName') },
                    { key: 'number', placeholder: t('projects.fields.apartmentNumber') },
                    { key: 'description', placeholder: t('projects.fields.descriptionOptional') },
                  ].map(f => (
                    <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder} value={aptForm[f.key]}
                      onChangeText={v => setAptForm({ ...aptForm, [f.key]: v })} textAlign="right" />
                  ))}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={createApartment}>
                      <Text style={styles.btnPrimaryText}>{t('projects.addApartment')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddApartmentModal(false)}>
                      <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}
        {confirmModalJsx}
        {docViewerJsx}
      </View>
    );
  }

  // ── PROJECTS LIST ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>{t('nav.projects')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 44 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProjects(); }} />}>
        {list.map(p => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: (statusColor[p.status] || '#888') + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor[p.status] || '#888' }]}>{STATUS_KEY[p.status] ? t(STATUS_KEY[p.status]) : p.status}</Text>
              </View>
              <Text style={styles.projName}>{p.name}</Text>
            </View>
            <Text style={styles.client}>{t('projects.clientLine', { name: p.clientName })}</Text>
            {!!p.city && <Text style={styles.meta}>📍 {p.city}{p.address ? ` · ${p.address}` : ''}</Text>}
            {p.budget > 0 && <Text style={styles.meta}>💰 ₪{Number(p.budget).toLocaleString()}</Text>}
            {!!p.endDate && (() => {
              const due = new Date(p.endDate);
              const today = new Date(); today.setHours(0,0,0,0);
              const overdue = due < today && p.status !== 'completed';
              const daysLeft = Math.ceil((due - today) / 86400000);
              return (
                <Text style={[styles.meta, overdue && { color: '#a32d2d', fontWeight: '600' }]}>
                  {overdue
                    ? `⚠ ${t('projects.overdueSince', { date: due.toLocaleDateString(dateLocale) })}`
                    : `📅 ${t('projects.dueOn', { date: due.toLocaleDateString(dateLocale) })}${daysLeft <= 7 ? ` ${t('projects.daysLeft', { days: daysLeft })}` : ''}`}
                </Text>
              );
            })()}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${p.progressPercent}%`, backgroundColor: statusColor[p.status] || '#1a6b4a' }]} />
            </View>
            <Text style={styles.pct}>{p.progressPercent}% {t('projects.done')}</Text>
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => { setSelectedProject(p); setActiveTab('files'); }}>
                <Text style={[styles.actionBtnText, { color: '#185fa5' }]}>📁 {t('projects.tabs.files')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#faeeda' }]} onPress={() => { setSelectedProject(p); setActiveTab('materials'); }}>
                <Text style={[styles.actionBtnText, { color: '#ba7517' }]}>📦 {t('nav.materials')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => { setSelectedProject(p); setActiveTab('apartments'); }}>
                <Text style={[styles.actionBtnText, { color: '#1a6b4a' }]}>🏠 {t('projects.tabs.apartments')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fcebeb' }]} onPress={() => deleteProject(p.id)}>
                <Text style={[styles.actionBtnText, { color: '#a32d2d' }]}>🗑 {t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {list.length === 0 && <Text style={styles.emptyList}>{t('projects.empty')}</Text>}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('projects.newProject')}</Text>
            <ScrollView>
              {[
                { key: 'name', placeholder: t('projects.fields.name') },
                { key: 'clientName', placeholder: t('invoices.fields.clientName') },
                { key: 'clientPhone', placeholder: t('invoices.fields.clientPhone'), keyboardType: 'phone-pad' },
                { key: 'city', placeholder: t('projects.fields.city') },
                { key: 'address', placeholder: t('projects.fields.address') },
                { key: 'budget', placeholder: t('projects.fields.budget'), keyboardType: 'numeric' },
                { key: 'apartmentCount', placeholder: t('projects.fields.apartmentCount'), keyboardType: 'numeric' },
                { key: 'endDate', placeholder: t('projects.fields.endDate') },
              ].map(f => (
                <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder} value={form[f.key]}
                  onChangeText={v => setForm({ ...form, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
              ))}
            </ScrollView>
            {projectError ? <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{projectError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnPrimary, projectSubmitting && { opacity: 0.6 }]} onPress={createProject} disabled={projectSubmitting}>
                <Text style={styles.btnPrimaryText}>{projectSubmitting ? t('projects.creating') : t('projects.createProject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setModalVisible(false); setProjectError(''); }}>
                <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {confirmModalJsx}
      {docViewerJsx}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a' },
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
