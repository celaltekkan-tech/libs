import { useEffect } from 'react'
import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import { NOTIFICATION_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineNotification } from '../types/discipline'

interface DisciplineNotificationModalProps {
  open: boolean
  editing: DisciplineNotification | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}

export function DisciplineNotificationModal({ open, editing, submitting, onCancel, onSubmit }: DisciplineNotificationModalProps) {
  const [form] = Form.useForm()
  const notificationType = Form.useWatch('notification_type', form) || 'ogrenciye_ceza_bildirimi'

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue(editing)
    } else {
      form.resetFields()
      form.setFieldsValue({ notification_type: 'ogrenciye_ceza_bildirimi' })
    }
  }, [open, editing, form])

  return (
    <Modal
      title="Tebligat"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={600}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="notification_type" label="Tür" rules={[{ required: true }]}>
          <Select options={NOTIFICATION_TYPE_OPTIONS} disabled={!!editing} />
        </Form.Item>
        <Form.Item name="sent_date" label="Tebliğ Tarihi">
          <Input type="date" />
        </Form.Item>

        {notificationType === 'ceza_gunu_bildirimi' && (
          <Space.Compact block>
            <Form.Item name="sanction_start_date" label="Ceza Başlangıcı" style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
            <Form.Item name="sanction_end_date" label="Ceza Bitişi" style={{ flex: 1 }}>
              <Input type="date" />
            </Form.Item>
          </Space.Compact>
        )}

        {notificationType === 'veliye_bildirim' && (
          <Space.Compact block>
            <Form.Item name="broken_behavior_point" label="Kırılan Davranış Notu" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="remaining_behavior_point" label="Kalan Davranış Notu" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
        )}

        <Space.Compact block>
          <Form.Item name="acknowledged_by" label="Bilgi Edinen" style={{ flex: 1 }}>
            <Input />
          </Form.Item>
          <Form.Item name="acknowledged_date" label="Bilgi Edinme Tarihi" style={{ flex: 1 }}>
            <Input type="date" />
          </Form.Item>
        </Space.Compact>
      </Form>
    </Modal>
  )
}
