import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { App, Button, Card, Col, Empty, Input, List, Row, Select, Space, Statistic, Tabs, Tag, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { SortableTable } from '../components/SortableTable'
import { ClearFiltersButton } from '../components/ClearFiltersButton'
import { FilterBar } from '../components/FilterBar'
import { AppLayout } from '../components/AppLayout'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { DisciplineIncidentWizardModal } from '../components/DisciplineIncidentWizardModal'
import { DisciplineIncidentDrawer } from '../components/DisciplineIncidentDrawer'
import { DisciplineBehaviorPointModal } from '../components/DisciplineBehaviorPointModal'
import { DisciplineRegulationArticleModal } from '../components/DisciplineRegulationArticleModal'
import { DisciplineMiniBarChart } from '../components/DisciplineMiniBarChart'
import { useAuth } from '../auth/AuthContext'
import {
  createBehaviorPoint,
  createRegulationArticle,
  deleteBehaviorPoint,
  deleteIncident,
  deleteRegulationArticle,
  fetchDisciplineStats,
  listIncidents,
  listRegulationArticles,
  listSanctionedStudents,
  summarizeBehaviorPoints,
} from '../api/discipline'
import { listStudents } from '../api/students'
import { downloadRegulation } from '../api/regulations'
import { getErrorMessage } from '../api/client'
import { downloadBlob } from '../utils/download'
import { deleteTeacherNote, listTeacherNotes } from '../api/teacherNotes'
import { compareValues, nestedPersonNameSorter, SORT_AZ } from '../utils/tableSort'
import {
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_OPTIONS,
  SANCTION_TYPE_LABELS,
  SANCTION_TYPE_OPTIONS,
} from '../types/discipline'
import type {
  DisciplineBehaviorPointSummary,
  DisciplineIncident,
  DisciplineRegulationArticle,
  DisciplineSanctionedStudent,
  DisciplineStats,
} from '../types/discipline'
import type { TeacherNote } from '../types/teacherNote'
import type { Student } from '../types/student'
import { tablePagination } from '../utils/tablePagination'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function currentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  return now.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

function classroomLabel(student?: { class_level?: string | null; section?: string | null; Classroom?: { class_level: string; section: string } | null } | null): string {
  if (!student) return ''
  if (student.Classroom) return `${student.Classroom.class_level}/${student.Classroom.section}`
  if (student.class_level) return `${student.class_level}${student.section ? '/' + student.section : ''}`
  return ''
}

function matchesQuery(q: string, ...parts: Array<string | null | undefined>): boolean {
  if (!q) return true
  return parts.some((part) => (part || '').toLocaleLowerCase('tr-TR').includes(q))
}

export function DisciplinePage() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'incidents'

  const canDelete = hasPermission('discipline.delete')
  const canCreate = hasPermission('discipline.create')

  const setTab = (key: string) => {
    if (key === 'incidents') setSearchParams({})
    else setSearchParams({ tab: key })
  }

  // ---- Olaylar ----
  const [incidents, setIncidents] = useState<DisciplineIncident[]>([])
  const [loadingIncidents, setLoadingIncidents] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<DisciplineIncident | null>(null)
  const selectedIncidentIdRef = useRef<number | null>(null)
  const [search, setSearch] = useState('')
  const searchQuery = useDebouncedValue(search)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

  const loadIncidents = useCallback(async () => {
    setLoadingIncidents(true)
    try {
      const data = await listIncidents()
      setIncidents(data)
      const openId = selectedIncidentIdRef.current
      if (openId) {
        const fresh = data.find((i) => i.id === openId)
        if (fresh) setSelectedIncident(fresh)
      }
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingIncidents(false)
    }
  }, [message])

  useEffect(() => {
    void loadIncidents()
  }, [loadIncidents])

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr-TR')
    return incidents.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false
      return matchesQuery(q, row.incident_code, row.title, row.location, row.summary)
    })
  }, [incidents, searchQuery, statusFilter])

  const filtersActive = Boolean(search.trim() || statusFilter)

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => filteredIncidents.map((c) => c.id),
    deleteOne: (id) => deleteIncident(Number(id)),
    noun: 'disiplin olayı',
    reload: () => void loadIncidents(),
    message,
  })

  const openIncident = (row: DisciplineIncident) => {
    selectedIncidentIdRef.current = row.id
    setSelectedIncident(row)
  }

  const onWizardFinished = (created: DisciplineIncident) => {
    setWizardOpen(false)
    openIncident(created)
    void loadIncidents()
  }

  const onDeleteIncident = (row: DisciplineIncident) => {
    modal.confirm({
      title: 'Olayı sil',
      content: `${row.incident_code} - ${row.title} kalıcı olarak silinecek (ilgili tüm katılımcı, tutanak ve kararlar dahil).`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteIncident(row.id)
          message.success('Silindi')
          void loadIncidents()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const incidentColumns: ColumnsType<DisciplineIncident> = [
    { title: 'Olay Kodu', dataIndex: 'incident_code', sorter: (a, b) => compareValues(a.incident_code, b.incident_code), sortDirections: [...SORT_AZ] },
    { title: 'Olay Adı', dataIndex: 'title', sorter: (a, b) => compareValues(a.title, b.title), sortDirections: [...SORT_AZ] },
    { title: 'Tarih', dataIndex: 'incident_date', sorter: (a, b) => compareValues(a.incident_date, b.incident_date), sortDirections: [...SORT_AZ] },
    { title: 'Okul', render: (_: unknown, r) => r.School?.name || '—' },
    { title: 'Katılımcı', render: (_: unknown, r) => r.Participants?.length ?? 0 },
    { title: 'Durum', dataIndex: 'status', render: (v: string) => <Tag>{INCIDENT_STATUS_LABELS[v] || v}</Tag> },
    {
      title: 'İşlemler',
      width: 100,
      render: (_: unknown, record: DisciplineIncident) =>
        canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); onDeleteIncident(record) }} />,
    },
  ]

  // ---- Davranış Puanı ----
  const [behaviorSummary, setBehaviorSummary] = useState<DisciplineBehaviorPointSummary[]>([])
  const [loadingBehavior, setLoadingBehavior] = useState(false)
  const [behaviorModalOpen, setBehaviorModalOpen] = useState(false)
  const [behaviorStudents, setBehaviorStudents] = useState<Student[]>([])
  const [savingBehavior, setSavingBehavior] = useState(false)

  const loadBehaviorSummary = useCallback(async () => {
    setLoadingBehavior(true)
    try {
      const data = await summarizeBehaviorPoints()
      setBehaviorSummary(data)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingBehavior(false)
    }
  }, [message])

  useEffect(() => {
    if (tab === 'behavior') {
      void loadBehaviorSummary()
      void listStudents().then(setBehaviorStudents).catch(() => undefined)
    }
  }, [tab, loadBehaviorSummary])

  const onCreateBehaviorPoint = async (values: {
    student_id: number
    academic_year: string
    points_deducted: number
    points_restored: number
    restore_date?: string
    reason?: string
  }) => {
    setSavingBehavior(true)
    try {
      await createBehaviorPoint(values)
      message.success('Kaydedildi')
      setBehaviorModalOpen(false)
      void loadBehaviorSummary()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingBehavior(false)
    }
  }

  const behaviorColumns: ColumnsType<DisciplineBehaviorPointSummary> = [
    { title: 'Öğrenci No', render: (_: unknown, r) => r.student.student_number || '—' },
    { title: 'Adı Soyadı', render: (_: unknown, r) => `${r.student.first_name} ${r.student.last_name}` },
    { title: 'Sınıf', render: (_: unknown, r) => classroomLabel(r.student) || '—' },
    { title: 'Kırılan Puan', dataIndex: 'points_deducted', sorter: (a, b) => a.points_deducted - b.points_deducted },
    { title: 'İade Edilen', dataIndex: 'points_restored', sorter: (a, b) => a.points_restored - b.points_restored },
    { title: 'Kalan', render: (_: unknown, r) => r.points_deducted - r.points_restored },
    {
      title: 'İşlemler',
      width: 80,
      render: (_: unknown, r) =>
        canDelete && (
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              modal.confirm({
                title: 'Kayıtları sil',
                content: `${r.student.first_name} ${r.student.last_name} için tüm davranış puanı kayıtları silinecek.`,
                okText: 'Sil',
                okButtonProps: { danger: true },
                cancelText: 'Vazgeç',
                onOk: async () => {
                  await Promise.all(r.entries.map((e) => deleteBehaviorPoint(e.id)))
                  void loadBehaviorSummary()
                },
              })
            }}
          />
        ),
    },
  ]

  // ---- Diğer: istatistik / ceza alan öğrenciler / yönetmelik maddeleri ----
  const [stats, setStats] = useState<DisciplineStats | null>(null)
  const [sanctioned, setSanctioned] = useState<DisciplineSanctionedStudent[]>([])
  const [articles, setArticles] = useState<DisciplineRegulationArticle[]>([])
  const [loadingOther, setLoadingOther] = useState(false)
  const [sanctionFilter, setSanctionFilter] = useState<string | undefined>()
  const [articleModalOpen, setArticleModalOpen] = useState(false)
  const [savingArticle, setSavingArticle] = useState(false)

  const loadOther = useCallback(async () => {
    setLoadingOther(true)
    try {
      const [s, list] = await Promise.all([fetchDisciplineStats(), listRegulationArticles()])
      setStats(s)
      setArticles(list)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingOther(false)
    }
  }, [message])

  const loadSanctioned = useCallback(async () => {
    try {
      const data = await listSanctionedStudents(sanctionFilter ? { sanction_type: sanctionFilter } : undefined)
      setSanctioned(data)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [message, sanctionFilter])

  useEffect(() => {
    if (tab === 'other') {
      void loadOther()
      void loadSanctioned()
    }
  }, [tab, loadOther, loadSanctioned])

  const onCreateArticle = async (values: { article_no?: string; title: string; description?: string; default_sanction_type?: string }) => {
    setSavingArticle(true)
    try {
      await createRegulationArticle(values)
      message.success('Eklendi')
      setArticleModalOpen(false)
      void loadOther()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingArticle(false)
    }
  }

  const onDownloadRegulation = async () => {
    try {
      const blob = await downloadRegulation('ortaogretim-kurumlari-yonetmeligi')
      downloadBlob(blob, 'MEB-Ortaogretim-Kurumlari-Yonetmeligi.pdf')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  // ---- Öğretmen Bildirimleri ----
  const [teacherNotes, setTeacherNotes] = useState<TeacherNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [noteSearch, setNoteSearch] = useState('')
  const noteSearchQuery = useDebouncedValue(noteSearch)

  const loadTeacherNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const data = await listTeacherNotes()
      setTeacherNotes(data)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingNotes(false)
    }
  }, [message])

  useEffect(() => {
    if (tab === 'notes') void loadTeacherNotes()
  }, [tab, loadTeacherNotes])

  const filteredTeacherNotes = useMemo(() => {
    const q = noteSearchQuery.trim().toLocaleLowerCase('tr-TR')
    return teacherNotes.filter((row) =>
      matchesQuery(q, row.Student ? `${row.Student.first_name} ${row.Student.last_name}` : '', row.Student?.student_number, row.Teacher?.full_name, row.note, row.tags.join(' ')),
    )
  }, [teacherNotes, noteSearchQuery])

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
          void loadTeacherNotes()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

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
            key: 'incidents',
            label: `Disiplin Olayları (${incidents.length})`,
            children: (
              <>
                <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
                  {canDelete && filteredIncidents.length > 0 && (
                    <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                      Toplu sil ({filteredIncidents.length})
                    </Button>
                  )}
                  {canCreate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setWizardOpen(true)}>
                      Yeni Disiplin Olayı
                    </Button>
                  )}
                </Space>

                <FilterBar>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Olay kodu, adı veya açıklama ile ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ width: 320 }}
                  />
                  <Select allowClear placeholder="Durum" style={{ width: 180 }} options={INCIDENT_STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
                  <ClearFiltersButton
                    active={filtersActive}
                    onClick={() => {
                      setSearch('')
                      setStatusFilter(undefined)
                    }}
                  />
                </FilterBar>

                <SortableTable
                  rowKey="id"
                  loading={loadingIncidents}
                  columns={incidentColumns}
                  dataSource={filteredIncidents}
                  pagination={tablePagination(20)}
                  scroll={{ x: 'max-content' }}
                  onRow={(record) => ({ onClick: () => openIncident(record), style: { cursor: 'pointer' } })}
                />
              </>
            ),
          },
          {
            key: 'behavior',
            label: 'Davranış Puanı',
            children: (
              <>
                <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
                  {canCreate && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setBehaviorModalOpen(true)}>
                      Puan Kaydı Ekle
                    </Button>
                  )}
                </Space>
                <SortableTable
                  rowKey={(r) => r.student.id}
                  loading={loadingBehavior}
                  columns={behaviorColumns}
                  dataSource={behaviorSummary}
                  pagination={tablePagination(20)}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
          {
            key: 'other',
            label: 'Diğer',
            children: (
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Card title="İstatistik (Ceza / Olay)" loading={loadingOther}>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={8}>
                        <Statistic title="Toplam Olay" value={stats?.total_incidents ?? 0} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="Toplam Karar" value={stats?.total_decisions ?? 0} />
                      </Col>
                    </Row>
                    <Typography.Text strong>Durum Dağılımı</Typography.Text>
                    <div style={{ marginTop: 8, marginBottom: 16 }}>
                      <DisciplineMiniBarChart
                        data={Object.entries(stats?.by_status || {}).map(([k, v]) => ({ label: INCIDENT_STATUS_LABELS[k] || k, value: v }))}
                      />
                    </div>
                    <Typography.Text strong>Ceza Türü Dağılımı</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <DisciplineMiniBarChart
                        color="#fa541c"
                        data={Object.entries(stats?.by_sanction || {}).map(([k, v]) => ({ label: SANCTION_TYPE_LABELS[k] || k, value: v }))}
                      />
                    </div>
                  </Card>
                </Col>

                <Col span={24}>
                  <Card
                    title="Ceza Alan Öğrenciler"
                    extra={<Select allowClear placeholder="Ceza türü" style={{ width: 220 }} options={SANCTION_TYPE_OPTIONS} value={sanctionFilter} onChange={setSanctionFilter} />}
                  >
                    <List
                      dataSource={sanctioned}
                      locale={{ emptyText: <Empty description="Kayıt yok" /> }}
                      renderItem={(row) => (
                        <List.Item>
                          <List.Item.Meta
                            title={`${row.student.first_name} ${row.student.last_name} (${row.student.student_number || '—'})`}
                            description={
                              <Space direction="vertical" size={4}>
                                {row.decisions.map((d) => (
                                  <span key={d.id}>
                                    {d.incident.incident_code} - {d.incident.title} ({d.incident.incident_date}):{' '}
                                    <Tag color="red">{SANCTION_TYPE_LABELS[d.sanction_type || ''] || '—'}</Tag>
                                  </span>
                                ))}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>

                <Col span={24}>
                  <Card
                    title="Yönetmelik Maddeleri"
                    extra={
                      <Space>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => void onDownloadRegulation()}>
                          Yönetmeliği İndir
                        </Button>
                        {canCreate && (
                          <Button size="small" icon={<PlusOutlined />} onClick={() => setArticleModalOpen(true)}>
                            Madde Ekle
                          </Button>
                        )}
                      </Space>
                    }
                  >
                    <List
                      dataSource={articles}
                      renderItem={(a) => (
                        <List.Item
                          actions={[
                            a.source === 'custom' && canDelete && (
                              <Button
                                key="sil"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={async () => {
                                  await deleteRegulationArticle(a.id)
                                  void loadOther()
                                }}
                              />
                            ),
                          ].filter(Boolean)}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                {a.article_no ? `Madde ${a.article_no}` : a.title}
                                <Tag color={a.source === 'meb' ? 'blue' : 'default'}>{a.source === 'meb' ? 'MEB' : 'Özel'}</Tag>
                              </Space>
                            }
                            description={a.article_no ? `${a.title}${a.description ? ` — ${a.description}` : ''}` : a.description}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
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
                </FilterBar>
                <SortableTable
                  rowKey="id"
                  loading={loadingNotes}
                  dataSource={filteredTeacherNotes}
                  pagination={tablePagination(20)}
                  scroll={{ x: 'max-content' }}
                  columns={[
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
                    { title: 'Sınıf', render: (_: unknown, r: TeacherNote) => classroomLabel(r.Student) || '—' },
                    { title: 'Bildiren Öğretmen', render: (_: unknown, r: TeacherNote) => r.Teacher?.full_name || '—' },
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
                    { title: 'Tarih', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleString('tr-TR') },
                    {
                      title: 'İşlemler',
                      width: 80,
                      render: (_: unknown, record: TeacherNote) =>
                        canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDeleteTeacherNote(record)} />,
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <DisciplineIncidentWizardModal
        open={wizardOpen}
        schools={session?.schools || []}
        defaultSchoolId={session?.user.school_id ?? null}
        onCancel={() => setWizardOpen(false)}
        onFinished={onWizardFinished}
      />
      <DisciplineIncidentDrawer
        incident={selectedIncident}
        open={!!selectedIncident}
        onClose={() => {
          selectedIncidentIdRef.current = null
          setSelectedIncident(null)
        }}
        onChanged={() => void loadIncidents()}
      />
      <DisciplineBehaviorPointModal
        open={behaviorModalOpen}
        students={behaviorStudents}
        academicYear={currentAcademicYear()}
        submitting={savingBehavior}
        onCancel={() => setBehaviorModalOpen(false)}
        onSubmit={onCreateBehaviorPoint}
      />
      <DisciplineRegulationArticleModal
        open={articleModalOpen}
        submitting={savingArticle}
        onCancel={() => setArticleModalOpen(false)}
        onSubmit={onCreateArticle}
      />
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Disiplin olaylarını toplu sil"
        description={`Filtreye uyan ${filteredIncidents.length} disiplin olayı silinecek.`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </AppLayout>
  )
}
