import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { lookupStudentByNumber } from '../api/students';
import { getApiBaseUrl, getErrorMessage, getStoredToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NumericKeypad } from '../components/NumericKeypad';
import type { Student } from '../types/api';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'StudentLookup'>;

const MAX_NUMBER_LENGTH = 20;

export function StudentLookupScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>(undefined);

  const resetResult = () => {
    setStudent(null);
    setError(null);
  };

  const onDigit = (digit: string) => {
    setNumber((prev) => (prev.length >= MAX_NUMBER_LENGTH ? prev : prev + digit));
    resetResult();
  };

  const onBackspace = () => {
    setNumber((prev) => prev.slice(0, -1));
    resetResult();
  };

  const onClear = () => {
    setNumber('');
    resetResult();
  };

  const onSearch = async () => {
    if (!number.trim()) return;
    setLoading(true);
    setError(null);
    setStudent(null);
    try {
      const found = await lookupStudentByNumber(number.trim());
      setStudent(found);
      if (found.photo_url) {
        const token = await getStoredToken();
        setPhotoHeaders(token ? { Authorization: `Bearer ${token}` } : undefined);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onContinue = () => {
    if (student) navigation.navigate('ReasonSelect', { student });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('MyNotes')}>
          <Text style={styles.headerLink}>Geçmiş</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('ChangePassword')}>
            <Text style={styles.headerLink}>Şifre</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void logout()}>
            <Text style={styles.logout}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.numberDisplay}>
        <Text style={[styles.numberText, !number && styles.numberPlaceholder]}>
          {number || 'Öğrenci numarası'}
        </Text>
      </View>

      <ScrollView style={styles.resultArea} contentContainerStyle={styles.resultContent} keyboardShouldPersistTaps="handled">
        {error && <Text style={styles.error}>{error}</Text>}

        {student && (
          <View style={styles.card}>
            {student.photo_url ? (
              <Image
                source={{ uri: `${getApiBaseUrl() ?? ''}${student.photo_url}`, headers: photoHeaders }}
                style={styles.photo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>Foto Yok</Text>
              </View>
            )}
            <Text style={styles.name}>
              {student.first_name} {student.last_name}
            </Text>
            <Text style={styles.meta}>
              {student.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : 'Sınıf yok'} · No:{' '}
              {student.student_number || '—'}
            </Text>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
              <Text style={styles.continueButtonText}>Bildirim Oluştur</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <NumericKeypad
        onDigit={onDigit}
        onBackspace={onBackspace}
        onClear={onClear}
        onSearch={() => void onSearch()}
        searchDisabled={!number.trim()}
        searchLoading={loading}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    headerLink: { color: colors.headerLink, fontSize: 15 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    logout: { color: colors.danger, fontSize: 15 },
    numberDisplay: {
      marginHorizontal: 20,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 56,
      justifyContent: 'center',
    },
    numberText: {
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: 2,
      color: colors.text,
      textAlign: 'center',
    },
    numberPlaceholder: {
      fontSize: 18,
      fontWeight: '500',
      letterSpacing: 0,
      color: colors.textMuted,
    },
    resultArea: { flex: 1 },
    resultContent: { paddingHorizontal: 20, paddingBottom: 12, flexGrow: 1 },
    error: { color: colors.danger, marginTop: 8, textAlign: 'center' },
    card: { marginTop: 12, alignItems: 'center' },
    photo: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.photoPlaceholder },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    photoPlaceholderText: { color: colors.textMuted },
    name: { fontSize: 20, fontWeight: '700', marginTop: 16, color: colors.text },
    meta: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
    continueButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 32,
      marginTop: 20,
    },
    continueButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
  });
}
