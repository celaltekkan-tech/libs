import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { listBackupLogs } from '../../api/backups'
import { getErrorMessage } from '../../api/client'
import type { BackupLog, BackupLogAction, BackupLogStatus } from '../../types/backup'

const ACTION_LABEL: Record<BackupLogAction, string> = {
  backup: 'Yedek alma',
  prune: 'Otomatik silme',
  delete: 'Silme',
  import: 'Yükleme',
  restore: 'Geri yükleme',
  download: 'İndirme',
  config: 'Ayar / Sistem',
}

const STATUS_TAG: Record<BackupLogStatus, { color: string; text: string }> = {
  running: { color: 'blue', text: 'Çalışıyor' },
  success: { color: 'green', text: 'Başarılı' },
  error: { color: 'red', text: 'Hata' },
  skipped: { color: 'default', text: 'Atlandı' },
  warning: { color: 'orange', text: 'Uyarı' },
}

const TRIGGER_LABEL: Record<BackupLog['trigger'], string> = {
  scheduled: 'Zamanlanmış',
  manual: 'Manuel',
  host: 'Host cron',
  system: 'Sistem',
}

const FILE_STATE: Record<NonNullable<BackupLog['file_state']>, { color: string; text: string; hint: string }> = {
  present: { color: 'green', text: 'Mevcut', hint: 'Dosya yedek klasöründe duruyor' },
  deleted: { color: 'default', text: 'Silindi', hint: 'Panelden kullanıcı tarafından silindi' },
  pruned: { color: 'default', text: 'Süresi doldu', hint: 'Saklama süresi aşıldığı için otomatik silindi' },
  missing: {
    color: 'red',
    text: 'Kayıp',
    hint: 'Uygulama bu dosyayı silmedi ama klasörde yok: dışarıdan silinmiş, klasör değişmiş ya da container ile birlikte kaybolmuş olabilir',
  },
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
}

export function BackupLogsCard({ refreshKey }: { refreshKey: number }) {
  const { message } = App.useApp()
  const [logs, setLogs] = useState<BackupLog[]>([])
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<BackupLogAction | undefined>()
  const [status, setStatus] = useState<BackupLogStatus | undefined>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLogs(await listBackupLogs({ limit: 500, action, status }))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [action, status, message])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const columns: ColumnsType<BackupLog> = [
    {
      title: 'Zaman',
      dataIndex: 'created_at',
      width: 170,
      render: (value: string, row) => new Date(row.started_at || value).toLocaleString('tr-TR'),
    },
    { title: 'İşlem', dataIndex: 'action', width: 130, render: (v: BackupLogAction) => ACTION_LABEL[v] || v },
    {
      title: 'Durum',
      dataIndex: 'status',
      width: 100,
      render: (v: BackupLogStatus) => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.text || v}</Tag>,
    },
    {
      title: 'Kaynak',
      dataIndex: 'trigger',
      width: 150,
      render: (v: BackupLog['trigger'], row) => (
        <Space direction="vertical" size={0}>
          <span>{TRIGGER_LABEL[v] || v}</span>
          {row.user_label && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.user_label}</Typography.Text>}
        </Space>
      ),
    },
    {
      title: 'Dosya',
      dataIndex: 'filename',
      render: (v: string | null, row) =>
        v ? (
          <Space direction="vertical" size={0}>
            <Typography.Text code style={{ fontSize: 12 }}>{v}</Typography.Text>
            <Space size={4}>
              {row.size_bytes != null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatSize(row.size_bytes)}</Typography.Text>}
              {row.file_state && (
                <Tooltip title={FILE_STATE[row.file_state].hint}>
                  <Tag color={FILE_STATE[row.file_state].color} style={{ marginInlineEnd: 0 }}>
                    {FILE_STATE[row.file_state].text}
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </Space>
        ) : null,
    },
    {
      title: 'Süre',
      dataIndex: 'duration_ms',
      width: 80,
      render: (v: number | null) => (v == null ? '' : v < 1000 ? `${v} ms` : `${(v / 1000).toFixed(1)} sn`),
    },
    {
      title: 'Açıklama',
      dataIndex: 'message',
      render: (v: string | null) => (
        <Typography.Paragraph style={{ margin: 0, maxWidth: 480, whiteSpace: 'pre-wrap' }} ellipsis={{ rows: 3, expandable: true }}>
          {v}
        </Typography.Paragraph>
      ),
    },
  ]

  return (
    <Card
      title="Yedekleme Geçmişi"
      style={{ marginTop: 24 }}
      extra={
        <Space wrap>
          <Select
            allowClear
            placeholder="İşlem"
            style={{ width: 160 }}
            value={action}
            onChange={setAction}
            options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            allowClear
            placeholder="Durum"
            style={{ width: 130 }}
            value={status}
            onChange={setStatus}
            options={Object.entries(STATUS_TAG).map(([value, t]) => ({ value, label: t.text }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()} />
        </Space>
      }
    >
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={logs}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  )
}
