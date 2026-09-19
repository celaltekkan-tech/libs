import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useServerConfig } from '../context/ServerConfigContext';
import { getApiBaseUrl, getErrorMessage } from '../api/client';

// NOT: Bu ekran şimdilik mevcut web paneliyle aynı e-posta/şifre uçunu
// (POST /api/auth/login) kullanıyor. Login akışının nasıl olacağı ayrıca
// netleştirilecek; o zaman bu ekran değiştirilecek.
export function LoginScreen() {
  const { login } = useAuth();
  const { resetApiBaseUrl } = useServerConfig();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Öğretmen Girişi</Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.serverLink} onPress={() => void resetApiBaseUrl()}>
        <Text style={styles.serverLinkText}>Sunucu: {getApiBaseUrl()}  (değiştir)</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1677ff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#d4380d', marginBottom: 12, textAlign: 'center' },
  serverLink: { marginTop: 20, alignItems: 'center' },
  serverLinkText: { color: '#98a2b3', fontSize: 12 },
});
