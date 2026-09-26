import { useEffect, useState } from 'react'
import { App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Select, Space, TimePicker, Typography } from 'antd'
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
  max_subject_daily: number
  weights: TimetableWeights
  bell: BellSchedule
}

const WEIGHT_HELP: Record<keyof TimetableWeights, string> = {
  teacher_gaps: 'Öğretmenin iki dersi arasında boş saat kalması',
  class_compact: 'Şubenin günü 1. saatte başlamaması veya arada boş saat kalması',
  teacher_single_hour_day: 'Öğretmenin bir gün yalnızca 1 saat dersi olması',
  hard_subject_late: 'Zorluk seviyesi "zor" olan derslerin son iki saate düşmesi',
  soft_constraint: 'Ağırlığı belirtilmeyen esnek kısıtların ihlal cezası',
}

export function ProjectSettingsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const { project } = ctx

  useEffect(() => {
    form.setFieldsValue({
      name: project.name,
      academic_year: project.academic_year,
      days: project.days,
      periods_per_day: project.periods_per_day,
      lunch_after: project.lunch_after,
      time_limit: project.settings.time_limit,
      max_subject_daily: project.settings.max_subject_daily,
      weights: project.settings.weights,
      bell: {
        ...DEFAULT_BELL,
        ...(project.settings.bell || {}),
        day_breaks: project.settings.bell?.day_breaks || [],
      },
    })
  }, [project, form])

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
          max_subject_daily: values.max_subject_daily,
          weights: values.weights,
          bell: {
            ...values.bell,
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
            <Form.Item name="days" label="Ders günleri" rules={[{ required: true, message: 'En az bir gün seçin' }]}>
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
              <Form.Item name={['bell', 'break_minutes']} label="Teneffüs">
                <InputNumber min={0} max={60} addonAfter="dk" />
              </Form.Item>
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
                <InputNumber min={1} max={12} />
              </Form.Item>
              <Form.Item
                name="lunch_after"
                label="Öğle arası (kaçıncı dersten sonra)"
                extra="Boş bırakılabilir. Peş peşe dersler öğle arasına bölünmez."
              >
                <InputNumber min={1} max={11} />
              </Form.Item>
            </Space>
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
                name="max_subject_daily"
                label="Aynı ders bir şubede günde en fazla"
                extra="Peş peşe blok bundan uzunsa blok esas alınır."
              >
                <InputNumber min={1} max={8} addonAfter="saat" />
              </Form.Item>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Neyi daha çok önemseyelim?" size="small" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              0 kuralı kapatır. Büyük sayı, program hazırlanırken o isteğe daha çok uyar. Öğretmen ve şube
              çakışmaması ile haftalık saatler her zaman korunur.
            </Typography.Paragraph>
            {(Object.keys(WEIGHT_LABELS) as Array<keyof TimetableWeights>).map((k) => (
              <Form.Item key={k} name={['weights', k]} label={WEIGHT_LABELS[k]} extra={WEIGHT_HELP[k]}>
                <InputNumber min={0} max={1000} />
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
