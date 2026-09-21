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
  requestTeacherRegisterSms,
  resendTeacherRegisterEmail,
  startTeacherRegister,
  verifyTeacherRegister,
} from '../api/auth';
import { getErrorMessage } from '../api/client';
import type { AuthStackParamList } from '../navigation/types';
import type { ThemeColors } from '../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Step = 'school' | 'identity' | 'email' | 'sms';

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

  const [personnelNo, setPersonnelNo] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [pendingToken, setPendingToken] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [smsRequested, setSmsRequested] = useState(false);

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
    if (!personnelNo.trim() || !lastName.trim() || !email.trim()) {
      setError('Sicil numarası, soyad ve e-posta gerekli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await startTeacherRegister({
        school_id: school.id,
        personnel_no: personnelNo.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      });
      setPendingToken(result.pending_token);
      setEmailHint(result.email_hint);
      setEmailSent(result.email_sent);
      setCode('');
      if (result.email_sent) {
        setStep('email');
      } else {
        setError(result.email_error || 'E-posta gönderilemedi. Telefon ile doğrulayın.');
        setStep('sms');
      }
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

  const onResendEmail = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await resendTeacherRegisterEmail(pendingToken);
      setEmailHint(result.email_hint);
      setEmailSent(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSendSms = async () => {
    if (!phone.trim()) {
      setError('Cep telefonu gerekli');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await requestTeacherRegisterSms(pendingToken, phone.trim());
      setPhoneHint(result.phone_hint);
      setSmsRequested(true);
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
          {step === 'identity' && 'Sicil numarası, soyad ve e-posta ile öğretmen kaydınız eşleştirilir.'}
          {step === 'email' &&
            `Doğrulama kodu ${emailHint} adresine gönderildi. Maildeki 6 haneyi girin; boşluklar otomatik silinir. Varsayılan şifreniz sicil numaranızdır.`}
          {step === 'sms' && 'E-postanıza erişemiyorsanız cep telefonunuza kod gönderilir.'}
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
              placeholder="Sicil numarası"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={personnelNo}
              onChangeText={setPersonnelNo}
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
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.button} onPress={() => void onStart()} disabled={submitting}>
              {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Kaydı Başlat</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('school')}>
              <Text style={styles.link}>Okul seçimine dön</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'email' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="6 haneli e-posta kodu"
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
            <TouchableOpacity onPress={() => void onResendEmail()} disabled={submitting}>
              <Text style={styles.link}>Kodu yeniden gönder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setCode('');
                setStep('sms');
              }}
            >
              <Text style={styles.link}>E-postama erişemiyorum</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'sms' && (
          <>
            {!smsRequested && (
              <TextInput
                style={styles.input}
                placeholder="Cep telefonu (05xx xxx xx xx)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            )}
            {smsRequested && (
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
              </>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {!smsRequested ? (
              <TouchableOpacity style={styles.button} onPress={() => void onSendSms()} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>SMS Gönder</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.button} onPress={() => void onVerify()} disabled={submitting}>
                {submitting ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.buttonText}>Doğrula ve Giriş Yap</Text>}
              </TouchableOpacity>
            )}
            {emailSent && (
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  setCode('');
                  setStep('email');
                }}
              >
                <Text style={styles.link}>E-posta koduna dön</Text>
              </TouchableOpacity>
            )}
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
