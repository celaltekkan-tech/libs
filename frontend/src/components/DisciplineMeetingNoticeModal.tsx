import { useEffect } from 'react'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { NOTICE_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineMeetingNotice, DisciplineParticipant } from '../types/discipline'

interface DisciplineMeetingNoticeModalProps {
  open: boolean
  participants: DisciplineParticipant[]
  editing: DisciplineMeetingNotice | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}

export function DisciplineMeetingNoticeModal({ open, participants, editing, submitting, onCancel, onSubmit }: DisciplineMeetingNoticeModalProps) {
  const [form] = Form.useForm()
  const noticeType = Form.useWatch('notice_type', form) || 'ogrenciye_cagri'

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue(editing)
    } else {
      form.resetFields()
      form.setFieldsValue({ notice_type: 'ogrenciye_cagri', board_members: [] })
    }
  }, [open, editing, form])

  const participantOptions = participants.map((p) => ({
    value: p.id,
    label: p.Student ? `${p.Student.first_name} ${p.Student.last_name}` : `#${p.id}`,
  }))

  return (
    <Modal
      title="Çağrı Pusulası"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={640}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="notice_type" label="Tür" rules={[{ required: true }]}>
          <Select options={NOTICE_TYPE_OPTIONS} disabled={!!editing} />
        </Form.Item>

        {noticeType === 'ogrenciye_cagri' && (
          <Form.Item name="participant_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçiniz' }]}>
            <Select options={participantOptions} showSearch optionFilterProp="label" />
          </Form.Item>
        )}

        <Space.Compact block>
          <Form.Item name="meeting_date" label="Tarih" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="meeting_time" label="Saat" style={{ flex: 1 }}>
            <Input type="time" />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="location" label="Yer">
          <Input placeholder="Örn: Toplantı Odası" />
        </Form.Item>

        {noticeType === 'kurul_toplantisi' && (
          <>
            <Form.Item name="agenda" label="Gündem Maddeleri">
              <Input.TextArea rows={4} placeholder={'1- Açılış ve yoklama.\n2- Dosyaların görüşülmesi.\n3- Dilek ve temenniler.'} />
            </Form.Item>
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
          </>
        )}
      </Form>
    </Modal>
  )
}
