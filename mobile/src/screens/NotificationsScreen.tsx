import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { getErrorMessage } from '../api/client';
import { useNotifications } from '../context/NotificationsContext';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';
import type { AppNotification } from '../types/api';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listMyNotifications());
      setError(null);
      await refreshUnreadCount();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onMarkAll = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
      setUnreadCount(0);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [setUnreadCount]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unreadCount > 0 ? (
          <Pressable onPress={() => void onMarkAll()} hitSlop={8}>
            <Text style={styles.headerAction}>Tümünü okundu say</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unreadCount, onMarkAll, styles]);

  const onPressItem = async (item: AppNotification) => {
    setExpandedId((prev) => (prev === item.id ? null : item.id));
    if (item.read_at) return;
    try {
      await markNotificationRead(item.id);
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: now } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

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
      contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.content}
      data={items}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.emptyText}>Bildiriminiz yok</Text>}
      renderItem={({ item }) => {
        const unread = !item.read_at;
        const expanded = expandedId === item.id;
        return (
          <Pressable
            onPress={() => void onPressItem(item)}
            style={[styles.card, unread && styles.cardUnread]}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
          >
            <View style={styles.titleRow}>
              {unread && <View style={styles.dot} />}
              <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={expanded ? undefined : 2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.body} numberOfLines={expanded ? undefined : 3}>
              {item.body}
            </Text>
            <Text style={styles.date}>
              {formatDate(item.created_at)}
              {item.Sender?.full_name ? ` · ${item.Sender.full_name}` : ''}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20 },
    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    emptyText: { color: colors.textSecondary, fontSize: 15 },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
    headerAction: { color: colors.headerLink, fontSize: 14, fontWeight: '600' },
    card: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    cardUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
    titleUnread: { fontWeight: '700' },
    body: { fontSize: 14, color: colors.noteText, marginTop: 6 },
    date: { fontSize: 12, color: colors.textMuted, marginTop: 10 },
  });
}
