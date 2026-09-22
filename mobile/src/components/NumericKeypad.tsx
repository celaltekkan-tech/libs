import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const ROWS: string[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['Sil', '0', '⌫'],
];

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSearch: () => void;
  searchDisabled?: boolean;
  searchLoading?: boolean;
}

export function NumericKeypad({
  onDigit,
  onBackspace,
  onClear,
  onSearch,
  searchDisabled,
  searchLoading,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleKey = (key: string) => {
    if (key === 'Sil') {
      onClear();
      return;
    }
    if (key === '⌫') {
      onBackspace();
      return;
    }
    onDigit(key);
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.keypadBackground,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      {ROWS.map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((key) => {
            const special = key === 'Sil' || key === '⌫';
            return (
              <Pressable
                key={key}
                onPress={() => handleKey(key)}
                onLongPress={key === '⌫' ? onClear : undefined}
                android_ripple={{ color: colors.keypadKeyPressed }}
                style={({ pressed }) => [
                  styles.key,
                  {
                    backgroundColor: special ? colors.keypadSpecial : colors.keypadKey,
                  },
                  pressed && { backgroundColor: colors.keypadKeyPressed },
                ]}
                accessibilityRole="button"
                accessibilityLabel={key === '⌫' ? 'Sil (son karakter)' : key === 'Sil' ? 'Tümünü sil' : key}
              >
                <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable
        onPress={onSearch}
        disabled={searchDisabled || searchLoading}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.searchKey,
          { backgroundColor: colors.keypadSearch },
          (searchDisabled || searchLoading) && styles.searchDisabled,
          pressed && !searchDisabled && !searchLoading && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Ara"
      >
        {searchLoading ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={[styles.searchText, { color: colors.primaryText }]}>Ara</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  key: {
    flex: 1,
    minHeight: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
  },
  searchKey: {
    minHeight: 54,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  searchDisabled: {
    opacity: 0.5,
  },
  searchText: {
    fontSize: 18,
    fontWeight: '700',
  },
});
