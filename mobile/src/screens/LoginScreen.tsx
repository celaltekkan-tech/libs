import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchCaptcha } from '../api/auth';
import { getErrorMessage } from '../api/client';
import { PasswordField } from '../components/PasswordField';
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

// Kayıtlı kullanıcı T.C. + okulun belirlediği şifre ile girer.
export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
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
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectNote, setReconnectNote] = useState<string | null>(null);
  const captchaEase = useRef(0);
  const captchaInputRef = useRef<TextInput>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showReconnectNote = (text: string) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setReconnectNote(text);
    noteTimer.current = setTimeout(() => setReconnectNote(null), 4000);
  };

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  const loadCaptcha = async (ease: number) => {
    setCaptchaLoading(true);
    try {
      const next = await fetchCaptcha(ease);
      setCaptchaId(next.id);
      setCaptchaSvg(next.svg);
      setCaptchaCode('');
      return true;
    } catch (err) {
      setCaptchaId(null);
      setCaptchaSvg(null);
      setError(getErrorMessage(err));
      return false;
    } finally {
      setCaptchaLoading(false);
    }
  };

  const reconnect = async () => {
    if (reconnecting || captchaLoading || submitting) return;
    setReconnecting(true);
    setError(null);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setReconnectNote(null);
    captchaEase.current = 0;
    try {
      const ok = await loadCaptcha(0);
      if (ok) showReconnectNote('Sunucu ile bağlantı kuruldu');
    } finally {
      setReconnecting(false);
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
      setError('T.C. kimlik numarası ve şifre gerekli');
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
      <View style={[styles.topRow, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.reconnectButton}
          onPress={() => void reconnect()}
          disabled={reconnecting || captchaLoading || submitting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sunucu ile tekrar bağlantı kur"
        >
          {reconnecting ? (
            <ActivityIndicator color={colors.headerLink} />
          ) : (
            <ReconnectIcon color={captchaLoading || submitting ? colors.textMuted : colors.headerLink} />
          )}
        </TouchableOpacity>
        <ThemeToggle compact />
      </View>

      <Text style={[styles.title, !reconnectNote && styles.titleAlone]}>Öğretmen Girişi</Text>
      {reconnectNote ? <Text style={styles.reconnectNote}>{reconnectNote}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="T.C. kimlik numarası"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="number-pad"
        maxLength={11}
        value={email}
        onChangeText={(value) => setEmail(value.replace(/\D/g, '').slice(0, 11))}
      />
      <PasswordField placeholder="Şifre" value={password} onChangeText={setPassword} />

      <View style={styles.captchaRow}>
        <View style={[styles.captchaImage, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          {captchaSvg ? (
            <SvgXml
              xml={captchaSvg}
              width="100%"
              height="100%"
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
          ref={captchaInputRef}
          style={[styles.input, styles.captchaInput]}
          placeholder="Görseldeki kod"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={5}
          value={captchaCode}
          onChangeText={(value) => {
            const next = value.slice(0, 5);
            setCaptchaCode(next);
            if (next.length >= 5) {
              captchaInputRef.current?.blur();
              Keyboard.dismiss();
            }
          }}
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

      <Text style={styles.versionText}>Sürüm {getAppVersionLabel()}</Text>
    </KeyboardAvoidingView>
  );
}

function ReconnectIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
      />
    </Svg>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
    topRow: {
      position: 'absolute',
      left: 12,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 1,
    },
    reconnectButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center', color: colors.text },
    titleAlone: { marginBottom: 32 },
    reconnectNote: {
      color: colors.headerLink,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 16,
    },
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
    versionText: { marginTop: 12, color: colors.textMuted, fontSize: 11, textAlign: 'center' },
    registerLinkText: { color: colors.headerLink, fontSize: 15, fontWeight: '600' },
  });
}
