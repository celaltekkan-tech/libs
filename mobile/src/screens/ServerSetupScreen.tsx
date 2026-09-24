import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServerConfig } from '../context/ServerConfigContext';
import { useTheme } from '../context/ThemeContext';
import { DEFAULT_API_URL } from '../config';
import { ThemeToggle } from '../components/ThemeToggle';
import type { ThemeColors } from '../theme/colors';

export function ServerSetupScreen() {
  const { saveApiBaseUrl } = useServerConfig();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [url, setUrl] = useState(DEFAULT_API_URL);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError('Adres http:// veya https:// ile başlamalı (örn: https://api.oids.com.tr)');
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
      <View style={[styles.themeRow, { top: insets.top + 12 }]}>
        <ThemeToggle compact />
      </View>

      <Text style={styles.title}>Sunucu Adresi</Text>
      <Text style={styles.subtitle}>
        Okulun backend adresini girin (örn. http://192.168.1.10:4000 veya https://api.oids.com.tr). Bu
        adres yalnızca bu cihazda saklanır; daha sonra giriş ekranından değiştirebilirsiniz.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="https://api.oids.com.tr"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        value={url}
        onChangeText={setUrl}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Kaydet ve Devam Et</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    themeRow: { position: 'absolute', top: 48, right: 24 },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24, textAlign: 'center' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  });
}
