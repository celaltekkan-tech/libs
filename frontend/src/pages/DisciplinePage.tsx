import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Dropdown, Form, Input, Modal, Select, Space, Tabs, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { SortableTable } from '../components/SortableTable'
import { DeleteOutlined, FileTextOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
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
import { deleteTeacherNote, listTeacherNotes } from '../api/teacherNotes'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import { compareValues, nestedPersonNameSorter, SORT_AZ } from '../utils/tableSort'
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_OPTIONS,
  SANCTION_LEVEL_LABELS,
  SANCTION_LEVEL_OPTIONS,
} from '../types/disciplinaryCase'
import type { DisciplinaryCase, DisciplinaryCasePayload, DisciplinaryCaseStudent, DisciplinaryStats } from '../types/disciplinaryCase'
import type { TeacherNote } from '../types/teacherNote'
import type { Student } from '../types/student'
import { downloadBlob } from '../utils/download'
import { tablePagination } from '../utils/tablePagination'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function classroomLabel(student?: DisciplinaryCaseStudent | null): string {
  if (!student?.Classroom) return ''
  return `${student.Classroom.class_level}/${student.Classroom.section}`
}

function studentFullName(student?: DisciplinaryCaseStudent | null): string {
  if (!student) return ''
  return `${student.first_name} ${student.last_name}`
}

function matchesQuery(q: string, ...parts: Array<string | null | undefined>): boolean {
  if (!q) return true
  return parts.some((part) => (part || '').toLocaleLowerCase('tr-TR').includes(q))
}

export function DisciplinePage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'notes' ? 'notes' : 'cases'

  const [cases, setCases] = useState<DisciplinaryCase[]>([])
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [stats, setStats] = useState<DisciplinaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editing, setEditing] = useState<DisciplinaryCase | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createForm] = Form.useForm<DisciplinaryCasePayload>()
  const [editForm] = Form.useForm<{ status: string; sanction_level?: string; decision_date?: string; decision_summary?: string }>()

  const [caseSearch, setCaseSearch] = useState('')
  const caseSearchQuery = useDebouncedValue(caseSearch)
  const [caseStatusFilter, setCaseStatusFilter] = useState<string | undefined>()
  const [noteSearch, setNoteSearch] = useState('')
  const noteSearchQuery = useDebouncedValue(noteSearch)
  const [noteClassroomFilter, setNoteClassroomFilter] = useState<string | undefined>()
  const [noteTeacherFilter, setNoteTeacherFilter] = useState<number | undefined>()
  const [noteTagFilter, setNoteTagFilter] = useState<string | undefined>()

  const canCreate = hasPermission('discipline.create')
  const canUpdate = hasPermission('discipline.update')
  const canDelete = hasPermission('discipline.delete')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [caseData, studentData, statsData, teacherNoteData] = await Promise.all([
        listDisciplinaryCases(),
        listStudents(),
        fetchDisciplinaryStats(),
        listTeacherNotes(),
      ])
      setCases(caseData)
      setStudents(studentData)
      setStats(statsData)
      setTeacherNotes(teacherNoteData)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const setTab = (key: string) => {
    if (key === 'notes') setSearchParams({ tab: 'notes' })
    else setSearchParams({})
  }

  const filteredCases = useMemo(() => {
    const q = caseSearchQuery.trim().toLocaleLowerCase('tr-TR')
    return cases.filter((row) => {
      if (caseStatusFilter && row.status !== caseStatusFilter) return false
      return matchesQuery(
        q,
        studentFullName(row.Student),
        row.Student?.last_name,
        row.Student?.first_name,
        row.Student?.student_number,
        classroomLabel(row.Student),
        row.description,
        SANCTION_LEVEL_LABELS[row.sanction_level || ''] || row.sanction_level,
        CASE_STATUS_LABELS[row.status] || row.status,
      )
    })
  }, [cases, caseSearchQuery, caseStatusFilter])

  const filteredTeacherNotes = useMemo(() => {
    const q = noteSearchQuery.trim().toLocaleLowerCase('tr-TR')
    return teacherNotes.filter((row) => {
      if (noteClassroomFilter && classroomLabel(row.Student) !== noteClassroomFilter) return false
      if (noteTeacherFilter && row.teacher_id !== noteTeacherFilter) return false
      if (noteTagFilter && !row.tags.includes(noteTagFilter)) return false
      return matchesQuery(
        q,
        studentFullName(row.Student),
        row.Student?.last_name,
        row.Student?.first_name,
        row.Student?.student_number,
        classroomLabel(row.Student),
        row.Teacher?.full_name,
        row.note,
        row.tags.join(' '),
      )
    })
  }, [teacherNotes, noteSearchQuery, noteClassroomFilter, noteTeacherFilter, noteTagFilter])

  const noteClassroomOptions = useMemo(() => {
    const labels = new Set<string>()
    teacherNotes.forEach((row) => {
      const label = classroomLabel(row.Student)
      if (label) labels.add(label)
    })
    return [...labels].sort((a, b) => a.localeCompare(b, 'tr')).map((label) => ({ value: label, label }))
  }, [teacherNotes])

  const noteTeacherOptions = useMemo(() => {
    const byId = new Map<number, string>()
    teacherNotes.forEach((row) => {
      if (row.Teacher && !byId.has(row.teacher_id)) byId.set(row.teacher_id, row.Teacher.full_name)
    })
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'tr'))
      .map(([value, label]) => ({ value, label }))
  }, [teacherNotes])

  const noteTagOptions = useMemo(() => {
    const tags = new Set<string>()
    teacherNotes.forEach((row) => row.tags.forEach((tag) => tags.add(tag)))
    return [...tags].sort((a, b) => a.localeCompare(b, 'tr')).map((tag) => ({ value: tag, label: tag }))
  }, [teacherNotes])

  const caseFiltersActive = Boolean(caseSearch.trim() || caseStatusFilter)
  const noteFiltersActive = Boolean(noteSearch.trim() || noteClassroomFilter || noteTeacherFilter || noteTagFilter)

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => filteredCases.map((c) => c.id),
    deleteOne: (id) => deleteDisciplinaryCase(Number(id)),
    noun: 'disiplin dosyası',
    reload: () => void load(),
    message,
  })

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

  const onDeleteTeacherNote = (row: TeacherNote) => {
    modal.confirm({
      title: 'Bildirimi sil',
      content: 'Bu öğretmen bildirimini silmek istediğinize emin misiniz?',
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteTeacherNote(row.id)
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
      title: 'Öğrenci No',
      sorter: (a, b) => compareValues(a.Student?.student_number, b.Student?.student_number),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, r: DisciplinaryCase) => r.Student?.student_number || '—',
    },
    {
      title: 'Adı Soyadı',
      sorter: nestedPersonNameSorter((r: DisciplinaryCase) => r.Student),
      sortDirections: [...SORT_AZ],
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

  const teacherNoteColumns: ColumnsType<TeacherNote> = [
    {
      title: 'Öğrenci No',
      sorter: (a, b) => compareValues(a.Student?.student_number, b.Student?.student_number),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, r: TeacherNote) => r.Student?.student_number || '—',
    },
    {
      title: 'Adı Soyadı',
      sorter: nestedPersonNameSorter((r: TeacherNote) => r.Student),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, r: TeacherNote) => (r.Student ? `${r.Student.first_name} ${r.Student.last_name}` : '—'),
    },
    {
      title: 'Sınıf',
      sorter: (a, b) => compareValues(classroomLabel(a.Student), classroomLabel(b.Student)),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, r: TeacherNote) => classroomLabel(r.Student) || '—',
    },
    {
      title: 'Bildiren Öğretmen',
      sorter: (a, b) => compareValues(a.Teacher?.full_name, b.Teacher?.full_name),
      sortDirections: [...SORT_AZ],
      render: (_: unknown, r: TeacherNote) => r.Teacher?.full_name || '—',
    },
    {
      title: 'Sebepler',
      render: (_: unknown, r: TeacherNote) => (
        <Space wrap>
          {r.tags.map((tag, i) => (
            <Tag key={i}>{tag}</Tag>
          ))}
          {r.note && <span>{r.note}</span>}
        </Space>
      ),
    },
    {
      title: 'Tarih',
      dataIndex: 'created_at',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'İşlemler',
      width: 80,
      render: (_: unknown, record: TeacherNote) =>
        canDelete && (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteTeacherNote(record)} />
        ),
    },
  ]

  return (
    <AppLayout title="Disiplin Modülü">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Disiplin Modülü
      </Typography.Title>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'cases',
            label: `Disiplin Dosyaları (${cases.length})`,
            children: (
              <>
                {stats && (
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Tag color="blue">Toplam: {stats.total}</Tag>
                    {Object.entries(stats.by_status).map(([status, count]) => (
                      <Tag key={status}>
                        {CASE_STATUS_LABELS[status] || status}: {count}
                      </Tag>
                    ))}
                  </Space>
                )}

                <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
                  {canDelete && filteredCases.length > 0 && (
                    <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                      Toplu sil ({filteredCases.length})
                    </Button>
                  )}
                  {canCreate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                      Yeni Disiplin Dosyası
                    </Button>
                  )}
                </Space>

                <FilterBar>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Ad, soyad, öğrenci no veya açıklama ile ara..."
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    style={{ width: 320 }}
                  />
                  <Select
                    allowClear
                    placeholder="Durum"
                    style={{ width: 180 }}
                    options={CASE_STATUS_OPTIONS}
                    value={caseStatusFilter}
                    onChange={setCaseStatusFilter}
                  />
                  <ClearFiltersButton
                    active={caseFiltersActive}
                    onClick={() => {
                      setCaseSearch('')
                      setCaseStatusFilter(undefined)
                    }}
                  />
                </FilterBar>

                <SortableTable
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={filteredCases}
                  pagination={tablePagination(20)}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
          {
            key: 'notes',
            label: `Öğretmen Bildirimleri (${teacherNotes.length})`,
            children: (
              <>
                <FilterBar>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Ad, soyad, öğrenci no, öğretmen veya sebep ile ara..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    style={{ width: 360 }}
                  />
                  <Select
                    allowClear
                    placeholder="Sınıf"
                    style={{ width: 140 }}
                    options={noteClassroomOptions}
                    value={noteClassroomFilter}
                    onChange={setNoteClassroomFilter}
                  />
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Öğretmen"
                    style={{ width: 200 }}
                    options={noteTeacherOptions}
                    value={noteTeacherFilter}
                    onChange={setNoteTeacherFilter}
                  />
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Sebep"
                    style={{ width: 220 }}
                    options={noteTagOptions}
                    value={noteTagFilter}
                    onChange={setNoteTagFilter}
                  />
                  <ClearFiltersButton
                    active={noteFiltersActive}
                    onClick={() => {
                      setNoteSearch('')
                      setNoteClassroomFilter(undefined)
                      setNoteTeacherFilter(undefined)
                      setNoteTagFilter(undefined)
                    }}
                  />
                </FilterBar>

                <SortableTable
                  rowKey="id"
                  loading={loading}
                  columns={teacherNoteColumns}
                  dataSource={filteredTeacherNotes}
                  pagination={tablePagination(20)}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
        ]}
      />

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
              options={students.map((s) => ({
                value: s.id,
                label: `${s.first_name} ${s.last_name}${s.student_number ? ` (${s.student_number})` : ''}`,
              }))}
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
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Disiplin dosyalarını toplu sil"
        description={`Filtreye uyan ${filteredCases.length} disiplin dosyası silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
