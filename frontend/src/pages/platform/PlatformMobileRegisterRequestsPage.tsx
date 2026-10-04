import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Input, Select, Space, Tag, Typography } from 'antd'
import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { SortableTable } from '../../components/SortableTable'
import {
  deletePlatformMobileRegisterRequest,
  listPlatformMobileRegisterRequests,
  setPlatformMobileRegisterVisibility,
} from '../../api/mobileRegisterRequests'
import { listTenants } from '../../api/tenants'
import { getErrorMessage } from '../../api/client'
import type { MobileRegisterRequest, MobileRegisterRequestStatus } from '../../types/mobileRegisterRequest'
import type { TenantListItem } from '../../types/tenant'
import { tablePagination } from '../../utils/tablePagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

function statusTag(status: MobileRegisterRequest['status']) {
  if (status === 'pending') return <Tag color="gold">Bekliyor</Tag>
  if (status === 'approved') return <Tag color="green">Onaylandı</Tag>
  return <Tag color="red">Reddedildi</Tag>
}

export function PlatformMobileRegisterRequestsPage() {
  const { message, modal } = App.useApp()
  const [rows, setRows] = useState<MobileRegisterRequest[]>([])
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<MobileRegisterRequestStatus | 'all'>('all')
  const [visibility, setVisibility] = useState<'all' | 'visible' | 'hidden'>('all')
  const [tenantId, setTenantId] = useState<number | undefined>()
  const searchQuery = useDebouncedValue(search)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(
        await listPlatformMobileRegisterRequests({
          q: searchQuery,
          status,
          visibility,
          tenant_id: tenantId,
        }),
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message, searchQuery, status, visibility, tenantId])

  useEffect(() => {
    void listTenants()
      .then(setTenants)
      .catch((err) => message.error(getErrorMessage(err)))
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onVisibility = async (row: MobileRegisterRequest, hidden: boolean) => {
    try {
      await setPlatformMobileRegisterVisibility(row.id, hidden)
      message.success(hidden ? 'Kurum listesinden gizlendi' : 'Kurum listesinde yeniden gösterildi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDelete = (row: MobileRegisterRequest) => {
    modal.confirm({
      title: 'Kayıt isteğini sil',
      content: `${row.full_name} talebi silinsin mi? Oluşmuş kullanıcı hesabı durur, yalnızca talep kaydı silinir.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        await deletePlatformMobileRegisterRequest(row.id)
        message.success('Kayıt isteği silindi')
        void load()
      },
    })
  }

  const columns: ColumnsType<MobileRegisterRequest> = useMemo(
    () => [
      { title: 'Kurum', dataIndex: 'tenant_name', render: (value: string | null) => value || '—' },
      { title: 'Ad soyad', dataIndex: 'full_name' },
      { title: 'T.C.', dataIndex: 'national_id', width: 130 },
      { title: 'Telefon', dataIndex: 'phone', width: 140 },
      { title: 'E-posta', dataIndex: 'email', render: (value: string | null) => value || '—' },
      {
        title: 'Durum',
        dataIndex: 'status',
        width: 110,
        render: (value: MobileRegisterRequest['status']) => statusTag(value),
      },
      {
        title: 'Kurumda',
        width: 120,
        render: (_: unknown, record: MobileRegisterRequest) =>
          record.hidden_at ? <Tag>Gizli</Tag> : <Tag color="blue">Görünür</Tag>,
      },
      {
        title: 'Tarih',
        dataIndex: 'created_at',
        width: 170,
        render: (value: string) => new Date(value).toLocaleString('tr-TR'),
      },
      {
        title: 'İşlemler',
        width: 280,
        render: (_: unknown, record: MobileRegisterRequest) => (
          <Space wrap>
            {record.hidden_at ? (
              <Button size="small" icon={<EyeOutlined />} onClick={() => void onVisibility(record, false)}>
                Tekrar göster
              </Button>
            ) : (
              <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => void onVisibility(record, true)}>
                Gizle
              </Button>
            )}
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
              Sil
            </Button>
          </Space>
        ),
      },
    ],
    [rows],
  )

  return (
    <AppLayout title="Mobil Kayıt İstekleri">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Mobil Kayıt İstekleri
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Tüm kurumlardaki mobil kayıt talepleri. Gizle ve tekrar göster kurumun listesini etkiler. Sil yalnızca talep
          kaydını kaldırır.
        </Typography.Paragraph>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Ad, T.C., telefon, e-posta, okul veya kurum"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 340 }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Kurum"
            style={{ width: 220 }}
            value={tenantId}
            onChange={(value) => setTenantId(value)}
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Tüm durumlar' },
              { value: 'pending', label: 'Bekliyor' },
              { value: 'approved', label: 'Onaylandı' },
              { value: 'rejected', label: 'Reddedildi' },
            ]}
          />
          <Select
            value={visibility}
            onChange={setVisibility}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Gizlilik: tümü' },
              { value: 'visible', label: 'Kurumda görünür' },
              { value: 'hidden', label: 'Kurumda gizli' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Yenile
          </Button>
        </Space>
        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </AppLayout>
  )
}
