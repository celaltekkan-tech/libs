import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useServerConfig } from '../context/ServerConfigContext';
import { DEFAULT_API_URL } from '../config';

export function ServerSetupScreen() {
  const { saveApiBaseUrl } = useServerConfig();
  const [url, setUrl] = useState(DEFAULT_API_URL);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError('Adres http:// veya https:// ile başlamalı (örn: http://192.168.1.10:4000)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveApiBaseUrl(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Sunucu Adresi</Text>
      <Text style={styles.subtitle}>
        Okulun backend adresini girin (örn. http://192.168.1.10:4000 veya https://api.oids.com.tr). Bu
        adres yalnızca bu cihazda saklanır; daha sonra giriş ekranından değiştirebilirsiniz.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="http://192.168.1.10:4000"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kaydet ve Devam Et</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#667085', marginBottom: 24, textAlign: 'center' },
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
});
