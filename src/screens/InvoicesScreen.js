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
import { invoices } from '../services/api';

export default function InvoicesScreen() {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ clientName: '', clientPhone: '', notes: '', taxPercent: '17', items: [{ description: '', quantity: '1', unitPrice: '' }] });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [inv, sum] = await Promise.all([invoices.getAll(), invoices.getSummary()]);
      setList(inv.data);
      setSummary(sum.data);
    } catch (e) {
      console.log('Invoices error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function createInvoice() {
    if (!form.clientName) return Alert.alert('שגיאה', 'מלא שם לקוח');
    try {
      await invoices.create({
        ...form,
        taxPercent: Number(form.taxPercent) || 17,
        items: form.items.map(i => ({
          description: i.description,
          quantity: Number(i.quantity) || 1,
          unitPrice: Number(i.unitPrice) || 0,
          total: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
        })),
      });
      setModalVisible(false);
      setForm({ clientName: '', clientPhone: '', notes: '', taxPercent: '17', items: [{ description: '', quantity: '1', unitPrice: '' }] });
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו ליצור חשבונית');
    }
  }

  async function markPaid(id) {
    try {
      await invoices.markPaid(id);
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן');
    }
  }

  const statusColor = { paid: '#1a6b4a', sent: '#185fa5', overdue: '#a32d2d', draft: '#ba7517' };
  const statusLabel = { paid: 'שולם ✓', sent: 'נשלח', overdue: 'איחור', draft: 'טיוטה' };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>חשבוניות</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ חדש</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {summary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>₪{Math.round(summary.totalRevenue / 1000)}K</Text>
              <Text style={styles.summaryLabel}>הכנסות</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#185fa5' }]}>₪{Math.round(summary.pendingAmount / 1000)}K</Text>
              <Text style={styles.summaryLabel}>ממתין</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#a32d2d' }]}>₪{Math.round(summary.overdueAmount / 1000)}K</Text>
              <Text style={styles.summaryLabel}>איחור</Text>
            </View>
          </View>
        )}

        {list.map(inv => (
          <View key={inv.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.invNum}>{inv.invoiceNumber}</Text>
              <View style={[styles.badge, { backgroundColor: statusColor[inv.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor[inv.status] }]}>{statusLabel[inv.status]}</Text>
              </View>
            </View>
            <Text style={styles.clientName}>{inv.clientName}</Text>
            <Text style={styles.amount}>₪{Number(inv.total).toLocaleString()}</Text>
            {inv.status !== 'paid' && (
              <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(inv.id)}>
                <Text style={styles.paidBtnText}>סמן כשולם</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {list.length === 0 && <Text style={styles.empty}>אין חשבוניות עדיין.</Text>}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>חשבונית חדשה</Text>
            <ScrollView>
              <TextInput style={styles.input} placeholder="שם לקוח *" value={form.clientName} onChangeText={v => setForm({ ...form, clientName: v })} textAlign="right" />
              <TextInput style={styles.input} placeholder="טלפון לקוח" value={form.clientPhone} onChangeText={v => setForm({ ...form, clientPhone: v })} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.itemsTitle}>פריטים</Text>
              {form.items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput style={[styles.input, { flex: 2 }]} placeholder="תיאור" value={item.description} onChangeText={v => { const items = [...form.items]; items[idx].description = v; setForm({ ...form, items }); }} textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholder="כמות" value={item.quantity} onChangeText={v => { const items = [...form.items]; items[idx].quantity = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholder="מחיר" value={item.unitPrice} onChangeText={v => { const items = [...form.items]; items[idx].unitPrice = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                </View>
              ))}
              <TouchableOpacity onPress={() => setForm({ ...form, items: [...form.items, { description: '', quantity: '1', unitPrice: '' }] })}>
                <Text style={styles.addItem}>+ הוסף שורה</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="הערות" value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} textAlign="right" />
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnPrimary} onPress={createInvoice}>
                <Text style={styles.btnPrimaryText}>צור חשבונית</Text>
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
  summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryVal: { fontSize: 18, fontWeight: 'bold', color: '#1a6b4a' },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  card: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  invNum: { fontSize: 13, color: '#1a6b4a', fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '500' },
  clientName: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', textAlign: 'right' },
  amount: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'right', marginTop: 4 },
  paidBtn: { marginTop: 10, backgroundColor: '#e8f5ef', padding: 8, borderRadius: 8, alignItems: 'center' },
  paidBtnText: { color: '#1a6b4a', fontSize: 13, fontWeight: '500' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  itemsTitle: { fontSize: 14, fontWeight: '600', textAlign: 'right', marginBottom: 8, color: '#1a1a1a' },
  itemRow: { flexDirection: 'row', gap: 6 },
  addItem: { color: '#1a6b4a', textAlign: 'right', fontSize: 14, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});