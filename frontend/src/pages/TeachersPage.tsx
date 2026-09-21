import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Col, DatePicker, Dropdown, Form, Input, InputNumber, Modal, Row, Select, Space, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileTextOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { MebbisImportModal } from '../components/MebbisImportModal'
import { PersonnelDepartureModal } from '../components/PersonnelDepartureModal'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  createTeacher,
  deleteTeacher,
  downloadTeacherDocument,
  exportTeachers,
  listTeachers,
  updateTeacher,
} from '../api/teachers'
import type { TeacherDocumentType } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { Teacher, TeacherPayload } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { listPersonnelCategories } from '../api/personnelCategories'
import type { PersonnelCategory } from '../types/personnelCategory'
import { listDistricts, listProvinces } from '../api/geo'
import type { District, Province } from '../types/geo'
import { tablePagination } from '../utils/tablePagination'
import { personNameSorter, SORT_AZ } from '../utils/tableSort'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { addSalaryFormStarter } from '../utils/salaryFormAutoEntry'
import { KARIYER_OPTIONS, teacherTitleParts } from '../utils/teacherTitle'
import { uniqueSelectOptions, trSelectFilter } from '../utils/uniqueSelectOptions'
import { DynamicListFilters, isActiveFilterValue, matchesListFilter, type ListFilterValue } from '../components/DynamicListFilters'
import { useVisibleFilterFields } from '../hooks/useVisibleFilterFields'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { FilterFieldsPicker, type FilterFieldOption } from '../components/FilterFieldsPicker'
import { MOBILE_PHONE_RULE } from '../utils/phone'

const TEACHER_FILTER_FIELDS = [
  'first_name',
  'last_name',
  'personnel_no',
  'national_id',
  'phone',
  'email',
  'unvan',
  'brans',
  'kariyer',
  'working_institution',
  'degree',
  'rank',
  'pension_degree',
  'degree_rank_date',
  'last_graduated_school',
  'class_level',
  'school_principal',
  'union',
  'first_duty_date',
  'service_start_date',
] as const
type TeacherFilterField = (typeof TEACHER_FILTER_FIELDS)[number]
const TEACHER_FILTER_DEFAULTS: TeacherFilterField[] = ['unvan', 'brans', 'kariyer', 'union']
const TEACHER_FILTER_OPTIONS: FilterFieldOption<TeacherFilterField>[] = [
  { key: 'first_name', label: 'Ad' },
  { key: 'last_name', label: 'Soyad' },
  { key: 'personnel_no', label: 'Sicil No' },
  { key: 'national_id', label: 'TC Kimlik No' },
  { key: 'phone', label: 'Cep telefonu' },
  { key: 'email', label: 'E-posta' },
  { key: 'unvan', label: 'Unvan' },
  { key: 'brans', label: 'Branş' },
  { key: 'kariyer', label: 'Kariyer' },
  { key: 'working_institution', label: 'Görev Yeri' },
  { key: 'degree', label: 'Derece' },
  { key: 'rank', label: 'Kademe' },
  { key: 'pension_degree', label: 'Emekli Sicil No' },
  { key: 'degree_rank_date', label: 'Kademe Tarihi', kind: 'dateRange' },
  { key: 'last_graduated_school', label: 'Mezun Olunan Okul' },
  { key: 'class_level', label: 'Sınıf / Kademe' },
  { key: 'school_principal', label: 'Okul Müdürü' },
  { key: 'union', label: 'Sendika' },
  { key: 'first_duty_date', label: 'İşe ilk başlama', kind: 'dateRange' },
  { key: 'service_start_date', label: 'Kuruma başlama', kind: 'dateRange' },
]

function teacherFieldValue(teacher: Teacher, key: TeacherFilterField): string {
  const parts = teacherTitleParts(teacher)
  switch (key) {
    case 'unvan':
      return parts.unvan || ''
    case 'brans':
      return parts.brans || ''
    case 'kariyer':
      return parts.kariyer || ''
    case 'union':
      return teacher.union_name || ''
    case 'degree_rank_date':
    case 'first_duty_date':
    case 'service_start_date':
      return String(teacher[key] || '').slice(0, 10)
    default:
      return String(teacher[key] ?? '').trim()
  }
}

interface TeacherFormValues {
  first_name: string
  last_name: string
  school_id?: number | null
  personnel_no?: string
  national_id?: string
  phone?: string
  email?: string
  city?: string
  district?: string
  last_graduated_school?: string
  class_level?: string
  unvan?: string
  brans?: string
  kariyer?: string
  working_institution?: string
  degree?: string
  pension_degree?: string
  rank?: string
  degree_rank_date?: Dayjs | null
  school_principal?: string
  service_start_date?: Dayjs | null
  first_duty_date?: Dayjs | null
  annual_leave_quota?: number | null
  union_name?: string
  add_to_salary_form?: boolean
}

export function TeachersPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const { schools, activeSchoolId, activeSchool } = useActiveSchool()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search)
  const [filterValues, setFilterValues] = useState<Partial<Record<TeacherFilterField, ListFilterValue>>>({})
  const { visible: visibleFilters, setVisible: setVisibleFilters, isVisible } = useVisibleFilterFields(
    'teachers',
    session?.user.id,
    TEACHER_FILTER_FIELDS,
    TEACHER_FILTER_DEFAULTS,
  )
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx')
  const [form] = Form.useForm<TeacherFormValues>()
  const [moveTarget, setMoveTarget] = useState<Teacher | null>(null)
  const [moveCategoryId, setMoveCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<PersonnelCategory[]>([])
  const [moving, setMoving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [departureTarget, setDepartureTarget] = useState<Teacher | null>(null)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const selectedCity = Form.useWatch('city', form)
  const selectedDistrict = Form.useWatch('district', form)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const teacherData = await listTeachers({ scope: 'teachers' })
      setTeachers(teacherData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void listProvinces()
      .then(setProvinces)
      .catch((err) => message.error(getErrorMessage(err)))
  }, [message])

  useEffect(() => {
    const province = provinces.find((p) => p.name === selectedCity)
    if (!province) {
      setDistricts([])
      return
    }
    let cancelled = false
    void listDistricts(province.id)
      .then((rows) => {
        if (!cancelled) setDistricts(rows)
      })
      .catch(() => {
        if (!cancelled) setDistricts([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedCity, provinces])

  const filterOptionsByKey = useMemo(() => {
    return {
      first_name: uniqueSelectOptions(teachers.map((t) => t.first_name)),
      last_name: uniqueSelectOptions(teachers.map((t) => t.last_name)),
      personnel_no: uniqueSelectOptions(teachers.map((t) => t.personnel_no)),
      national_id: uniqueSelectOptions(teachers.map((t) => t.national_id)),
      phone: uniqueSelectOptions(teachers.map((t) => t.phone)),
      email: uniqueSelectOptions(teachers.map((t) => t.email)),
      unvan: uniqueSelectOptions(teachers.map((t) => teacherTitleParts(t).unvan)),
      brans: uniqueSelectOptions(teachers.map((t) => teacherTitleParts(t).brans)),
      kariyer: uniqueSelectOptions([
        ...KARIYER_OPTIONS.map((o) => o.value),
        ...teachers.map((t) => teacherTitleParts(t).kariyer),
      ]),
      working_institution: uniqueSelectOptions(teachers.map((t) => t.working_institution)),
      degree: uniqueSelectOptions(teachers.map((t) => t.degree)),
      rank: uniqueSelectOptions(teachers.map((t) => t.rank)),
      pension_degree: uniqueSelectOptions(teachers.map((t) => t.pension_degree)),
      last_graduated_school: uniqueSelectOptions(teachers.map((t) => t.last_graduated_school)),
      class_level: uniqueSelectOptions(teachers.map((t) => t.class_level)),
      school_principal: uniqueSelectOptions(teachers.map((t) => t.school_principal)),
      union: uniqueSelectOptions(teachers.map((t) => t.union_name)),
    } satisfies Partial<Record<TeacherFilterField, Array<{ value: string | number; label: string }>>>
  }, [teachers])

  const hasActiveFilters = Boolean(
    search.trim() || TEACHER_FILTER_FIELDS.some((key) => isActiveFilterValue(filterValues[key])),
  )

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    return teachers.filter((t) => {
      for (const key of TEACHER_FILTER_FIELDS) {
        const selected = filterValues[key]
        if (!isActiveFilterValue(selected)) continue
        if (!matchesListFilter(teacherFieldValue(t, key), selected)) return false
      }
      if (!q) return true
      const parts = teacherTitleParts(t)
      const fullName = `${t.first_name} ${t.last_name}`.toLocaleLowerCase('tr-TR')
      const reverseName = `${t.last_name} ${t.first_name}`.toLocaleLowerCase('tr-TR')
      return (
        fullName.includes(q) ||
        reverseName.includes(q) ||
        t.first_name.toLocaleLowerCase('tr-TR').includes(q) ||
        t.last_name.toLocaleLowerCase('tr-TR').includes(q) ||
        (t.personnel_no || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.national_id || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (parts.unvan || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (parts.brans || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (parts.kariyer || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.union_name || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.phone || '').toLocaleLowerCase('tr-TR').includes(q) ||
        (t.email || '').toLocaleLowerCase('tr-TR').includes(q)
      )
    })
  }, [teachers, searchQuery, filterValues])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ add_to_salary_form: true, school_id: activeSchoolId ?? undefined, kariyer: 'Öğretmen' })
    setModalOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    form.setFieldsValue({
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      school_id: teacher.school_id,
      personnel_no: teacher.personnel_no || undefined,
      national_id: teacher.national_id || undefined,
      phone: teacher.phone || undefined,
      email: teacher.email || undefined,
      city: teacher.city || undefined,
      district: teacher.district || undefined,
      last_graduated_school: teacher.last_graduated_school || undefined,
      class_level: teacher.class_level || undefined,
      unvan: teacher.unvan || teacherTitleParts(teacher).unvan || undefined,
      brans: teacher.brans || teacherTitleParts(teacher).brans || undefined,
      kariyer: teacher.kariyer || teacherTitleParts(teacher).kariyer,
      working_institution: teacher.working_institution || undefined,
      degree: teacher.degree || undefined,
      pension_degree: teacher.pension_degree || undefined,
      rank: teacher.rank || undefined,
      degree_rank_date: teacher.degree_rank_date ? dayjs(teacher.degree_rank_date) : null,
      school_principal: teacher.school_principal || undefined,
      service_start_date: teacher.service_start_date ? dayjs(teacher.service_start_date) : null,
      first_duty_date: teacher.first_duty_date ? dayjs(teacher.first_duty_date) : null,
      annual_leave_quota: teacher.annual_leave_quota,
      union_name: teacher.union_name || undefined,
    })
    setModalOpen(true)
  }

  const onFinish = async (values: TeacherFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const { add_to_salary_form, ...rest } = values
      const payload: TeacherPayload = {
        ...rest,
        personnel_type: 'ogretmen',
        personnel_category_id: null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        unvan: values.unvan || null,
        brans: values.brans || null,
        kariyer: values.kariyer || 'Öğretmen',
        degree_rank_date: values.degree_rank_date ? values.degree_rank_date.toISOString() : null,
        service_start_date: values.service_start_date ? values.service_start_date.format('YYYY-MM-DD') : null,
        first_duty_date: values.first_duty_date ? values.first_duty_date.format('YYYY-MM-DD') : null,
      }

      if (editing) {
        await updateTeacher(editing.id, payload)
        message.success('Öğretmen güncellendi')
      } else {
        const created = await createTeacher(session.user.tenant_id, payload)
        message.success('Öğretmen oluşturuldu')
        if (add_to_salary_form) {
          const startDate = values.service_start_date || dayjs()
          try {
            await addSalaryFormStarter(startDate, {
              personnel_no: created.personnel_no || undefined,
              full_name: `${created.first_name} ${created.last_name}`,
              national_id: created.national_id || undefined,
              start_date: startDate.format('YYYY-MM-DD'),
            })
          } catch (err) {
            message.warning('Öğretmen oluşturuldu ancak maaş değişikliği formuna eklenemedi: ' + getErrorMessage(err))
          }
        }
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = (teacher: Teacher) => {
    modal.confirm({
      title: 'Öğretmeni sil',
      content: `"${teacher.first_name} ${teacher.last_name}" kaydını silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTeacher(teacher.id)
          message.success('Öğretmen silindi')
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
        filteredTeachers.map((t) => t.id),
        (id) => deleteTeacher(Number(id)),
      )
      const text = bulkDeleteResultMessage(result, 'öğretmen')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

  const onExport = async () => {
    setSubmitting(true)
    try {
      const blob = await exportTeachers({
        format: exportFormat,
        filters: {
          scope: 'teachers',
          ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
        },
      })
      downloadBlob(blob, exportFilename('ogretmenler', exportFormat))
      message.success('Dışa aktarma indirildi')
      setExportOpen(false)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const canCreate = hasPermission('teachers.create')
  const canUpdate = hasPermission('teachers.update')
  const canDelete = hasPermission('teachers.delete')

  const openMove = async (teacher: Teacher) => {
    try {
      const rows = await listPersonnelCategories()
      setCategories(rows)
      setMoveTarget(teacher)
      setMoveCategoryId(rows[0]?.id ?? null)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onMove = async () => {
    if (!moveTarget || !moveCategoryId) {
      message.warning('Kategori seçin')
      return
    }
    setMoving(true)
    try {
      await updateTeacher(moveTarget.id, { personnel_category_id: moveCategoryId })
      message.success('Personel Diğer Personeller listesine taşındı')
      setMoveTarget(null)
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setMoving(false)
    }
  }

  const onDownloadDocument = async (teacher: Teacher, type: TeacherDocumentType) => {
    if (type === 'ayrilis') {
      setDepartureTarget(teacher)
      return
    }
    try {
      const blob = await downloadTeacherDocument(teacher.id, type)
      downloadBlob(blob, `${type}-${teacher.personnel_no || teacher.id}.docx`)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const columns: ColumnsType<Teacher> = [
    {
      title: 'Ad soyad',
      sorter: personNameSorter<Teacher>(),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => `${record.first_name} ${record.last_name}`,
    },
    { title: 'Cep telefonu', dataIndex: 'phone', render: (v: string | null) => v || '—' },
    { title: 'E-posta', dataIndex: 'email', render: (v: string | null) => v || '—' },
    {
      title: 'Unvan',
      dataIndex: 'unvan',
      sorter: (a: Teacher, b: Teacher) =>
        (teacherTitleParts(a).unvan || '').localeCompare(teacherTitleParts(b).unvan || '', 'tr'),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => teacherTitleParts(record).unvan || '—',
    },
    {
      title: 'Branş',
      dataIndex: 'brans',
      sorter: (a: Teacher, b: Teacher) =>
        (teacherTitleParts(a).brans || '').localeCompare(teacherTitleParts(b).brans || '', 'tr'),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => teacherTitleParts(record).brans || '—',
    },
    {
      title: 'Kariyer',
      dataIndex: 'kariyer',
      sorter: (a: Teacher, b: Teacher) =>
        (teacherTitleParts(a).kariyer || '').localeCompare(teacherTitleParts(b).kariyer || '', 'tr'),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, record) => teacherTitleParts(record).kariyer || '—',
    },
    { title: 'Sendika', dataIndex: 'union_name', render: (v: string | null) => v || '—' },
    {
      title: 'İlk başlama',
      dataIndex: 'first_duty_date',
      render: (v: string | null) => (v ? dayjs(v).format('DD.MM.YYYY') : '—'),
    },
    {
      title: 'İşlemler',
      width: 160,
      render: (_: unknown, record: Teacher) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'baslama', label: 'Göreve Başlama Yazısı' },
                { key: 'gorevlendirme', label: 'Görevlendirme Yazısı' },
                { key: 'ayrilis', label: 'Ayrılış Ver...' },
              ],
              onClick: ({ key }) => void onDownloadDocument(record, key as TeacherDocumentType),
            }}
          >
            <Button size="small" icon={<FileTextOutlined />} title="Evrak indir" />
          </Dropdown>
          {canUpdate && (
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={() => void openMove(record)}
              title="Diğer personele taşı"
            />
          )}
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
    <AppLayout title="Öğretmenler">
      <div>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Öğretmenler
          </Typography.Title>
          <Space wrap>
            {canDelete && filteredTeachers.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredTeachers.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>
            {canCreate && (
              <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
                MEBBİS'ten İçe Aktar
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Yeni Öğretmen
              </Button>
            )}
          </Space>
        </Space>

        <FilterBar>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Ad, soyad, unvan, branş, T.C., telefon veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
          <DynamicListFilters
            fields={TEACHER_FILTER_OPTIONS}
            isVisible={isVisible}
            values={filterValues}
            optionsByKey={filterOptionsByKey}
            onChange={(key, value) => {
              setFilterValues((current) => ({ ...current, [key]: value }))
            }}
          />
          <FilterFieldsPicker
            options={TEACHER_FILTER_OPTIONS}
            value={visibleFilters}
            onChange={(next) => {
              setVisibleFilters(next)
              setFilterValues((current) => {
                const kept: Partial<Record<TeacherFilterField, ListFilterValue>> = {}
                for (const key of next) kept[key] = current[key]
                return kept
              })
            }}
          />
          <ClearFiltersButton
            active={hasActiveFilters}
            onClick={() => {
              setSearch('')
              setFilterValues({})
            }}
          />
        </FilterBar>

        <SortableTable
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredTeachers}
          pagination={tablePagination(20)}
          scroll={{ x: 'max-content' }}
        />

      </div>

      <Modal
        title={editing ? 'Öğretmeni Düzenle' : 'Yeni Öğretmen'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={680}
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
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="school_id" label="Okul">
                <Select
                  allowClear
                  placeholder="Okul seçin"
                  options={schools.map((school) => ({ value: school.id, label: school.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="personnel_no" label="Sicil No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="national_id" label="TC Kimlik No">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Cep telefonu" rules={[MOBILE_PHONE_RULE]}>
                <Input placeholder="05xx xxx xx xx" maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="E-posta"
                rules={[{ type: 'email', message: 'Geçerli bir e-posta girin' }]}
              >
                <Input placeholder="ornek@okul.k12.tr" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="city" label="İl">
                <Select
                  allowClear
                  showSearch
                  placeholder="İl seçin"
                  optionFilterProp="label"
                  filterOption={trSelectFilter}
                  options={[
                    ...provinces.map((p) => ({ value: p.name, label: p.name })),
                    ...(selectedCity && !provinces.some((p) => p.name === selectedCity)
                      ? [{ value: selectedCity, label: selectedCity }]
                      : []),
                  ]}
                  onChange={() => form.setFieldValue('district', undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="district" label="İlçe">
                <Select
                  allowClear
                  showSearch
                  placeholder={selectedCity ? 'İlçe seçin' : 'Önce il seçin'}
                  disabled={!selectedCity}
                  optionFilterProp="label"
                  filterOption={trSelectFilter}
                  options={[
                    ...districts.map((d) => ({ value: d.name, label: d.name })),
                    ...(selectedDistrict && !districts.some((d) => d.name === selectedDistrict)
                      ? [{ value: selectedDistrict, label: selectedDistrict }]
                      : []),
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="unvan" label="Unvan">
                <Input placeholder="Örn. Öğretmen, Müdür Yardımcısı" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="brans" label="Branş">
                <Input placeholder="Örn. Matematik" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="kariyer" label="Kariyer">
                <Select options={KARIYER_OPTIONS} placeholder="Kariyer" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="working_institution" label="Görev Yeri">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12} />
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="degree" label="Derece">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rank" label="Kademe">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="pension_degree" label="Emekli Sicil No">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="degree_rank_date" label="Kademe Tarihi">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="last_graduated_school" label="Mezun Olunan Okul">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="class_level" label="Sınıf / Kademe">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="school_principal" label="Okul Müdürü">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="union_name" label="Sendika">
                <Input placeholder="Sendika adı (isteğe bağlı)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="first_duty_date"
                label="İşe ilk başlama tarihi"
                tooltip="Kamu görevine ilk başladığı tarih (MEBBİS: İlk göreve başlama)"
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="service_start_date"
                label="Kuruma başlama tarihi"
                tooltip="Bu okula/kuruma başladığı tarih. Yıllık izin için ilk başlama tarihi yoksa bu tarih kullanılır."
              >
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="annual_leave_quota"
                label="Yıllık izin hakkı (gün, manuel override)"
                tooltip="Boş bırakılırsa işe ilk başlama (yoksa kuruma başlama) tarihine göre otomatik hesaplanır (10 yıla kadar 20 gün, üzeri 30 gün)"
              >
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {!editing && (
            <Form.Item name="add_to_salary_form" valuePropName="checked">
              <Checkbox>
                Maaş Değişikliği Bildirim Formuna ekle (C - Başlayan Personel). İşaret kaldırılırsa kurum
                içi görevlendirme kabul edilir.
              </Checkbox>
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Öğretmen Listesini Dışa Aktar"
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
            {hasActiveFilters
              ? `Aktif filtre uygulanacak (${filteredTeachers.length} kayıt).`
              : 'Tüm öğretmenler dışa aktarılır.'}
          </Typography.Text>
        </Form>
      </Modal>

      <MebbisImportModal
        open={importOpen}
        schoolId={activeSchoolId}
        schoolName={activeSchool?.name}
        onCancel={() => setImportOpen(false)}
        onImported={() => void load()}
      />

      <Modal
        title="Diğer personele taşı"
        open={Boolean(moveTarget)}
        onCancel={() => setMoveTarget(null)}
        onOk={() => void onMove()}
        confirmLoading={moving}
        okText="Taşı"
      >
        <Typography.Paragraph>
          {moveTarget
            ? `"${moveTarget.first_name} ${moveTarget.last_name}" öğretmen listesinden çıkarılıp seçilen kategoriye alınacak.`
            : null}
        </Typography.Paragraph>
        <Select
          style={{ width: '100%' }}
          placeholder="Kategori seçin"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={moveCategoryId ?? undefined}
          onChange={(v) => setMoveCategoryId(v)}
        />
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Öğretmenleri toplu sil"
        description={`Filtreye uyan ${filteredTeachers.length} öğretmen kaydı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
      <PersonnelDepartureModal
        teacher={departureTarget}
        onClose={() => setDepartureTarget(null)}
        onDone={() => {
          setDepartureTarget(null)
          void load()
        }}
      />
    </AppLayout>
  )
}
