import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { ThemeMode } from '../theme/colors';

interface Props {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: Props) {
  const { mode, setMode, colors } = useTheme();

  const options: Array<{ id: ThemeMode; label: string }> = [
    { id: 'light', label: 'Açık' },
    { id: 'dark', label: 'Koyu' },
  ];

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        { backgroundColor: colors.keypadBackground, borderColor: colors.border },
      ]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const active = mode === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => setMode(option.id)}
            style={[
              styles.option,
              compact && styles.optionCompact,
              active && { backgroundColor: colors.primary },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} tema`}
          >
            <Text
              style={[
                styles.label,
                compact && styles.labelCompact,
                { color: active ? colors.primaryText : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    alignSelf: 'center',
  },
  wrapCompact: {
    alignSelf: 'auto',
  },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  optionCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 12,
  },
});
