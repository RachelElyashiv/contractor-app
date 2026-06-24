import { useEffect, useState } from 'react';
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
import { materials } from '../services/api';

export default function MaterialsScreen() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'יחידות', quantity: '', minQuantity: '', unitPrice: '', supplier: '' });

  useEffect(() => { loadData(); }, []);

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
    if (!form.name) return Alert.alert('שגיאה', 'מלא שם חומר');
    try {
      await materials.create({
        ...form,
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 0,
        unitPrice: Number(form.unitPrice) || 0,
      });
      setModalVisible(false);
      setForm({ name: '', unit: 'יחידות', quantity: '', minQuantity: '', unitPrice: '', supplier: '' });
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף חומר');
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
                {isLow && <Text style={styles.lowBadge}>⚠️ מלאי נמוך</Text>}
              </View>
              {m.supplier && <Text style={styles.meta}>ספק: {m.supplier}</Text>}
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
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnPrimary} onPress={createMaterial}>
                <Text style={styles.btnPrimaryText}>הוסף חומר</Text>
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
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});