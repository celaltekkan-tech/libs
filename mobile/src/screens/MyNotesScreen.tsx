import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { listMyTeacherNotes } from '../api/teacherNotes';
import { getErrorMessage } from '../api/client';
import { useTheme } from '../context/ThemeContext';
import type { TeacherNote } from '../types/api';
import type { ThemeColors } from '../theme/colors';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function MyNotesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [notes, setNotes] = useState<TeacherNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listMyTeacherNotes();
      setNotes(rows);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={notes.length === 0 ? styles.emptyContent : styles.content}
      data={notes}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.emptyText}>Henüz bildirim oluşturmadınız</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.studentName}>
            {item.Student ? `${item.Student.first_name} ${item.Student.last_name}` : 'Öğrenci bilgisi yok'}
          </Text>
          {item.Student?.Classroom && (
            <Text style={styles.meta}>
              {item.Student.Classroom.class_level}/{item.Student.Classroom.section} · No:{' '}
              {item.Student.student_number || '—'}
            </Text>
          )}
          {item.tags.length > 0 && (
            <View style={styles.tagRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {item.note && <Text style={styles.note}>{item.note}</Text>}
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, gap: 12 },
    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
    card: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    studentName: { fontSize: 16, fontWeight: '700', color: colors.text },
    meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    tag: {
      backgroundColor: colors.primarySoft,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tagText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
    note: { fontSize: 14, color: colors.noteText, marginTop: 10 },
    date: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
  });
}
