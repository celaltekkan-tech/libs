import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Alert, Button, Checkbox, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Steps, Tag, Typography, Upload } from 'antd'
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
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs, { type Dayjs } from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { StudentImportAbsenceModal } from '../components/StudentImportAbsenceModal'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  createStudent,
  deleteStudent,
  exportStudents,
  fetchStudentPhotoBlob,
  importStudents,
  listStudents,
  previewStudentImport,
  updateStudent,
  uploadStudentPhoto,
} from '../api/students'
import { createExportTemplate, deleteExportTemplate, listExportTemplates } from '../api/exportTemplates'
import type { ExportTemplate } from '../api/exportTemplates'
import { listClassrooms } from '../api/classrooms'
import { getErrorMessage } from '../api/client'
import type { Classroom } from '../types/classroom'
import { classroomLabel } from '../types/classroom'
import type {
  BoardingStatus,
  PhotoRosterImportRow,
  RegistrationStatus,
  Student,
  StudentExtraContact,
  StudentFilters,
  StudentGender,
  ImportMissingClass,
  StudentImportPreview,
  StudentPayload,
} from '../types/student'
import {
  BOARDING_STATUS_OPTIONS,
  REGISTRATION_STATUS_OPTIONS,
  STUDENT_COLUMN_OPTIONS,
  STUDENT_IMPORT_FIELD_OPTIONS,
} from '../types/student'
import { downloadBlob, exportFilename, type ExportFormat } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'
import { personNameSorter, SORT_AZ } from '../utils/tableSort'
import { NATIONAL_ID_RULE, digitsOnlyNationalId } from '../utils/nationalId'
import { uniqueSelectOptions } from '../utils/uniqueSelectOptions'
import { DynamicListFilters, isActiveFilterValue, matchesListFilter, type ListFilterValue } from '../components/DynamicListFilters'
import { useVisibleFilterFields } from '../hooks/useVisibleFilterFields'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { FilterFieldsPicker, type FilterFieldOption } from '../components/FilterFieldsPicker'

interface StudentFormValues {
  first_name: string
  last_name: string
  school_id?: number | null
  classroom_id: number
  student_number: string
  national_id?: string
  gender?: StudentGender | null
  birth_date?: Dayjs | null
  yasi?: number | null
  registration_status?: RegistrationStatus
  parent_name?: string
  mother_name?: string
  father_name?: string
  parent_phone?: string
  student_phone?: string
  extra_contacts?: StudentExtraContact[]
  is_inclusion?: boolean
  is_foreign?: boolean
  boarding_status?: BoardingStatus | null
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  aktif: 'Aktif',
  nakil_giden: 'Nakil giden',
  orgun_egitim_disi: 'Örgün eğitim dışı',
}

const STUDENT_FILTER_FIELDS = [
  'first_name',
  'last_name',
  'student_number',
  'national_id',
  'classroom',
  'birth_date',
  'yasi',
  'gender',
  'registration_status',
  'mother_name',
  'father_name',
  'parent_name',
  'parent_phone',
  'student_phone',
  'is_inclusion',
  'is_foreign',
  'boarding_status',
] as const
type StudentFilterField = (typeof STUDENT_FILTER_FIELDS)[number]
const STUDENT_FILTER_DEFAULTS: StudentFilterField[] = ['classroom', 'yasi', 'gender', 'registration_status']
const STUDENT_FILTER_OPTIONS: FilterFieldOption<StudentFilterField>[] = [
  { key: 'first_name', label: 'Ad' },
  { key: 'last_name', label: 'Soyad' },
  { key: 'student_number', label: 'Öğrenci No' },
  { key: 'national_id', label: 'T.C. Kimlik No' },
  { key: 'classroom', label: 'Sınıf / Şube' },
  { key: 'birth_date', label: 'Doğum Tarihi', kind: 'dateRange' },
  { key: 'yasi', label: 'Yaşı' },
  { key: 'gender', label: 'Cinsiyet' },
  { key: 'registration_status', label: 'Kayıt durumu' },
  { key: 'mother_name', label: 'Anne Adı' },
  { key: 'father_name', label: 'Baba Adı' },
  { key: 'parent_name', label: 'Veli Adı' },
  { key: 'parent_phone', label: 'Veli Telefon' },
  { key: 'student_phone', label: 'Öğrenci Telefon' },
  { key: 'is_inclusion', label: 'Kaynaştırma' },
  { key: 'is_foreign', label: 'Yabancı Uyruklu' },
  { key: 'boarding_status', label: 'Yurt Durumu' },
]
const YES_NO_OPTIONS = [
  { value: 'true', label: 'Evet' },
  { value: 'false', label: 'Hayır' },
]
const GENDER_FILTER_OPTIONS = [
  { value: 'K', label: 'Kız' },
  { value: 'E', label: 'Erkek' },
]

function studentFieldValue(student: Student, key: StudentFilterField): string {
  switch (key) {
    case 'classroom':
      return student.classroom_id != null ? String(student.classroom_id) : ''
    case 'yasi': {
      const age = student.yasi ?? (student.birth_date ? Math.max(0, dayjs().diff(dayjs(student.birth_date), 'year')) : null)
      return age == null ? '' : String(age)
    }
    case 'birth_date':
      return String(student.birth_date || '').slice(0, 10)
    case 'is_inclusion':
      return student.is_inclusion ? 'true' : 'false'
    case 'is_foreign':
      return student.is_foreign ? 'true' : 'false'
    default:
      return String(student[key] ?? '').trim()
  }
}

const PHOTO_MAX_BYTES = 3 * 1024 * 1024
const PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

function studentAge(student: Student): number | null {
  if (student.yasi != null) return student.yasi
  if (student.birth_date) return Math.max(0, dayjs().diff(dayjs(student.birth_date), 'year'))
  return null
}

function validateStudentPhotoFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const extOk = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')
  const typeOk = !file.type || PHOTO_TYPES.has(file.type)
  if (!extOk || !typeOk) return 'Yalnızca PNG, JPG veya WEBP resim dosyaları yüklenebilir'
  if (file.size > PHOTO_MAX_BYTES) return 'Fotoğraf en fazla 3 MB olabilir'
  return null
}

export function StudentsPage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission, hasModule } = useAuth()
  const { activeSchoolId, schools } = useActiveSchool()
  const [students, setStudents] = useState<Student[]>([])
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [missingGroups, setMissingGroups] = useState<ImportMissingClass[]>([])
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
  const [importColumnSuggestions, setImportColumnSuggestions] = useState<Record<string, string>>({})
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
  const searchQuery = useDebouncedValue(search)
  const [filterValues, setFilterValues] = useState<Partial<Record<StudentFilterField, ListFilterValue>>>({})
  const { visible: visibleFilters, setVisible: setVisibleFilters, isVisible } = useVisibleFilterFields(
    'students',
    session?.user.id,
    STUDENT_FILTER_FIELDS,
    STUDENT_FILTER_DEFAULTS,
  )
  const [templates, setTemplates] = useState<ExportTemplate[]>([])
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const photoPreviewRef = useRef<string | null>(null)
  const photoLoadGen = useRef(0)
  const [form] = Form.useForm<StudentFormValues>()

  const replacePhotoPreview = useCallback((url: string | null) => {
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current)
    photoPreviewRef.current = url
    setPhotoPreviewUrl(url)
  }, [])

  const clearPhotoState = useCallback(() => {
    photoLoadGen.current += 1
    setPendingPhotoFile(null)
    setPhotoLoading(false)
    replacePhotoPreview(null)
  }, [replacePhotoPreview])

  useEffect(() => {
    return () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current)
    }
  }, [])

  const loadStudentPhoto = useCallback(
    async (studentId: number) => {
      const gen = ++photoLoadGen.current
      setPhotoLoading(true)
      try {
        const blob = await fetchStudentPhotoBlob(studentId)
        if (gen !== photoLoadGen.current) return
        if (!blob.type.startsWith('image/')) return
        replacePhotoPreview(URL.createObjectURL(blob))
      } catch {
        if (gen !== photoLoadGen.current) return
      } finally {
        if (gen === photoLoadGen.current) setPhotoLoading(false)
      }
    },
    [replacePhotoPreview],
  )

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

  const listFilters = useMemo(
    () => ({
      school_id: filters.school_id,
      classroom_id: typeof filterValues.classroom === 'number' ? filterValues.classroom : undefined,
      gender: typeof filterValues.gender === 'string' ? (filterValues.gender as StudentGender) : undefined,
      registration_status:
        typeof filterValues.registration_status === 'string'
          ? (filterValues.registration_status as RegistrationStatus)
          : undefined,
    }),
    [filters.school_id, filterValues.classroom, filterValues.gender, filterValues.registration_status],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentData, classroomData] = await Promise.all([
        listStudents(listFilters),
        listClassrooms({ is_active: true }).catch(() => []),
      ])
      setStudents(studentData)
      setClassrooms(classroomData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [listFilters, message])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setFilters((f) => {
      const next = activeSchoolId ?? undefined
      if (f.school_id === next) return f
      return { ...f, school_id: next, classroom_id: undefined }
    })
    setFilterValues((current) => ({ ...current, classroom: undefined }))
  }, [activeSchoolId])

  const classroomOptions = useMemo(
    () =>
      classrooms
        .filter((c) => activeSchoolId == null || c.school_id === activeSchoolId || c.school_id == null)
        .map((c) => ({
          value: c.id,
          label: classroomLabel(c),
        })),
    [classrooms, activeSchoolId],
  )

  const filterOptionsByKey = useMemo(() => {
    return {
      first_name: uniqueSelectOptions(students.map((s) => s.first_name)),
      last_name: uniqueSelectOptions(students.map((s) => s.last_name)),
      student_number: uniqueSelectOptions(students.map((s) => s.student_number)),
      national_id: uniqueSelectOptions(students.map((s) => s.national_id)),
      classroom: classroomOptions,
      yasi: uniqueSelectOptions(students.map((s) => studentAge(s)).filter((age): age is number => age != null)),
      gender: GENDER_FILTER_OPTIONS,
      registration_status: REGISTRATION_STATUS_OPTIONS,
      mother_name: uniqueSelectOptions(students.map((s) => s.mother_name)),
      father_name: uniqueSelectOptions(students.map((s) => s.father_name)),
      parent_name: uniqueSelectOptions(students.map((s) => s.parent_name)),
      parent_phone: uniqueSelectOptions(students.map((s) => s.parent_phone)),
      student_phone: uniqueSelectOptions(students.map((s) => s.student_phone)),
      is_inclusion: YES_NO_OPTIONS,
      is_foreign: YES_NO_OPTIONS,
      boarding_status: BOARDING_STATUS_OPTIONS,
    } satisfies Partial<Record<StudentFilterField, Array<{ value: string | number; label: string }>>>
  }, [students, classroomOptions])

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    return students.filter((s) => {
      for (const key of STUDENT_FILTER_FIELDS) {
        const selected = filterValues[key]
        if (!isActiveFilterValue(selected)) continue
        if (!matchesListFilter(studentFieldValue(s, key), selected)) return false
      }
      if (!q) return true
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
  }, [students, searchQuery, filterValues])

  const hasActiveFilters = Boolean(
    search.trim() || STUDENT_FILTER_FIELDS.some((key) => isActiveFilterValue(filterValues[key])),
  )

  const openCreate = () => {
    setEditing(null)
    clearPhotoState()
    form.resetFields()
    form.setFieldsValue({
      registration_status: 'aktif',
      boarding_status: 'Gündüzlü',
      is_inclusion: false,
      is_foreign: false,
      extra_contacts: [],
      school_id: activeSchoolId ?? undefined,
    })
    setModalOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    clearPhotoState()
    form.setFieldsValue({
      first_name: student.first_name,
      last_name: student.last_name,
      school_id: student.school_id,
      classroom_id: student.classroom_id || undefined,
      student_number: student.student_number || undefined,
      national_id: student.national_id || undefined,
      gender: student.gender,
      birth_date: student.birth_date ? dayjs(student.birth_date) : null,
      yasi: student.yasi ?? undefined,
      registration_status: student.registration_status || 'aktif',
      parent_name: student.parent_name || undefined,
      mother_name: student.mother_name || undefined,
      father_name: student.father_name || undefined,
      parent_phone: student.parent_phone || undefined,
      student_phone: student.student_phone || undefined,
      extra_contacts: student.extra_contacts?.length ? student.extra_contacts : [],
      is_inclusion: student.is_inclusion,
      is_foreign: student.is_foreign,
      boarding_status: student.boarding_status || 'Gündüzlü',
    })
    setModalOpen(true)
    if (student.photo_url) void loadStudentPhoto(student.id)
  }

  const onSelectPhoto = (file: File) => {
    const error = validateStudentPhotoFile(file)
    if (error) {
      message.error(error)
      return
    }
    photoLoadGen.current += 1
    setPhotoLoading(false)
    setPendingPhotoFile(file)
    replacePhotoPreview(URL.createObjectURL(file))
  }

  const onFinish = async (values: StudentFormValues) => {
    if (!session) return
    setSubmitting(true)
    try {
      const payload: StudentPayload = {
        ...values,
        classroom_id: values.classroom_id,
        student_number: values.student_number.trim(),
        national_id: values.national_id ? digitsOnlyNationalId(values.national_id) || null : null,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        yasi: values.yasi ?? null,
        gender: values.gender || null,
        extra_contacts: (values.extra_contacts || []).filter(
          (c) => c.label || c.phone || c.address || c.description,
        ),
        boarding_status: values.boarding_status || 'Gündüzlü',
      }

      let savedId: number
      if (editing) {
        await updateStudent(editing.id, payload)
        savedId = editing.id
      } else {
        const created = await createStudent(session.user.tenant_id, payload)
        savedId = created.id
      }

      if (pendingPhotoFile) {
        try {
          await uploadStudentPhoto(savedId, pendingPhotoFile)
        } catch (photoErr) {
          message.warning(`Kayıt kaydedildi ancak fotoğraf yüklenemedi: ${getErrorMessage(photoErr)}`)
          setModalOpen(false)
          clearPhotoState()
          void load()
          return
        }
      }

      message.success(editing ? 'Öğrenci güncellendi' : 'Öğrenci oluşturuldu')
      setModalOpen(false)
      clearPhotoState()
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
    setImportSchoolId(activeSchoolId)
    setImportClassroomId(null)
    setImportPreview(null)
    setImportHeaderRow(1)
    setImportMapping({})
    setImportColumnSuggestions({})
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

      if (preview.format === 'table') {
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

    if (importPreview?.format === 'photo_roster') {
      setSubmitting(true)
      try {
        const result = await importStudents(file, {})
        if (result.format === 'photo_roster') {
          message.success(
            `İçe aktarma tamamlandı: ${result.updated} öğrenci güncellendi, ${result.photos_saved} fotoğraf kaydedildi` +
              (result.not_found ? `, ${result.not_found} kayıt eşleşmedi` : ''),
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
        }
        setImportOpen(false)
        resetImportState()
        void load()
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        setSubmitting(false)
      }
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
      !(importPreview?.format === 'table' && importPreview.detected_class?.class_level)
    ) {
      message.warning('Excelde sınıf/şube yoksa varsayılan sınıf/şube seçin')
      return
    }

    setSubmitting(true)
    try {
      const columnSuggestions = Object.fromEntries(
        Object.entries(importColumnSuggestions).filter(([col]) => !importMapping[col]),
      )
      const detectedClass = importPreview?.format === 'table' ? importPreview.detected_class : null
      const result = await importStudents(file, {
        schoolId: importSchoolId,
        classroomId: importClassroomId,
        headerRow: importHeaderRow,
        columnMapping: importMapping,
        columnSuggestions,
        classLevel: detectedClass?.class_level ?? null,
        section: detectedClass?.section ?? null,
      })
      if (result.format !== 'table') return
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
      if (result.unmatched_columns && result.unmatched_columns.length > 0) {
        modal.info({
          title: 'Eşleştirilemeyen sütunlar',
          content: (
            <>
              <Typography.Paragraph>
                Dosyada sistemin tanıyamadığı şu sütun(lar) vardı: {result.unmatched_columns.join(', ')}.
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary">
                {result.feedback_created
                  ? 'Bu durum otomatik olarak Geri Bildirim olarak kaydedildi; yönetici değerlendirecek.'
                  : 'Bu sütunlar içe aktarıma dahil edilmedi.'}
              </Typography.Paragraph>
            </>
          ),
        })
      }
      setImportOpen(false)
      resetImportState()
      void load()
      const missing = (result.missing_by_class || []).filter((group) => group.students.length > 0)
      if (missing.length) setMissingGroups(missing)
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
          ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
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
      title: 'Yaşı',
      dataIndex: 'yasi',
      width: 80,
      sorter: (a, b) => (studentAge(a) ?? -1) - (studentAge(b) ?? -1),
      render: (_: unknown, record) => studentAge(record) ?? '—',
    },
    {
      title: 'Durum',
      dataIndex: 'registration_status',
      render: (v: RegistrationStatus | null) => (v ? STATUS_LABEL[v] || v : '—'),
    },
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
          <DynamicListFilters
            fields={STUDENT_FILTER_OPTIONS}
            isVisible={isVisible}
            values={filterValues}
            optionsByKey={filterOptionsByKey}
            onChange={(key, value) => setFilterValues((current) => ({ ...current, [key]: value }))}
          />
          <FilterFieldsPicker
            options={STUDENT_FILTER_OPTIONS}
            value={visibleFilters}
            onChange={(next) => {
              setVisibleFilters(next)
              setFilterValues((current) => {
                const kept: Partial<Record<StudentFilterField, ListFilterValue>> = {}
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
              setFilters({ school_id: activeSchoolId ?? undefined })
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
        onCancel={() => {
          setModalOpen(false)
          clearPhotoState()
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editing ? 'Kaydet' : 'Oluştur'}
        cancelText="Vazgeç"
        destroyOnHidden
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <Upload
              accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
              showUploadList={false}
              beforeUpload={(file) => {
                onSelectPhoto(file)
                return false
              }}
            >
              <div
                style={{
                  width: 104,
                  height: 128,
                  border: '1px dashed #d9d9d9',
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  cursor: 'pointer',
                }}
              >
                {photoPreviewUrl ? (
                  <img
                    src={photoPreviewUrl}
                    alt="Öğrenci fotoğrafı"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                    <UserOutlined style={{ fontSize: 28 }} />
                    <div style={{ marginTop: 8, fontSize: 12 }}>{photoLoading ? 'Yükleniyor...' : 'Fotoğraf'}</div>
                  </div>
                )}
              </div>
            </Upload>
            <div>
              <Typography.Text strong style={{ display: 'block' }}>
                Öğrenci fotoğrafı
              </Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                PNG, JPG veya WEBP. En fazla 3 MB. Seçilen fotoğraf kaydettiğinizde yüklenir.
              </Typography.Text>
              <Upload
                accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                showUploadList={false}
                beforeUpload={(file) => {
                  onSelectPhoto(file)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={photoLoading}>
                  {photoPreviewUrl ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
                </Button>
              </Upload>
            </div>
          </div>
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
              <Form.Item
                name="national_id"
                label="T.C. Kimlik No"
                rules={[NATIONAL_ID_RULE]}
                getValueFromEvent={(e) => digitsOnlyNationalId(e.target.value)}
              >
                <Input inputMode="numeric" maxLength={11} placeholder="11 haneli" />
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="birth_date" label="Doğum Tarihi">
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  onChange={(value) => {
                    if (!value) return
                    form.setFieldValue('yasi', Math.max(0, dayjs().diff(value, 'year')))
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="yasi" label="Yaşı">
                <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="Örn. 15" />
              </Form.Item>
            </Col>
          </Row>
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
              <Form.Item name="mother_name" label="Anne Adı">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="father_name" label="Baba Adı">
                <Input />
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="student_phone" label="Öğrenci Telefon">
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
          <Form.Item name="boarding_status" label="Yurt Durumu">
            <Select placeholder="Gündüzlü" options={BOARDING_STATUS_OPTIONS} />
          </Form.Item>
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
                  Devam
                </Button>
              ) : (
                <Button
                  type="primary"
                  loading={submitting}
                  disabled={importPreview?.format === 'photo_roster' && importPreview.matched === 0}
                  onClick={() => void onImport()}
                >
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
          items={[
            { title: 'Dosya' },
            { title: importPreview?.format === 'photo_roster' ? 'Önizleme' : 'Sütun eşleme' },
          ]}
        />

        {importStep === 0 && (
          <>
            <Typography.Paragraph type="secondary">
              e-Okul sınıf listesi (.xls), düz başlıklı (.xlsx) veya e-Okul "Fotoğraflı Öğrenci
              Bilgileri" dökümü (.xls) yüklenebilir — dosya türü otomatik tanınır. Fotoğraflı
              dökümde yalnızca öğrenci numarası sistemde eşleşen kayıtlar güncellenir ve
              fotoğraflar öğrenci kartına kaydedilir; sütun eşlemesi gerektiren normal dosyalarda
              bir sonraki adımda sütunları sistem alanlarıyla eşleştirirsiniz.
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

        {importStep === 1 && importPreview && importPreview.format === 'table' && (
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
              Her Excel başlığını bir öğrenci alanına bağlayın. Sistemin tanımadığı bir sütun için ne anlama
              geldiğini "Öneriniz" kutusuna yazabilirsiniz; bu bilgi yöneticiye geri bildirim olarak iletilir.
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
                {
                  title: 'Öneriniz (sistem tanımıyorsa)',
                  width: 220,
                  render: (_, row) => {
                    const isMapped = Boolean(importMapping[String(row.index)])
                    return (
                      <Input
                        disabled={isMapped}
                        placeholder={isMapped ? 'Eşleşti' : 'Bu sütun ne anlama geliyor?'}
                        value={importColumnSuggestions[String(row.index)] || ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setImportColumnSuggestions((prev) => {
                            const next = { ...prev }
                            if (!v) delete next[String(row.index)]
                            else next[String(row.index)] = v
                            return next
                          })
                        }}
                      />
                    )
                  },
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

        {importStep === 1 && importPreview && importPreview.format === 'photo_roster' && (
          <>
            <Typography.Paragraph>
              {importPreview.total_rows} kayıt bulundu — {importPreview.matched} kayıt sistemde eşleşti ve
              güncellenecek, {importPreview.not_found} kayıt sistemde bulunamadığından atlanacak. Dosyada{' '}
              {importPreview.photos_found} fotoğraf var.
            </Typography.Paragraph>
            {importPreview.matched === 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Eşleşen kayıt yok"
                description="Dosyadaki hiçbir öğrenci numarası sistemdeki kayıtlarla eşleşmedi, güncelleme yapılamaz."
              />
            )}
            <SortableTable
              rowKey="row"
              size="small"
              pagination={tablePagination(10)}
              scroll={{ x: 700 }}
              dataSource={importPreview.rows}
              columns={[
                { title: 'Öğrenci No', dataIndex: 'student_number', width: 120 },
                { title: 'Dosyadaki Ad Soyad', dataIndex: 'full_name' },
                {
                  title: 'Fotoğraf',
                  width: 100,
                  render: (_: unknown, row: PhotoRosterImportRow) =>
                    row.has_photo ? <Tag color="blue">Var</Tag> : <Tag>Yok</Tag>,
                },
                {
                  title: 'Durum',
                  width: 220,
                  render: (_: unknown, row: PhotoRosterImportRow) =>
                    row.matched ? (
                      <Tag color="gold">Güncellenecek ({row.current_name})</Tag>
                    ) : (
                      <Tag color="default">Sistemde bulunamadı</Tag>
                    ),
                },
              ]}
            />
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
      <StudentImportAbsenceModal
        open={missingGroups.length > 0}
        groups={missingGroups}
        onClose={() => setMissingGroups([])}
        onSaved={() => {
          setMissingGroups([])
          void load()
        }}
      />
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
