import { useEffect } from 'react'
import { Button, Divider, Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { DECISION_STATUS_OPTIONS, SANCTION_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineDecision, DisciplineParticipant, DisciplineRegulationArticle } from '../types/discipline'

interface DisciplineDecisionModalProps {
  open: boolean
  participants: DisciplineParticipant[]
  articles: DisciplineRegulationArticle[]
  editing: DisciplineDecision | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}

export function DisciplineDecisionModal({ open, participants, articles, editing, submitting, onCancel, onSubmit }: DisciplineDecisionModalProps) {
  const [form] = Form.useForm()
  const sanctionType = Form.useWatch('sanction_type', form)

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue(editing)
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'taslak', board_members: [] })
    }
  }, [open, editing, form])

  const accusedOptions = participants
    .filter((p) => p.role === 'suclanan')
    .map((p) => ({ value: p.id, label: p.Student ? `${p.Student.first_name} ${p.Student.last_name}` : `#${p.id}` }))

  const handleArticleChange = (id: number) => {
    const article = articles.find((a) => a.id === id)
    if (article) {
      form.setFieldsValue({
        regulation_article_text: article.article_no ? `Madde ${article.article_no} - ${article.title}` : article.title,
        sanction_type: article.default_sanction_type || form.getFieldValue('sanction_type'),
      })
    }
  }

  return (
    <Modal
      title="Ceza Verme Kararı"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={800}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="participant_id" label="Suçlanan Öğrenci" rules={[{ required: true, message: 'Öğrenci seçiniz' }]}>
          <Select options={accusedOptions} showSearch optionFilterProp="label" disabled={!!editing} />
        </Form.Item>

        <Space.Compact block>
          <Form.Item name="decision_no" label="Karar No" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="decision_date" label="Karar Tarihi" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>
        </Space.Compact>

        <Form.Item name="prior_sanctions_summary" label="Şimdiye Kadar Aldığı Cezalar">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider titlePlacement="left" plain>
          Cezayı Gerektiren Davranış
        </Divider>
        <Space.Compact block>
          <Form.Item name="behavior_date" label="Tarih" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="behavior_place" label="Yer" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="behavior_type" label="Davranışın Çeşidi">
          <Input />
        </Form.Item>
        <Form.Item name="behavior_reason" label="Davranışın Nedeni">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="statements_summary" label="İfade ve Delillerin Özeti">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item name="mitigating_aggravating_factors" label="Hafifletici / Ağırlaştırıcı Nedenler">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="board_opinion" label="Kurulun Kanaati">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider titlePlacement="left" plain>
          Ceza
        </Divider>
        <Form.Item name="regulation_article_id" label="Yönetmelik Maddesi (MEB kütüphanesinden seç)">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            options={articles.map((a) => ({ value: a.id, label: a.article_no ? `Madde ${a.article_no} - ${a.title}` : a.title }))}
            onChange={handleArticleChange}
          />
        </Form.Item>
        <Form.Item name="regulation_article_text" label="Madde Metni (manuel düzenlenebilir)">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Space.Compact block>
          <Form.Item name="sanction_type" label="Verilen Ceza" style={{ flex: 1 }} rules={[{ required: true, message: 'Ceza türü seçiniz' }]}>
            <Select options={SANCTION_TYPE_OPTIONS} />
          </Form.Item>
          {(sanctionType === 'okuldan_kisa_sureli_uzaklastirma' || sanctionType === 'okuldan_uzun_sureli_uzaklastirma') && (
            <Form.Item name="sanction_days" label="Gün Sayısı" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Space.Compact>
        <Form.Item name="board_decision" label="Kurulun Kararı">
          <Input.TextArea rows={2} />
        </Form.Item>

        <Divider titlePlacement="left" plain>
          Kurul Üyeleri
        </Divider>
        <Form.List name="board_members">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item name={[field.name, 'name']} style={{ width: 240, marginBottom: 0 }}>
                    <Input placeholder="Üye Adı Soyadı" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'title']} style={{ width: 240, marginBottom: 0 }}>
                    <Input placeholder="Görevi" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add({ name: '', title: '' })} icon={<PlusOutlined />}>
                Üye Ekle
              </Button>
            </>
          )}
        </Form.List>

        <Divider titlePlacement="left" plain>
          Onay
        </Divider>
        <Space.Compact block>
          <Form.Item name="approved_by" label="Okul Müdürü" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="approved_date" label="Onay Tarihi" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="status" label="Durum" rules={[{ required: true }]}>
          <Select options={DECISION_STATUS_OPTIONS} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
