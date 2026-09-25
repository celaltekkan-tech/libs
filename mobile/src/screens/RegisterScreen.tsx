import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SelectField, type SelectOption } from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  listRegisterDistricts,
  listRegisterProvinces,
  listRegisterSchools,
  resendTeacherRegisterSms,
  startTeacherRegister,
  verifyTeacherRegister,
} from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { AuthStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Step = 'school' | 'identity' | 'sms';

export function RegisterScreen({ navigation }: Props) {
  const { applySession } = useAuth();
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
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');
  const [phoneHint, setPhoneHint] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listRegisterProvinces()
      .then((rows) => {
        if (!cancelled) setProvinces(rows);
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
    setLoadingGeo(true);
    void listRegisterDistricts(province.id)
      .then(setDistricts)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingGeo(false));
  }, [province]);

  useEffect(() => {
    if (!province || !district) {
      setSchools([]);
      return;
    }
    setLoadingGeo(true);
    void listRegisterSchools(province.id, district.id)
      .then(setSchools)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingGeo(false));
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
    if (!nationalId.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      setError('T.C. kimlik numarası, soyad, e-posta ve cep telefonu gerekli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await startTeacherRegister({
        school_id: school.id,
        national_id: nationalId.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setPendingToken(result.pending_token);
      setPhoneHint(result.phone_hint);
      setCode('');
      setStep('sms');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    const digits = code.replace(/\D/g, '');
    if (!/^\d{6}$/.test(digits)) {
      setError('6 haneli doğrulama kodunu girin');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await verifyTeacherRegister(pendingToken, digits);
      await applySession(session);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onResendSms = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await resendTeacherRegisterSms(pendingToken);
      setPhoneHint(result.phone_hint);
      setCode('');
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
            'T.C. kimlik numarası ve soyad ile öğretmen kaydınız eşleştirilir; doğrulama cep telefonunuza gelen SMS ile yapılır. Telefon, öğretmen kaydınızdaki numarayla aynı olmalıdır. E-posta adresiniz giriş için kullanıcı adı olur.'}
          {step === 'sms' &&
            `Doğrulama kodu ${phoneHint} numarasına gönderildi. Kodu girin; boşluklar otomatik silinir. Varsayılan şifreniz T.C. kimlik numaranızdır.`}
        </Text>

        {step === 'school' && (
          <>
            <SelectField
              label="İl"
              placeholder="İl seçin"
              value={province}
              options={provinces}
              onSelect={(row) => {
                setProvince(row);
                setDistrict(null);
                setSchool(null);
                setError(null);
              }}
            />
            <SelectField
              label="İlçe"
              placeholder={province ? 'İlçe seçin' : 'Önce il seçin'}
              value={district}
              options={districts}
              disabled={!province}
              loading={loadingGeo && Boolean(province) && !district}
              onSelect={(row) => {
                setDistrict(row);
                setSchool(null);
                setError(null);
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
              placeholder="Soyad"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              value={lastName}
              onChangeText={setLastName}
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
            <TextInput
              style={styles.input}
              placeholder="Cep telefonu (05xx xxx xx xx)"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={() => void onStart()} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Kaydı Başlat</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('school')}>
              <Text style={styles.link}>Okul seçimine dön</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'sms' && (
          <>
            <Text style={styles.hint}>Kod {phoneHint} numarasına gönderildi.</Text>
            <TextInput
              style={styles.input}
              placeholder="6 haneli SMS kodu"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={12}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={() => void onVerify()} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Doğrula ve Giriş Yap</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void onResendSms()} disabled={submitting}>
              <Text style={styles.link}>Kodu yeniden gönder</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Hesabım var, giriş yap</Text>
        </TouchableOpacity>
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
    hint: { color: colors.textSecondary, textAlign: 'center', marginBottom: 12 },
    link: { color: colors.headerLink, textAlign: 'center', marginTop: 16, fontSize: 14 },
  });
}
