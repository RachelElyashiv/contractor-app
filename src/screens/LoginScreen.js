import { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export default function LoginScreen({ onSwitch }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  async function handleLogin() {
    setError('');
    if (!email || !password) { setError(t('auth.errors.missingCredentials')); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      const msg = e?.response?.data?.message || t('auth.errors.invalidCredentials');
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>🏗️ {t('common.appName')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>

        <TextInput
          style={styles.input}
          placeholderTextColor="#9a9a9a"
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          textAlign="right"
        />
        <TextInput
          style={styles.input}
          placeholderTextColor="#9a9a9a"
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textAlign="right"
        />

        {!!error && (
          <View style={{ backgroundColor: '#fcebeb', borderRadius: 8, padding: 10, marginBottom: 10 }}>
            <Text style={{ color: '#a32d2d', textAlign: 'center', fontSize: 14 }}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('auth.signIn')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={onSwitch}>
          <Text style={styles.switchText}>{t('auth.noAccount')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 3 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1a6b4a', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#888', marginBottom: 24 },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 15, backgroundColor: '#fafafa', color: '#1a1a1a' },
  btn: { backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchText: { textAlign: 'center', color: '#1a6b4a', marginTop: 16, fontSize: 14 },
});