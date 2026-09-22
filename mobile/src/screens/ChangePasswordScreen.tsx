import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../api/client';
import type { RootStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const { changePassword } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!currentPassword || !newPassword) {
      setError('Mevcut ve yeni şifre gerekli');
      return;
    }
    if (newPassword.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifre tekrarı eşleşmiyor');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Şifreniz güncellendi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.hint}>
        İlk girişte şifreniz sicil numaranızdır. Yeni şifre en az 8 karakter olmalıdır.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Mevcut şifre"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={currentPassword}
        onChangeText={setCurrentPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Yeni şifre"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Yeni şifre (tekrar)"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {success && <Text style={styles.success}>{success}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => void onSubmit()} disabled={submitting}>
        {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Şifreyi Güncelle</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: colors.background },
    hint: { color: colors.textSecondary, marginBottom: 20, fontSize: 14 },
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
      marginTop: 8,
    },
    buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
    success: { color: colors.headerLink, marginBottom: 12, textAlign: 'center' },
  });
}
