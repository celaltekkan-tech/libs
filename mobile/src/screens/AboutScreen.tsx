import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getApiBaseUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getAppVersionLabel } from '../update/appVersion';
import type { ThemeColors } from '../theme/colors';

const WEBSITE_URL = 'https://oids.com.tr';
const PANEL_URL = 'https://app.oids.com.tr';
const CONTACT_EMAIL = 'info@oids.com.tr';

export function AboutScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const rows: Array<{ label: string; value: string; url?: string }> = [
    { label: 'Sürüm', value: getAppVersionLabel() },
    { label: 'Sunucu', value: getApiBaseUrl() || '—' },
    ...(user ? [{ label: 'Oturum', value: `${user.full_name}\n${user.email}` }] : []),
    { label: 'Web sitesi', value: 'oids.com.tr', url: WEBSITE_URL },
    { label: 'Yönetim paneli', value: 'app.oids.com.tr', url: PANEL_URL },
    { label: 'İletişim', value: CONTACT_EMAIL, url: `mailto:${CONTACT_EMAIL}` },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} contentFit="contain" />
        <Text style={styles.appName}>OIDS</Text>
        <Text style={styles.tagline}>Okul İdare Sistemi</Text>
      </View>

      <Text style={styles.paragraph}>
        OIDS; öğrenci, öğretmen, ders programı, sınav, disiplin, izin ve veli iletişimi gibi okul idaresi işlerini tek
        panelden yönetmek için geliştirilmiş bir sistemdir. Mobil uygulama ile öğrenci numarasından öğrenciyi bulup
        idareye bildirim iletebilir, sistemden size gelen bildirimleri takip edebilirsiniz.
      </Text>

      <View style={styles.table}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <View style={styles.rowValueWrap}>
              {row.url ? (
                <Pressable onPress={() => void Linking.openURL(row.url!)} hitSlop={6}>
                  <Text style={[styles.rowValue, styles.link]}>{row.value}</Text>
                </Pressable>
              ) : (
                <Text style={styles.rowValue} selectable>
                  {row.value}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>© {new Date().getFullYear()} OIDS. Tüm hakları saklıdır.</Text>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 32 },
    hero: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
    logo: { width: 88, height: 88, borderRadius: 20 },
    appName: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 12 },
    tagline: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
    paragraph: { fontSize: 14, lineHeight: 21, color: colors.noteText, marginBottom: 20 },
    table: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, gap: 12 },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
    rowLabel: { width: 110, fontSize: 14, color: colors.textSecondary },
    rowValueWrap: { flex: 1 },
    rowValue: { fontSize: 14, color: colors.text, textAlign: 'right' },
    link: { color: colors.headerLink },
    footer: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  });
}
