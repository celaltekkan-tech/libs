import { useEffect, useState } from 'react'
import { App, Button, Card, Checkbox, Col, Form, Input, InputNumber, Row, Space, Typography } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { updateTimetableProject } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { DAY_OPTIONS } from '../../types/scheduleEntry'
import { WEIGHT_LABELS, type TimetableWeights } from '../../types/timetable'
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
          <Card title="Okul zaman çizelgesi" size="small" style={{ marginBottom: 16 }}>
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
              <Form.Item name="periods_per_day" label="Günlük ders saati" rules={[{ required: true }]}>
                <InputNumber min={1} max={12} />
              </Form.Item>
              <Form.Item
                name="lunch_after"
                label="Öğle arası (kaçıncı saatten sonra)"
                extra="Blok dersler öğle arasına bölünmez. Boş bırakılabilir."
              >
                <InputNumber min={1} max={11} />
              </Form.Item>
            </Space>
          </Card>
          <Card title="Çözüm ayarları" size="small" style={{ marginBottom: 16 }}>
            <Space size="large" wrap>
              <Form.Item
                name="time_limit"
                label="Süre sınırı (saniye)"
                extra="Uzun süre daha iyi sonuç verir; 60-180 sn çoğu okul için yeterli."
              >
                <InputNumber min={10} max={600} step={30} />
              </Form.Item>
              <Form.Item
                name="max_subject_daily"
                label="Bir ders bir şubede günde en fazla"
                extra="Blok uzunluğu bundan büyükse blok uzunluğu esas alınır."
              >
                <InputNumber min={1} max={8} addonAfter="saat" />
              </Form.Item>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Kalite kuralları (ağırlıklar)" size="small" style={{ marginBottom: 16 }}>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Çözücü bu kuralların toplam cezasını en aza indirir. 0 kuralı kapatır; yüksek değer o kurala
              daha çok önem verir. Çakışmasızlık ve haftalık saatler her zaman kesin kuraldır.
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
