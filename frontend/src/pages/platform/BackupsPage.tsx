import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, InputNumber, Space, Typography } from 'antd'
import { SortableTable } from '../../components/SortableTable'
import { DeleteOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../../components/AppLayout'
import { deleteBackup, getBackupSettings, listBackups, updateBackupSettings } from '../../api/backups'
import { getErrorMessage } from '../../api/client'
import type { BackupFile } from '../../types/backup'
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

export function BackupsPage() {
  const { message, modal } = App.useApp()
  const [form] = Form.useForm<{ retention_days: number }>()
  const [savingSettings, setSavingSettings] = useState(false)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settings, files] = await Promise.all([getBackupSettings(), listBackups()])
      form.setFieldsValue(settings)
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

  const onSaveSettings = async (values: { retention_days: number }) => {
    setSavingSettings(true)
    try {
      await updateBackupSettings(values.retention_days)
      message.success('Saklama süresi güncellendi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingSettings(false)
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
      width: 100,
      render: (_: unknown, record) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>
          Sil
        </Button>
      ),
    },
  ]

  return (
    <AppLayout title="Veritabanı Yedekleme">
      <div style={{ width: '100%' }}>
        <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
          Yedekleme
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Veritabanı yedekleri sunucuda otomatik olarak alınır. Aşağıdaki saklama süresinden eski
          yedekler bir sonraki yedekleme çalışmasında otomatik silinir.
        </Typography.Paragraph>

        <Card style={{ marginBottom: 24, maxWidth: 420 }}>
          <Form form={form} layout="inline" onFinish={onSaveSettings}>
            <Form.Item
              name="retention_days"
              label="Saklama Süresi (gün)"
              rules={[{ required: true, message: 'Değer girin' }]}
            >
              <InputNumber min={1} max={365} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={savingSettings}>
                Kaydet
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
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
    </AppLayout>
  )
}
