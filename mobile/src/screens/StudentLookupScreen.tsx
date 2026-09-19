import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { lookupStudentByNumber } from '../api/students';
import { getErrorMessage, getStoredToken } from '../api/client';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import type { Student } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'StudentLookup'>;

export function StudentLookupScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [photoHeaders, setPhotoHeaders] = useState<Record<string, string> | undefined>(undefined);

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
        <Text style={styles.title}>Öğrenci Ara</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('MyNotes')}>
            <Text style={styles.headerLink}>Geçmiş</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void logout()}>
            <Text style={styles.logout}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Öğrenci numarası"
          keyboardType="number-pad"
          value={number}
          onChangeText={setNumber}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={onSearch} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchButtonText}>Ara</Text>}
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {student && (
        <View style={styles.card}>
          {student.photo_url ? (
            <Image
              source={{ uri: `${API_BASE_URL}${student.photo_url}`, headers: photoHeaders }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerLink: { color: '#1677ff', fontSize: 15 },
  logout: { color: '#d4380d', fontSize: 15 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  searchButton: { backgroundColor: '#1677ff', borderRadius: 8, paddingHorizontal: 20, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#d4380d', marginTop: 16, textAlign: 'center' },
  card: { marginTop: 24, alignItems: 'center' },
  photo: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#f0f2f5' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { color: '#98a2b3' },
  name: { fontSize: 20, fontWeight: '700', marginTop: 16 },
  meta: { fontSize: 15, color: '#667085', marginTop: 4 },
  continueButton: { backgroundColor: '#1677ff', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24 },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
