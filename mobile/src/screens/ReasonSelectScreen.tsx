import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getTagOptions, createTeacherNote } from '../api/teacherNotes';
import { getErrorMessage } from '../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'ReasonSelect'>;

export function ReasonSelectScreen({ route, navigation }: Props) {
  const { student } = route.params;

  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [note, setNote] = useState('');
  const [loadingTags, setLoadingTags] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const tags = await getTagOptions();
        setSuggestedTags(tags);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoadingTags(false);
      }
    })();
  }, []);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const addCustomTag = () => {
    const value = customInput.trim();
    if (!value) return;
    if (!customTags.includes(value)) setCustomTags((prev) => [...prev, value]);
    setCustomInput('');
  };

  const removeCustomTag = (tag: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  };

  const onSubmit = async () => {
    const tags = [...selectedTags, ...customTags];
    if (tags.length === 0 && !note.trim()) {
      setError('En az bir sebep seçin, ekleyin veya not yazın');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTeacherNote({ student_id: student.id, tags, note: note.trim() || undefined });
      Alert.alert('Kaydedildi', 'Bildirim disiplin ekranına iletildi', [
        { text: 'Tamam', onPress: () => navigation.navigate('StudentLookup') },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {student.first_name} {student.last_name}
      </Text>
      <Text style={styles.subtitle}>
        {student.Classroom ? `${student.Classroom.class_level}/${student.Classroom.section}` : ''} · No:{' '}
        {student.student_number || '—'}
      </Text>

      <Text style={styles.sectionLabel}>Sebep seçin (çoklu seçim)</Text>
      {loadingTags ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.chipRow}>
          {suggestedTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionLabel}>Kendi sebebinizi yazın</Text>
      <View style={styles.customRow}>
        <TextInput
          style={styles.customInput}
          placeholder="Örn: Ödev yapmama"
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={addCustomTag}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCustomTag}>
          <Text style={styles.addButtonText}>Ekle</Text>
        </TouchableOpacity>
      </View>
      {customTags.length > 0 && (
        <View style={styles.chipRow}>
          {customTags.map((tag) => (
            <TouchableOpacity key={tag} style={[styles.chip, styles.chipActive]} onPress={() => removeCustomTag(tag)}>
              <Text style={styles.chipTextActive}>{tag} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>Not (opsiyonel)</Text>
      <TextInput
        style={styles.noteInput}
        placeholder="Ek açıklama..."
        multiline
        numberOfLines={4}
        value={note}
        onChangeText={setNote}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.submitButton} onPress={onSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Gönder</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#667085', marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginTop: 16, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: '#1677ff', borderColor: '#1677ff' },
  chipText: { color: '#344054', fontSize: 14 },
  chipTextActive: { color: '#fff', fontSize: 14 },
  customRow: { flexDirection: 'row', gap: 8 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  addButton: { backgroundColor: '#344054', borderRadius: 8, paddingHorizontal: 18, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600' },
  noteInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  error: { color: '#d4380d', marginTop: 16, textAlign: 'center' },
  submitButton: { backgroundColor: '#1677ff', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
