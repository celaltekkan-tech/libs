import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useServerConfig } from '../context/ServerConfigContext';
import { useTheme } from '../context/ThemeContext';
import { getApiBaseUrl, getErrorMessage } from '../api/client';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AuthStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Kayıtlı öğretmen e-posta + şifre ile girer. Yeni kayıt Register ekranındadır.
export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { resetApiBaseUrl } = useServerConfig();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      <View style={[styles.themeRow, { top: insets.top + 12 }]}>
        <ThemeToggle compact />
      </View>

      <Text style={styles.title}>Öğretmen Girişi</Text>

      <TextInput
        style={styles.input}
        placeholder="E-posta"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Şifre"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.serverLink} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.registerLinkText}>Hesabım yok, öğretmen kaydı oluştur</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.serverLink} onPress={() => void resetApiBaseUrl()}>
        <Text style={styles.serverLinkText}>Sunucu: {getApiBaseUrl()}  (değiştir)</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    themeRow: { position: 'absolute', top: 48, right: 24 },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 32, textAlign: 'center', color: colors.text },
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
    serverLink: { marginTop: 20, alignItems: 'center' },
    serverLinkText: { color: colors.textMuted, fontSize: 12 },
    registerLinkText: { color: colors.headerLink, fontSize: 15, fontWeight: '600' },
  });
}
