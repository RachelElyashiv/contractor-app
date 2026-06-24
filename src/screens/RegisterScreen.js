import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ onSwitch }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', companyName: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  async function handleRegister() {
    if (!form.fullName || !form.email || !form.password) return Alert.alert('שגיאה', 'מלא את כל השדות החובה');
    setLoading(true);
    try {
      await register(form);
    } catch (e) {
      Alert.alert('שגיאה', e.response?.data?.message || 'שגיאה בהרשמה');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>🏗️ בניית על</Text>
          <Text style={styles.subtitle}>צור חשבון חדש</Text>

          {[
            { key: 'fullName', placeholder: 'שם מלא *' },
            { key: 'email', placeholder: 'אימייל *', keyboardType: 'email-address' },
            { key: 'password', placeholder: 'סיסמה * (לפחות 6 תווים)', secure: true },
            { key: 'companyName', placeholder: 'שם חברה' },
            { key: 'phone', placeholder: 'טלפון', keyboardType: 'phone-pad' },
          ].map((field) => (
            <TextInput
              key={field.key}
              style={styles.input}
              placeholder={field.placeholder}
              value={form[field.key]}
              onChangeText={(v) => setForm({ ...form, [field.key]: v })}
              secureTextEntry={field.secure}
              keyboardType={field.keyboardType || 'default'}
              autoCapitalize="none"
              textAlign="right"
            />
          ))}

          <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>הירשם</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitch}>
            <Text style={styles.switchText}>כבר יש לך חשבון? התחבר</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f0' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 3 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#1a6b4a', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#888', marginBottom: 24 },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 15, backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#1a6b4a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchText: { textAlign: 'center', color: '#1a6b4a', marginTop: 16, fontSize: 14 },
});