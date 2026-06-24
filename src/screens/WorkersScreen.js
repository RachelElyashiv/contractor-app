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
import { workers } from '../services/api';

export default function WorkersScreen() {
  const [list, setList] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [w, a] = await Promise.all([workers.getAll(), workers.getToday()]);
      setList(w.data);
      setAttendance(a.data);
    } catch (e) {
      console.log('Workers error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function createWorker() {
    if (!form.firstName || !form.lastName) return Alert.alert('שגיאה', 'מלא שם פרטי ומשפחה');
    try {
      await workers.create({ ...form, dailyRate: Number(form.dailyRate) || 0 });
      setModalVisible(false);
      setForm({ firstName: '', lastName: '', phone: '', role: '', dailyRate: '' });
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו להוסיף עובד');
    }
  }

  async function markPresent(workerId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await workers.markAttendance(workerId, {
        date: today, status: 'present',
        checkIn: new Date().toTimeString().slice(0, 5),
        hoursWorked: 8,
      });
      loadData();
    } catch (e) {
      Alert.alert('שגיאה', 'לא הצלחנו לרשום נוכחות');
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>עובדים</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ הוסף</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <Text style={styles.sectionTitle}>נוכחות היום</Text>
        {attendance.map(w => {
          const present = w.todayAttendance?.status === 'present';
          return (
            <View key={w.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: present ? '#e8f5ef' : '#f5f5f5' }]}>
                  <Text style={[styles.avatarText, { color: present ? '#1a6b4a' : '#888' }]}>
                    {w.firstName[0]}{w.lastName[0]}
                  </Text>
                </View>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.workerName}>{w.firstName} {w.lastName}</Text>
                  <Text style={styles.workerRole}>{w.role || 'פועל'}</Text>
                  {w.dailyRate > 0 && <Text style={styles.workerRate}>₪{w.dailyRate} ליום</Text>}
                </View>
                {present ? (
                  <View style={styles.presentBadge}>
                    <Text style={styles.presentText}>נוכח ✓</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.markBtn} onPress={() => markPresent(w.id)}>
                    <Text style={styles.markBtnText}>סמן נוכח</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        {list.length === 0 && <Text style={styles.empty}>אין עובדים עדיין. לחץ + הוסף.</Text>}
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  addBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', margin: 12, textAlign: 'right' },
  card: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  avatarText: { fontSize: 15, fontWeight: '600' },
  workerName: { fontSize: 15, fontWeight: '500', color: '#1a1a1a', textAlign: 'right' },
  workerRole: { fontSize: 12, color: '#888', textAlign: 'right' },
  workerRate: { fontSize: 12, color: '#1a6b4a', textAlign: 'right' },
  presentBadge: { backgroundColor: '#e8f5ef', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  presentText: { color: '#1a6b4a', fontSize: 12, fontWeight: '500' },
  markBtn: { backgroundColor: '#1a6b4a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  markBtnText: { color: '#fff', fontSize: 12 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 16, color: '#1a1a1a' },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 15, backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnSecondary: { flex: 1, borderWidth: 0.5, borderColor: '#ddd', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#555', fontSize: 15 },
});