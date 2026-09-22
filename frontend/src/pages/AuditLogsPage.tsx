import { useCallback, useEffect, useState } from 'react'
import { App, Input, Select, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import { SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { listAuditLogs } from '../api/auditLogs'
import { getErrorMessage } from '../api/client'
import type { AuditLog } from '../types/auditLog'
import { tablePagination } from '../utils/tablePagination'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

const ACTION_LABEL: Record<string, string> = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  login: 'Giriş',
}

const ENTITY_LABEL: Record<string, string> = {
  teacher: 'Öğretmen',
  student: 'Öğrenci',
  classroom: 'Sınıf/Şube',
  school: 'Okul',
  user: 'Kullanıcı',
  auth: 'Oturum',
  profile: 'Profil',
}

const ACTION_COLOR: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'default',
}

export function AuditLogsPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search)
  const [action, setAction] = useState<string | undefined>()
  const [entityType, setEntityType] = useState<string | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listAuditLogs({
        q: searchQuery.trim() || undefined,
        action,
        entity_type: entityType,
        limit: 200,
      })
      setRows(result.rows)
      setTotal(result.total)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [searchQuery, action, entityType, message])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ColumnsType<AuditLog> = [
    {
      title: 'Zaman',
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('tr-TR'),
    },
    {
      title: 'Kullanıcı',
      render: (_: unknown, record) => (
        <div>
          <div>{record.user_name || '—'}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.user_email || ''}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'İşlem',
      dataIndex: 'action',
      width: 120,
      render: (v: string) => <Tag color={ACTION_COLOR[v] || 'default'}>{ACTION_LABEL[v] || v}</Tag>,
    },
    {
      title: 'Modül',
      dataIndex: 'entity_type',
      width: 120,
      render: (v: string) => ENTITY_LABEL[v] || v,
    },
    {
      title: 'Özet',
      dataIndex: 'summary',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 130,
      render: (v: string | null) => v || '—',
    },
  ]

  return (
    <AppLayout title="Denetim Kayıtları">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Denetim Kayıtları
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Hesaptaki kullanıcıların yaptığı işlemler. Bu ekran yalnızca Müdür rolüne açıktır.
          {total > 0 ? ` · ${total} kayıt` : ''}
        </Typography.Paragraph>

        <FilterBar>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Özet, kullanıcı veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          <Select
            allowClear
            placeholder="İşlem"
            style={{ width: 140 }}
            value={action}
            onChange={setAction}
            options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            allowClear
            placeholder="Modül"
            style={{ width: 160 }}
            value={entityType}
            onChange={setEntityType}
            options={Object.entries(ENTITY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <ClearFiltersButton
            active={Boolean(search.trim() || action || entityType)}
            onClick={() => {
              setSearch('')
              setAction(undefined)
              setEntityType(undefined)
            }}
          />
        </FilterBar>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={tablePagination(25)}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </AppLayout>
  )
}
