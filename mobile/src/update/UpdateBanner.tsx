import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { useStoreUpdate } from './useStoreUpdate';

// Mağazada yeni sürüm varsa ekranın altında gösterilen bildirim.
export function UpdateBanner() {
  const { status, startUpdate, dismiss } = useStoreUpdate();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (status === 'idle') return null;

  return (
    <View style={[styles.banner, { bottom: insets.bottom + 12 }]}>
      {status === 'downloading' ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>Güncelleme indiriliyor; bitince uygulama yeniden başlayacak.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.title}>Yeni sürüm mevcut</Text>
          <Text style={styles.text}>Uygulamanın yeni sürümü Google Play'de yayınlandı.</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={dismiss} style={styles.secondary}>
              <Text style={styles.secondaryText}>Sonra</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={startUpdate} style={styles.primary}>
              <Text style={styles.primaryText}>Güncelle</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      position: 'absolute',
      left: 12,
      right: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    text: { flexShrink: 1, fontSize: 14, color: colors.textSecondary },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
    secondary: { paddingVertical: 8, paddingHorizontal: 14 },
    secondaryText: { color: colors.textSecondary, fontWeight: '500' },
    primary: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.primary },
    primaryText: { color: colors.primaryText, fontWeight: '600' },
  });
}
