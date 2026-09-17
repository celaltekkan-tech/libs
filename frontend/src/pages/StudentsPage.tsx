import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Alert, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Steps, Typography, Upload } from 'antd'
import { SortableTable } from '../components/SortableTable'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import {
  createStudent,
  deleteStudent,
  exportStudents,
  importStudents,
  listStudents,
  previewStudentImport,
  updateStudent,
} from '../api/students'
import { createExportTemplate, deleteExportTemplate, listExportTemplates } from '../api/exportTemplates'
import type { ExportTemplate } from '../api/exportTemplates'
import { listSchools } from '../api/schools'
import { listClassrooms } from '../api/classrooms'
import { getErrorMessage } from '../api/client'
import type { School } from '../types/school'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import type {
  RegistrationStatus,
  Student,
  StudentExtraContact,
  StudentFilters,
  StudentGender,
  StudentImportPreview,
  StudentPayload,
} from '../types/student'
import {
  REGISTRATION_STATUS_OPTIONS,
  STUDENT_COLUMN_OPTIONS,
  STUDENT_IMPORT_FIELD_OPTIONS,
} from '../types/student'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { personNameSorter, SORT_AZ } from '../utils/tableSort'

interface StudentFormValues {
  first_name: string
  last_name: string
  school_id?: number | null
  classroom_id: number
  student_number: string
  national_id?: string
  gender?: StudentGender | null
  birth_date?: Dayjs | null
  registration_status?: RegistrationStatus
  parent_name?: string
  parent_phone?: string
  extra_contacts?: StudentExtraContact[]
  is_inclusion?: boolean
  is_foreign?: boolean
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  aktif: 'Aktif',
  nakil_gelen: 'Nakil gelen',
  nakil_giden: 'Nakil giden',
  kayit_silindi: 'Kayıt silindi',
}

export function StudentsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission, hasModule } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [importStep, setImportStep] = useState(0)
  const [importFile, setImportFile] = useState<UploadFile | null>(null)
  const [importSchoolId, setImportSchoolId] = useState<number | null>(null)
  const [importClassroomId, setImportClassroomId] = useState<number | null>(null)
  const [importPreview, setImportPreview] = useState<StudentImportPreview | null>(null)
  const [importHeaderRow, setImportHeaderRow] = useState<number>(1)
  const [importMapping, setImportMapping] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [exportColumns, setExportColumns] = useState<string[]>([
    'student_number',
    'national_id',
    'first_name',
    'last_name',
    'class_level',
    'section',
  ])
  const [filters, setFilters] = useState<StudentFilters>({})
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState<ExportTemplate[]>([])
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [form] = Form.useForm<StudentFormValues>()

  const canSchools = hasModule('schools')

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await listExportTemplates('students'))
    } catch {
      // şablonlar isteğe bağlı, sessizce yok say
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentData, classroomData, schoolData] = await Promise.all([
        listStudents(filters),
        listClassrooms({ is_active: true }).catch(() => []),
        canSchools ? listSchools().catch(() => []) : Promise.resolve([]),
      ])
      setStudents(studentData)
      setClassrooms(classroomData)
      setSchools(schoolData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filters, canSchools, message])

  useEffect(() => {
    void load()
  }, [load])

  const schoolName = (schoolId: number | null) => schools.find((s) => s.id === schoolId)?.name || '—'

  const classroomOptions = useMemo(
    () =>
      classrooms.map((c) => ({
        value: c.id,
        label: classroomLabel(c),
      })),
    [classrooms],
  )

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    if (!q) return students
    return students.filter((s) => {
      const fullName = `${s.first_name} ${s.last_name}`.toLocaleLowerCase('tr-TR')
      const reverseName = `${s.last_name} ${s.first_name}`.toLocaleLowerCase('tr-TR')
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        s.first_name.toLocaleLowerCase('tr-TR').includes(q) ||
        s.last_name.toLocaleLowerCase('tr-TR').includes(q) ||
        (s.student_number || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (s.national_id || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [students, search])

  const hasActiveFilters = Boolean(
    search.trim() ||
      filters.school_id ||
      filters.classroom_id ||
      filters.gender ||
      filters.registration_status,
  )

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      registration_status: 'aktif',
      is_inclusion: false,
      is_foreign: false,
      extra_contacts: [],
    })
    setModalOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    form.setFieldsValue({
      first_name: student.first_name,
      last_name: student.last_name,
      school_id: student.school_id,
      classroom_id: student.classroom_id || undefined,
      student_number: student.student_number || undefined,
      national_id: student.national_id || undefined,
      gender: student.gender,
      birth_date: student.birth_date ? dayjs(student.birth_date) : null,
      registration_status: student.registration_status || 'aktif',
      parent_name: student.parent_name || undefined,
      parent_phone: student.parent_phone || undefined,
      extra_contacts: student.extra_contacts?.length ? student.extra_contacts : [],
      is_inclusion: student.is_inclusion,
      is_foreign: student.is_foreign,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: StudentFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload: StudentPayload = {
        ...values,
        classroom_id: values.classroom_id,
        student_number: values.student_number.trim(),
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        gender: values.gender || null,
        extra_contacts: (values.extra_contacts || []).filter(
          (c) => c.label || c.phone || c.address || c.description,
        ),
      }

      if (editing) {
        await updateStudent(editing.id, payload)
        message.success('Öğrenci güncellendi')
      } else {
        await createStudent(session.user.tenant_id, payload)
        message.success('Öğrenci oluşturuldu')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (student: Student) => {
    modal.confirm({
      title: 'Öğrenciyi sil',
      content: `"${student.first_name} ${student.last_name}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteStudent(student.id)
          message.success('Öğrenci silindi')
          void load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(
        filteredStudents.map((s) => s.id),
        (id) => deleteStudent(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'öğrenci')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const resetImportState = () => {
    setImportStep(0)
    setImportFile(null)
    setImportSchoolId(null)
    setImportClassroomId(null)
    setImportPreview(null)
    setImportHeaderRow(1)
    setImportMapping({})
    setPreviewLoading(false)
  }

  const importClassroomOptions = useMemo(() => {
    const list = importSchoolId
      ? classrooms.filter((c) => c.school_id === importSchoolId || c.school_id == null)
      : classrooms
    return list.map((c) => ({ value: c.id, label: classroomLabel(c) }))
  }, [classrooms, importSchoolId])

  const mappingHasClassColumns = useMemo(() => {
    const fields = Object.values(importMapping)
    return fields.includes('class_level') || fields.includes('section')
  }, [importMapping])

  const usedImportFields = useMemo(() => new Set(Object.values(importMapping).filter(Boolean)), [importMapping])

  const applyImportPreview = async (headerRow?: number | null) => {
    const file = importFile?.originFileObj
    if (!file) {
      message.warning('Lütfen bir .xls veya .xlsx dosyası seçin')
      return
    }
    setPreviewLoading(true)
    try {
      const preview = await previewStudentImport(file, { headerRow })
      setImportPreview(preview)
      setImportHeaderRow(preview.header_row)
      setImportMapping({ ...preview.suggested_mapping })

      if (preview.detected_class) {
        const match = classrooms.find(
          (c) =>
            String(c.class_level) === String(preview.detected_class?.class_level) &&
            String(c.section).toLocaleUpperCase('tr-TR') ===
              String(preview.detected_class?.section).toLocaleUpperCase('tr-TR') &&
            (!importSchoolId || c.school_id === importSchoolId),
        )
        if (match) setImportClassroomId(match.id)
      }
      setImportStep(1)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setPreviewLoading(false)
    }
  }

  const onPreviewImport = async () => {
    await applyImportPreview(null)
  }

  const onImport = async () => {
    const file = importFile?.originFileObj
    if (!file) {
      message.warning('Lütfen bir .xls veya .xlsx dosyası seçin')
      return
    }
    const fields = Object.values(importMapping)
    if (!fields.includes('first_name') || !fields.includes('last_name')) {
      message.warning('Ad ve Soyad sütunlarını eşleştirin')
      return
    }
    if (!fields.includes('student_number')) {
      message.warning('Öğrenci No sütununu eşleştirin')
      return
    }
    if (
      !mappingHasClassColumns &&
      !importClassroomId &&
      !importPreview?.detected_class?.class_level
    ) {
      message.warning('Excelde sınıf/şube yoksa varsayılan sınıf/şube seçin')
      return
    }

    setSubmitting(true)
    try {
      const result = await importStudents(file, {
        schoolId: importSchoolId,
        classroomId: importClassroomId,
        headerRow: importHeaderRow,
        columnMapping: importMapping,
        classLevel: importPreview?.detected_class?.class_level ?? null,
        section: importPreview?.detected_class?.section ?? null,
      })
      message.success(
        `İçe aktarma tamamlandı: ${result.created} yeni, ${result.updated} güncellendi` +
          (result.errors.length ? `, ${result.errors.length} hata` : ''),
      )
      if (result.errors.length) {
        modal.info({
          title: 'İçe aktarma hataları',
          content: (
            <ul style={{ maxHeight: 240, overflow: 'auto', paddingLeft: 18 }}>
              {result.errors.slice(0, 30).map((e) => (
                <li key={`${e.row}-${e.message}`}>
                  Satır {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ),
        })
      }
      setImportOpen(false)
      resetImportState()
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onExport = async () => {
    if (exportColumns.length === 0) {
      message.warning('En az bir sütun seçin')
      return
    }
    setSubmitting(true)
    try {
      const blob = await exportStudents({
        format: exportFormat,
        columns: exportColumns,
        filters: {
          ...filters,
          ...(search.trim() ? { q: search.trim() } : {}),
        },
      })
      downloadBlob(blob, exportFilename('ogrenciler', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onApplyTemplate = (template: ExportTemplate) => {
    setExportColumns(template.columns)
    message.success(`"${template.name}" şablonu uygulandı`)
  }

  const onSaveTemplate = async () => {
    if (!session) return
    if (!saveTemplateName.trim()) {
      message.warning('Şablon adı girin')
      return
    }
    if (exportColumns.length === 0) {
      message.warning('En az bir sütun seçin')
      return
    }
    try {
      await createExportTemplate(session.user.tenant_id, {
        entity_type: 'students',
        name: saveTemplateName.trim(),
        columns: exportColumns,
      })
      message.success('Şablon kaydedildi')
      setSaveTemplateName('')
      void loadTemplates()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDeleteTemplate = (template: ExportTemplate) => {
    modal.confirm({
      title: 'Şablonu sil',
      content: `"${template.name}" şablonunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteExportTemplate(template.id)
          message.success('Şablon silindi')
          void loadTemplates()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const canCreate = hasPermission('students.create')
  const canUpdate = hasPermission('students.update')
  const canDelete = hasPermission('students.delete')

  const columns: ColumnsType<Student> = [
    { title: 'Öğrenci No', dataIndex: 'student_number', render: (v: string | null) => v || '—' },
    {
      title: 'Ad soyad',
      sorter: personNameSorter(),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => `${record.first_name} ${record.last_name}`,
    },
    { title: 'T.C.', dataIndex: 'national_id', render: (v: string | null) => v || '—' },
    {
      title: 'Sınıf / Şube',
      render: (_: unknown, record) =>
        record.class_level && record.section ? `${record.class_level}/${record.section}` : '—',
    },
    {
      title: 'Cinsiyet',
      dataIndex: 'gender',
      render: (v: StudentGender | null) => (v === 'K' ? 'Kız' : v === 'E' ? 'Erkek' : '—'),
    },
    {
      title: 'Durum',
      dataIndex: 'registration_status',
      render: (v: RegistrationStatus | null) => (v ? STATUS_LABEL[v] : '—'),
    },
    { title: 'Okul', render: (_: unknown, record) => schoolName(record.school_id) },
    {
      title: 'İşlemler',
      width: 120,
      render: (_: unknown, record: Student) => (
        <Space>
          {canUpdate && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} title="Düzenle" />
          )}
          {canDelete && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} title="Sil" />
          )}
        </Space>
      ),
    },
  ]

  return (
    <AppLayout title="Öğrenciler">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Öğrenciler
          </Typography.Title>
          <Space wrap>
            {canDelete && filteredStudents.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredStudents.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
            {canCreate && (
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  resetImportState()
                  setImportOpen(true)
                }}
              >
                Excel İçe Aktar
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Öğrenci
              </Button>
            )}
          </Space>
        </Space>

        <FilterBar>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Ad, soyad, öğrenci no veya T.C. ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          {canSchools && (
            <Select
              allowClear
              placeholder="Okul"
              style={{ width: 180 }}
              options={schools.map((s) => ({ value: s.id, label: s.name }))}
              value={filters.school_id}
              onChange={(school_id) => setFilters((f) => ({ ...f, school_id }))}
            />
          )}
          <Select
            allowClear
            placeholder="Sınıf / Şube"
            style={{ width: 180 }}
            options={classroomOptions}
            value={filters.classroom_id}
            onChange={(classroom_id) => setFilters((f) => ({ ...f, classroom_id }))}
          />
          <Select
            allowClear
            placeholder="Cinsiyet"
            style={{ width: 120 }}
            options={[
              { value: 'K', label: 'Kız' },
              { value: 'E', label: 'Erkek' },
            ]}
            value={filters.gender}
            onChange={(gender) => setFilters((f) => ({ ...f, gender }))}
          />
          <Select
            allowClear
            placeholder="Kayıt durumu"
            style={{ width: 160 }}
            options={REGISTRATION_STATUS_OPTIONS}
            value={filters.registration_status}
            onChange={(registration_status) => setFilters((f) => ({ ...f, registration_status }))}
          />
          <ClearFiltersButton
            active={hasActiveFilters}
            onClick={() => {
              setSearch('')
              setFilters({})
            }}
          />
        </FilterBar>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredStudents}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />
      </div>

      <Modal
        title={editing ? 'Öğrenciyi Düzenle' : 'Yeni Öğrenci'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="first_name" label="Ad" rules={[{ required: true, message: 'Ad zorunludur' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="last_name" label="Soyad" rules={[{ required: true, message: 'Soyad zorunludur' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {canSchools && (
            <Form.Item name="school_id" label="Okul">
              <Select
                allowClear
                placeholder="Okul seçin"
                options={schools.map((school) => ({ value: school.id, label: school.name }))}
              />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="student_number"
                label="Öğrenci No"
                rules={[{ required: true, message: 'Öğrenci numarası zorunludur' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="national_id" label="T.C. Kimlik No">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="classroom_id"
            label="Sınıf / Şube"
            rules={[{ required: true, message: 'Sınıf/şube seçimi zorunludur' }]}
            extra={
              classroomOptions.length === 0
                ? 'Önce Sınıflar menüsünden sınıf/şube tanımlayın.'
                : undefined
            }
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Tanımlı sınıf/şube seçin"
              options={classroomOptions}
            />
          </Form.Item>
          <Form.Item name="birth_date" label="Doğum Tarihi">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gender" label="Cinsiyet">
                <Select
                  allowClear
                  options={[
                    { value: 'K', label: 'Kız' },
                    { value: 'E', label: 'Erkek' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="registration_status" label="Kayıt Durumu">
                <Select options={REGISTRATION_STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="parent_name" label="Veli Adı">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="parent_phone" label="Veli Telefon">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Ek iletişim bilgileri
          </Typography.Text>
          <Form.List name="extra_contacts">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {fields.map((field) => (
                  <div
                    key={field.key}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 12,
                      background: '#fafafa',
                    }}
                  >
                    <Row gutter={12} align="top">
                      <Col span={22}>
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'label']}
                              label="Etiket / Kişi"
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="Örn. Anne, Baba, Acil" />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'phone']}
                              label="Telefon"
                              style={{ marginBottom: 8 }}
                            >
                              <Input placeholder="Telefon" />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'address']}
                              label="Adres"
                              style={{ marginBottom: 8 }}
                            >
                              <Input.TextArea rows={2} placeholder="Adres" />
                            </Form.Item>
                          </Col>
                          <Col span={24}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'description']}
                              label="Açıklama"
                              style={{ marginBottom: 0 }}
                            >
                              <Input.TextArea rows={2} placeholder="Açıklama / not" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Col>
                      <Col span={2} style={{ textAlign: 'right', paddingTop: 30 }}>
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                          title="Kaldır"
                        />
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>
                  İletişim bilgisi ekle
                </Button>
              </Space>
            )}
          </Form.List>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Form.Item name="is_inclusion" valuePropName="checked">
                <Checkbox>Kaynaştırma</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_foreign" valuePropName="checked">
                <Checkbox>Yabancı uyruklu</Checkbox>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title="Öğrenci Excel İçe Aktar"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false)
          resetImportState()
        }}
        width={820}
        destroyOnHidden
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button
              disabled={importStep === 0 || submitting}
              onClick={() => setImportStep((s) => Math.max(0, s - 1))}
            >
              Geri
            </Button>
            <Space>
              <Button
                onClick={() => {
                  setImportOpen(false)
                  resetImportState()
                }}
              >
                Vazgeç
              </Button>
              {importStep === 0 ? (
                <Button
                  type="primary"
                  loading={previewLoading}
                  onClick={() => void onPreviewImport()}
                >
                  Devam — Sütun Eşle
                </Button>
              ) : (
                <Button type="primary" loading={submitting} onClick={() => void onImport()}>
                  İçe Aktar
                </Button>
              )}
            </Space>
          </Space>
        }
      >
        <Steps
          size="small"
          current={importStep}
          style={{ marginBottom: 20 }}
          items={[{ title: 'Dosya' }, { title: 'Sütun eşleme' }]}
        />

        {importStep === 0 && (
          <>
            <Typography.Paragraph type="secondary">
              e-Okul sınıf listesi (.xls) veya düz başlıklı (.xlsx) dosyalar desteklenir. Farklı
              şablonlarda bir sonraki adımda Excel sütunlarını sistem alanlarıyla eşleştirirsiniz.
            </Typography.Paragraph>
            <Form layout="vertical">
              <Form.Item label="Okul (tüm satırlara uygulanır)">
                <Select
                  allowClear
                  placeholder="Okul seçin"
                  options={schools.map((s) => ({ value: s.id, label: s.name }))}
                  value={importSchoolId ?? undefined}
                  onChange={(v) => {
                    setImportSchoolId(v ?? null)
                    setImportClassroomId(null)
                  }}
                />
              </Form.Item>
              <Form.Item label="Excel dosyası (.xls / .xlsx)" required>
                <Upload.Dragger
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  maxCount={1}
                  beforeUpload={(file) => {
                    setImportFile({ uid: file.uid, name: file.name, originFileObj: file })
                    setImportPreview(null)
                    return false
                  }}
                  onRemove={() => {
                    setImportFile(null)
                    setImportPreview(null)
                  }}
                  fileList={importFile ? [importFile] : []}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Dosyayı buraya sürükleyin veya tıklayarak seçin</p>
                  <p className="ant-upload-hint">Excel (.xls, .xlsx)</p>
                </Upload.Dragger>
              </Form.Item>
            </Form>
          </>
        )}

        {importStep === 1 && importPreview && (
          <>
            {importPreview.detected_class && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 12 }}
                message={`Dosyadan sınıf algılandı: ${importPreview.detected_class.class_level}. Sınıf / ${importPreview.detected_class.section} Şube`}
                description="Bu değer yalnızca satırda sınıf/şube yoksa kullanılır. Excelde 10/B gibi satır bilgisi varsa öğrenci o sınıfa yazılır; mevcut kayıt varsa yeni öğrenci açılmaz, yalnızca değişen alanlar güncellenir."
              />
            )}

            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Başlık satırı" help="Yanlışsa değiştirip yeniden oku">
                    <Space.Compact style={{ width: '100%' }}>
                      <InputNumber
                        min={1}
                        max={Math.max(1, importPreview.total_rows)}
                        value={importHeaderRow}
                        onChange={(v) => setImportHeaderRow(Number(v) || 1)}
                        style={{ width: '100%' }}
                      />
                      <Button
                        loading={previewLoading}
                        onClick={() => void applyImportPreview(importHeaderRow)}
                      >
                        Yeniden oku
                      </Button>
                    </Space.Compact>
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item
                    label="Sınıf / şube (isteğe bağlı)"
                    required={!mappingHasClassColumns && !importPreview.detected_class}
                    help={
                      mappingHasClassColumns
                        ? 'Satırdaki sınıf/şube kullanılır (9/A, 10-B gibi birleşik değerler de okunur). Mevcut öğrenciler T.C. veya öğrenci no ile eşlenir, mükerrer kayıt açılmaz.'
                        : importPreview.detected_class
                          ? `Algılanan: ${importPreview.detected_class.class_level}/${importPreview.detected_class.section} — satırda sınıf yoksa bu kullanılır.`
                          : 'Excelde sınıf bilgisi bulunamadı; seçim zorunlu.'
                    }
                  >
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder={
                        importPreview.detected_class
                          ? `${importPreview.detected_class.class_level}/${importPreview.detected_class.section} (otomatik)`
                          : 'Sınıf / şube seçin'
                      }
                      options={importClassroomOptions}
                      value={importClassroomId ?? undefined}
                      onChange={(v) => setImportClassroomId(v ?? null)}
                      notFoundContent={
                        importPreview.detected_class
                          ? 'Kayıtlı sınıf yok — algılanan sınıf otomatik oluşturulacak'
                          : 'Veri Yok'
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Typography.Text strong>Sütun → alan eşlemesi</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
              Her Excel başlığını bir öğrenci alanına bağlayın. Kullanılmayan sütunları boş bırakın.
            </Typography.Paragraph>

            <SortableTable
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey={(r) => String(r.index)}
              dataSource={importPreview.headers}
              columns={[
                {
                  title: 'Excel sütunu',
                  dataIndex: 'label',
                  width: 200,
                },
                {
                  title: 'Örnek değer',
                  width: 160,
                  render: (_, row) => {
                    const sample = importPreview.sample_rows[0]?.values?.[row.label]
                    return sample ?? '—'
                  },
                },
                {
                  title: 'Sistem alanı',
                  render: (_, row) => (
                    <Select
                      allowClear
                      placeholder="Eşleme yok (atla)"
                      style={{ width: '100%' }}
                      value={importMapping[String(row.index)] || undefined}
                      options={STUDENT_IMPORT_FIELD_OPTIONS.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                        disabled:
                          usedImportFields.has(opt.value) &&
                          importMapping[String(row.index)] !== opt.value,
                      }))}
                      onChange={(v) => {
                        setImportMapping((prev) => {
                          const next = { ...prev }
                          if (!v) delete next[String(row.index)]
                          else next[String(row.index)] = v
                          return next
                        })
                      }}
                    />
                  ),
                },
              ]}
            />

            {importPreview.sample_rows.length > 0 && (
              <>
                <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>
                  Önizleme (ilk satırlar)
                </Typography.Text>
                <SortableTable
                  size="small"
                  style={{ marginTop: 8 }}
                  pagination={false}
                  scroll={{ x: true }}
                  rowKey={(r) => String(r.row)}
                  dataSource={importPreview.sample_rows}
                  columns={[
                    { title: 'Satır', dataIndex: 'row', width: 70, fixed: 'left' },
                    ...importPreview.headers.map((h) => ({
                      title: h.label,
                      dataIndex: ['values', h.label] as unknown as string,
                      render: (_: unknown, record: (typeof importPreview.sample_rows)[number]) =>
                        record.values[h.label] ?? '—',
                    })),
                  ]}
                />
              </>
            )}
          </>
        )}
      </Modal>

      <Modal
        title="Öğrenci Listesini Dışa Aktar"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        onOk={() => void onExport()}
        confirmLoading={submitting}
        okText="İndir"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form layout="vertical">
          {templates.length > 0 && (
            <Form.Item label="Kayıtlı şablonlar">
              <Space direction="vertical" style={{ width: '100%' }}>
                {templates.map((t) => (
                  <Space key={t.id} style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Button size="small" onClick={() => onApplyTemplate(t)}>
                      {t.name}
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => onDeleteTemplate(t)}
                    />
                  </Space>
                ))}
              </Space>
            </Form.Item>
          )}
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
          <Form.Item label="Sütunlar">
            <Checkbox.Group
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              options={STUDENT_COLUMN_OPTIONS.map((c) => ({ label: c.label, value: c.value }))}
              value={exportColumns}
              onChange={(vals) => setExportColumns(vals as string[])}
            />
          </Form.Item>
          <Form.Item label="Bu sütun seçimini şablon olarak kaydet">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Şablon adı"
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
              />
              <Button onClick={() => void onSaveTemplate()}>Kaydet</Button>
            </Space.Compact>
          </Form.Item>
          <Typography.Text type="secondary">
            Arama ve tablo filtreleri dışa aktarmaya da uygulanır.
          </Typography.Text>
        </Form>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Öğrencileri toplu sil"
        description={`Filtreye uyan ${filteredStudents.length} öğrenci kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
