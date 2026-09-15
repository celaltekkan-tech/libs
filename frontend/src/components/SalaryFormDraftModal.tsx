import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tabs,
  Typography,
} from 'antd'
import { DownloadOutlined, MinusCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { downloadSalaryForm, getSalaryFormDraft, saveSalaryFormDraft } from '../api/salaryForm'
import { getErrorMessage } from '../api/client'
import type { SalaryFormDraftPayload } from '../types/salaryForm'
import { downloadBlob } from '../utils/download'

interface Props {
  open: boolean
  onClose: () => void
  canSave: boolean
}

const EMPTY_PAYLOAD: SalaryFormDraftPayload = {
  institution_name: '',
  bank_branch: '',
  accounting_code: '',
  principal: '',
  form_date: '',
  previous_month_count: null,
  started_count: null,
  left_count: null,
  payable_count: null,
  departures: [],
  starters: [],
  other_changes: [],
  deductions: [],
  report_days: [],
  union_changes: [],
}

function PersonListFields({
  name,
  extraFields,
}: {
  name: string
  extraFields: Array<{ name: string; label: string; span?: number }>
}) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {fields.map((field) => (
            <Card
              key={field.key}
              size="small"
              title={`Kayıt ${field.name + 1}`}
              extra={
                <Button
                  type="text"
                  danger
                  icon={<MinusCircleOutlined />}
                  onClick={() => remove(field.name)}
                />
              }
            >
              <Row gutter={12}>
                <Col xs={24} md={8}>
                  <Form.Item {...field} name={[field.name, 'personnel_no']} label="Personel No">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item {...field} name={[field.name, 'full_name']} label="Ad Soyad">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item {...field} name={[field.name, 'national_id']} label="T.C. No">
                    <Input />
                  </Form.Item>
                </Col>
                {extraFields.map((ef) => (
                  <Col key={ef.name} xs={24} md={ef.span || 12}>
                    <Form.Item {...field} name={[field.name, ef.name]} label={ef.label}>
                      <Input />
                    </Form.Item>
                  </Col>
                ))}
                <Col xs={24}>
                  <Form.Item {...field} name={[field.name, 'documents']} label="Eklenecek belgeler">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
          <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>
            Satır ekle
          </Button>
        </Space>
      )}
    </Form.List>
  )
}

export function SalaryFormDraftModal({ open, onClose, canSave }: Props) {
  const { message } = App.useApp()
  const [form] = Form.useForm<SalaryFormDraftPayload>()
  const [period, setPeriod] = useState<Dayjs>(dayjs())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [periodLabel, setPeriodLabel] = useState<string>('')
  const [promotionCount, setPromotionCount] = useState(0)

  const loadDraft = useCallback(
    async (value: Dayjs) => {
      setLoading(true)
      try {
        const month = value.month() + 1
        const year = value.year()
        const data = await getSalaryFormDraft(month, year)
        form.setFieldsValue({ ...EMPTY_PAYLOAD, ...data.payload })
        setPeriodLabel(data.period_label || '')
        setPromotionCount(data.promotion_count || 0)
      } catch (err) {
        message.error(getErrorMessage(err))
        form.setFieldsValue(EMPTY_PAYLOAD)
      } finally {
        setLoading(false)
      }
    },
    [form, message],
  )

  useEffect(() => {
    if (open) void loadDraft(period)
  }, [open, period, loadDraft])

  const onSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await saveSalaryFormDraft(period.month() + 1, period.year(), values)
      message.success('Taslak kaydedildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const onExport = async () => {
    if (canSave) {
      try {
        const values = await form.validateFields()
        await saveSalaryFormDraft(period.month() + 1, period.year(), values)
      } catch (err) {
        message.error(getErrorMessage(err))
        return
      }
    }
    setExporting(true)
    try {
      const month = period.month() + 1
      const year = period.year()
      const blob = await downloadSalaryForm(month, year)
      downloadBlob(blob, `maas-degisiklik-${year}-${String(month).padStart(2, '0')}.xlsx`)
      message.success('Excel indirildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title="Maaş Değişikliği Bildirim Formu"
      open={open}
      onCancel={onClose}
      width={920}
      destroyOnHidden
      footer={
        <Space wrap>
          <Button onClick={onClose}>Kapat</Button>
          {canSave && (
            <Button icon={<SaveOutlined />} loading={saving} onClick={() => void onSave()}>
              Kaydet
            </Button>
          )}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => void onExport()}
          >
            Excel indir
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Form layout="vertical">
          <Form.Item label="İlgili ay / yıl" style={{ marginBottom: 8 }}>
            <DatePicker
              picker="month"
              value={period}
              onChange={(v) => v && setPeriod(v)}
              format="MMMM YYYY"
              style={{ width: 220 }}
              allowClear={false}
            />
          </Form.Item>
        </Form>

        <Alert
          type="info"
          showIcon
          message={
            periodLabel
              ? `Terfi dönemi: ${periodLabel} · DB'den otomatik dolacak terfi kaydı: ${promotionCount}`
              : `DB'den otomatik dolacak terfi kaydı: ${promotionCount}`
          }
          description="Kurum bilgileri, personel sayıları ve B/C/E/F/G/H bölümleri buradan kaydedilir. D) Terfi satırları onaylanmış terfi kayıtlarından gelir."
        />

        <Form form={form} layout="vertical" disabled={loading}>
          <Tabs
            items={[
              {
                key: 'header',
                label: 'Üst bilgi',
                children: (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item name="institution_name" label="Kurumun adı">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="bank_branch" label="Banka şubesi">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="accounting_code" label="Saymanlık kodu">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="principal" label="Okul müdürü / düzenleyen">
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="form_date" label="Form tarihi (GG.AA.YYYY)">
                        <Input placeholder="Boşsa bugünün tarihi" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="previous_month_count" label="Geçen ay personel">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="started_count" label="Bu ay giren">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="left_count" label="Bu ay çıkan">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="payable_count" label="Ödeme yapılacak">
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'departures',
                label: 'B) Ayrılan',
                children: (
                  <PersonListFields
                    name="departures"
                    extraFields={[
                      { name: 'leave_date', label: 'Ayrılış tarihi' },
                      { name: 'leave_reason', label: 'Ayrılma nedeni' },
                    ]}
                  />
                ),
              },
              {
                key: 'starters',
                label: 'C) Başlayan',
                children: (
                  <PersonListFields
                    name="starters"
                    extraFields={[
                      { name: 'iban', label: 'IBAN', span: 24 },
                      { name: 'start_reason', label: 'Başlama nedeni' },
                      { name: 'start_date', label: 'Başlama tarihi' },
                    ]}
                  />
                ),
              },
              {
                key: 'promotions',
                label: 'D) Terfi',
                children: (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Bu bölüm Excel'e veritabanındaki onaylanmış terfi kayıtlarından otomatik yazılır.
                    Terfi işlemi Öğretmenler sayfasından yapılır. Bu dönem için {promotionCount} kayıt
                    var.
                  </Typography.Paragraph>
                ),
              },
              {
                key: 'other',
                label: 'E) Diğer',
                children: (
                  <PersonListFields
                    name="other_changes"
                    extraFields={[
                      { name: 'previous_status', label: 'Önceki durumu' },
                      { name: 'new_status', label: 'Yeni durumu' },
                    ]}
                  />
                ),
              },
              {
                key: 'deductions',
                label: 'F) Kesinti',
                children: (
                  <PersonListFields
                    name="deductions"
                    extraFields={[
                      { name: 'reason', label: 'Kesinti nedeni' },
                      { name: 'amount', label: 'Miktar' },
                    ]}
                  />
                ),
              },
              {
                key: 'reports',
                label: 'G) Rapor',
                children: (
                  <PersonListFields
                    name="report_days"
                    extraFields={[
                      { name: 'start_date', label: 'Başlama tarihi' },
                      { name: 'days_after_7', label: '7 günden sonraki gün' },
                    ]}
                  />
                ),
              },
              {
                key: 'unions',
                label: 'H) Sendika',
                children: (
                  <PersonListFields
                    name="union_changes"
                    extraFields={[
                      { name: 'left_union', label: 'Ayrıldığı sendika' },
                      { name: 'joined_union', label: 'Girdiği sendika' },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Form>
      </Space>
    </Modal>
  )
}
