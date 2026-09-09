import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import {
  createClassroom,
  deleteClassroom,
  exportClassrooms,
  listClassrooms,
  updateClassroom,
} from '../api/classrooms'
import { listTeachers } from '../api/teachers'
import { listSchools } from '../api/schools'
import { getErrorMessage } from '../api/client'
import type { Classroom, ClassroomPayload } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import type { Teacher } from '../types/teacher'
import type { School } from '../types/school'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'

export function ClassroomsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission, hasModule } = useAuth()
  const [rows, setRows] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editing, setEditing] = useState<Classroom | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<ClassroomPayload>()

  const canSchools = hasModule('schools')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [classroomData, teacherData, schoolData] = await Promise.all([
        listClassrooms(),
        listTeachers().catch(() => []),
        canSchools ? listSchools().catch(() => []) : Promise.resolve([]),
      ])
      setRows(classroomData)
      setTeachers(teacherData)
      setSchools(schoolData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canSchools, message])

  useEffect(() => {
    void load()
  }, [load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return rows
    return rows.filter((row) => {
      const label = classroomLabel(row).toLocaleLowerCase('tr-TR')
      const teacherName = row.Teacher
        ? `${row.Teacher.first_name} ${row.Teacher.last_name}`.toLocaleLowerCase('tr-TR')
        : ''
      const schoolName = (row.School?.name || '').toLocaleLowerCase('tr-TR')
      return (
        label.includes(q) ||
        row.class_level.toLocaleLowerCase('tr-TR').includes(q) ||
        row.section.toLocaleLowerCase('tr-TR').includes(q) ||
        (row.academic_year || '').toLocaleLowerCase('tr-TR').includes(q) ||
        teacherName.includes(q) ||
        schoolName.includes(q)
      )
    })
  }, [rows, search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ is_active: true })
    setModalOpen(true)
  }

  const openEdit = (row: Classroom) => {
    setEditing(row)
    form.setFieldsValue({
      school_id: row.school_id,
      class_level: row.class_level,
      section: row.section,
      teacher_id: row.teacher_id,
      academic_year: row.academic_year || undefined,
      is_active: row.is_active,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: ClassroomPayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        academic_year: values.academic_year || null,
        teacher_id: values.teacher_id || null,
        school_id: values.school_id || null,
      }
      if (editing) {
        await updateClassroom(editing.id, payload)
        message.success('Sınıf/şube güncellendi')
      } else {
        await createClassroom(session.user.tenant_id, payload)
        message.success('Sınıf/şube oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (row: Classroom) => {
    modal.confirm({
      title: 'Sınıf/şubeyi sil',
      content: `"${classroomLabel(row)}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteClassroom(row.id)
          message.success('Sınıf/şube silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportClassrooms({
        format: exportFormat,
        filters: search.trim() ? { q: search.trim() } : undefined,
      })
      downloadBlob(blob, exportFilename('siniflar', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const canCreate = hasPermission('classrooms.create')
  const canUpdate = hasPermission('classrooms.update')
  const canDelete = hasPermission('classrooms.delete')

  const columns: ColumnsType<Classroom> = [
    {
      title: 'Sınıf / Şube',
      render: (_: unknown, record) => classroomLabel(record),
    },
    {
      title: 'Sınıf öğretmeni',
      render: (_: unknown, record) =>
        record.Teacher ? `${record.Teacher.first_name} ${record.Teacher.last_name}` : '—',
    },
    ...(canSchools
      ? [
          {
            title: 'Okul',
            render: (_: unknown, record: Classroom) => record.School?.name || '—',
          },
        ]
      : []),
    {
      title: 'Durum',
      dataIndex: 'is_active',
      render: (v: boolean) => (v ? 'Aktif' : 'Pasif'),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: 'İşlemler',
            width: 120,
            render: (_: unknown, record: Classroom) => (
              <Space>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
                )}
                {canDelete && (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(record)}
                    title="Sil"
                  />
                )}
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <AppLayout title="Sınıflar / Şubeler">
      <div style={{ maxWidth: 1000 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Sınıflar / Şubeler
          </Typography.Title>
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Sınıf/Şube
              </Button>
            )}
          </Space>
        </Space>

        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Sınıf, şube, öğretmen veya okul ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 420, marginBottom: 16 }}
        />

        <Table rowKey="id" loading={loading} columns={columns} dataSource={filteredRows} pagination={{ pageSize: 20 }} />
      </div>

      <Modal
        title={editing ? 'Sınıf/Şube Düzenle' : 'Yeni Sınıf/Şube'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {canSchools && (
            <Form.Item name="school_id" label="Okul">
              <Select
                allowClear
                placeholder="Okul seçin"
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="class_level" label="Sınıf" rules={[{ required: true, message: 'Sınıf zorunludur' }]}>
            <Input placeholder="Örn. 9, 10, 11, 12" />
          </Form.Item>
          <Form.Item name="section" label="Şube" rules={[{ required: true, message: 'Şube zorunludur' }]}>
            <Input placeholder="Örn. A, B, C" />
          </Form.Item>
          <Form.Item name="teacher_id" label="Sorumlu sınıf öğretmeni">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Öğretmen seçin"
              options={teachers.map((t) => ({
                value: t.id,
                label: `${t.first_name} ${t.last_name}${t.personnel_no ? ` (${t.personnel_no})` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="academic_year" label="Eğitim öğretim yılı">
            <Input placeholder="Örn. 2025-2026" />
          </Form.Item>
          <Form.Item name="is_active" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Sınıf Listesini Dışa Aktar"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        confirmLoading={submitting}
        okText="İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form layout="vertical">
          <Form.Item label="Biçim">
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV (.csv)' },
                { value: 'pdf', label: 'PDF' },
              ]}
            />
          </Form.Item>
          <Typography.Text type="secondary">
            {search.trim()
              ? `Arama filtresi uygulanacak (${filteredRows.length} kayıt).`
              : 'Tüm sınıflar dışa aktarılır.'}
          </Typography.Text>
        </Form>
      </Modal>
    </AppLayout>
  )
}
