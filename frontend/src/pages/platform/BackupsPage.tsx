import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Form, Input, InputNumber, Space, Tag, TimePicker, Typography } from 'antd'
import { SortableTable } from '../../components/SortableTable'
import { DeleteOutlined, PlayCircleOutlined, RollbackOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../../components/AppLayout'
import {
  deleteBackup,
  getBackupSettings,
  listBackups,
  restoreBackup,
  runBackup,
  updateBackupSettings,
} from '../../api/backups'
import { getErrorMessage } from '../../api/client'
import type { BackupFile, BackupSettings } from '../../types/backup'
import { tablePagination } from '../../utils/tablePagination'
import { TypedPhraseConfirmModal } from '../../components/TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../../hooks/useBulkTypedDelete'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const LAST_RUN_TAG: Record<NonNullable<BackupSettings['last_run_status']>, { color: string; text: string }> = {
  success: { color: 'green', text: 'Başarılı' },
  error: { color: 'red', text: 'Hata' },
  running: { color: 'blue', text: 'Çalışıyor' },
}

interface SettingsFormValues {
  backup_dir: string
  schedule_time: string
  retention_days: number
}

export function BackupsPage() {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<SettingsFormValues>()
  const [savingSettings, setSavingSettings] = useState(false)
  const [runningBackup, setRunningBackup] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null)
  const [settings, setSettings] = useState<BackupSettings | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSettings, files] = await Promise.all([getBackupSettings(), listBackups()])
      setSettings(nextSettings)
      form.setFieldsValue({
        backup_dir: nextSettings.backup_dir,
        schedule_time: nextSettings.schedule_time,
        retention_days: nextSettings.retention_days,
      })
      setBackups(files)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [form, message])

  useEffect(() => {
    void load()
  }, [load])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => backups.map((b) => b.filename),
    deleteOne: (filename) => deleteBackup(String(filename)),
    noun: 'yedek',
    reload: () => void load(),
    message,
  })

  const onSaveSettings = async (values: SettingsFormValues) => {
    setSavingSettings(true)
    try {
      const next = await updateBackupSettings({
        backup_dir: values.backup_dir,
        schedule_time: values.schedule_time,
        retention_days: values.retention_days,
      })
      setSettings(next)
      form.setFieldsValue({
        backup_dir: next.backup_dir,
        schedule_time: next.schedule_time,
        retention_days: next.retention_days,
      })
      message.success('Yedekleme ayarları kaydedildi')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingSettings(false)
    }
  }

  const onRunBackup = () => {
    modal.confirm({
      title: 'Yedek al',
      content: 'Veritabanının anlık yedeği şimdi alınacak. Devam edilsin mi?',
      okText: 'Yedek al',
      cancelText: 'Vazgeç',
      onOk: async () => {
        setRunningBackup(true)
        try {
          const result = await runBackup()
          message.success(`Yedek alındı: ${result.filename}`)
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        } finally {
          setRunningBackup(false)
        }
      },
    })
  }

  const onConfirmRestore = async () => {
    if (!restoreTarget) return
    setRestoring(true)
    try {
      await restoreBackup(restoreTarget.filename)
      message.success(`Veritabanı geri yüklendi: ${restoreTarget.filename}`)
      setRestoreTarget(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setRestoring(false)
    }
  }

  const onDelete = (backup: BackupFile) => {
    modal.confirm({
      title: 'Yedeği sil',
      content: `"${backup.filename}" yedeğini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteBackup(backup.filename)
          message.success('Yedek silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<BackupFile> = [
    { title: 'Dosya Adı', dataIndex: 'filename' },
    { title: 'Boyut', dataIndex: 'size_bytes', render: (value: number) => formatSize(value) },
    {
      title: 'Alınma Zamanı',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleString('tr-TR'),
    },
    {
      title: 'İşlemler',
      width: 220,
      render: (_: unknown, record) => (
        <Space>
          <Button
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => setRestoreTarget(record)}
            disabled={runningBackup || restoring}
          >
            Geri yükle
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
            Sil
          </Button>
        </Space>
      ),
    },
  ]

  const lastRun = settings?.last_run_status ? LAST_RUN_TAG[settings.last_run_status] : null

  return (
    <AppLayout title="Veritabanı Yedekleme">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Yedekleme
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Yedekler her gün belirlediğiniz saatte, seçtiğiniz klasöre alınır. Saklama süresini aşan
          dosyalar bir sonraki yedeklemede silinir. Geri yükleme mevcut veritabanının üzerine yazar.
        </Typography.Paragraph>

        <Card style={{ marginBottom: 24, maxWidth: 640 }}>
          <Form form={form} layout="vertical" onFinish={onSaveSettings}>
            <Form.Item
              name="backup_dir"
              label="Yedek klasörü"
              extra="Sunucunun gördüğü klasör yolu. Docker'da varsayılan /app/backups (host'ta BACKUP_HOST_DIR veya ./backups)."
              rules={[{ required: true, message: 'Klasör yolu girin' }]}
            >
              <Input placeholder="C:\yedekler veya /app/backups" />
            </Form.Item>
            <Space wrap size="large" style={{ width: '100%' }} align="start">
              <Form.Item
                name="schedule_time"
                label="Yedekleme saati"
                extra="Her gün, Europe/Istanbul"
                rules={[{ required: true, message: 'Saat seçin' }]}
                getValueFromEvent={(value) => (value ? value.format('HH:mm') : undefined)}
                getValueProps={(value) => ({ value: value ? dayjs(value, 'HH:mm') : undefined })}
              >
                <TimePicker format="HH:mm" minuteStep={5} needConfirm={false} style={{ width: 140 }} />
              </Form.Item>
              <Form.Item
                name="retention_days"
                label="Saklama süresi (gün)"
                rules={[{ required: true, message: 'Değer girin' }]}
              >
                <InputNumber min={1} max={365} style={{ width: 140 }} />
              </Form.Item>
            </Space>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={savingSettings}>
                Ayarları kaydet
              </Button>
            </Form.Item>
          </Form>
          {lastRun && (
            <Alert
              style={{ marginTop: 16 }}
              type={settings?.last_run_status === 'error' ? 'error' : settings?.last_run_status === 'running' ? 'info' : 'success'}
              showIcon
              message={
                <Space>
                  <span>Son yedekleme</span>
                  <Tag color={lastRun.color}>{lastRun.text}</Tag>
                  {settings?.last_run_at && (
                    <Typography.Text type="secondary">
                      {new Date(settings.last_run_at).toLocaleString('tr-TR')}
                    </Typography.Text>
                  )}
                </Space>
              }
              description={settings?.last_run_message || undefined}
            />
          )}
        </Card>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onRunBackup}
            loading={runningBackup}
            disabled={restoring}
          >
            Şimdi yedek al
          </Button>
          {backups.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
              Toplu sil ({backups.length})
            </Button>
          )}
          <Button onClick={() => void load()}>Yenile</Button>
        </Space>

        <SortableTable
          rowKey="filename"
          loading={loading}
          columns={columns}
          dataSource={backups}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Yedekleri toplu sil"
        description={`Listedeki ${backups.length} yedek dosyası silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
      <TypedPhraseConfirmModal
        open={Boolean(restoreTarget)}
        title="Veritabanını geri yükle"
        description={`"${restoreTarget?.filename || ''}" yedeği mevcut veritabanının üzerine yazılacak. Bu işlemden önce güncel bir yedek almanız önerilir.`}
        confirmPhrase="geri yükle"
        okText="Geri yükle"
        loading={restoring}
        onCancel={() => {
          if (!restoring) setRestoreTarget(null)
        }}
        onConfirm={onConfirmRestore}
      />
    </AppLayout>
  )
}
