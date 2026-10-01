import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Select, Space, Tabs, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import { CopyOutlined, DeleteOutlined, DownloadOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import {
  createTeacherDocument,
  deleteTeacherDocument,
  duplicateTeacherDocument,
  listTeacherDocuments,
  reviewTeacherDocument,
} from '../api/teacherDocuments'
import { getErrorMessage } from '../api/client'
import { downloadRegulation } from '../api/regulations'
import { downloadBlob } from '../utils/download'
import {
  DMK_657_URL,
  EK_DERS_YONETMELIGI_FILENAME,
  EK_DERS_YONETMELIGI_SLUG,
  DOC_CATEGORY_OPTIONS,
  DOC_STATUS_LABELS,
  DOC_STATUS_OPTIONS,
  DOC_TYPE_LABELS,
  DOC_TYPE_OPTIONS,
} from '../types/teacherDocument'
import type { DocCategory, TeacherDocument, TeacherDocumentPayload } from '../types/teacherDocument'
import { tablePagination } from '../utils/tablePagination'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'

function categoryOf(doc: TeacherDocument): DocCategory {
  if (
    doc.category === 'mevzuat' ||
    doc.category === 'yillik_evrak' ||
    doc.category === 'dilekce' ||
    doc.category === 'sinif_rehberlik' ||
    doc.category === 'maarif'
  ) {
    return doc.category
  }
  if (doc.doc_type === 'sinif_rehberlik_plani' || doc.doc_type === 'ogrenci_gelisim_raporu') return 'sinif_rehberlik'
  if (doc.doc_type === 'maarif_modeli_raporu') return 'maarif'
  return 'yillik_evrak'
}

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
  const [category, setCategory] = useState<DocCategory>('mevzuat')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [reviewing, setReviewing] = useState<TeacherDocument | null>(null)
  const [duplicating, setDuplicating] = useState<TeacherDocument | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<TeacherDocumentPayload>()
  const [reviewForm] = Form.useForm<{ status: string; reviewer_note?: string }>()
  const [duplicateYear, setDuplicateYear] = useState('')
  const [downloadingRegulation, setDownloadingRegulation] = useState(false)

  const canCreate = hasPermission('teacher_documents.create')
  const canUpdate = hasPermission('teacher_documents.update')
  const canDelete = hasPermission('teacher_documents.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const docData = await listTeacherDocuments()
      setDocs(docData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => docs.filter((d) => categoryOf(d) === category).map((d) => d.id),
    deleteOne: (id) => deleteTeacherDocument(Number(id)),
    noun: 'evrak',
    reload: () => void load(),
    message,
  })

  const onFinish = async (values: TeacherDocumentPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      await createTeacherDocument(session.user.tenant_id, { ...values, category })
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

  const onDownloadEkDers = async () => {
    setDownloadingRegulation(true)
    try {
      const blob = await downloadRegulation(EK_DERS_YONETMELIGI_SLUG)
      downloadBlob(blob, EK_DERS_YONETMELIGI_FILENAME)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setDownloadingRegulation(false)
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

  const visibleDocs = docs.filter((doc) => categoryOf(doc) === category)

  const columns: ColumnsType<TeacherDocument> = [
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
      <Typography.Title level={3} style={{ margin: 0 }}>
        Öğretmen Evrak Arşivi
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        Ortak evraklar gruplanır. Personel listesi yoktur; öğretmenler buradan mevzuat, yıllık evrak, dilekçe ve örnek belgelere bakar.
      </Typography.Paragraph>

      <Tabs
        activeKey={category}
        onChange={(key) => setCategory(key as DocCategory)}
        tabBarExtraContent={
          <Space>
            {canDelete && visibleDocs.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({visibleDocs.length})
              </Button>
            )}
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  form.resetFields()
                  form.setFieldsValue({ category, doc_type: category === 'yillik_evrak' ? 'yillik_plan' : undefined })
                  setModalOpen(true)
                }}
              >
                Yeni evrak
              </Button>
            )}
          </Space>
        }
        items={DOC_CATEGORY_OPTIONS.map((item) => ({ key: item.value, label: item.label }))}
      />

      {category === 'mevzuat' && (
        <Space direction="vertical" size={12} style={{ width: '100%', marginBottom: 16 }}>
          <Card size="small">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>657 sayılı Devlet Memurları Kanunu</Typography.Text>
              <Button type="link" icon={<LinkOutlined />} href={DMK_657_URL} target="_blank" style={{ paddingLeft: 0 }}>
                Mevzuat.gov.tr üzerinde aç
              </Button>
            </Space>
          </Card>
          <Card size="small">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>Ek Ders Yönetmeliği</Typography.Text>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                loading={downloadingRegulation}
                onClick={() => void onDownloadEkDers()}
                style={{ paddingLeft: 0 }}
              >
                PDF olarak indir
              </Button>
            </Space>
          </Card>
        </Space>
      )}

      <SortableTable
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={visibleDocs}
        pagination={tablePagination(20)}
        scroll={{ x: 'max-content' }}
      />

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
          <Form.Item name="category" hidden>
            <Input />
          </Form.Item>
          {(category === 'yillik_evrak' || category === 'sinif_rehberlik' || category === 'maarif') && (
            <Form.Item name="doc_type" label="Evrak türü">
              <Select allowClear options={DOC_TYPE_OPTIONS} placeholder="İsteğe bağlı" />
            </Form.Item>
          )}
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
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Evrakları toplu sil"
        description={`Bu gruptaki ${visibleDocs.length} evrak kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
