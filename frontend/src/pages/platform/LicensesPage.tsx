import { useCallback, useEffect, useState } from 'react'
import {
  App,
  Button,
  Collapse,
  DatePicker,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { CloseCircleOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../../components/AppLayout'
import { cancelLicense, createLicense, listLicenses } from '../../api/licenses'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import { LICENSE_PLANS, MODULE_LABELS, getLicensePlan } from '../../constants/licensePlans'
import type { License, LicenseStatus } from '../../types/license'
import type { TenantListItem } from '../../types/tenant'

const STATUS_LABEL: Record<LicenseStatus, { text: string; color: string }> = {
  active: { text: 'Aktif', color: 'green' },
  cancelled: { text: 'İptal Edildi', color: 'red' },
}

interface LicenseFormValues {
  tenant_id: number
  plan: string
  range?: [Dayjs, Dayjs | null] | null
  notes?: string
}

export function LicensesPage() {
  const { message, modal } = App.useApp()
  const [licenses, setLicenses] = useState<License[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<LicenseFormValues>()
  const selectedPlanName = Form.useWatch('plan', form)
  const selectedPlan = selectedPlanName ? getLicensePlan(selectedPlanName) : undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [licenseData, tenantData] = await Promise.all([listLicenses(), listTenants()])
      setLicenses(licenseData)
      setTenants(tenantData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async (values: LicenseFormValues) => {
    setSubmitting(true)
    try {
      const [starts, ends] = values.range || [null, null]
      await createLicense({
        tenant_id: values.tenant_id,
        plan: values.plan,
        starts_at: starts ? starts.toISOString() : undefined,
        ends_at: ends ? ends.toISOString() : null,
        notes: values.notes,
      })
      message.success('Lisans tanımlandı')
      setModalOpen(false)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onCancel = (license: License) => {
    modal.confirm({
      title: 'Lisansı iptal et',
      content: `${license.Tenant?.name || `#${license.tenant_id}`} hesabının "${license.plan}" lisansını iptal etmek istediğinize emin misiniz?`,
      okText: 'İptal Et',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await cancelLicense(license.id)
          message.success('Lisans iptal edildi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<License> = [
    {
      title: 'Hesap',
      render: (_: unknown, record) => record.Tenant?.name || `#${record.tenant_id}`,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      render: (plan: string) => {
        const def = getLicensePlan(plan)
        return def ? (
          <Tooltip title={def.summary}>
            <Space size={4}>
              {plan}
              <InfoCircleOutlined style={{ color: '#9ca3af' }} />
            </Space>
          </Tooltip>
        ) : (
          plan
        )
      },
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (status: LicenseStatus) => (
        <Tag color={STATUS_LABEL[status].color}>{STATUS_LABEL[status].text}</Tag>
      ),
    },
    {
      title: 'Başlangıç',
      dataIndex: 'starts_at',
      render: (value: string) => new Date(value).toLocaleDateString('tr-TR'),
    },
    {
      title: 'Bitiş',
      dataIndex: 'ends_at',
      render: (value: string | null) => (value ? new Date(value).toLocaleDateString('tr-TR') : 'Süresiz'),
    },
    {
      title: 'İşlemler',
      width: 120,
      render: (_: unknown, record) =>
        record.status === 'active' ? (
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => onCancel(record)}
          >
            İptal Et
          </Button>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  return (
    <AppLayout title="Lisans Yönetimi">
      <div style={{ maxWidth: 1100 }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Lisanslar
        </Typography.Title>

        <Collapse
          style={{ marginTop: 16, marginBottom: 24 }}
          items={[
            {
              key: 'plans',
              label: 'Plan Açıklamaları',
              children: (
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 4 }}
                  dataSource={LICENSE_PLANS}
                  renderItem={(plan) => (
                    <List.Item>
                      <Typography.Text strong>{plan.name}</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 13 }}>
                        {plan.summary}
                      </Typography.Paragraph>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#4b5563' }}>
                        {plan.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      <Space wrap style={{ marginTop: 8 }}>
                        {plan.modules.map((mod) => (
                          <Tag key={mod} color="blue">
                            {MODULE_LABELS[mod]}
                          </Tag>
                        ))}
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Yeni Lisans
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={licenses}
          pagination={{ pageSize: 20 }}
        />
      </div>

      <Modal
        title="Yeni Lisans Tanımla"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Tanımla"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ range: [dayjs(), null] }}>
          <Form.Item name="tenant_id" label="Hesap" rules={[{ required: true, message: 'Hesap seçin' }]}>
            <Select
              showSearch
              placeholder="Hesap seçin"
              optionFilterProp="label"
              options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
            />
          </Form.Item>
          <Form.Item name="plan" label="Plan" rules={[{ required: true, message: 'Plan seçin' }]}>
            <Select
              placeholder="Plan seçin"
              options={LICENSE_PLANS.map((plan) => ({ value: plan.name, label: plan.name }))}
            />
          </Form.Item>
          {selectedPlan && (
            <Typography.Paragraph type="secondary" style={{ marginTop: -12, fontSize: 13 }}>
              {selectedPlan.summary}
            </Typography.Paragraph>
          )}
          <Form.Item name="range" label="Başlangıç / Bitiş">
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder={['Başlangıç', 'Süresiz']}
              allowEmpty={[false, true]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Not">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Opsiyonel not" />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
