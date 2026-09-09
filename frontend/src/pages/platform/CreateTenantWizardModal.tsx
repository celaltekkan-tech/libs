import { useState } from 'react'
import { App, Divider, Form, Input, Modal, Select } from 'antd'
import { ApiError, getErrorMessage } from '../../api/client'
import { createTenant } from '../../api/tenants'
import { LICENSE_PLANS } from '../../constants/licensePlans'
import type { CreateTenantWizardPayload } from '../../types/tenant'

interface CreateTenantWizardModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateTenantWizardModal({ open, onClose, onCreated }: CreateTenantWizardModalProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<CreateTenantWizardPayload>()
  const [submitting, setSubmitting] = useState(false)

  async function handleOk() {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await createTenant(values)
      message.success('Hesap oluşturuldu')
      form.resetFields()
      onCreated()
    } catch (err) {
      if (err instanceof ApiError) {
        message.error(getErrorMessage(err))
      } else if (err && typeof err === 'object' && 'errorFields' in err) {
        // Form doğrulama hatası — antd zaten alan altında gösterir
      } else {
        message.error(getErrorMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    form.resetFields()
    onClose()
  }

  return (
    <Modal
      title="Yeni Hesap Oluştur"
      open={open}
      onOk={() => void handleOk()}
      onCancel={handleCancel}
      confirmLoading={submitting}
      okText="Oluştur"
      cancelText="Vazgeç"
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Divider titlePlacement="left" plain>
          Hesap
        </Divider>
        <Form.Item
          label="Hesap adı"
          name={['tenant', 'name']}
          rules={[{ required: true, message: 'Hesap adı zorunludur' }]}
        >
          <Input placeholder="Örn. Atatürk Anadolu Lisesi" />
        </Form.Item>
        <Form.Item label="Plan" name={['tenant', 'plan']}>
          <Select
            allowClear
            placeholder="Plan seçin (opsiyonel)"
            options={LICENSE_PLANS.map((plan) => ({ value: plan.name, label: plan.name }))}
          />
        </Form.Item>

        <Divider titlePlacement="left" plain>
          İlk Okul
        </Divider>
        <Form.Item
          label="Okul adı"
          name={['school', 'name']}
          rules={[{ required: true, message: 'Okul adı zorunludur' }]}
        >
          <Input placeholder="Örn. Atatürk Anadolu Lisesi" />
        </Form.Item>
        <Form.Item
          label="Okul kodu"
          name={['school', 'code']}
          rules={[{ required: true, message: 'Okul kodu zorunludur' }]}
        >
          <Input placeholder="Örn. ATA-001" />
        </Form.Item>

        <Divider titlePlacement="left" plain>
          İlk Yönetici
        </Divider>
        <Form.Item
          label="Ad soyad"
          name={['admin', 'full_name']}
          rules={[{ required: true, message: 'Ad soyad zorunludur' }]}
        >
          <Input placeholder="Ad Soyad" />
        </Form.Item>
        <Form.Item
          label="E-posta"
          name={['admin', 'email']}
          rules={[
            { required: true, message: 'E-posta zorunludur' },
            { type: 'email', message: 'Geçerli bir e-posta girin' },
          ]}
        >
          <Input placeholder="mudur@okul.local" />
        </Form.Item>
        <Form.Item
          label="Şifre"
          name={['admin', 'password']}
          rules={[
            { required: true, message: 'Şifre zorunludur' },
            { min: 8, message: 'Şifre en az 8 karakter olmalı' },
          ]}
        >
          <Input.Password placeholder="En az 8 karakter" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
