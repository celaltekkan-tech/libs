import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';

export interface SelectOption {
  id: number;
  name: string;
}

interface Props {
  label: string;
  placeholder: string;
  value: SelectOption | null;
  options: SelectOption[];
  loading?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  emptyText?: string;
  onSelect: (option: SelectOption) => void;
}

export function SelectField({
  label,
  placeholder,
  value,
  options,
  loading,
  disabled,
  searchable = true,
  emptyText = 'Kayıt yok',
  onSelect,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return options;
    return options.filter((row) => row.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        disabled={disabled || loading}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <Text style={value ? styles.value : styles.placeholder}>
          {loading ? 'Yükleniyor…' : value?.name || placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.close}>Kapat</Text>
            </TouchableOpacity>
          </View>
          {searchable && (
            <TextInput
              style={styles.search}
              placeholder="Ara"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: 12 },
    label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
    field: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    fieldDisabled: { opacity: 0.5 },
    value: { color: colors.text, fontSize: 16 },
    placeholder: { color: colors.textMuted, fontSize: 16 },
    modal: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    close: { color: colors.headerLink, fontSize: 16 },
    search: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 12,
      fontSize: 16,
    },
    option: {
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
    },
    optionText: { color: colors.text, fontSize: 16 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  });
}
