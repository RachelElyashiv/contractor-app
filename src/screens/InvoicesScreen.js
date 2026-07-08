import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { apartments as apartmentsApi, invoices, materials as materialsApi, projects as projectsApi } from '../services/api';

const isWeb = Platform.OS === 'web';

export default function InvoicesScreen({ pendingCreate, onClearPendingCreate } = {}) {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (pendingCreate) { setCreateType('invoice'); setModalVisible(true); onClearPendingCreate?.(); }
  }, [pendingCreate]);
  const [activeTab, setActiveTab] = useState('invoices');
  const [createType, setCreateType] = useState('invoice');
  const [form, setForm] = useState({ clientName: '', clientPhone: '', notes: '', taxPercent: '17', items: [{ description: '', quantity: '1', unitPrice: '' }] });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [pdfModal, setPdfModal] = useState({ visible: false, html: '' });
  const pendingDeleteFn = useRef(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Import-from-project state
  const [projectsList, setProjectsList] = useState([]);
  const [srcApartments, setSrcApartments] = useState([]);
  const [srcProjectId, setSrcProjectId] = useState(null);
  const [srcApartmentId, setSrcApartmentId] = useState(null);
  const [showSrcProject, setShowSrcProject] = useState(false);
  const [showSrcApartment, setShowSrcApartment] = useState(false);
  const [importing, setImporting] = useState(false);
  // Pull a single material from inventory into a line item
  const [allMaterials, setAllMaterials] = useState([]);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);

  useEffect(() => { loadData(); loadProjects(); loadAllMaterials(); }, []);

  // Android back button: close any open popup before leaving the screen
  useEffect(() => {
    const onBack = () => {
      if (confirmDelete) { setConfirmDelete(null); return true; }
      if (pdfModal.visible) { setPdfModal({ visible: false, html: '' }); return true; }
      if (showMaterialPicker) { setShowMaterialPicker(false); return true; }
      if (showSrcApartment) { setShowSrcApartment(false); return true; }
      if (showSrcProject) { setShowSrcProject(false); return true; }
      if (modalVisible) { setModalVisible(false); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [confirmDelete, pdfModal.visible, showMaterialPicker, showSrcApartment, showSrcProject, modalVisible]);

  // Load apartments of the chosen source project
  useEffect(() => {
    if (srcProjectId) {
      apartmentsApi.getByProject(srcProjectId)
        .then(res => {
          const arr = Array.isArray(res.data) ? res.data : [];
          arr.sort((a, b) => (parseInt(a.number, 10) || 0) - (parseInt(b.number, 10) || 0));
          setSrcApartments(arr);
        })
        .catch(() => setSrcApartments([]));
      setSrcApartmentId(null);
    } else {
      setSrcApartments([]);
      setSrcApartmentId(null);
    }
  }, [srcProjectId]);

  async function loadProjects() {
    try {
      const res = await projectsApi.getAll();
      setProjectsList(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log('Projects error:', e); }
  }

  async function loadAllMaterials() {
    try {
      const res = await materialsApi.getAll();
      setAllMaterials(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.log('Materials error:', e); }
  }

  // Add a single inventory material as a new line item (price is editable so you can add profit)
  function addMaterialItem(m) {
    const newItem = {
      description: m.name + (m.unit ? ` (${m.unit})` : ''),
      quantity: '1',
      unitPrice: String(m.unitPrice || 0),
    };
    setForm(f => {
      // Replace the first empty row if present, otherwise append
      const hasEmpty = f.items.length === 1 && !f.items[0].description && !f.items[0].unitPrice;
      return { ...f, items: hasEmpty ? [newItem] : [...f.items, newItem] };
    });
    setShowMaterialPicker(false);
  }

  // Pull all materials of the project/apartment and turn them into quote line items
  async function importFromProject() {
    if (!srcProjectId) { setFormError('בחרי פרויקט קודם'); return; }
    setImporting(true);
    try {
      const res = srcApartmentId
        ? await materialsApi.getByApartment(srcApartmentId)
        : await materialsApi.getByProject(srcProjectId);
      const mats = Array.isArray(res.data) ? res.data : [];
      const items = mats.map(m => ({
        description: m.name + (m.unit ? ` (${m.unit})` : ''),
        quantity: String(m.quantity || 1),
        unitPrice: String(m.unitPrice || 0),
      }));
      const proj = projectsList.find(p => p.id === srcProjectId);
      setForm(f => ({
        ...f,
        clientName: f.clientName || proj?.clientName || '',
        clientPhone: f.clientPhone || proj?.clientPhone || '',
        items: items.length ? items : f.items,
      }));
      setFormError(items.length ? '' : 'לא נמצאו חומרים לפרויקט/דירה זו — הוסיפי פריטים ידנית');
    } catch (e) {
      setFormError('שגיאה בטעינת החומרים — נסי שוב');
    } finally {
      setImporting(false);
    }
  }

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
      setSrcProjectId(null);
      setSrcApartmentId(null);
      loadData();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'שגיאה בשרת';
      setFormError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
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

  async function printInvoice(inv) {
    const typeLabel = inv.type === 'quote' ? 'הצעת מחיר' : 'חשבונית מס';
    const itemRows = (inv.items || []).map(it => `
      <tr>
        <td style="padding:8px;text-align:left">₪${Number(it.total || (it.quantity * it.unitPrice)).toLocaleString()}</td>
        <td style="padding:8px;text-align:center">${Number(it.unitPrice).toLocaleString()}</td>
        <td style="padding:8px;text-align:center">${it.quantity}</td>
        <td style="padding:8px;text-align:right">${it.description}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8">
<title>${typeLabel} ${inv.invoiceNumber}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; font-family:Arial,sans-serif; }
  body { background:#fff; color:#1a1a1a; padding:40px; direction:rtl; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; border-bottom:3px solid #1a6b4a; padding-bottom:20px; }
  .title { font-size:28px; font-weight:bold; color:#1a6b4a; }
  .num { font-size:14px; color:#888; margin-top:4px; }
  .client-box { background:#f9f9f9; border-radius:10px; padding:16px; margin-bottom:24px; }
  .client-box h3 { font-size:13px; color:#888; margin-bottom:6px; }
  .client-box p { font-size:15px; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
  thead { background:#1a6b4a; color:#fff; }
  thead th { padding:10px 8px; font-size:13px; }
  tbody tr:nth-child(even) { background:#f9f9f9; }
  tbody td { font-size:14px; border-bottom:1px solid #eee; }
  .totals { margin-right:auto; width:260px; }
  .totals tr td { padding:6px 8px; font-size:14px; }
  .totals tr:last-child td { font-size:16px; font-weight:bold; color:#1a6b4a; border-top:2px solid #1a6b4a; padding-top:10px; }
  .notes { margin-top:24px; padding:12px; background:#f9f9f9; border-radius:8px; font-size:13px; color:#555; }
  .footer { margin-top:40px; text-align:center; color:#aaa; font-size:11px; }
  @media print { body { padding:20px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="title">${typeLabel}</div>
    <div class="num">${inv.invoiceNumber} · ${new Date(inv.issueDate || inv.createdAt).toLocaleDateString('he-IL')}</div>
  </div>
  <div style="text-align:left">
    ${inv.status === 'paid' ? '<span style="background:#e8f5ef;color:#1a6b4a;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600">שולם ✓</span>' : ''}
  </div>
</div>
<div class="client-box">
  <h3>לקוח</h3>
  <p>${inv.clientName}</p>
  ${inv.clientPhone ? `<p style="font-size:13px;color:#888;margin-top:4px">${inv.clientPhone}</p>` : ''}
</div>
<table>
  <thead><tr>
    <th style="text-align:left">סה"כ</th>
    <th style="text-align:center">מחיר יחידה</th>
    <th style="text-align:center">כמות</th>
    <th style="text-align:right">תיאור</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<table class="totals">
  <tr><td>סכום לפני מע"מ</td><td style="text-align:left">₪${Number(inv.subtotal||0).toLocaleString()}</td></tr>
  <tr><td>מע"מ (${inv.taxPercent||17}%)</td><td style="text-align:left">₪${Number(inv.taxAmount||0).toLocaleString()}</td></tr>
  <tr><td>סה"כ לתשלום</td><td style="text-align:left">₪${Number(inv.total||0).toLocaleString()}</td></tr>
</table>
${inv.notes ? `<div class="notes">הערות: ${inv.notes}</div>` : ''}
<div class="footer">נוצר אוטומטית · ${new Date().toLocaleDateString('he-IL')}</div>
</body></html>`;
    if (isWeb) {
      setPdfModal({ visible: true, html });
    } else {
      try {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'שיתוף מסמך', UTI: 'com.adobe.pdf' });
        } else {
          await Print.printAsync({ uri });
        }
      } catch (e) {
        Alert.alert('שגיאה', 'לא הצלחנו ליצור PDF');
      }
    }
  }

  function shareOnWhatsApp(inv) {
    const typeLabel = inv.type === 'quote' ? 'הצעת מחיר' : 'חשבונית';
    const itemLines = (inv.items || []).map(it =>
      `• ${it.description} × ${it.quantity} = ₪${Number(it.total || it.unitPrice * it.quantity).toLocaleString()}`
    ).join('\n');
    const msg = [
      `שלום ${inv.clientName},`,
      ``,
      `מצורפת ${typeLabel} מספר ${inv.invoiceNumber}:`,
      itemLines,
      ``,
      `סה"כ לפני מע"מ: ₪${Number(inv.subtotal || 0).toLocaleString()}`,
      `מע"מ (${inv.taxPercent || 17}%): ₪${Number(inv.taxAmount || 0).toLocaleString()}`,
      `סה"כ לתשלום: ₪${Number(inv.total || 0).toLocaleString()}`,
      inv.notes ? `\nהערות: ${inv.notes}` : '',
    ].filter(l => l !== undefined).join('\n');

    const rawPhone = (inv.clientPhone || '').replace(/\D/g, '');
    const phone = rawPhone.startsWith('972') ? rawPhone : rawPhone.startsWith('0') ? '972' + rawPhone.slice(1) : '972' + rawPhone;
    const url = phone.length > 5
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    if (isWeb) window.open(url, '_blank');
    else Linking.openURL(url);
  }

  const invoiceList = list.filter(i => i.type === 'invoice' || i.type === 'receipt' || !i.type);
  const quoteList = list.filter(i => i.type === 'quote');

  const displayList = activeTab === 'quotes' ? quoteList : invoiceList;
  const srcProject = projectsList.find(p => p.id === srcProjectId);
  const srcApartment = srcApartments.find(a => a.id === srcApartmentId);

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
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
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
              <TouchableOpacity style={[styles.paidBtn, { backgroundColor: '#fff3e0' }]} onPress={() => printInvoice(inv)}>
                <Text style={[styles.paidBtnText, { color: '#c84b00' }]}>🖨 PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.paidBtn, { backgroundColor: '#e7f7ee' }]} onPress={() => shareOnWhatsApp(inv)}>
                <Text style={[styles.paidBtnText, { color: '#1a7a3c' }]}>📲 WhatsApp</Text>
              </TouchableOpacity>
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
              {/* Auto-fill from a project / apartment */}
              <View style={styles.importBox}>
                <Text style={styles.importTitle}>📥 בנה מפרויקט (אופציונלי)</Text>
                <Text style={styles.importHint}>בחרי פרויקט/דירה כדי לטעון את כל החומרים כפריטים אוטומטית</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSrcProject(true)}>
                  <Text style={styles.selectorText}>{srcProject ? `📁 ${srcProject.name}` : '📁 בחרי פרויקט'}</Text>
                </TouchableOpacity>
                {srcProjectId ? (
                  <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSrcApartment(true)}>
                    <Text style={styles.selectorText}>{srcApartment ? `🏠 ${srcApartment.name}` : '🏠 כל הדירות בפרויקט'}</Text>
                  </TouchableOpacity>
                ) : null}
                {srcProjectId ? (
                  <TouchableOpacity style={[styles.importBtn, importing && { opacity: 0.6 }]} onPress={importFromProject} disabled={importing}>
                    <Text style={styles.importBtnText}>{importing ? 'טוען...' : '📥 טען חומרים כפריטים'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TextInput style={styles.input} placeholderTextColor="#9a9a9a" placeholder="שם לקוח *" value={form.clientName}
                onChangeText={v => setForm({ ...form, clientName: v })} textAlign="right" />
              <TextInput style={styles.input} placeholderTextColor="#9a9a9a" placeholder="טלפון לקוח" value={form.clientPhone}
                onChangeText={v => setForm({ ...form, clientPhone: v })} keyboardType="phone-pad" textAlign="right" />
              <Text style={styles.itemsTitle}>פריטים</Text>
              {form.items.map((item, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <TextInput style={[styles.input, { flex: 2 }]} placeholderTextColor="#9a9a9a" placeholder="תיאור" value={item.description}
                    onChangeText={v => { const items = [...form.items]; items[idx].description = v; setForm({ ...form, items }); }} textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholderTextColor="#9a9a9a" placeholder="כמות" value={item.quantity}
                    onChangeText={v => { const items = [...form.items]; items[idx].quantity = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                  <TextInput style={[styles.input, { flex: 1, marginRight: 6 }]} placeholderTextColor="#9a9a9a" placeholder="מחיר" value={item.unitPrice}
                    onChangeText={v => { const items = [...form.items]; items[idx].unitPrice = v; setForm({ ...form, items }); }} keyboardType="numeric" textAlign="right" />
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                <TouchableOpacity onPress={() => setForm({ ...form, items: [...form.items, { description: '', quantity: '1', unitPrice: '' }] })}>
                  <Text style={styles.addItem}>+ הוסף שורה</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { loadAllMaterials(); setShowMaterialPicker(true); }}>
                  <Text style={styles.addItem}>📦 משוך חומר מהמלאי</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} placeholderTextColor="#9a9a9a" placeholder="הערות" value={form.notes}
                onChangeText={v => setForm({ ...form, notes: v })} textAlign="right" />
              {createType === 'invoice' && (
                <TextInput style={styles.input} placeholderTextColor="#9a9a9a" placeholder="מע״מ %" value={form.taxPercent}
                  onChangeText={v => setForm({ ...form, taxPercent: v })} keyboardType="numeric" textAlign="right" />
              )}
              {/* Live total preview */}
              {(() => {
                const subtotal = form.items.reduce((s, it) =>
                  s + (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0), 0);
                const tax = createType === 'invoice' ? subtotal * ((Number(form.taxPercent) || 17) / 100) : 0;
                const total = subtotal + tax;
                if (subtotal === 0) return null;
                return (
                  <View style={{ backgroundColor: '#f0f7f3', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#555', fontSize: 13 }}>₪{subtotal.toLocaleString()}</Text>
                      <Text style={{ color: '#555', fontSize: 13 }}>סכום לפני מע"מ</Text>
                    </View>
                    {createType === 'invoice' && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#555', fontSize: 13 }}>₪{tax.toLocaleString()}</Text>
                        <Text style={{ color: '#555', fontSize: 13 }}>מע"מ ({form.taxPercent || 17}%)</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#c8e6d6', paddingTop: 6, marginTop: 4 }}>
                      <Text style={{ color: '#1a6b4a', fontSize: 15, fontWeight: 'bold' }}>₪{total.toLocaleString()}</Text>
                      <Text style={{ color: '#1a6b4a', fontSize: 15, fontWeight: 'bold' }}>סה"כ לתשלום</Text>
                    </View>
                  </View>
                );
              })()}
            </ScrollView>
            {!!formError && <Text style={{ color: '#a32d2d', textAlign: 'center', marginBottom: 8 }}>{formError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnPrimary, submitting && { opacity: 0.6 }]} onPress={createDocument} disabled={submitting}>
                <Text style={styles.btnPrimaryText}>
                  {submitting ? 'שולח...' : createType === 'quote' ? 'צור הצעה' : 'צור חשבונית'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setModalVisible(false); setFormError(''); setSrcProjectId(null); setSrcApartmentId(null); }}>
                <Text style={styles.btnSecondaryText}>ביטול</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pick source project */}
      <Modal visible={showSrcProject} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>בחרי פרויקט</Text>
            <ScrollView>
              {projectsList.map(p => (
                <TouchableOpacity key={p.id} style={[styles.filterOption, srcProjectId === p.id && styles.filterOptionActive]}
                  onPress={() => { setSrcProjectId(p.id); setShowSrcProject(false); }}>
                  <Text style={[styles.filterOptionText, srcProjectId === p.id && { color: '#1a6b4a', fontWeight: '600' }]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
              {projectsList.length === 0 && <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>אין פרויקטים עדיין</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowSrcProject(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pick source apartment */}
      <Modal visible={showSrcApartment} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>בחרי דירה</Text>
            <ScrollView>
              <TouchableOpacity style={styles.filterOption} onPress={() => { setSrcApartmentId(null); setShowSrcApartment(false); }}>
                <Text style={styles.filterOptionText}>כל הדירות בפרויקט</Text>
              </TouchableOpacity>
              {srcApartments.map(a => (
                <TouchableOpacity key={a.id} style={[styles.filterOption, srcApartmentId === a.id && styles.filterOptionActive]}
                  onPress={() => { setSrcApartmentId(a.id); setShowSrcApartment(false); }}>
                  <Text style={[styles.filterOptionText, srcApartmentId === a.id && { color: '#1a6b4a', fontWeight: '600' }]}>
                    🏠 {a.name}{a.number ? ` (${a.number})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
              {srcApartments.length === 0 && <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>אין דירות לפרויקט זה</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowSrcApartment(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pick a single material from inventory */}
      <Modal visible={showMaterialPicker} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>📦 משוך חומר מהמלאי</Text>
            <Text style={{ textAlign: 'center', color: '#888', fontSize: 12, marginBottom: 10 }}>המחיר יטען לפי מחיר הקנייה — תוכלי לערוך אותו ולהוסיף רווח</Text>
            <ScrollView>
              {allMaterials.map(m => (
                <TouchableOpacity key={m.id} style={styles.filterOption} onPress={() => addMaterialItem(m)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#1a6b4a', fontSize: 13, fontWeight: '600' }}>₪{Number(m.unitPrice) || 0}{m.unit ? ` / ${m.unit}` : ''}</Text>
                    <Text style={styles.filterOptionText}>{m.name}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              {allMaterials.length === 0 && <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>אין חומרים במלאי</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setShowMaterialPicker(false)}>
              <Text style={styles.btnSecondaryText}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PDF in-app modal (web only — native uses expo-print/sharing) */}
      {isWeb && (
      <Modal visible={pdfModal.visible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#f0f4f0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1a6b4a' }}>
            <TouchableOpacity onPress={() => {
                const iframe = document.querySelector('iframe[title="invoice-preview"]');
                if (iframe) iframe.contentWindow.print();
              }}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>🖨 הדפס</Text>
            </TouchableOpacity>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>תצוגת מסמך</Text>
            <TouchableOpacity onPress={() => setPdfModal({ visible: false, html: '' })}
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>✕ סגור</Text>
            </TouchableOpacity>
          </View>
          {pdfModal.html ? (
            <iframe
              srcDoc={pdfModal.html}
              style={{ width: '100%', height: 'calc(100vh - 60px)', border: 'none', display: 'block' }}
              title="invoice-preview"
            />
          ) : null}
        </View>
      </Modal>
      )}

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
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a' },
  itemsTitle: { fontSize: 14, fontWeight: '600', textAlign: 'right', marginBottom: 8, color: '#1a1a1a' },
  importBox: { backgroundColor: '#f0f7f3', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 0.5, borderColor: '#c8e6d6' },
  importTitle: { fontSize: 14, fontWeight: '600', color: '#1a6b4a', textAlign: 'right', marginBottom: 4 },
  importHint: { fontSize: 12, color: '#5a7a68', textAlign: 'right', marginBottom: 10 },
  selectorBtn: { borderWidth: 0.5, borderColor: '#1a6b4a', borderRadius: 10, padding: 11, marginBottom: 8, backgroundColor: '#fff' },
  selectorText: { fontSize: 14, color: '#1a6b4a', textAlign: 'right' },
  importBtn: { backgroundColor: '#1a6b4a', borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 2 },
  importBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  filterOption: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  filterOptionActive: { backgroundColor: '#e8f5ef' },
  filterOptionText: { fontSize: 15, color: '#333', textAlign: 'right' },
  itemRow: { flexDirection: 'row', gap: 6 },
  addItem: { color: '#1a6b4a', textAlign: 'right', fontSize: 14, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});
