import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, ToastAndroid, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import DashboardScreen from '../screens/DashboardScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import LoginScreen from '../screens/LoginScreen';
import MaterialsScreen from '../screens/MaterialsScreen';
import PhotosScreen from '../screens/PhotosScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import RegisterScreen from '../screens/RegisterScreen';
import WorkersScreen from '../screens/WorkersScreen';

const tabs = [
  { name: 'דשבורד', icon: 'grid-outline', activeIcon: 'grid', component: DashboardScreen },
  { name: 'פרויקטים', icon: 'business-outline', activeIcon: 'business', component: ProjectsScreen },
  { name: 'עובדים', icon: 'people-outline', activeIcon: 'people', component: WorkersScreen },
  { name: 'חומרים', icon: 'cube-outline', activeIcon: 'cube', component: MaterialsScreen },
  { name: 'חשבוניות', icon: 'document-text-outline', activeIcon: 'document-text', component: InvoicesScreen },
  { name: 'תמונות', icon: 'camera-outline', activeIcon: 'camera', component: PhotosScreen },
];

function MainApp() {
  const auth = useAuth() as any;
  const { user, loading } = auth;
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [pendingCreate, setPendingCreate] = useState(false);

  function handleNavigate(tab: number, action?: string) {
    setActiveTab(tab);
    if (action === 'create') setPendingCreate(true);
  }

  // Android hardware/gesture back button.
  // Screens register their own handlers first (to close popups / go back a view);
  // this parent handler runs last: non-dashboard tab -> dashboard, dashboard -> double-press to exit.
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const lastBackRef = useRef(0);
  useEffect(() => {
    const onBack = () => {
      if (activeTabRef.current !== 0) {
        setActiveTab(0);
        return true; // consumed — go to dashboard
      }
      // Already on dashboard: require a second press within 2s to exit
      const now = Date.now();
      if (now - lastBackRef.current < 2000) {
        return false; // let the OS close the app
      }
      lastBackRef.current = now;
      if (Platform.OS === 'android') ToastAndroid.show('לחצי שוב ליציאה', ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, []);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#1a6b4a" />
    </View>
  );

  if (!user) {
    return showRegister
      ? <RegisterScreen onSwitch={() => setShowRegister(false)} />
      : <LoginScreen onSwitch={() => setShowRegister(true)} />;
  }

  const ActiveScreen = tabs[activeTab].component;

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <ActiveScreen
          onNavigate={handleNavigate}
          pendingCreate={pendingCreate}
          onClearPendingCreate={() => setPendingCreate(false)}
        />
      </View>
      <View style={styles.tabBar}>
        {tabs.map((tab, idx) => {
          const active = idx === activeTab;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => setActiveTab(idx)}
            >
              <Ionicons
                name={(active ? tab.activeIcon : tab.icon) as any}
                size={22}
                color={active ? '#1a6b4a' : '#888'}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' as any },
  screen: { flex: 1, overflow: 'hidden' as any },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: { fontSize: 10, color: '#888' },
  tabLabelActive: { color: '#1a6b4a', fontWeight: '600' },
});

export default function Index() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}