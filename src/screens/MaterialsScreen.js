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
import { apartments as apartmentsApi, materials, projects as projectsApi } from '../services/api';

export default function MaterialsScreen({ pendingCreate, onClearPendingCreate } = {}) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (pendingCreate) { setModalVisible(true); onClearPendingCreate?.(); }
  }, [pendingCreate]);
  const [form, setForm] = useState({ name: '', unit: 'יחידות', quantity: '', minQuantity: '', unitPrice: '', supplier: '' });
  // Assign material to a project + apartment (optional)
  const [projectsList, setProjectsList] = useState([]);
  const [matApartments, setMatApartments] = useState([]);
  const [matProjectId, setMatProjectId] = useState(null);
  const [matApartmentId, setMatApartmentId] = useState(null);
  const [showMatProject, setShowMatProject] = useState(false);
  const [showMatApartment, setShowMatApartment] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pendingDeleteFn = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { loadData(); loadProjects(); }, []);

  // Android back button: close any open popup before leaving the screen
  useEffect(() => {
    const onBack = () => {
      if (confirmDelete) { setConfirmDelete(null); return true; }
      if (showMatApartment) { setShowMatApartment(false); return true; }
      if (showMatProject) { setShowMatProject(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [confirmDelete, showMatApartment, showMatProject, modalVisible]);

  // Load apartments for the material form when a project is chosen
  useEffect(() => {
    if (matProjectId) {
      apartmentsApi.getByProject(matProjectId)
        .then(res => {
          const arr = Array.isArray(res.data) ? res.data : [];
          arr.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
          setMatApartments(arr);
        })
        .catch(() => setMatApartments([]));
      setMatApartmentId(null);
    } else {
      setMatApartments([]);
      setMatApartmentId(null);
    }
  }, [matProjectId]);

  async function loadProjects() {
    try {
      const res = await projectsApi.getAll();
      setProjectsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log('Projects error:', e); }
  }

  async function loadData() {
    try {
      const res = await materials.getAll();
      setList(res.data);
    } catch (e) {
      console.log('Materials error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function createMaterial() {
    if (!form.name) { setFormError('חובה למלא שם חומר'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      await materials.create({
        ...form,
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 0,
        unitPrice: Number(form.unitPrice) || 0,
        ...(matProjectId ? { projectId: matProjectId } : {}),
        ...(matApartmentId ? { apartmentId: matApartmentId } : {}),
      });
      setModalVisible(false);
      setForm({ name: '', unit: 'יחידות', quantity: '', minQuantity: '', unitPrice: '', supplier: '' });
      setMatProjectId(null);
      setMatApartmentId(null);
      loadData();
    } catch (e) {
      setFormError('שגיאה בשרת — נסי שוב');
    } finally {
      setSubmitting(false);
    }
  }

  async function adjustStock(id, delta) {
    try {
      await materials.adjust(id, delta);
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן מלאי');
    }
  }

  function deleteMaterial(id) {
    pendingDeleteFn.current = async () => {
      try { await materials.delete(id); loadData(); }
      catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקת חומר'); }
    };
    setConfirmDelete({ message: 'האם למחוק חומר זה?' });
  }

  const matProject = projectsList.find(p => p.id === matProjectId);
  const matApartment = matApartments.find(a => a.id === matApartmentId);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>חומרים ומלאי</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ הוסף</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {list.map(m => {
          const isLow = Number(m.quantity) <= Number(m.minQuantity);
          return (
            <View key={m.id} style={[styles.card, isLow && styles.cardLow]}>
              <View style={styles.cardTop}>
                <Text style={styles.matName}>{m.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isLow && <Text style={styles.lowBadge}>⚠️ מלאי נמוך</Text>}
                  <TouchableOpacity onPress={() => deleteMaterial(m.id)}>
                    <Text style={{ fontSize: 18, color: '#ccc' }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {!!m.supplier && <Text style={styles.meta}>ספק: {m.supplier}</Text>}
              {m.unitPrice > 0 && <Text style={styles.meta}>מחיר: ₪{m.unitPrice} ל{m.unit}</Text>}
              <View style={styles.stockRow}>
                <TouchableOpacity style={styles.stockBtn} onPress={() => adjustStock(m.id, -1)}>
                  <Text style={styles.stockBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.stockVal, isLow && { color: '#a32d2d' }]}>
                  {m.quantity} {m.unit}
                </Text>
                <TouchableOpacity style={[styles.stockBtn, { backgroundColor: '#e8f5ef' }]} onPress={() => adjustStock(m.id, 1)}>
                  <Text style={[styles.stockBtnText, { color: '#1a6b4a' }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {list.length === 0 && <Text style={styles.empty}>אין חומרים עדיין. לחץ + הוסף.</Text>}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>חומר חדש</Text>
            <ScrollView>
              {[
                { key: 'name', placeholder: 'שם חומר *' },
                { key: 'unit', placeholder: 'יחידה (שקים, מטרים...)' },
                { key: 'quantity', placeholder: 'כמות במלאי', keyboardType: 'numeric' },
                { key: 'minQuantity', placeholder: 'כמות מינימום להתראה', keyboardType: 'numeric' },
                { key: 'unitPrice', placeholder: 'מחיר ליחידה ₪', keyboardType: 'numeric' },
                { key: 'supplier', placeholder: 'ספק' },
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

              {/* Assign to project + apartment (optional) */}
              <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowMatProject(true)}>
                <Text style={styles.selectorText}>{matProject ? `📁 ${matProject.name}` : '📁 שייך לפרויקט (לא חובה)'}</Text>
              </TouchableOpacity>
              {matProjectId ? (
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowMatApartment(true)}>
                  <Text style={styles.selectorText}>{matApartment ? `🏠 ${matApartment.name}` : '🏠 שייך לדירה (לא חובה)'}</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
            {formError ? <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnPrimary, submitting && { opacity: 0.6 }]} onPress={createMaterial} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>{submitting ? 'שולח...' : 'הוסף חומר'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setModalVisible(false); setFormError(''); }}>
                <Text style={styles.btnSecondaryText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pick project for material */}
      <Modal visible={showMatProject} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>שייך לפרויקט</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setMatProjectId(null); setShowMatProject(false); }}>
                <Text style={styles.filterOptionText}>ללא פרויקט</Text>
              </TouchableOpacity>
              {projectsList.map(p => (
                <TouchableOpacity key={p.id} style={[styles.filterOption, matProjectId === p.id && styles.filterOptionActive]}
                  onPress={() => { setMatProjectId(p.id); setShowMatProject(false); }}>
                  <Text style={[styles.filterOptionText, matProjectId === p.id && { color: '#1a6b4a', fontWeight: '600' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              {projectsList.length === 0 && <Text style={styles.empty}>אין פרויקטים עדיין</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowMatProject(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pick apartment for material */}
      <Modal visible={showMatApartment} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>שייך לדירה</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setMatApartmentId(null); setShowMatApartment(false); }}>
                <Text style={styles.filterOptionText}>ללא דירה</Text>
              </TouchableOpacity>
              {matApartments.map(a => (
                <TouchableOpacity key={a.id} style={[styles.filterOption, matApartmentId === a.id && styles.filterOptionActive]}
                  onPress={() => { setMatApartmentId(a.id); setShowMatApartment(false); }}>
                  <Text style={[styles.filterOptionText, matApartmentId === a.id && { color: '#1a6b4a', fontWeight: '600' }]}>
                    🏠 {a.name}{a.number ? ` (${a.number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {matApartments.length === 0 && <Text style={styles.empty}>אין דירות לפרויקט זה</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowMatApartment(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  card: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardLow: { borderRightWidth: 4, borderRightColor: '#a32d2d' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  matName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  lowBadge: { fontSize: 12, color: '#a32d2d' },
  meta: { fontSize: 12, color: '#888', textAlign: 'right', marginBottom: 2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 12 },
  stockBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fcebeb', justifyContent: 'center', alignItems: 'center' },
  stockBtnText: { fontSize: 20, color: '#a32d2d', fontWeight: '600' },
  stockVal: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', minWidth: 80, textAlign: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  selectorBtn: { borderWidth: 0.5, borderColor: '#1a6b4a', borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: '#e8f5ef' },
  selectorText: { fontSize: 15, color: '#1a6b4a', textAlign: 'right' },
  filterOption: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  filterOptionActive: { backgroundColor: '#e8f5ef' },
  filterOptionText: { fontSize: 15, color: '#333', textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});