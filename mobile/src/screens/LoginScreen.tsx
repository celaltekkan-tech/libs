import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useServerConfig } from '../context/ServerConfigContext';
import { useTheme } from '../context/ThemeContext';
import { fetchCaptcha } from '../api/auth';
import { getApiBaseUrl, getErrorMessage } from '../api/client';
import { ThemeToggle } from '../components/ThemeToggle';
import { getAppVersionLabel } from '../update/appVersion';
import type { AuthStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const REMEMBER_KEY = 'okul.rememberedLogin';

async function readRememberedLogin(): Promise<{ email: string; password: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(REMEMBER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; password?: string };
    if (!parsed.email || !parsed.password) return null;
    return { email: parsed.email, password: parsed.password };
  } catch {
    return null;
  }
}

// Kayıtlı öğretmen e-posta + şifre ile girer. Yeni kayıt Register ekranındadır.
export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const { resetApiBaseUrl } = useServerConfig();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [captchaId, setCaptchaId] = useState<string | null>(null);
  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaEase = useRef(0);

  const loadCaptcha = async (ease: number) => {
    setCaptchaLoading(true);
    try {
      const next = await fetchCaptcha(ease);
      setCaptchaId(next.id);
      setCaptchaSvg(next.svg);
      setCaptchaCode('');
    } catch (err) {
      setCaptchaId(null);
      setCaptchaSvg(null);
      setError(getErrorMessage(err));
    } finally {
      setCaptchaLoading(false);
    }
  };

  const refreshCaptcha = () => {
    captchaEase.current = Math.min(2, captchaEase.current + 1);
    return loadCaptcha(captchaEase.current);
  };

  useEffect(() => {
    void (async () => {
      const saved = await readRememberedLogin();
      if (saved) {
        setEmail(saved.email);
        setPassword(saved.password);
        setRemember(true);
      }
    })();
    captchaEase.current = 0;
    void loadCaptcha(0);
  }, []);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre gerekli');
      return;
    }
    if (!captchaId || !captchaCode.trim()) {
      setError('Görsel doğrulama kodu gerekli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password, captchaId, captchaCode.trim());
      try {
        if (remember) {
          await SecureStore.setItemAsync(REMEMBER_KEY, JSON.stringify({ email: email.trim(), password }));
        } else {
          await SecureStore.deleteItemAsync(REMEMBER_KEY);
        }
      } catch {
        // Kimlik saklama hatası başarılı girişi kesmesin.
      }
      Alert.alert('Girişiniz güvenli değil', '2FA veya SMS doğrulaması kullanın.');
    } catch (err) {
      setError(getErrorMessage(err));
      void loadCaptcha(captchaEase.current);
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

      <View style={styles.captchaRow}>
        <View style={[styles.captchaImage, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          {captchaSvg ? (
            <Image
              source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(captchaSvg)}` }}
              style={styles.captchaImg}
              contentFit="contain"
              accessibilityLabel="Görsel doğrulama kodu"
            />
          ) : (
            <Text style={{ color: colors.textMuted }}>{captchaLoading ? '…' : '—'}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => void refreshCaptcha()} disabled={captchaLoading}>
          <Text style={styles.refreshText}>{captchaLoading ? '…' : 'Yenile'}</Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, styles.captchaInput]}
          placeholder="Görseldeki kod"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          value={captchaCode}
          onChangeText={setCaptchaCode}
        />
      </View>

      <View style={styles.rememberRow}>
        <Switch
          value={remember}
          onValueChange={(checked) => {
            setRemember(checked);
            if (!checked) void SecureStore.deleteItemAsync(REMEMBER_KEY).catch(() => undefined);
          }}
        />
        <Text style={styles.rememberText}>Kullanıcı adımı ve şifremi hatırla</Text>
      </View>

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

      <Text style={styles.versionText}>Sürüm {getAppVersionLabel()}</Text>
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
    captchaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    captchaImage: {
      width: 112,
      height: 40,
      borderWidth: 1,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    captchaImg: { width: 112, height: 40 },
    captchaInput: { flex: 1, marginBottom: 0 },
    refreshButton: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
    },
    refreshText: { color: colors.headerLink, fontWeight: '600' },
    rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    rememberText: { color: colors.text, flex: 1 },
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
    versionText: { marginTop: 12, color: colors.textMuted, fontSize: 11, textAlign: 'center' },
    registerLinkText: { color: colors.headerLink, fontSize: 15, fontWeight: '600' },
  });
}
