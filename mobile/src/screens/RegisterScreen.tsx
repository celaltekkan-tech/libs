import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelectField, type SelectOption } from '../components/SelectField';
import { useTheme } from '../context/ThemeContext';
import {
  listRegisterDistricts,
  listRegisterProvinces,
  listRegisterSchools,
  startTeacherRegister,
} from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { AuthStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Step = 'school' | 'identity' | 'done';

export function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('school');
  const [provinces, setProvinces] = useState<SelectOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [schools, setSchools] = useState<SelectOption[]>([]);
  const [province, setProvince] = useState<SelectOption | null>(null);
  const [district, setDistrict] = useState<SelectOption | null>(null);
  const [school, setSchool] = useState<SelectOption | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);

  const [nationalId, setNationalId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openProvince, setOpenProvince] = useState(0);
  const [openDistrict, setOpenDistrict] = useState(0);
  const [openSchool, setOpenSchool] = useState(0);
  const provinceFocused = useRef(false);
  const districtFocusArmed = useRef(false);
  const schoolFocusArmed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void listRegisterProvinces()
      .then((rows) => {
        if (cancelled) return;
        setProvinces(rows);
        if (!provinceFocused.current && rows.length > 0) {
          provinceFocused.current = true;
          setOpenProvince((token) => token + 1);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!province) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setLoadingGeo(true);
    void listRegisterDistricts(province.id)
      .then((rows) => {
        if (!cancelled) setDistricts(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingGeo(false);
        if (districtFocusArmed.current) {
          districtFocusArmed.current = false;
          setOpenDistrict((token) => token + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [province]);

  useEffect(() => {
    if (!province || !district) {
      setSchools([]);
      return;
    }
    let cancelled = false;
    setLoadingGeo(true);
    void listRegisterSchools(province.id, district.id)
      .then((rows) => {
        if (!cancelled) setSchools(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingGeo(false);
        if (schoolFocusArmed.current) {
          schoolFocusArmed.current = false;
          setOpenSchool((token) => token + 1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [province, district]);

  const onSchoolNext = () => {
    if (!school) {
      setError('Lisanslı bir okul seçin');
      return;
    }
    setError(null);
    setStep('identity');
  };

  const onStart = async () => {
    if (!school) return;
    if (!nationalId.trim() || !firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      setError('T.C. kimlik numarası, ad, soyad, cep telefonu ve e-posta gerekli');
      return;
    }
    if (!/^\d{11}$/.test(nationalId.trim())) {
      setError('T.C. kimlik numarası 11 hane olmalı');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await startTeacherRegister({
        school_id: school.id,
        national_id: nationalId.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setDoneMessage(result.message);
      setStep('done');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Öğretmen Kaydı</Text>
        <Text style={styles.subtitle}>
          {step === 'school' && 'Önce il, ilçe ve okulunuzu seçin. Yalnızca geçerli lisansı olan okullar listelenir.'}
          {step === 'identity' &&
            'T.C., ad soyad, telefon ve e-postanızı yazın. İstek okulunuza gider; onaylanınca T.C. ve okulun belirlediği şifreyle giriş yaparsınız.'}
          {step === 'done' && 'İsteğiniz gönderildi.'}
        </Text>

        {step === 'school' && (
          <>
            <SelectField
              label="İl"
              placeholder="İl seçin"
              value={province}
              options={provinces}
              openToken={openProvince}
              onSelect={(row) => {
                setProvince(row);
                setDistrict(null);
                setSchool(null);
                setDistricts([]);
                setSchools([]);
                setError(null);
                districtFocusArmed.current = true;
                schoolFocusArmed.current = false;
              }}
            />
            <SelectField
              label="İlçe"
              placeholder={province ? 'İlçe seçin' : 'Önce il seçin'}
              value={district}
              options={districts}
              disabled={!province}
              loading={loadingGeo && Boolean(province) && !district}
              openToken={openDistrict}
              onSelect={(row) => {
                setDistrict(row);
                setSchool(null);
                setSchools([]);
                setError(null);
                schoolFocusArmed.current = true;
              }}
            />
            <SelectField
              label="Okul"
              placeholder={district ? 'Okul seçin' : 'Önce ilçe seçin'}
              value={school}
              options={schools}
              disabled={!district}
              loading={loadingGeo && Boolean(district)}
              emptyText="Bu ilçede lisanslı okul bulunamadı"
              openToken={openSchool}
              onSelect={(row) => {
                setSchool(row);
                setError(null);
              }}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={onSchoolNext}>
              <Text style={styles.buttonText}>Devam</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'identity' && (
          <>
            <Text style={styles.schoolName}>{school?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder="T.C. kimlik numarası"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={11}
              value={nationalId}
              onChangeText={(value) => setNationalId(value.replace(/\D/g, '').slice(0, 11))}
            />
            <TextInput
              style={styles.input}
              placeholder="Ad"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={firstName}
              onChangeText={setFirstName}
            />
            <TextInput
              style={styles.input}
              placeholder="Soyad"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={lastName}
              onChangeText={setLastName}
            />
            <TextInput
              style={styles.input}
              placeholder="Cep telefonu (05xx xxx xx xx)"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="E-posta"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={() => void onStart()} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.buttonText}>Kayıt İsteği Gönder</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('school')}>
              <Text style={styles.link}>Okul seçimine dön</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.doneText}>{doneMessage}</Text>
            <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
              <Text style={styles.buttonText}>Girişe dön</Text>
            </TouchableOpacity>
          </>
        )}

        {step !== 'done' && (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Hesabım var, giriş yap</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 24, paddingBottom: 32 },
    title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
    schoolName: { fontSize: 15, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: 16 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      color: colors.text,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 12,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '600' },
    error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
    link: { color: colors.headerLink, textAlign: 'center', marginTop: 16, fontSize: 14 },
    doneText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 16,
    },
  });
}
