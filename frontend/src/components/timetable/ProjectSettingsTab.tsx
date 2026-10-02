import { useEffect, useState } from 'react'
import { App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Select, Space, Switch, TimePicker, Tooltip, Typography } from 'antd'
import { MinusCircleOutlined, PlusOutlined, QuestionCircleOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { updateTimetableProject } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_OPTIONS } from '../../types/scheduleEntry'
import { DEFAULT_BELL, WEIGHT_LABELS, type BellSchedule, type SameClassSubjectsMode, type TimetableWeights } from '../../types/timetable'
import { EffortPicker } from './EffortPicker'
import { ImportanceSlider } from './ImportanceSlider'
import type { TimetableCtx } from './shared'

interface FormValues {
  name: string
  academic_year: string | null
  days: number[]
  periods_per_day: number
  lunch_after: number | null
  time_limit: number
  max_culture_daily: number
  max_vocational_daily: number
  block_across_lunch: boolean
  weights: TimetableWeights
  bell: BellSchedule
  gap_seconds: number
  split_double: boolean
  merge_singles: boolean
  merge_two_one: boolean
  eliminate_gaps: boolean
  free_day: boolean
  same_class_subjects: SameClassSubjectsMode
  prioritize_difficulty: boolean
  max_daily_hours: number
  max_windows: number
  workers: number
  algorithms: Array<'cpsat' | 'greedy' | 'local'>
}

function breakList(periods: number, saved: number[] | undefined, fallback: number): number[] {
  const count = Math.max(0, periods - 1)
  return Array.from({ length: count }, (_, index) => {
    const value = saved?.[index]
    return value == null || Number.isNaN(Number(value)) ? fallback : Number(value)
  })
}

const WEIGHT_HELP: Record<keyof TimetableWeights, string> = {
  teacher_gaps: 'Öğretmenin iki dersi arasında boş saat kalması',
  class_compact: 'Şubenin günü 1. saatte başlamaması veya arada boş saat kalması',
  teacher_single_hour_day: 'Öğretmenin bir gün yalnızca 1 saat dersi olmaması',
  hard_subject_late: 'Zorluk seviyesi "zor" olan derslerin son iki saate düşmemesi',
  soft_constraint: 'Ağırlığı belirtilmeyen esnek kısıtların ihlal cezası',
  availability_avoid: 'Zaman tablosunda sarı ("istenmiyor") işaretli saate ders konması',
  block_flex: 'Blok düzeni tutmuyorsa programın ne kadar esneyeceği',
  teacher_day_off: 'Boş gün istenirken öğretmenin her gün okula gelmesi. "Öğretmenlere boş gün vermeye çalış" kapalıysa bu puan kullanılmaz.',
}

type AlgorithmKey = 'cpsat' | 'greedy' | 'local'

const ALGORITHM_INFO: Array<{ value: AlgorithmKey; label: string; help: string }> = [
  {
    value: 'cpsat',
    label: 'Kısıt çözücü',
    help: 'Bütün dersleri, kesin kuralları ve önem puanlarını tek bir matematik modeline çevirir; "Dağıtım süresi" boyunca arar ve bulabildiği en iyi programı çıkarır. Kesin kuralların tamamını denetleyen tek algoritma budur: kilitli dersler ve diğer ikisinin tanımadığı özel kurallar yalnız burada geçerli olur. En yavaşıdır ama en güvenilir sonucu verir, bu yüzden kapatmanız önerilmez.',
  },
  {
    value: 'greedy',
    label: 'Sıkışık ders önce',
    help: 'Haftalık saati en çok olan ve en fazla öğretmeni ilgilendiren dersleri en başta yerleştirir, kolay yerleşenleri sona bırakır; böylece sıkışık dersler yer bulamadan kalmaz. Saniyeler içinde biter, rastgele birkaç farklı sıra dener ve cezası en düşük olanı saklar. Kesin kuralı bozan programı kabul etmez. Kilitli ders varsa veya tanımadığı bir kesin kural girilmişse çalışmaz, raporda sebebini yazar.',
  },
  {
    value: 'local',
    label: 'Yerel iyileştirme',
    help: '"Sıkışık ders önce" ile çıkan programı alır, ders bloklarını başka gün ve saatlere taşıyarak pencere, boşluk ve şube sıkışıklığı cezasını düşürmeye çalışır. Yalnızca cezayı gerçekten azaltan taşımayı tutar, kötüleşirse bloğu eski yerine koyar. Tek başına seçilse de o başlangıç programı yine üretilir; sonuç olarak iyileştirilmiş hâli kıyaslamaya girer. Hızlıdır, ancak kısıt çözücü kadar derin aramaz.',
  },
]

export function ProjectSettingsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const { project } = ctx
  const periods = Form.useWatch('periods_per_day', form) || project.periods_per_day
  const lunchAfter = Form.useWatch('lunch_after', form)

  useEffect(() => {
    form.setFieldsValue({
      name: project.name,
      academic_year: project.academic_year,
      days: project.days,
      periods_per_day: project.periods_per_day,
      lunch_after: project.lunch_after,
      time_limit: project.settings.distribution?.place_seconds || project.settings.time_limit,
      max_culture_daily: project.settings.max_culture_daily ?? project.settings.max_subject_daily ?? 2,
      max_vocational_daily: project.settings.max_vocational_daily ?? 8,
      block_across_lunch: Boolean(project.settings.block_across_lunch),
      weights: project.settings.weights,
      gap_seconds: project.settings.distribution?.gap_seconds ?? 90,
      split_double: project.settings.distribution?.split_double ?? true,
      merge_singles: project.settings.distribution?.merge_singles ?? true,
      merge_two_one: project.settings.distribution?.merge_two_one ?? true,
      eliminate_gaps: project.settings.distribution?.eliminate_gaps ?? true,
      free_day: Boolean(project.settings.distribution?.free_day),
      same_class_subjects: project.settings.distribution?.same_class_subjects ?? 'off',
      prioritize_difficulty: Boolean(project.settings.distribution?.prioritize_difficulty),
      max_daily_hours: project.settings.distribution?.max_daily_hours ?? 0,
      max_windows: project.settings.distribution?.max_windows ?? 25,
      workers: project.settings.distribution?.workers ?? 4,
      algorithms: project.settings.distribution?.algorithms?.length
        ? project.settings.distribution.algorithms
        : project.settings.distribution?.methods === 'single'
          ? ['cpsat']
          : ['cpsat', 'greedy', 'local'],
      bell: {
        ...DEFAULT_BELL,
        ...(project.settings.bell || {}),
        breaks: breakList(
          project.periods_per_day,
          project.settings.bell?.breaks,
          project.settings.bell?.break_minutes ?? DEFAULT_BELL.break_minutes,
        ),
        day_breaks: project.settings.bell?.day_breaks || [],
      },
    })
  }, [project, form])

  useEffect(() => {
    const count = Math.max(0, periods - 1)
    const current = (form.getFieldValue(['bell', 'breaks']) || []) as number[]
    if (current.length === count) return
    const fallback = form.getFieldValue(['bell', 'break_minutes']) ?? DEFAULT_BELL.break_minutes
    form.setFieldValue(['bell', 'breaks'], breakList(periods, current, fallback))
  }, [periods, form])

  const onSave = async (values: FormValues) => {
    setSaving(true)
    try {
      await updateTimetableProject(project.id, {
        name: values.name,
        academic_year: values.academic_year || null,
        days: [...values.days].sort(),
        periods_per_day: values.periods_per_day,
        lunch_after: values.lunch_after || null,
        settings: {
          time_limit: values.time_limit,
          max_subject_daily: values.max_culture_daily,
          max_culture_daily: values.max_culture_daily,
          max_vocational_daily: values.max_vocational_daily,
          block_across_lunch: values.block_across_lunch,
          weights: values.weights,
          distribution: {
            place_seconds: values.time_limit,
            gap_seconds: values.gap_seconds,
            split_double: values.split_double,
            merge_singles: values.merge_singles,
            merge_two_one: values.merge_two_one,
            eliminate_gaps: values.eliminate_gaps,
            free_day: values.free_day,
            same_class_subjects: values.same_class_subjects,
            prioritize_difficulty: values.prioritize_difficulty,
            max_daily_hours: values.max_daily_hours,
            max_windows: values.max_windows,
            workers: values.workers,
            algorithms: values.algorithms?.length ? values.algorithms : ['cpsat'],
            methods: values.algorithms?.length === 1 && values.algorithms[0] === 'cpsat' ? 'single' : 'all',
          },
          bell: {
            ...values.bell,
            break_minutes: values.bell?.breaks?.[0] ?? values.bell?.break_minutes ?? DEFAULT_BELL.break_minutes,
            breaks: breakList(values.periods_per_day, values.bell?.breaks, values.bell?.break_minutes ?? DEFAULT_BELL.break_minutes),
            day_breaks: (values.bell?.day_breaks || []).filter((item) => item && item.day && item.after_period),
          },
        },
      })
      message.success('Ayarlar kaydedildi')
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={onSave} disabled={!ctx.canUpdate}>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="1. Okul ne zaman başlıyor?" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="name" label="Çalışma adı" rules={[{ required: true, message: 'Ad gerekli' }]}>
              <Input maxLength={150} />
            </Form.Item>
            <Form.Item name="academic_year" label="Eğitim öğretim yılı" extra="Yayınlanınca ders programı bu yıla yazılır.">
              <Input placeholder="2026-2027" maxLength={20} />
            </Form.Item>
            <Form.Item
              name="days"
              label="Ders günleri"
              extra="İşaretli günler zaman tablosunda görünür ve açık/kapalı saate katılır. Cumartesi ve pazar işaretli değilse çizelgede yer almaz."
              rules={[{ required: true, message: 'En az bir gün seçin' }]}
            >
              <Checkbox.Group options={DAY_OPTIONS} />
            </Form.Item>
            <Space size="large" wrap>
              <Form.Item
                name={['bell', 'start_time']}
                label="İlk dersin başlama saati"
                getValueProps={(value: string) => ({ value: value ? dayjs(value, 'HH:mm') : null })}
                getValueFromEvent={(value) => (value ? value.format('HH:mm') : DEFAULT_BELL.start_time)}
              >
                <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} />
              </Form.Item>
              <Form.Item name={['bell', 'lesson_minutes']} label="Bir ders kaç dakika">
                <InputNumber min={20} max={120} addonAfter="dk" />
              </Form.Item>
            </Space>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
              Her teneffüs ayrı yazılır. Örneğin 1. teneffüs 10 dakika, 2. teneffüs 5 dakika olabilir. Öğle arası en az 30 dakikadır.
            </Typography.Paragraph>
            <Button
              size="small"
              style={{ marginBottom: 12 }}
              onClick={() => {
                const first = form.getFieldValue(['bell', 'breaks', 0]) ?? form.getFieldValue(['bell', 'break_minutes']) ?? 10
                const count = Math.max(0, Number(form.getFieldValue('periods_per_day') || periods) - 1)
                form.setFieldValue(['bell', 'breaks'], Array.from({ length: count }, () => first))
              }}
            >
              Tüm teneffüslere ata
            </Button>
            <Space size="middle" wrap>
              {Array.from({ length: Math.max(0, periods - 1) }, (_, index) => (
                <Form.Item
                  key={index}
                  name={['bell', 'breaks', index]}
                  label={lunchAfter === index + 1 ? `${index + 1}. ara (öğle)` : `${index + 1}. teneffüs`}
                >
                  <InputNumber min={0} max={120} addonAfter="dk" />
                </Form.Item>
              ))}
            </Space>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Bazı günler değişebilir. Örneğin cuma namazı için 4. dersten sonra teneffüsü uzatın.
            </Typography.Paragraph>
            <Form.Item label="Güne özel teneffüs">
              <Form.List name={['bell', 'day_breaks']}>
                {(fields, { add, remove }) => (
                  <Space direction="vertical">
                    {fields.map((field) => (
                      <Space key={field.key} wrap align="baseline">
                        <Form.Item name={[field.name, 'day']} rules={[{ required: true, message: 'Gün' }]} style={{ marginBottom: 0 }}>
                          <Select style={{ width: 140 }} options={DAY_OPTIONS} placeholder="Gün" />
                        </Form.Item>
                        <Form.Item
                          name={[field.name, 'after_period']}
                          rules={[{ required: true, message: 'Ders' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <InputNumber min={1} max={12} addonAfter=". dersten sonra" />
                        </Form.Item>
                        <Form.Item name={[field.name, 'minutes']} rules={[{ required: true, message: 'Dakika' }]} style={{ marginBottom: 0 }}>
                          <InputNumber min={0} max={120} addonAfter="dk" />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(field.name)} />
                      </Space>
                    ))}
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ day: 5, after_period: 4, minutes: 40 })}>
                      Gün ekle
                    </Button>
                  </Space>
                )}
              </Form.List>
            </Form.Item>
            <Space size="large" wrap>
              <Form.Item name="periods_per_day" label="Günlük ders saati" rules={[{ required: true }]}>
                <InputNumber min={1} max={12} addonAfter="ders" />
              </Form.Item>
              <Form.Item
                name="lunch_after"
                label="Öğle arası"
                extra="Boş bırakılabilir. Şubeye özel öğle arası 'Sınıfa ders verme' adımında girilir."
              >
                <InputNumber min={1} max={11} addonAfter=". dersten sonra" />
              </Form.Item>
            </Space>
            <Form.Item
              name="block_across_lunch"
              label="Peş peşe dersler öğle arasını aşabilir"
              valuePropName="checked"
              extra="Kapalıyken hiçbir blok öğle arasıyla bölünmez. Açıkken yalnız 'Öğle arasıyla bölünmesin' isteğindeki dersler korunur."
            >
              <Switch />
            </Form.Item>
          </Card>
          <Card title="Programı ne kadar uğraştırsın?" size="small" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Önce geçerli bir program aranır, sonra pencereler ve boşluklar azaltılır. Kısa çabuk biter, uzun daha düzgün program arar.
            </Typography.Paragraph>
            <Form.Item name="time_limit" label="Dağıtım süresi">
              <EffortPicker />
            </Form.Item>
            <Form.Item name="gap_seconds" label="Karnıyarık yok etme süresi" extra="Pencere, boş gün ve şube sıkışıklığı bu sürede iyileştirilir.">
              <EffortPicker />
            </Form.Item>
            <Space size="large" wrap>
              <Form.Item
                name="algorithms"
                label="Algoritmalar"
                extra="Hepsi çalışır, aynı cezayla kıyaslanır ve en düşük cezalı program yazılır. Kısıt çözücü işçileri kendi içinde birkaç aramayı zaten birlikte dener."
                rules={[{ required: true, message: 'En az bir algoritma seçin' }]}
              >
                <Checkbox.Group
                  options={ALGORITHM_INFO.map((a) => ({
                    value: a.value,
                    label: (
                      <Space size={4}>
                        {a.label}
                        <Tooltip title={a.help} styles={{ root: { maxWidth: 360 } }}>
                          <Typography.Text
                            type="secondary"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                          >
                            <QuestionCircleOutlined />
                          </Typography.Text>
                        </Tooltip>
                      </Space>
                    ),
                  }))}
                />
              </Form.Item>
              <Form.Item name="workers" label="Kaç işlemci kullanılsın">
                <InputNumber min={1} max={8} />
              </Form.Item>
            </Space>
            <Space size="large" wrap>
              <Form.Item
                name="max_culture_daily"
                label="Kültür dersi bir şubede günde en fazla"
                extra="Matematik, edebiyat gibi dersler. 2 saat derseniz aynı kültür dersi bir günde 2 saati geçmez."
              >
                <InputNumber min={1} max={8} addonAfter="saat" />
              </Form.Item>
              <Form.Item
                name="max_vocational_daily"
                label="Meslek / atölye dersi bir şubede günde en fazla"
                extra="Atölye dersi bloktur. İllüstrasyon 8 saat ve sınır 8 ise o ders bir günde 8 saat olur. Kültür derslerini tek parça yapmaz. Dersi ders havuzunda Meslek olarak işaretleyin."
              >
                <InputNumber min={1} max={12} addonAfter="saat" />
              </Form.Item>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Neyi daha çok önemseyelim?" size="small" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              İşaretçiyi az ile çok arasında kaydırın. Çubuklar birbirine göre kıyaslanır: sağa çektiğiniz istek,
              solda kalan istekten daha önemli sayılır. Kapalı o kuralı tamamen devre dışı bırakır. Öğretmen ve şube
              çakışmaması ile haftalık saatler her zaman korunur.
            </Typography.Paragraph>
            {(Object.keys(WEIGHT_LABELS) as Array<keyof TimetableWeights>)
              .filter((k) => k !== 'block_flex' && k !== 'teacher_day_off' && k !== 'class_compact')
              .map((k) => (
              <Form.Item
                key={k}
                name={['weights', k]}
                label={WEIGHT_LABELS[k]}
                tooltip={WEIGHT_HELP[k]}
                colon={false}
                style={{ marginBottom: 4 }}
              >
                <ImportanceSlider />
              </Form.Item>
            ))}
          </Card>
          <Card title="Blok ve öğretmen kuralları" size="small" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Bu ayarlar çözücüye gider. Atamada bölme veya birleştirme kapatılmışsa o ders bu kutuların dışında kalır. Meslek ve atölye blokları kendiliğinden bölünmez.
              Öğretmene özel değerler Öğretmene ders atama sekmesinden girilir. 0, sınır yok demektir.
            </Typography.Paragraph>
            <Typography.Text strong>Blok dağıtılamazsa</Typography.Text>
            <Form.Item name="split_double" valuePropName="checked" style={{ marginBottom: 4 }}>
              <Checkbox>2 saatlik ders blokları 1+1 şeklinde bölünebilsin</Checkbox>
            </Form.Item>
            <Form.Item name="merge_singles" valuePropName="checked" style={{ marginBottom: 4 }}>
              <Checkbox>1+1 şeklindeki ders blokları birleştirilebilsin</Checkbox>
            </Form.Item>
            <Form.Item name="merge_two_one" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Checkbox>2+1 şeklindeki ders blokları 3 saatlik tek blok olabilsin</Checkbox>
            </Form.Item>
            <Form.Item name="eliminate_gaps" valuePropName="checked" style={{ marginBottom: 4 }}>
              <Checkbox>Karnıyarık sayısını yok etmeye çalış</Checkbox>
            </Form.Item>
            <Form.Item name="free_day" valuePropName="checked" style={{ marginBottom: 4 }}>
              <Checkbox>Öğretmenlere boş gün vermeye çalış</Checkbox>
            </Form.Item>
            <Form.Item name="prioritize_difficulty" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Ders havuzundaki zor derslere öncelik verilsin</Checkbox>
            </Form.Item>
            <Form.Item
              name="same_class_subjects"
              label="Öğretmenin aynı sınıfa verdiği farklı dersler"
              extra="Sığmazsa ders boş bırakılmaz. Kesin seçenekte program çıkmazsa çelişen kural yazılır."
            >
              <Select
                options={[
                  { value: 'off', label: 'Aynı güne gelebilir' },
                  { value: 'soft', label: 'Aynı güne gelmesin; sığmazsa aynı güne koy' },
                  { value: 'hard', label: 'Aynı güne gelmesin; sığmazsa çözücü durur' },
                ]}
              />
            </Form.Item>
            <Space size="large" wrap>
              <Form.Item name="max_daily_hours" label="Öğretmene 1 günde en fazla kaç saat" extra="0 = sınır yok">
                <InputNumber min={0} max={12} addonAfter="saat" />
              </Form.Item>
              <Form.Item name="max_windows" label="Haftalık programda en fazla pencere" extra="0 = sınır yok">
                <InputNumber min={0} max={40} addonAfter="pencere" />
              </Form.Item>
            </Space>
          </Card>
        </Col>
      </Row>
      {ctx.canUpdate && (
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
          Kaydet
        </Button>
      )}
    </Form>
  )
}
