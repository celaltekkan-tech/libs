import { useCallback, useEffect, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createTeacherDocument,
  deleteTeacherDocument,
  duplicateTeacherDocument,
  listTeacherDocuments,
  reviewTeacherDocument,
} from '../api/teacherDocuments'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { DOC_STATUS_LABELS, DOC_STATUS_OPTIONS, DOC_TYPE_LABELS, DOC_TYPE_OPTIONS } from '../types/teacherDocument'
import type { TeacherDocument, TeacherDocumentPayload } from '../types/teacherDocument'
import type { Teacher } from '../types/teacher'

const STATUS_COLORS: Record<string, string> = {
  taslak: 'default',
  teslim_edildi: 'blue',
  onaylandi: 'green',
  revizyon_istendi: 'red',
}

export function TeacherDocumentsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [docs, setDocs] = useState<TeacherDocument[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewing, setReviewing] = useState<TeacherDocument | null>(null)
  const [duplicating, setDuplicating] = useState<TeacherDocument | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<TeacherDocumentPayload>()
  const [reviewForm] = Form.useForm<{ status: string; reviewer_note?: string }>()
  const [duplicateYear, setDuplicateYear] = useState('')

  const canCreate = hasPermission('teacher_documents.create')
  const canUpdate = hasPermission('teacher_documents.update')
  const canDelete = hasPermission('teacher_documents.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [docData, teacherData] = await Promise.all([
        listTeacherDocuments(selectedTeacherId ? { teacher_id: selectedTeacherId } : undefined),
        listTeachers(),
      ])
      setDocs(docData)
      setTeachers(teacherData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [selectedTeacherId, message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async (values: TeacherDocumentPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createTeacherDocument(session.user.tenant_id, values)
      message.success('Evrak oluşturuldu')
      setModalOpen(false)
      form.resetFields()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const openReview = (row: TeacherDocument) => {
    setReviewing(row)
    reviewForm.setFieldsValue({ status: row.status, reviewer_note: row.reviewer_note || undefined })
  }

  const onReviewSubmit = async (values: { status: string; reviewer_note?: string }) => {
    if (!reviewing) return
    setSubmitting(true)
    try {
      await reviewTeacherDocument(reviewing.id, values)
      message.success('Durum güncellendi')
      setReviewing(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDuplicate = async () => {
    if (!duplicating || !session || !duplicateYear.trim()) return
    setSubmitting(true)
    try {
      await duplicateTeacherDocument(duplicating.id, session.user.tenant_id, duplicateYear.trim())
      message.success('Evrak yeni yıl için kopyalandı')
      setDuplicating(null)
      setDuplicateYear('')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: TeacherDocument) => {
    modal.confirm({
      title: 'Evrakı sil',
      content: `"${row.title}" evrakını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTeacherDocument(row.id)
          message.success('Silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<TeacherDocument> = [
    {
      title: 'Personel',
      render: (_: unknown, r: TeacherDocument) => (r.Teacher ? `${r.Teacher.first_name} ${r.Teacher.last_name}` : '—'),
    },
    { title: 'Evrak Türü', dataIndex: 'doc_type', render: (v: string) => DOC_TYPE_LABELS[v] || v },
    { title: 'Başlık', dataIndex: 'title' },
    { title: 'Eğitim Öğretim Yılı', dataIndex: 'academic_year', render: (v: string | null) => v || '—' },
    {
      title: 'Durum',
      dataIndex: 'status',
      render: (v: string) => <Tag color={STATUS_COLORS[v]}>{DOC_STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'İşlemler',
      width: 220,
      render: (_: unknown, record: TeacherDocument) => (
        <Space>
          {canUpdate && (
            <Button size="small" onClick={() => openReview(record)}>
              Durum
            </Button>
          )}
          <Button size="small" icon={<CopyOutlined />} onClick={() => setDuplicating(record)}>
            Kopyala
          </Button>
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Öğretmen Evrak Arşivi">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Öğretmen Evrak Arşivi
      </Typography.Title>

      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Personele göre filtrele"
          value={selectedTeacherId ?? undefined}
          onChange={(v) => setSelectedTeacherId(v ?? null)}
          options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
          style={{ width: 260 }}
        />
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Yeni Evrak
          </Button>
        )}
      </Space>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={docs} pagination={{ pageSize: 20 }} />

      <Modal
        title="Yeni Evrak"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="teacher_id" label="Personel" rules={[{ required: true, message: 'Personel seçimi zorunludur' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
          <Form.Item name="doc_type" label="Evrak türü" rules={[{ required: true, message: 'Evrak türü zorunludur' }]}>
            <Select options={DOC_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="title" label="Başlık" rules={[{ required: true, message: 'Başlık zorunludur' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="academic_year" label="Eğitim öğretim yılı">
            <Input placeholder="Örn. 2025-2026" />
          </Form.Item>
          <Form.Item name="content" label="İçerik">
            <Input.TextArea rows={6} placeholder="Plan/rapor içeriği (metin)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Evrak Durumunu Güncelle"
        open={!!reviewing}
        onCancel={() => setReviewing(null)}
        onOk={() => reviewForm.submit()}
        confirmLoading={submitting}
        okText="Kaydet"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={reviewForm} layout="vertical" onFinish={onReviewSubmit}>
          <Form.Item name="status" label="Durum" rules={[{ required: true }]}>
            <Select options={DOC_STATUS_OPTIONS} />
          </Form.Item>
          <Form.Item name="reviewer_note" label="Yönetici notu">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Evrakı Yeni Yıl İçin Kopyala"
        open={!!duplicating}
        onCancel={() => setDuplicating(null)}
        onOk={() => void onDuplicate()}
        confirmLoading={submitting}
        okText="Kopyala"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Input
          placeholder="Yeni eğitim öğretim yılı (Örn. 2026-2027)"
          value={duplicateYear}
          onChange={(e) => setDuplicateYear(e.target.value)}
        />
      </Modal>
    </AppLayout>
  )
}
