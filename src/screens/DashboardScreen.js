import { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { expenses, invoices, materials, projects, workers } from '../services/api';

export default function DashboardScreen({ onNavigate }) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [invoiceSummary, setInvoiceSummary] = useState(null);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [salaryReport, setSalaryReport] = useState([]);
  const [materialsCost, setMaterialsCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const now = new Date();
    try {
      const [dash, att, stock, inv, exp, sal, mats] = await Promise.all([
        projects.getDashboard(),
        workers.getToday(),
        materials.getLowStock(),
        invoices.getSummary(),
        expenses.getSummary(),
        workers.getMonthly(now.getFullYear(), now.getMonth() + 1),
        materials.getAll(),
      ]);
      setStats(dash.data);
      setAttendance(att.data);
      setLowStock(stock.data);
      setInvoiceSummary(inv.data);
      setExpenseSummary(exp.data);
      setSalaryReport(Array.isArray(sal.data) ? sal.data : []);
      const matList = Array.isArray(mats.data) ? mats.data : [];
      setMaterialsCost(matList.reduce((s, m) => s + (Number(m.quantity) || 0) * (Number(m.unitPrice) || 0), 0));
    } catch (e) {
      console.log('Dashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a6b4a" />;

  const presentWorkers = attendance.filter(w => w.todayAttendance?.status === 'present').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>שלום, {user?.fullName?.split(' ')[0]} 👋</Text>
          <Text style={styles.headerSub}>{user?.companyName || 'דשבורד ראשי'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>יציאה</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickRow}>
        {[
          { label: '+ פרויקט', tab: 1, bg: '#e8f5ef', color: '#1a6b4a' },
          { label: '+ עובד', tab: 2, bg: '#e6f1fb', color: '#185fa5' },
          { label: '+ חשבונית', tab: 4, bg: '#faeeda', color: '#8a5200' },
          { label: '+ חומר', tab: 3, bg: '#fcebeb', color: '#a32d2d' },
        ].map(a => (
          <TouchableOpacity key={a.tab} style={[styles.quickBtn, { backgroundColor: a.bg }]} onPress={() => onNavigate?.(a.tab, 'create')}>
            <Text style={[styles.quickBtnText, { color: a.color }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#e8f5ef' }]}>
          <Text style={styles.statVal}>{stats?.active || 0}</Text>
          <Text style={styles.statLabel}>פרויקטים פעילים</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#e6f1fb' }]}>
          <Text style={styles.statVal}>{presentWorkers}</Text>
          <Text style={styles.statLabel}>עובדים היום</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#faeeda' }]}>
          <Text style={styles.statVal}>₪{Math.round((invoiceSummary?.totalRevenue || 0) / 1000)}K</Text>
          <Text style={styles.statLabel}>הכנסות</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fcebeb' }]}>
          <Text style={styles.statVal}>{lowStock?.length || 0}</Text>
          <Text style={styles.statLabel}>חומרים נמוכים</Text>
        </View>
      </View>

      {lowStock?.length > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertTitle}>⚠️ התראות מלאי</Text>
          {lowStock.map(m => (
            <Text key={m.id} style={styles.alertItem}>• {m.name} – נשאר {m.quantity} {m.unit}</Text>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>נוכחות היום</Text>
        {attendance.slice(0, 5).map(w => (
          <View key={w.id} style={styles.workerRow}>
            <View style={[styles.dot, { backgroundColor: w.todayAttendance ? '#1a6b4a' : '#ccc' }]} />
            <Text style={styles.workerName}>{w.firstName} {w.lastName}</Text>
            <Text style={styles.workerRole}>{w.role}</Text>
          </View>
        ))}
      </View>

      {/* Monthly report */}
      {(() => {
        const monthName = new Date().toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
        const totalExpenses = expenseSummary?.total || 0;
        const totalSalary = salaryReport.reduce((s, r) => s + (Number(r.totalPay) || 0), 0);
        const totalCosts = totalExpenses + totalSalary + materialsCost;
        const pendingIncome = invoiceSummary?.pendingAmount || 0;
        const revenue = invoiceSummary?.totalRevenue || 0;
        const profit = revenue - totalCosts;
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 דוח חודשי — {monthName}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={[styles.monthCard, { backgroundColor: '#fcebeb' }]}>
                <Text style={styles.monthVal}>₪{Math.round(totalCosts).toLocaleString()}</Text>
                <Text style={styles.monthLabel}>סה"כ הוצאות</Text>
              </View>
              <View style={[styles.monthCard, { backgroundColor: '#e6f1fb' }]}>
                <Text style={styles.monthVal}>₪{Math.round(pendingIncome).toLocaleString()}</Text>
                <Text style={styles.monthLabel}>לגבייה</Text>
              </View>
            </View>
            <View style={styles.monthRow}>
              <Text style={styles.monthRowVal}>₪{Math.round(materialsCost).toLocaleString()}</Text>
              <Text style={styles.monthRowLabel}>עלות חומרים</Text>
            </View>
            <View style={styles.monthRow}>
              <Text style={styles.monthRowVal}>₪{Math.round(totalExpenses).toLocaleString()}</Text>
              <Text style={styles.monthRowLabel}>הוצאות אחרות</Text>
            </View>
            <View style={styles.monthRow}>
              <Text style={styles.monthRowVal}>₪{Math.round(totalSalary).toLocaleString()}</Text>
              <Text style={styles.monthRowLabel}>שכר עובדים ({salaryReport.reduce((s,r)=>s+(Number(r.daysPresent)||0),0)} ימי עבודה)</Text>
            </View>
            <View style={styles.monthRow}>
              <Text style={styles.monthRowVal}>₪{Math.round(revenue).toLocaleString()}</Text>
              <Text style={styles.monthRowLabel}>הכנסות מחשבוניות</Text>
            </View>
            <View style={[styles.monthRow, { borderTopWidth: 2, borderTopColor: profit >= 0 ? '#1a6b4a' : '#a32d2d', marginTop: 4, paddingTop: 10 }]}>
              <Text style={[styles.monthRowVal, { fontSize: 16, color: profit >= 0 ? '#1a6b4a' : '#a32d2d' }]}>₪{Math.round(profit).toLocaleString()}</Text>
              <Text style={[styles.monthRowLabel, { fontSize: 14, fontWeight: '700', color: '#1a1a1a' }]}>💰 רווח (הכנסות − הוצאות)</Text>
            </View>
          </View>
        );
      })()}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>פרויקטים אחרונים</Text>
        {stats?.projects?.slice(0, 3).map(p => (
          <View key={p.id} style={styles.projectRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.projName}>{p.name}</Text>
              <Text style={styles.projClient}>{p.clientName}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${p.progressPercent}%` }]} />
              </View>
            </View>
            <Text style={styles.projPct}>{p.progressPercent}%</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  header: { backgroundColor: '#1a6b4a', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 13, color: '#a8d5be', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  statCard: { width: '47%', borderRadius: 12, padding: 16, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  statLabel: { fontSize: 12, color: '#555', marginTop: 4, textAlign: 'center' },
  alertCard: { margin: 12, backgroundColor: '#fff8e6', borderRadius: 12, padding: 14, borderRightWidth: 4, borderRightColor: '#ba7517' },
  alertTitle: { fontSize: 14, fontWeight: '600', color: '#633806', marginBottom: 8 },
  alertItem: { fontSize: 13, color: '#633806', marginBottom: 4 },
  section: { margin: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 12, textAlign: 'right' },
  workerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },
  workerName: { flex: 1, fontSize: 14, color: '#1a1a1a', textAlign: 'right' },
  workerRole: { fontSize: 12, color: '#888' },
  projectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  projName: { fontSize: 14, fontWeight: '500', color: '#1a1a1a', textAlign: 'right' },
  projClient: { fontSize: 12, color: '#888', textAlign: 'right' },
  progressBar: { height: 4, backgroundColor: '#eee', borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1a6b4a', borderRadius: 4 },
  projPct: { fontSize: 13, color: '#1a6b4a', fontWeight: '600', marginRight: 10 },
  monthCard: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  monthVal: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  monthLabel: { fontSize: 11, color: '#555', marginTop: 3, textAlign: 'center' },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
  monthRowLabel: { fontSize: 13, color: '#555', textAlign: 'right' },
  monthRowVal: { fontSize: 13, fontWeight: '600', color: '#1a1a1a' },
  quickRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  quickBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  quickBtnText: { fontSize: 13, fontWeight: '600' },
});