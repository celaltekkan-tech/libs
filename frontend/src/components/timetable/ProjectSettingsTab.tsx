import { useEffect, useState } from 'react'
import { App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Select, Space, Switch, TimePicker, Typography } from 'antd'
import { MinusCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { updateTimetableProject } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_OPTIONS } from '../../types/scheduleEntry'
import { DEFAULT_BELL, WEIGHT_LABELS, type BellSchedule, type TimetableWeights } from '../../types/timetable'
import { EffortPicker } from './EffortPicker'
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
  teacher_single_hour_day: 'Öğretmenin bir gün yalnızca 1 saat dersi olması',
  hard_subject_late: 'Zorluk seviyesi "zor" olan derslerin son iki saate düşmesi',
  soft_constraint: 'Ağırlığı belirtilmeyen esnek kısıtların ihlal cezası',
  availability_avoid: 'Zaman tablosunda sarı ("istenmiyor") işaretli saate ders konması',
  block_flex: 'Blok düzeni tutmuyorsa programın ne kadar esneyeceği',
}

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
      time_limit: project.settings.time_limit,
      max_culture_daily: project.settings.max_culture_daily ?? project.settings.max_subject_daily ?? 2,
      max_vocational_daily: project.settings.max_vocational_daily ?? 8,
      block_across_lunch: Boolean(project.settings.block_across_lunch),
      weights: project.settings.weights,
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
              Saniye yazmanıza gerek yok. Kısa çabuk biter, uzun daha düzgün program arar.
            </Typography.Paragraph>
            <Form.Item name="time_limit">
              <EffortPicker />
            </Form.Item>
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
              Sayılar önem puanıdır, birimi yoktur: birbirine göre kıyaslanır. Puanı 60 olan istek, puanı 6 olandan
              10 kat daha önemli sayılır. 0 kuralı kapatır. Öğretmen ve şube çakışmaması ile haftalık saatler her
              zaman korunur.
            </Typography.Paragraph>
            {(Object.keys(WEIGHT_LABELS) as Array<keyof TimetableWeights>)
              .filter((k) => k !== 'block_flex')
              .map((k) => (
              <Form.Item
                key={k}
                name={['weights', k]}
                label={WEIGHT_LABELS[k]}
                tooltip={WEIGHT_HELP[k]}
                layout="horizontal"
                labelCol={{ flex: 'auto' }}
                wrapperCol={{ flex: '150px' }}
                labelAlign="left"
                colon={false}
                style={{ marginBottom: 8 }}
              >
                <InputNumber min={0} max={1000} addonAfter="puan" style={{ width: '100%' }} />
              </Form.Item>
            ))}
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
