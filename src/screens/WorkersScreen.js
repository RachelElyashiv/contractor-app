import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { apartments as apartmentsApi, projects as projectsApi, workers } from '../services/api';

export default function WorkersScreen() {
  const [list, setList] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pendingDeleteFn = useRef(null);

  // Filter state
  const [projectsList, setProjectsList] = useState([]);
  const [apartmentsList, setApartmentsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [showProjectFilter, setShowProjectFilter] = useState(false);
  const [showApartmentFilter, setShowApartmentFilter] = useState(false);

  useEffect(() => { loadData(); loadProjects(); }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadApartments(selectedProjectId);
      setSelectedApartmentId(null);
    } else {
      setApartmentsList([]);
      setSelectedApartmentId(null);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadAttendance();
  }, [selectedProjectId, selectedApartmentId]);

  async function loadProjects() {
    try {
      const res = await projectsApi.getAll();
      setProjectsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log(e); }
  }

  async function loadApartments(projectId) {
    try {
      const res = await apartmentsApi.getByProject(projectId);
      setApartmentsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log(e); }
  }

  async function loadAttendance() {
    try {
      const res = await workers.getToday(selectedProjectId, selectedApartmentId);
      setAttendance(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log(e); }
  }

  async function loadData() {
    try {
      const [w, a] = await Promise.all([workers.getAll(), workers.getToday()]);
      setList(Array.isArray(w.data) ? w.data : []);
      setAttendance(Array.isArray(a.data) ? a.data : []);
    } catch (e) { console.log('Workers error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function createWorker() {
    if (!form.firstName || !form.lastName) return Alert.alert('שגיאה', 'מלא שם פרטי ומשפחה');
    try {
      await workers.create({ ...form, dailyRate: Number(form.dailyRate) || 0 });
      setModalVisible(false);
      setForm({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
      loadData();
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו להוסיף עובד'); }
  }

  async function markPresent(workerId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await workers.markAttendance(workerId, {
        date: today,
        status: 'present',
        checkIn: new Date().toTimeString().slice(0, 5),
        hoursWorked: 8,
        projectId: selectedProjectId || undefined,
        apartmentId: selectedApartmentId || undefined,
      });
      loadAttendance();
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לרשום נוכחות'); }
  }

  async function removeAttendance(workerId) {
    const w = attendance.find(a => a.id === workerId);
    if (!w?.todayAttendance) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await workers.markAttendance(workerId, {
        date: today,
        status: 'absent',
        projectId: selectedProjectId || undefined,
        apartmentId: selectedApartmentId || undefined,
      });
      loadAttendance();
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לעדכן'); }
  }

  function deleteWorker(workerId) {
    pendingDeleteFn.current = async () => {
      try { await workers.delete(workerId); loadData(); }
      catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקת עובד'); }
    };
    setConfirmDelete({ message: 'האם למחוק עובד זה לצמיתות?' });
  }

  const selectedProject = projectsList.find(p => p.id === selectedProjectId);
  const selectedApartment = apartmentsList.find(a => a.id === selectedApartmentId);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>עובדים</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ הוסף</Text>
        </TouchableOpacity>
      </View>

      {/* Filter row */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterBtn, selectedProjectId && styles.filterBtnActive]} onPress={() => setShowProjectFilter(true)}>
          <Text style={[styles.filterBtnText, selectedProjectId && styles.filterBtnTextActive]} numberOfLines={1}>
            {selectedProject ? `📁 ${selectedProject.name}` : '📁 כל הפרויקטים'}
          </Text>
        </TouchableOpacity>
        {selectedProjectId && (
          <TouchableOpacity style={[styles.filterBtn, selectedApartmentId && styles.filterBtnActive]} onPress={() => setShowApartmentFilter(true)}>
            <Text style={[styles.filterBtnText, selectedApartmentId && styles.filterBtnTextActive]} numberOfLines={1}>
              {selectedApartment ? `🏠 ${selectedApartment.name}` : '🏠 כל הדירות'}
            </Text>
          </TouchableOpacity>
        )}
        {selectedProjectId && (
          <TouchableOpacity style={styles.clearBtn} onPress={() => { setSelectedProjectId(null); setSelectedApartmentId(null); }}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {(selectedProjectId || selectedApartmentId) && (
        <View style={styles.filterInfo}>
          <Text style={styles.filterInfoText}>
            מציג נוכחות {selectedApartment ? `בדירה: ${selectedApartment.name}` : selectedProject ? `בפרויקט: ${selectedProject.name}` : ''}
          </Text>
        </View>
      )}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        <Text style={styles.sectionTitle}>נוכחות היום</Text>
        {attendance.map(w => {
          const present = w.todayAttendance?.status === 'present';
          return (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: present ? '#e8f5ef' : '#f5f5f5' }]}>
                  <Text style={[styles.avatarText, { color: present ? '#1a6b4a' : '#888' }]}>
                    {w.firstName?.[0]}{w.lastName?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.workerName}>{w.firstName} {w.lastName}</Text>
                  <Text style={styles.workerRole}>{w.role || 'פועל'}</Text>
                  {w.dailyRate > 0 && <Text style={styles.workerRate}>₪{w.dailyRate} ליום</Text>}
                  {present && w.todayAttendance?.projectId && (
                    <Text style={styles.attendanceDetail}>
                      📁 {projectsList.find(p => p.id === w.todayAttendance.projectId)?.name || ''}
                      {w.todayAttendance?.apartmentId ? ` · 🏠 ${apartmentsList.find(a => a.id === w.todayAttendance.apartmentId)?.name || ''}` : ''}
                    </Text>
                  )}
                </View>
                {present ? (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={styles.presentBadge}><Text style={styles.presentText}>נוכח ✓</Text></View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeAttendance(w.id)}>
                      <Text style={styles.removeBtnText}>הסר נוכחות</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity style={styles.markBtn} onPress={() => markPresent(w.id)}>
                      <Text style={styles.markBtnText}>סמן נוכח</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteWorkerBtn} onPress={() => deleteWorker(w.id)}>
                      <Text style={styles.deleteWorkerText}>🗑 מחק</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {attendance.length === 0 && <Text style={styles.empty}>אין עובדים עדיין. לחץ + הוסף.</Text>}
      </ScrollView>

      {/* Project filter modal */}
      <Modal visible={showProjectFilter} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>בחר פרויקט</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setSelectedProjectId(null); setShowProjectFilter(false); }}>
                <Text style={styles.filterOptionText}>כל הפרויקטים</Text>
              </TouchableOpacity>
              {projectsList.map(p => (
                <TouchableOpacity key={p.id} style={[styles.filterOption, selectedProjectId === p.id && styles.filterOptionActive]}
                  onPress={() => { setSelectedProjectId(p.id); setShowProjectFilter(false); }}>
                  <Text style={[styles.filterOptionText, selectedProjectId === p.id && { color: '#1a6b4a', fontWeight: '600' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowProjectFilter(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Apartment filter modal */}
      <Modal visible={showApartmentFilter} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>בחר דירה</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setSelectedApartmentId(null); setShowApartmentFilter(false); }}>
                <Text style={styles.filterOptionText}>כל הדירות</Text>
              </TouchableOpacity>
              {apartmentsList.map(a => (
                <TouchableOpacity key={a.id} style={[styles.filterOption, selectedApartmentId === a.id && styles.filterOptionActive]}
                  onPress={() => { setSelectedApartmentId(a.id); setShowApartmentFilter(false); }}>
                  <Text style={[styles.filterOptionText, selectedApartmentId === a.id && { color: '#1a6b4a', fontWeight: '600' }]}>
                    🏠 {a.name}{a.number ? ` (${a.number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {apartmentsList.length === 0 && <Text style={styles.empty}>אין דירות לפרויקט זה</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowApartmentFilter(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add worker modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>עובד חדש</Text>
            {[
              { key: 'firstName', placeholder: 'שם פרטי *' },
              { key: 'lastName', placeholder: 'שם משפחה *' },
              { key: 'phone', placeholder: 'טלפון', keyboardType: 'phone-pad' },
              { key: 'role', placeholder: 'תפקיד (בנאי, חשמלאי...)' },
              { key: 'dailyRate', placeholder: 'שכר יומי ₪', keyboardType: 'numeric' },
            ].map(f => (
              <TextInput key={f.key} style={styles.input} placeholder={f.placeholder} value={form[f.key]}
                onChangeText={v => setForm({ ...form, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
            ))}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnPrimary} onPress={createWorker}>
                <Text style={styles.btnPrimaryText}>הוסף עובד</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => setModalVisible(false)}>
                <Text style={styles.btnSecondaryText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm delete dialog */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 14 },
  filterRow: { flexDirection: 'row', padding: 10, gap: 8, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  filterBtn: { flex: 1, backgroundColor: '#f0f4f0', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, borderColor: '#ddd' },
  filterBtnActive: { backgroundColor: '#e8f5ef', borderColor: '#1a6b4a' },
  filterBtnText: { fontSize: 12, color: '#666', textAlign: 'center' },
  filterBtnTextActive: { color: '#1a6b4a', fontWeight: '600' },
  clearBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  clearBtnText: { color: '#888', fontSize: 14 },
  filterInfo: { backgroundColor: '#e8f5ef', paddingHorizontal: 14, paddingVertical: 6 },
  filterInfoText: { fontSize: 12, color: '#1a6b4a', textAlign: 'right' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', margin: 12, textAlign: 'right' },
  card: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  avatarText: { fontSize: 15, fontWeight: '600' },
  workerName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', textAlign: 'right' },
  workerRole: { fontSize: 12, color: '#888', textAlign: 'right' },
  workerRate: { fontSize: 12, color: '#1a6b4a', textAlign: 'right' },
  attendanceDetail: { fontSize: 11, color: '#888', textAlign: 'right', marginTop: 2 },
  presentBadge: { backgroundColor: '#e8f5ef', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  presentText: { color: '#1a6b4a', fontSize: 12, fontWeight: '500' },
  markBtn: { backgroundColor: '#1a6b4a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  markBtnText: { color: '#fff', fontSize: 12 },
  removeBtn: { backgroundColor: '#fcebeb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  removeBtnText: { color: '#a32d2d', fontSize: 11 },
  deleteWorkerBtn: { backgroundColor: '#f5f5f5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  deleteWorkerText: { color: '#888', fontSize: 11 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
  filterOption: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  filterOptionActive: { backgroundColor: '#e8f5ef' },
  filterOptionText: { fontSize: 15, color: '#333', textAlign: 'right' },
});
