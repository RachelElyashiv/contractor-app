import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { useTopInset } from '../hooks/useTopInset';
import { useLanguage } from '../i18n/LanguageContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

export default function WorkersScreen({ pendingCreate, onClearPendingCreate } = {}) {
  const { t } = useLanguage();
  const topInset = useTopInset();
  const keyboardHeight = useKeyboardHeight();
  const [list, setList] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (pendingCreate) { setModalVisible(true); onClearPendingCreate?.(); }
  }, [pendingCreate]);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
  const [workerError, setWorkerError] = useState('');
  const [workerSubmitting, setWorkerSubmitting] = useState(false);
  // Assign-to-project/apartment state for the "add worker" form
  const [formProjectId, setFormProjectId] = useState(null);
  const [formApartmentId, setFormApartmentId] = useState(null);
  const [formApartments, setFormApartments] = useState([]);
  const [showFormProject, setShowFormProject] = useState(false);
  const [showFormApartment, setShowFormApartment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pendingDeleteFn = useRef(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [salaryReport, setSalaryReport] = useState([]);
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());

  // Filter state
  const [projectsList, setProjectsList] = useState([]);
  const [apartmentsList, setApartmentsList] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState(null);
  const [showProjectFilter, setShowProjectFilter] = useState(false);
  const [showApartmentFilter, setShowApartmentFilter] = useState(false);

  useEffect(() => { loadData(); loadProjects(); }, []);
  useEffect(() => { loadSalaryReport(); }, [salaryMonth, salaryYear]);

  // Android back button: close any open popup before leaving the screen
  useEffect(() => {
    const onBack = () => {
      if (confirmDelete) { setConfirmDelete(null); return true; }
      if (showFormApartment) { setShowFormApartment(false); return true; }
      if (showFormProject) { setShowFormProject(false); return true; }
      if (showApartmentFilter) { setShowApartmentFilter(false); return true; }
      if (showProjectFilter) { setShowProjectFilter(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [confirmDelete, showFormApartment, showFormProject, showApartmentFilter, showProjectFilter, modalVisible]);

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

  // Load apartments for the "add worker" form when a project is chosen
  useEffect(() => {
    if (formProjectId) {
      apartmentsApi.getByProject(formProjectId)
        .then(res => {
          const arr = Array.isArray(res.data) ? res.data : [];
          arr.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
          setFormApartments(arr);
        })
        .catch(() => setFormApartments([]));
      setFormApartmentId(null);
    } else {
      setFormApartments([]);
      setFormApartmentId(null);
    }
  }, [formProjectId]);

  async function loadSalaryReport() {
    try {
      const res = await workers.getMonthly(salaryYear, salaryMonth);
      setSalaryReport(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log('Salary error:', e); }
  }

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
    if (!form.firstName || !form.lastName) { setWorkerError(t('workers.errors.nameRequired')); return; }
    setWorkerError('');
    setWorkerSubmitting(true);
    try {
      const res = await workers.create({ ...form, dailyRate: Number(form.dailyRate) || 0 });
      const newId = res?.data?.id;
      // If a project was chosen, mark the new worker present there today (this links them to project/apartment)
      if (newId && formProjectId) {
        const today = new Date().toISOString().split('T')[0];
        await workers.markAttendance(newId, {
          date: today,
          status: 'present',
          checkIn: new Date().toTimeString().slice(0, 5),
          hoursWorked: 8,
          projectId: formProjectId,
          apartmentId: formApartmentId || undefined,
        });
      }
      setModalVisible(false);
      setWorkerError('');
      setForm({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
      setFormProjectId(null);
      setFormApartmentId(null);
      loadData();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (status === 401) setWorkerError(t('workers.errors.sessionExpired'));
      else setWorkerError(msg ? String(msg) : t('workers.errors.serverError'));
    } finally {
      setWorkerSubmitting(false);
    }
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
    } catch (e) { Alert.alert(t('common.error'), t('workers.errors.attendanceFailed')); }
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
    } catch (e) { Alert.alert(t('common.error'), t('workers.errors.updateFailed')); }
  }

  function deleteWorker(workerId) {
    pendingDeleteFn.current = async () => {
      try { await workers.delete(workerId); loadData(); }
      catch (e) { Alert.alert(t('common.error'), t('workers.errors.deleteFailed')); }
    };
    setConfirmDelete({ message: t('workers.confirmDelete') });
  }

  const selectedProject = projectsList.find(p => p.id === selectedProjectId);
  const selectedApartment = apartmentsList.find(a => a.id === selectedApartmentId);
  const formProject = projectsList.find(p => p.id === formProjectId);
  const formApartment = formApartments.find(a => a.id === formApartmentId);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>{t('workers.title')}</Text>
      </View>
      <View style={styles.fabWrap} pointerEvents="box-none">
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' }}>
        <TouchableOpacity style={[styles.tab, activeTab === 'attendance' && styles.tabActive]} onPress={() => setActiveTab('attendance')}>
          <Text style={[styles.tabText, activeTab === 'attendance' && styles.tabTextActive]}>✅ {t('workers.tabs.attendance')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'salary' && styles.tabActive]} onPress={() => setActiveTab('salary')}>
          <Text style={[styles.tabText, activeTab === 'salary' && styles.tabTextActive]}>💰 {t('workers.tabs.salary')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter row */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterBtn, selectedProjectId && styles.filterBtnActive]} onPress={() => setShowProjectFilter(true)}>
          <Text style={[styles.filterBtnText, selectedProjectId && styles.filterBtnTextActive]} numberOfLines={1}>
            {selectedProject ? `📁 ${selectedProject.name}` : `📁 ${t('workers.allProjects')}`}
          </Text>
        </TouchableOpacity>
        {selectedProjectId && (
          <TouchableOpacity style={[styles.filterBtn, selectedApartmentId && styles.filterBtnActive]} onPress={() => setShowApartmentFilter(true)}>
            <Text style={[styles.filterBtnText, selectedApartmentId && styles.filterBtnTextActive]} numberOfLines={1}>
              {selectedApartment ? `🏠 ${selectedApartment.name}` : `🏠 ${t('workers.allApartments')}`}
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
            {t('workers.showingAttendance')} {selectedApartment ? t('workers.inApartment', { name: selectedApartment.name }) : selectedProject ? t('workers.inProject', { name: selectedProject.name }) : ''}
          </Text>
        </View>
      )}

      {activeTab === 'salary' && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSalaryReport} />}>
          {/* Month picker */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 12 }}>
            <TouchableOpacity onPress={() => { const d = new Date(salaryYear, salaryMonth - 2); setSalaryMonth(d.getMonth() + 1); setSalaryYear(d.getFullYear()); }}
              style={{ padding: 8, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
              <Text style={{ fontSize: 18 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#1a1a1a' }}>
              {new Date(salaryYear, salaryMonth - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => { const d = new Date(salaryYear, salaryMonth); setSalaryMonth(d.getMonth() + 1); setSalaryYear(d.getFullYear()); }}
              style={{ padding: 8, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
              <Text style={{ fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Total */}
          {salaryReport.length > 0 && (
            <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: '#1a6b4a', borderRadius: 12, padding: 16 }}>
              <Text style={{ color: '#fff', fontSize: 13, textAlign: 'right' }}>{t('workers.totalMonthlySalary')}</Text>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: 'bold', textAlign: 'right' }}>
                ₪{salaryReport.reduce((s, r) => s + Number(r.totalPay), 0).toLocaleString()}
              </Text>
            </View>
          )}

          {salaryReport.map(r => (
            <View key={r.worker.id} style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <View style={{ alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a6b4a' }}>₪{Number(r.totalPay).toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: '#888' }}>{t('workers.daysRate', { days: r.daysPresent, rate: Number(r.worker.dailyRate).toLocaleString() })}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.workerName}>{r.worker.firstName} {r.worker.lastName}</Text>
                <Text style={styles.workerRole}>{r.worker.role || t('workers.defaultRole')}</Text>
                <Text style={{ fontSize: 11, color: '#aaa' }}>{t('workers.hours', { hours: r.totalHours })}</Text>
              </View>
            </View>
          ))}
          {salaryReport.length === 0 && <Text style={styles.empty}>{t('workers.noSalaryData')}</Text>}
        </ScrollView>
      )}

      {activeTab === 'attendance' && (
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        <Text style={styles.sectionTitle}>{t('workers.attendanceToday')}</Text>
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
                  <Text style={styles.workerRole}>{w.role || t('workers.defaultRole')}</Text>
                  {w.dailyRate > 0 && <Text style={styles.workerRate}>{t('workers.perDay', { rate: w.dailyRate })}</Text>}
                  {present && w.todayAttendance?.projectId && (
                    <Text style={styles.attendanceDetail}>
                      📁 {projectsList.find(p => p.id === w.todayAttendance.projectId)?.name || ''}
                      {w.todayAttendance?.apartmentId ? ` · 🏠 ${apartmentsList.find(a => a.id === w.todayAttendance.apartmentId)?.name || ''}` : ''}
                    </Text>
                  )}
                </View>
                {present ? (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={styles.presentBadge}><Text style={styles.presentText}>{t('workers.present')} ✓</Text></View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeAttendance(w.id)}>
                      <Text style={styles.removeBtnText}>{t('workers.removeAttendance')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity style={styles.markBtn} onPress={() => markPresent(w.id)}>
                      <Text style={styles.markBtnText}>{t('workers.markPresent')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteWorkerBtn} onPress={() => deleteWorker(w.id)}>
                      <Text style={styles.deleteWorkerText}>🗑 {t('common.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
        {attendance.length === 0 && <Text style={styles.empty}>{t('workers.empty')}</Text>}
      </ScrollView>
      )}

      {/* Project filter modal */}
      <Modal visible={showProjectFilter} animationType="slide" transparent onRequestClose={() => setShowProjectFilter(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('workers.chooseProject')}</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setSelectedProjectId(null); setShowProjectFilter(false); }}>
                <Text style={styles.filterOptionText}>{t('workers.allProjects')}</Text>
              </TouchableOpacity>
              {projectsList.map(p => (
                <TouchableOpacity key={p.id} style={[styles.filterOption, selectedProjectId === p.id && styles.filterOptionActive]}
                  onPress={() => { setSelectedProjectId(p.id); setShowProjectFilter(false); }}>
                  <Text style={[styles.filterOptionText, selectedProjectId === p.id && { color: '#1a6b4a', fontWeight: '600' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowProjectFilter(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Apartment filter modal */}
      <Modal visible={showApartmentFilter} animationType="slide" transparent onRequestClose={() => setShowApartmentFilter(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('workers.chooseApartment')}</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setSelectedApartmentId(null); setShowApartmentFilter(false); }}>
                <Text style={styles.filterOptionText}>{t('workers.allApartments')}</Text>
              </TouchableOpacity>
              {apartmentsList.map(a => (
                <TouchableOpacity key={a.id} style={[styles.filterOption, selectedApartmentId === a.id && styles.filterOptionActive]}
                  onPress={() => { setSelectedApartmentId(a.id); setShowApartmentFilter(false); }}>
                  <Text style={[styles.filterOptionText, selectedApartmentId === a.id && { color: '#1a6b4a', fontWeight: '600' }]}>
                    🏠 {a.name}{a.number ? ` (${a.number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {apartmentsList.length === 0 && <Text style={styles.empty}>{t('workers.noApartmentsForProject')}</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowApartmentFilter(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add worker modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('workers.newWorker')}</Text>
            {[
              { key: 'firstName', placeholder: t('workers.fields.firstName') },
              { key: 'lastName', placeholder: t('workers.fields.lastName') },
              { key: 'phone', placeholder: t('workers.fields.phone'), keyboardType: 'phone-pad' },
              { key: 'role', placeholder: t('workers.fields.role') },
              { key: 'dailyRate', placeholder: t('workers.fields.dailyRate'), keyboardType: 'numeric' },
            ].map(f => (
              <TextInput key={f.key} style={styles.input} placeholderTextColor="#9a9a9a" placeholder={f.placeholder} value={form[f.key]}
                onChangeText={v => setForm({ ...form, [f.key]: v })} keyboardType={f.keyboardType || 'default'} textAlign="right" />
            ))}

            {/* Assign to project + apartment (optional) */}
            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowFormProject(true)}>
              <Text style={styles.selectorText}>{formProject ? `📁 ${formProject.name}` : `📁 ${t('workers.assignProjectPlaceholder')}`}</Text>
            </TouchableOpacity>
            {formProjectId ? (
              <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowFormApartment(true)}>
                <Text style={styles.selectorText}>{formApartment ? `🏠 ${formApartment.name}` : `🏠 ${t('workers.assignApartmentPlaceholder')}`}</Text>
              </TouchableOpacity>
            ) : null}

            {workerError ? <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{workerError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnPrimary, workerSubmitting && { opacity: 0.6 }]} onPress={createWorker} disabled={workerSubmitting}>
                <Text style={styles.btnPrimaryText}>{workerSubmitting ? t('workers.adding') : t('workers.addWorker')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setModalVisible(false); setWorkerError(''); }}>
                <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Form: pick project for new worker */}
      <Modal visible={showFormProject} animationType="slide" transparent onRequestClose={() => setShowFormProject(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('workers.assignProject')}</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setFormProjectId(null); setShowFormProject(false); }}>
                <Text style={styles.filterOptionText}>{t('workers.noProject')}</Text>
              </TouchableOpacity>
              {projectsList.map(p => (
                <TouchableOpacity key={p.id} style={[styles.filterOption, formProjectId === p.id && styles.filterOptionActive]}
                  onPress={() => { setFormProjectId(p.id); setShowFormProject(false); }}>
                  <Text style={[styles.filterOptionText, formProjectId === p.id && { color: '#1a6b4a', fontWeight: '600' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              {projectsList.length === 0 && <Text style={styles.empty}>{t('workers.noProjectsYet')}</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowFormProject(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Form: pick apartment for new worker */}
      <Modal visible={showFormApartment} animationType="slide" transparent onRequestClose={() => setShowFormApartment(false)}>
        <View style={[styles.overlay, { paddingBottom: keyboardHeight }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('workers.assignApartment')}</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setFormApartmentId(null); setShowFormApartment(false); }}>
                <Text style={styles.filterOptionText}>{t('workers.noApartment')}</Text>
              </TouchableOpacity>
              {formApartments.map(a => (
                <TouchableOpacity key={a.id} style={[styles.filterOption, formApartmentId === a.id && styles.filterOptionActive]}
                  onPress={() => { setFormApartmentId(a.id); setShowFormApartment(false); }}>
                  <Text style={[styles.filterOptionText, formApartmentId === a.id && { color: '#1a6b4a', fontWeight: '600' }]}>
                    🏠 {a.name}{a.number ? ` (${a.number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {formApartments.length === 0 && <Text style={styles.empty}>{t('workers.noApartmentsForProject')}</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowFormApartment(false)}>
              <Text style={styles.btnSecondaryText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm delete dialog */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  fabWrap: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', zIndex: 10 },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1a6b4a', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabText: { color: '#fff', fontSize: 34, lineHeight: 38, fontWeight: '300' },
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
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a' },
  selectorBtn: { borderWidth: 0.5, borderColor: '#1a6b4a', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#e8f5ef' },
  selectorText: { fontSize: 15, color: '#1a6b4a', textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
  filterOption: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  filterOptionActive: { backgroundColor: '#e8f5ef' },
  filterOptionText: { fontSize: 15, color: '#333', textAlign: 'right' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a6b4a' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#1a6b4a', fontWeight: '600' },
});
