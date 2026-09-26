import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Checkbox, Col, DatePicker, Descriptions, Dropdown, Form, Input, InputNumber, Modal, Row, Select, Space, Typography } from 'antd'
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
  fetchSchoolPrincipal,
  listTeachers,
  updateTeacher,
} from '../api/teachers'
import type { TeacherDocumentType } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { Teacher, TeacherPayload } from '../types/teacher'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { listPersonnelCategories } from '../api/personnelCategories'
import type { PersonnelCategory } from '../types/personnelCategory'
import { tablePagination } from '../utils/tablePagination'
import { personNameSorter, SORT_AZ } from '../utils/tableSort'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { addSalaryFormStarter } from '../utils/salaryFormAutoEntry'
import { KARIYER_OPTIONS, teacherTitleParts } from '../utils/teacherTitle'
import { uniqueSelectOptions } from '../utils/uniqueSelectOptions'
import { DynamicListFilters, isActiveFilterValue, matchesListFilter, type ListFilterValue } from '../components/DynamicListFilters'
import { useVisibleFilterFields } from '../hooks/useVisibleFilterFields'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { FilterFieldsPicker, type FilterFieldOption } from '../components/FilterFieldsPicker'
import { MOBILE_PHONE_RULE } from '../utils/phone'

type EmploymentKind = 'kadrolu' | 'sozlesmeli' | 'ucretli'

const TEACHER_DATA_EXPORT_OPTIONS = [
  { value: 'first_name', label: 'Ad' },
  { value: 'last_name', label: 'Soyad' },
  { value: 'school_name', label: 'Okul' },
  { value: 'personnel_no', label: 'Sicil No' },
  { value: 'national_id', label: 'T.C. Kimlik No' },
  { value: 'phone', label: 'Cep telefonu' },
  { value: 'email', label: 'E-posta' },
  { value: 'employment_type', label: 'Çalışma biçimi' },
  { value: 'unvan', label: 'Unvan' },
  { value: 'brans', label: 'Branş' },
  { value: 'kariyer', label: 'Kariyer' },
  { value: 'degree', label: 'Derece' },
  { value: 'rank', label: 'Kademe' },
  { value: 'degree_rank_date', label: 'Kademe Tarihi' },
  { value: 'first_duty_date', label: 'İşe ilk başlama tarihi' },
  { value: 'service_start_date', label: 'Kuruma başlama tarihi' },
]

const TEACHER_SIGNATURE_EXPORT_OPTIONS = [
  { value: 'signature', label: 'İmza' },
  { value: 'signature_morning', label: 'Sabah imza' },
  { value: 'signature_noon', label: 'Öğle imza' },
  { value: 'signature_evening', label: 'Akşam imza' },
  { value: 'signature_timed', label: 'Saatli imza' },
]

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
  'birth_date',
  'last_graduated_school',
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
  { key: 'birth_date', label: 'Doğum Tarihi', kind: 'dateRange' },
  { key: 'last_graduated_school', label: 'Mezun Olunan Okul' },
  { key: 'school_principal', label: 'Okul Müdürü' },
  { key: 'union', label: 'Sendika' },
  { key: 'first_duty_date', label: 'İşe ilk başlama', kind: 'dateRange' },
  { key: 'service_start_date', label: 'Kuruma başlama', kind: 'dateRange' },
]

function formatTrDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('DD.MM.YYYY') : '—'
}

function TeacherRowDetail({ teacher, principalName }: { teacher: Teacher; principalName: string | null }) {
  const parts = teacherTitleParts(teacher)
  return (
    <Descriptions size="small" column={3} bordered>
      <Descriptions.Item label="Sicil No">{teacher.personnel_no || '—'}</Descriptions.Item>
      <Descriptions.Item label="TC Kimlik No">{teacher.national_id || '—'}</Descriptions.Item>
      <Descriptions.Item label="Doğum Tarihi">{formatTrDate(teacher.birth_date)}</Descriptions.Item>
      <Descriptions.Item label="Telefon">{teacher.phone || '—'}</Descriptions.Item>
      <Descriptions.Item label="E-posta">{teacher.email || '—'}</Descriptions.Item>
      <Descriptions.Item label="Unvan">{parts.unvan || '—'}</Descriptions.Item>
      <Descriptions.Item label="Branş">{parts.brans || '—'}</Descriptions.Item>
      <Descriptions.Item label="Kariyer">{parts.kariyer || '—'}</Descriptions.Item>
      <Descriptions.Item label="Personel Türü">Öğretmen</Descriptions.Item>
      <Descriptions.Item label="Personel Kategorisi">{teacher.PersonnelCategory?.name || '—'}</Descriptions.Item>
      <Descriptions.Item label="Çalıştığı Kurum">{teacher.working_institution || '—'}</Descriptions.Item>
      <Descriptions.Item label="Derece">{teacher.degree || '—'}</Descriptions.Item>
      <Descriptions.Item label="Kademe">{teacher.rank || '—'}</Descriptions.Item>
      <Descriptions.Item label="Emekli Sicil No">{teacher.pension_degree || '—'}</Descriptions.Item>
      <Descriptions.Item label="Sendika">{teacher.union_name || '—'}</Descriptions.Item>
      <Descriptions.Item label="Son Mezun Olduğu Okul">{teacher.last_graduated_school || '—'}</Descriptions.Item>
      <Descriptions.Item label="İl / İlçe">
        {teacher.city || teacher.district ? `${teacher.city || '—'} / ${teacher.district || '—'}` : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Okul Müdürü">{principalName || teacher.school_principal || '—'}</Descriptions.Item>
      <Descriptions.Item label="Yıllık İzin Kotası">{teacher.annual_leave_quota ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Hizmet Başlangıç Tarihi">{formatTrDate(teacher.service_start_date)}</Descriptions.Item>
      <Descriptions.Item label="İlk Görev Tarihi">{formatTrDate(teacher.first_duty_date)}</Descriptions.Item>
      <Descriptions.Item label="Kademe Tarihi">{formatTrDate(teacher.degree_rank_date)}</Descriptions.Item>
      <Descriptions.Item label="8 Yıl Başlangıç Tarihi">{formatTrDate(teacher.eight_year_base_date)}</Descriptions.Item>
      <Descriptions.Item label="Sözleşme Başlangıç">{formatTrDate(teacher.contract_start_date)}</Descriptions.Item>
      <Descriptions.Item label="Sözleşme Bitiş">{formatTrDate(teacher.contract_end_date)}</Descriptions.Item>
    </Descriptions>
  )
}

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
    case 'birth_date':
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
  birth_date?: Dayjs | null
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
  employment_type?: EmploymentKind
  contract_start_date?: Dayjs | null
  contract_end_date?: Dayjs | null
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
  const [exportColumns, setExportColumns] = useState<string[]>(
    TEACHER_DATA_EXPORT_OPTIONS.map((column) => column.value),
  )
  const [form] = Form.useForm<TeacherFormValues>()
  const employmentType = Form.useWatch('employment_type', form)
  const [moveTarget, setMoveTarget] = useState<Teacher | null>(null)
  const [moveCategoryId, setMoveCategoryId] = useState<number | null>(null)
  const [categories, setCategories] = useState<PersonnelCategory[]>([])
  const [moving, setMoving] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [departureTarget, setDepartureTarget] = useState<Teacher | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<number[]>([])
  const [principalName, setPrincipalName] = useState<string | null>(null)

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
    if (!activeSchoolId) {
      setPrincipalName(null)
      return
    }
    void fetchSchoolPrincipal(activeSchoolId)
      .then(setPrincipalName)
      .catch(() => setPrincipalName(null))
  }, [activeSchoolId])

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
      school_principal: uniqueSelectOptions(teachers.map((t) => t.school_principal)),
      union: uniqueSelectOptions(teachers.map((t) => t.union_name)),
    } satisfies Partial<Record<TeacherFilterField, Array<{ value: string | number; label: string }>>>
  }, [teachers])

  const hasActiveFilters = Boolean(
    search.trim() || TEACHER_FILTER_FIELDS.some((key) => isActiveFilterValue(filterValues[key])),
  )

  const filteredTeachers = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    const list = teachers.filter((t) => {
      if (activeSchoolId && t.school_id && t.school_id !== activeSchoolId) return false
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
    list.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'tr'),
    )
    return list
  }, [teachers, searchQuery, filterValues, activeSchoolId])

  const openCreate = (kind: EmploymentKind = 'kadrolu') => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      employment_type: kind,
      add_to_salary_form: kind !== 'ucretli',
      school_id: activeSchoolId ?? undefined,
      kariyer: kind === 'ucretli' ? undefined : 'Öğretmen',
      city: activeSchool?.Province?.name || undefined,
      district: activeSchool?.District?.name || undefined,
      school_principal: session?.user.full_name || undefined,
    })
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
      city: teacher.city || activeSchool?.Province?.name || undefined,
      district: teacher.district || activeSchool?.District?.name || undefined,
      last_graduated_school: teacher.last_graduated_school || undefined,
      birth_date: teacher.birth_date ? dayjs(teacher.birth_date) : null,
      unvan: teacher.unvan || teacherTitleParts(teacher).unvan || undefined,
      brans: teacher.brans || teacherTitleParts(teacher).brans || undefined,
      kariyer: teacher.kariyer || teacherTitleParts(teacher).kariyer,
      working_institution: teacher.working_institution || undefined,
      degree: teacher.degree || undefined,
      pension_degree: teacher.pension_degree || undefined,
      rank: teacher.rank || undefined,
      degree_rank_date: teacher.degree_rank_date ? dayjs(teacher.degree_rank_date) : null,
      school_principal: teacher.school_principal || session?.user.full_name || undefined,
      service_start_date: teacher.service_start_date ? dayjs(teacher.service_start_date) : null,
      first_duty_date: teacher.first_duty_date ? dayjs(teacher.first_duty_date) : null,
      annual_leave_quota: teacher.annual_leave_quota,
      union_name: teacher.union_name || undefined,
      employment_type: teacher.employment_type || 'kadrolu',
      contract_start_date: teacher.contract_start_date ? dayjs(teacher.contract_start_date) : null,
      contract_end_date: teacher.contract_end_date ? dayjs(teacher.contract_end_date) : null,
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
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        service_start_date: values.service_start_date ? values.service_start_date.format('YYYY-MM-DD') : null,
        first_duty_date: values.first_duty_date ? values.first_duty_date.format('YYYY-MM-DD') : null,
        employment_type: values.employment_type || 'kadrolu',
        contract_start_date: values.contract_start_date
          ? values.contract_start_date.format('YYYY-MM-DD')
          : null,
        contract_end_date: values.contract_end_date ? values.contract_end_date.format('YYYY-MM-DD') : null,
      }
      if (payload.employment_type === 'ucretli') {
        payload.personnel_no = null
        payload.unvan = null
        payload.kariyer = null
        payload.degree = null
        payload.rank = null
        payload.pension_degree = null
        payload.degree_rank_date = null
      }

      if (editing) {
        await updateTeacher(editing.id, payload)
        message.success('Öğretmen güncellendi')
      } else {
        const created = await createTeacher(session.user.tenant_id, payload)
        message.success('Öğretmen oluşturuldu')
        if (add_to_salary_form && payload.employment_type !== 'ucretli') {
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
    if (exportColumns.length === 0) {
      message.warning('En az bir sütun seçin')
      return
    }
    setSubmitting(true)
    try {
      const blob = await exportTeachers({
        format: exportFormat,
        columns: exportColumns,
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
        <Space onClick={(event) => event.stopPropagation()}>
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
              <Space direction="vertical" size={4} align="end">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate('kadrolu')}>
                  Yeni Öğretmen
                </Button>
                <Space size={4}>
                  <Button size="small" onClick={() => openCreate('kadrolu')}>
                    Kadrolu
                  </Button>
                  <Button size="small" onClick={() => openCreate('sozlesmeli')}>
                    Sözleşmeli
                  </Button>
                  <Button size="small" onClick={() => openCreate('ucretli')}>
                    Ücretli
                  </Button>
                </Space>
              </Space>
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
          onRow={(record) => ({
            onClick: () => {
              setExpandedKeys((keys) => (keys[0] === record.id ? [] : [record.id]))
            },
            style: { cursor: 'pointer' },
          })}
          expandable={{
            expandedRowKeys: expandedKeys,
            showExpandColumn: false,
            expandedRowRender: (record) => (
              <TeacherRowDetail teacher={record} principalName={principalName} />
            ),
          }}
        />

      </div>

      <Modal
        title={
          editing
            ? 'Öğretmeni Düzenle'
            : employmentType === 'ucretli'
              ? 'Ücretli öğretmen'
              : employmentType === 'sozlesmeli'
                ? 'Sözleşmeli öğretmen'
                : 'Kadrolu öğretmen'
        }
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
          <Form.Item name="employment_type" hidden>
            <Input />
          </Form.Item>
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
            {employmentType !== 'ucretli' && (
              <Col span={12}>
                <Form.Item name="personnel_no" label="Sicil No">
                  <Input />
                </Form.Item>
              </Col>
            )}
            <Col span={employmentType === 'ucretli' ? 24 : 12}>
              <Form.Item
                name="national_id"
                label="TC Kimlik No"
                rules={
                  employmentType === 'ucretli' ? [{ required: true, message: 'T.C. kimlik no zorunludur' }] : []
                }
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Cep telefonu"
                rules={
                  employmentType === 'ucretli'
                    ? [{ required: true, message: 'Telefon zorunludur' }, MOBILE_PHONE_RULE]
                    : [MOBILE_PHONE_RULE]
                }
              >
                <Input placeholder="05xx xxx xx xx" maxLength={30} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="E-posta"
                rules={
                  employmentType === 'ucretli'
                    ? [
                        { required: true, message: 'E-posta zorunludur' },
                        { type: 'email', message: 'Geçerli bir e-posta girin' },
                      ]
                    : [{ type: 'email', message: 'Geçerli bir e-posta girin' }]
                }
              >
                <Input placeholder="ornek@okul.k12.tr" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="city" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="district" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            {employmentType !== 'ucretli' && (
              <Col span={8}>
                <Form.Item name="unvan" label="Unvan">
                  <Input placeholder="Örn. Öğretmen, Müdür Yardımcısı" />
                </Form.Item>
              </Col>
            )}
            <Col span={employmentType === 'ucretli' ? 24 : 8}>
              <Form.Item
                name="brans"
                label="Branş"
                rules={employmentType === 'ucretli' ? [{ required: true, message: 'Branş zorunludur' }] : []}
              >
                <Input placeholder="Örn. Matematik" />
              </Form.Item>
            </Col>
            {employmentType !== 'ucretli' && (
              <Col span={8}>
                <Form.Item name="kariyer" label="Kariyer">
                  <Select options={KARIYER_OPTIONS} placeholder="Kariyer" />
                </Form.Item>
              </Col>
            )}
          </Row>
          {employmentType !== 'ucretli' && (
            <>
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
              <Form.Item name="birth_date" label="Doğum Tarihi">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" placeholder="Tarih seç" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="school_principal" hidden>
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="union_name" label="Sendika">
                <Input placeholder="Sendika adı (isteğe bağlı)" />
              </Form.Item>
            </Col>
            <Col span={12} />
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
          </>
          )}
          {employmentType === 'sozlesmeli' && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="contract_start_date" label="Sözleşme başlangıcı">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="contract_end_date" label="Sözleşme bitişi">
                  <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
                </Form.Item>
              </Col>
            </Row>
          )}
          {!editing && employmentType !== 'ucretli' && (
            <Form.Item name="add_to_salary_form" valuePropName="checked">
              <Checkbox>
                Maaş Değişikliği Bildirim Formuna ekle (C - Başlayan Personel). İşaret kaldırılırsa
                görevlendirme kabul edilir.
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
          <Typography.Paragraph strong style={{ marginTop: 16, marginBottom: 8 }}>
            Sütunlar
          </Typography.Paragraph>
          <Checkbox
            style={{ marginBottom: 8 }}
            checked={
              TEACHER_DATA_EXPORT_OPTIONS.every((column) => exportColumns.includes(column.value))
            }
            indeterminate={
              TEACHER_DATA_EXPORT_OPTIONS.some((column) => exportColumns.includes(column.value)) &&
              !TEACHER_DATA_EXPORT_OPTIONS.every((column) => exportColumns.includes(column.value))
            }
            onChange={(e) => {
              const dataKeys = TEACHER_DATA_EXPORT_OPTIONS.map((column) => column.value)
              const signatureKeys = exportColumns.filter((key) => !dataKeys.includes(key))
              setExportColumns(e.target.checked ? [...dataKeys, ...signatureKeys] : signatureKeys)
            }}
          >
            Tüm bilgi sütunları
          </Checkbox>
          <Checkbox.Group
            value={exportColumns}
            onChange={(vals) => setExportColumns(vals as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            options={[...TEACHER_DATA_EXPORT_OPTIONS, ...TEACHER_SIGNATURE_EXPORT_OPTIONS].map(
              (column) => ({ label: column.label, value: column.value }),
            )}
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
            İmza, sabah / öğle / akşam imza ve saatli imza sütunları boş gelir; liste çıktısına imza
            alanı eklemek içindir.
          </Typography.Paragraph>
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
