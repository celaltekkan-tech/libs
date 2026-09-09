import { useCallback, useEffect, useState } from 'react'
import { App, Button, Dropdown, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createDisciplinaryCase,
  deleteDisciplinaryCase,
  downloadDisciplinaryDocument,
  fetchDisciplinaryStats,
  listDisciplinaryCases,
  updateDisciplinaryCase,
} from '../api/disciplinaryCases'
import type { DisciplinaryDocumentType } from '../api/disciplinaryCases'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_OPTIONS,
  SANCTION_LEVEL_LABELS,
  SANCTION_LEVEL_OPTIONS,
} from '../types/disciplinaryCase'
import type { DisciplinaryCase, DisciplinaryCasePayload, DisciplinaryStats } from '../types/disciplinaryCase'
import type { Student } from '../types/student'
import { downloadBlob } from '../utils/download'

export function DisciplinePage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [cases, setCases] = useState<DisciplinaryCase[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState<DisciplinaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editing, setEditing] = useState<DisciplinaryCase | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createForm] = Form.useForm<DisciplinaryCasePayload>()
  const [editForm] = Form.useForm<{ status: string; sanction_level?: string; decision_date?: string; decision_summary?: string }>()

  const canCreate = hasPermission('discipline.create')
  const canUpdate = hasPermission('discipline.update')
  const canDelete = hasPermission('discipline.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [caseData, studentData, statsData] = await Promise.all([
        listDisciplinaryCases(),
        listStudents(),
        fetchDisciplinaryStats(),
      ])
      setCases(caseData)
      setStudents(studentData)
      setStats(statsData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (values: DisciplinaryCasePayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createDisciplinaryCase(session.user.tenant_id, values)
      message.success('Disiplin dosyası açıldı')
      setCreateModalOpen(false)
      createForm.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (row: DisciplinaryCase) => {
    setEditing(row)
    editForm.setFieldsValue({
      status: row.status,
      sanction_level: row.sanction_level || undefined,
      decision_date: row.decision_date || undefined,
      decision_summary: row.decision_summary || undefined,
    })
  }

  const onEditSubmit = async (values: {
    status: string
    sanction_level?: string
    decision_date?: string
    decision_summary?: string
  }) => {
    if (!editing) return
    setSubmitting(true)
    try {
      await updateDisciplinaryCase(editing.id, values)
      message.success('Güncellendi')
      setEditing(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: DisciplinaryCase) => {
    modal.confirm({
      title: 'Dosyayı sil',
      content: 'Bu disiplin dosyasını silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteDisciplinaryCase(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onDownloadDocument = async (row: DisciplinaryCase, type: DisciplinaryDocumentType) => {
    try {
      const blob = await downloadDisciplinaryDocument(row.id, type)
      downloadBlob(blob, `${type}-${row.id}.pdf`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<DisciplinaryCase> = [
    {
      title: 'Öğrenci',
      render: (_: unknown, r: DisciplinaryCase) => (r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '—'),
    },
    { title: 'Olay Tarihi', dataIndex: 'incident_date' },
    {
      title: 'Yaptırım',
      dataIndex: 'sanction_level',
      render: (v: string | null) => (v ? SANCTION_LEVEL_LABELS[v] : '—'),
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (v: string) => <Tag>{CASE_STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'İşlemler',
      width: 200,
      render: (_: unknown, record: DisciplinaryCase) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'veli_tebligati', label: 'Veli Tebligatı' },
                { key: 'savunma_istemi', label: 'Savunma İstemi' },
                { key: 'karar_bildirimi', label: 'Karar Bildirimi' },
              ],
              onClick: ({ key }) => void onDownloadDocument(record, key as DisciplinaryDocumentType),
            }}
          >
            <Button size="small" icon={<FileTextOutlined />} />
          </Dropdown>
          {canUpdate && (
            <Button size="small" onClick={() => openEdit(record)}>
              Karar / Durum
            </Button>
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Disiplin Modülü">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Disiplin Modülü
      </Typography.Title>

      {stats && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Tag color="blue">Toplam: {stats.total}</Tag>
          {Object.entries(stats.by_status).map(([status, count]) => (
            <Tag key={status}>{CASE_STATUS_LABELS[status] || status}: {count}</Tag>
          ))}
        </Space>
      )}

      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Yeni Disiplin Dosyası
          </Button>
        )}
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={cases} pagination={{ pageSize: 20 }} />

      <Modal
        title="Yeni Disiplin Dosyası"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" onFinish={onCreate}>
          <Form.Item name="student_id" label="Öğrenci" rules={[{ required: true, message: 'Öğrenci seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={students.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="incident_date" label="Olay tarihi" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="description" label="Olay açıklaması" rules={[{ required: true, message: 'Açıklama zorunludur' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="sanction_level" label="Önerilen yaptırım">
            <Select allowClear options={SANCTION_LEVEL_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Karar / Durum Güncelle"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        confirmLoading={submitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={onEditSubmit}>
          <Form.Item name="status" label="Durum" rules={[{ required: true }]}>
            <Select options={CASE_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="sanction_level" label="Yaptırım">
            <Select allowClear options={SANCTION_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item name="decision_date" label="Karar tarihi">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="decision_summary" label="Karar özeti">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  )
}
