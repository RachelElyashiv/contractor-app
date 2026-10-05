import { Ionicons } from '@expo/vector-icons';
import { ComponentType, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, ToastAndroid, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext';
import DashboardScreen from '../screens/DashboardScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import LoginScreen from '../screens/LoginScreen';
import MaterialsScreen from '../screens/MaterialsScreen';
import PhotosScreen from '../screens/PhotosScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import RegisterScreen from '../screens/RegisterScreen';
import WorkersScreen from '../screens/WorkersScreen';

const CREATE_SIZE = 56;

const tabs = [
  { key: 'nav.dashboard', icon: 'grid-outline', activeIcon: 'grid', component: DashboardScreen },
  { key: 'nav.projects', icon: 'business-outline', activeIcon: 'business', component: ProjectsScreen },
  { key: 'nav.workers', icon: 'people-outline', activeIcon: 'people', component: WorkersScreen },
  { key: 'nav.materials', icon: 'cube-outline', activeIcon: 'cube', component: MaterialsScreen },
  { key: 'nav.invoices', icon: 'document-text-outline', activeIcon: 'document-text', component: InvoicesScreen },
  { key: 'nav.photos', icon: 'camera-outline', activeIcon: 'camera', component: PhotosScreen },
];

function MainApp() {
  const auth = useAuth() as any;
  const { user, loading } = auth;
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);

  function handleNavigate(tab: number, action?: string) {
    setActiveTab(tab);
    if (action === 'create') setPendingCreate(true);
  }

  // The round button in the middle of the tab bar. It creates whatever the
  // current tab holds; the dashboard creates nothing of its own, so from there
  // it opens a new project, which is where work starts.
  function handleCreatePress() {
    const target = activeTab === 0 ? 1 : activeTab;
    setActiveTab(target);
    setPendingCreate(true);
  }

  // Android hardware/gesture back button.
  // Screens register their own handlers first (to close popups / go back a view);
  // this parent handler runs last: non-dashboard tab -> dashboard, dashboard -> double-press to exit.
  const lastBackRef = useRef(0);
  useEffect(() => {
    const onBack = () => {
      if (activeTab !== 0) {
        setActiveTab(0);
        return true; // consumed — go to dashboard
      }
      // Already on dashboard: require a second press within 2s to exit
      const now = Date.now();
      if (now - lastBackRef.current < 2000) {
        return false; // let the OS close the app
      }
      lastBackRef.current = now;
      if (Platform.OS === 'android') ToastAndroid.show(t('common.pressAgainToExit'), ToastAndroid.SHORT);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [activeTab, t]);

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

  const ActiveScreen = tabs[activeTab].component as ComponentType<any>;

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <ActiveScreen
          onNavigate={handleNavigate}
          pendingCreate={pendingCreate}
          onClearPendingCreate={() => setPendingCreate(false)}
        />
      </View>
      <View
        style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}
        onLayout={(e) => setTabBarHeight(e.nativeEvent.layout.height)}
      >
        {tabs.map((tab, idx) => {
          const active = idx === activeTab;
          // the middle slot is left empty for the create button
          const item = (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(idx)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={(active ? tab.activeIcon : tab.icon) as any}
                size={22}
                color={active ? '#1a6b4a' : '#888'}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t(tab.key)}
              </Text>
            </TouchableOpacity>
          );
          return idx === tabs.length / 2
            ? [<View key="create-slot" style={styles.tabItem} />, item]
            : item;
        })}
      </View>

      <TouchableOpacity
        style={[styles.createBtn, { bottom: Math.max(tabBarHeight - CREATE_SIZE / 2, insets.bottom + 8) }]}
        onPress={handleCreatePress}
        accessibilityRole="button"
        accessibilityLabel={t('common.createNew')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
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
  createBtn: {
    position: 'absolute',
    alignSelf: 'center',
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: CREATE_SIZE / 2,
    backgroundColor: '#1a6b4a',
    alignItems: 'center',
    justifyContent: 'center',
    // lifted off the bar so it reads as a button, not a tab
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 3,
    borderColor: '#fff',
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
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}