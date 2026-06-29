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
import { invoices } from '../services/api';

export default function InvoicesScreen() {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  const [createType, setCreateType] = useState('invoice');
  const [form, setForm] = useState({ clientName: '', clientPhone: '', notes: '', taxPercent: '17', items: [{ description: '', quantity: '1', unitPrice: '' }] });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pendingDeleteFn = useRef(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [inv, sum] = await Promise.all([invoices.getAll(), invoices.getSummary()]);
      setList(Array.isArray(inv.data) ? inv.data : []);
      setSummary(sum.data);
    } catch (e) { console.log('Invoices error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function createDocument() {
    if (!form.clientName) { setFormError('חובה למלא שם לקוח'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      await invoices.create({
        ...form,
        type: createType,
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
    } catch (e) { setFormError('שגיאה בשרת — נסי שוב'); }
    finally { setSubmitting(false); }
  }

  async function markPaid(id) {
    try {
      await invoices.markPaid(id);
      loadData();
    } catch (e) { Alert.alert('שגיאה', 'לא הצלחנו לעדכן'); }
  }

  function deleteInvoice(id) {
    pendingDeleteFn.current = async () => {
      try { await invoices.delete(id); loadData(); }
      catch (e) { Alert.alert('שגיאה', 'שגיאה במחיקה'); }
    };
    setConfirmDelete({ message: 'האם למחוק מסמך זה?' });
  }

  const statusColor = { paid: '#1a6b4a', sent: '#185fa5', overdue: '#a32d2d', draft: '#ba7517', cancelled: '#888' };
  const statusLabel = { paid: 'שולם ✓', sent: 'נשלח', overdue: 'איחור', draft: 'טיוטה', cancelled: 'בוטל' };

  const invoiceList = list.filter(i => i.type === 'invoice' || i.type === 'receipt' || !i.type);
  const quoteList = list.filter(i => i.type === 'quote');

  const displayList = activeTab === 'quotes' ? quoteList : invoiceList;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>חשבוניות</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setCreateType('quote'); setModalVisible(true); }}>
            <Text style={styles.addBtnText}>📋 הצעה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setCreateType('invoice'); setModalVisible(true); }}>
            <Text style={styles.addBtnText}>+ חדש</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === 'invoices' && styles.tabActive]} onPress={() => setActiveTab('invoices')}>
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
            🧾 חשבוניות ({invoiceList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'quotes' && styles.tabActive]} onPress={() => setActiveTab('quotes')}>
          <Text style={[styles.tabText, activeTab === 'quotes' && styles.tabTextActive]}>
            📋 הצעות מחיר ({quoteList.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>
        {activeTab === 'invoices' && summary && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>₪{Math.round((summary.totalRevenue || 0) / 1000)}K</Text>
              <Text style={styles.summaryLabel}>הכנסות</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#185fa5' }]}>₪{Math.round((summary.pendingAmount || 0) / 1000)}K</Text>
              <Text style={styles.summaryLabel}>ממתין</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryVal, { color: '#a32d2d' }]}>₪{Math.round((summary.overdueAmount || 0) / 1000)}K</Text>
              <Text style={styles.summaryLabel}>איחור</Text>
            </View>
          </View>
        )}

        {displayList.map(inv => (
          <View key={inv.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.invNum}>{inv.invoiceNumber}</Text>
              <View style={[styles.badge, { backgroundColor: (statusColor[inv.status] || '#888') + '20' }]}>
                <Text style={[styles.badgeText, { color: statusColor[inv.status] || '#888' }]}>{statusLabel[inv.status] || inv.status}</Text>
              </View>
            </View>
            <Text style={styles.clientName}>{inv.clientName}</Text>
            <Text style={styles.amount}>₪{Number(inv.total || 0).toLocaleString()}</Text>
            {inv.notes ? <Text style={styles.notes}>{inv.notes}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {inv.status !== 'paid' && inv.type !== 'quote' && (
                <TouchableOpacity style={styles.paidBtn} onPress={() => markPaid(inv.id)}>
                  <Text style={styles.paidBtnText}>סמן כשולם ✓</Text>
                </TouchableOpacity>
              )}
              {inv.type === 'quote' && inv.status !== 'paid' && (
                <TouchableOpacity style={[styles.paidBtn, { backgroundColor: '#e6f1fb' }]} onPress={() => markPaid(inv.id)}>
                  <Text style={[styles.paidBtnText, { color: '#185fa5' }]}>אושרה ✓</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.paidBtn, { backgroundColor: '#fcebeb' }]} onPress={() => deleteInvoice(inv.id)}>
                <Text style={[styles.paidBtnText, { color: '#a32d2d' }]}>🗑 מחק</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {displayList.length === 0 && (
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>{activeTab === 'quotes' ? '📋' : '🧾'}</Text>
            <Text style={{ fontSize: 16, color: '#555', fontWeight: '600' }}>
              {activeTab === 'quotes' ? 'אין הצעות מחיר עדיין' : 'אין חשבוניות עדיין'}
            </Text>
            <Text style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              {activeTab === 'quotes' ? 'לחצי "📋 הצעה" להוסיף' : 'לחצי "+ חדש" להוסיף'}
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {createType === 'quote' ? '📋 הצעת מחיר חדשה' : '🧾 חשבונית חדשה'}
            </Text>
            <ScrollView>
              <TextInput style={styles.input} placeholder="שם לקוח *" value={form.clientName}
                onChangeText={v => setForm({ ...form, clientName: v })} textAlign="right" />
              <TextInput style={styles.input} placeholder="טלפון לקוח" value={form.clientPhone}
                onChangeText={v => setForm({ ...form, clientPhone: v })} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.itemsTitle}>פריטים</Text>
              {form.items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput style={[styles.input, { flex: 2 }]} placeholder="תיאור" value={item.description}
                    onChangeText={v => { const items = [...form.items]; items[idx].description = v; setForm({ ...form, items }); }} textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholder="כמות" value={item.quantity}
                    onChangeText={v => { const items = [...form.items]; items[idx].quantity = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholder="מחיר" value={item.unitPrice}
                    onChangeText={v => { const items = [...form.items]; items[idx].unitPrice = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                </View>
              ))}
              <TouchableOpacity onPress={() => setForm({ ...form, items: [...form.items, { description: '', quantity: '1', unitPrice: '' }] })}>
                <Text style={styles.addItem}>+ הוסף שורה</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} placeholder="הערות" value={form.notes}
                onChangeText={v => setForm({ ...form, notes: v })} textAlign="right" />
              {createType === 'invoice' && (
                <TextInput style={styles.input} placeholder="מע״מ %" value={form.taxPercent}
                  onChangeText={v => setForm({ ...form, taxPercent: v })} keyboardType="numeric" textAlign="right" />
              )}
            </ScrollView>
            {!!formError && <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{formError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnPrimary, submitting && { opacity: 0.6 }]} onPress={createDocument} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>
                  {submitting ? 'שולח...' : createType === 'quote' ? 'צור הצעה' : 'צור חשבונית'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setModalVisible(false); setFormError(''); }}>
                <Text style={styles.btnSecondaryText}>ביטול</Text>
              </TouchableOpacity>
            </View>
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
  addBtnText: { color: '#fff', fontSize: 13 },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, padding: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a6b4a' },
  tabText: { fontSize: 13, color: '#888' },
  tabTextActive: { color: '#1a6b4a', fontWeight: '600' },
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
  notes: { fontSize: 12, color: '#888', textAlign: 'right', marginTop: 4 },
  paidBtn: { flex: 1, backgroundColor: '#e8f5ef', padding: 8, borderRadius: 8, alignItems: 'center' },
  paidBtnText: { color: '#1a6b4a', fontSize: 13, fontWeight: '500' },
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
