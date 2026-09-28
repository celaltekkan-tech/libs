import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Input,
  InputNumber,
  Modal,
  Popover,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  theme,
} from 'antd'
import { CopyOutlined, DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { blockPatternChoices } from './blocks'
import {
  copyTimetableAssignments,
  createTimetableAssignment,
  deleteTimetableAssignment,
  restoreCommonAssignments,
  syncCommonAssignments,
  getLessonPool,
  listAvailability,
  listTimetableAssignments,
  updateTimetableAssignment,
  updateTimetableProject,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { TypedPhraseConfirmModal } from '../TypedPhraseConfirmModal'
import { bulkDeleteByIds, bulkDeleteResultMessage } from '../../utils/bulkDelete'
import type {
  CommonSyncResult,
  LessonPool,
  PoolHour,
  PoolSubject,
  TimetableAssignment,
  TimetableAssignmentPayload,
  TimetableAvailability,
} from '../../types/timetable'
import {
  assignmentTeacherIds,
  computeLoads,
  shortClassroom,
  teacherFullName,
  type TimetableCtx,
} from './shared'

// Havuzda saati olmayan dersi eklerken saat sorar.
function AddWithHours({ onAdd }: { onAdd: (hours: number) => void }) {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState<number | null>(2)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Space>
          <InputNumber min={1} max={40} value={hours} onChange={setHours} addonAfter="saat" style={{ width: 110 }} />
          <Button
            size="small"
            type="primary"
            disabled={!hours}
            onClick={() => {
              setOpen(false)
              if (hours) onAdd(hours)
            }}
          >
            Ekle
          </Button>
        </Space>
      }
    >
      <Button size="small" icon={<PlusOutlined />} />
    </Popover>
  )
}

function AddFromOptions({ options, onAdd }: { options: PoolHour[]; onAdd: (hours: number) => void }) {
  const [open, setOpen] = useState(false)
  if (options.length <= 1) {
    const hours = options[0]?.weekly_hours
    return <Button size="small" icon={<PlusOutlined />} disabled={!hours} onClick={() => hours && onAdd(hours)} />
  }
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      content={
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Bu seviyede birden fazla saat var
          </Typography.Text>
          {options
            .slice()
            .sort((a, b) => a.weekly_hours - b.weekly_hours)
            .map((hour) => (
              <Button
                key={hour.id}
                size="small"
                onClick={() => {
                  setOpen(false)
                  onAdd(hour.weekly_hours)
                }}
              >
                {hour.weekly_hours} saat{hour.block_pattern ? ` (${hour.block_pattern})` : ''}
              </Button>
            ))}
        </Space>
      }
    >
      <Button size="small" icon={<PlusOutlined />} />
    </Popover>
  )
}

export function ClassLessonsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { project } = ctx
  const [rows, setRows] = useState<TimetableAssignment[]>([])
  const [pool, setPool] = useState<LessonPool>({ subjects: [], hours: [], branches: [] })
  const [availability, setAvailability] = useState<TimetableAvailability[]>([])
  const [loading, setLoading] = useState(false)
  const [classId, setClassId] = useState<number | null>(ctx.classrooms[0]?.id ?? null)
  const [poolFilter, setPoolFilter] = useState('')
  const [allSubjects, setAllSubjects] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTargets, setCopyTargets] = useState<number[]>([])
  const [copyReplace, setCopyReplace] = useState(false)
  const [copyTeachers, setCopyTeachers] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [common, setCommon] = useState<CommonSyncResult | null>(null)
  const editable = ctx.canUpdate

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Havuzdaki ortak dersler eksik şubelere otomatik verilir (kaldırılanlar hariç).
      if (ctx.canCreate) {
        const sync = await syncCommonAssignments(project.id)
        setCommon(sync)
        if (sync.created) {
          message.success(`Ders havuzundaki ortak dersler ${sync.classrooms} şubeye eklendi (${sync.created} ders)`)
        }
      }
      const [a, p, av] = await Promise.all([
        listTimetableAssignments(project.id),
        getLessonPool(project.id),
        listAvailability(project.id),
      ])
      setRows(a)
      setPool(p)
      setAvailability(av)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message, ctx.canCreate])

  useEffect(() => {
    void load()
  }, [load])

  const teacherById = useMemo(() => new Map(ctx.teachers.map((t) => [t.id, t])), [ctx.teachers])
  const subjectById = useMemo(() => new Map(pool.subjects.map((s) => [s.id, s])), [pool.subjects])
  const loads = useMemo(() => computeLoads(rows), [rows])
  const classroom = ctx.classrooms.find((c) => c.id === classId) || null
  const classLunch = project.settings.class_lunch || {}

  // Şubenin açık saat sayısı: gün x saat - (okul + şube kapalı hücreleri).
  const capacity = useMemo(() => {
    const total = project.days.length * project.periods_per_day
    const school = new Set(
      Object.entries(availability.find((r) => r.entity_type === 'school')?.cells || {})
        .filter(([, v]) => v === 'closed')
        .map(([k]) => k),
    )
    const map = new Map<number, number>()
    for (const c of ctx.classrooms) {
      const closed = new Set(school)
      const row = availability.find((r) => r.entity_type === 'classroom' && r.entity_id === c.id)
      for (const [k, v] of Object.entries(row?.cells || {})) if (v === 'closed') closed.add(k)
      map.set(c.id, total - closed.size)
    }
    return map
  }, [availability, ctx.classrooms, project.days.length, project.periods_per_day])

  const classRows = useMemo(() => rows.filter((a) => a.classroom_id === classId), [rows, classId])
  const isCommon = (subjectId: number) => {
    const s = subjectById.get(subjectId)
    return Boolean(s && !s.is_elective)
  }
  const inClass = useMemo(() => new Set(classRows.map((a) => a.subject_id)), [classRows])

  const poolRows = useMemo(() => {
    if (!classroom) return []
    const level = classroom.class_level
    const hours = new Map<number, PoolHour[]>()
    for (const hour of pool.hours) {
      if (hour.class_level !== level) continue
      hours.set(hour.subject_id, [...(hours.get(hour.subject_id) || []), hour])
    }
    const q = poolFilter.trim().toLocaleLowerCase('tr-TR')
    return pool.subjects
      .filter((s) => (allSubjects ? s.is_active || hours.has(s.id) : hours.has(s.id)))
      .filter((s) => !q || `${s.code || ''} ${s.name}`.toLocaleLowerCase('tr-TR').includes(q))
      .map((s) => ({ subject: s, hours: hours.get(s.id) || [] }))
  }, [classroom, pool, poolFilter, allSubjects])

  const addLesson = async (subject: PoolSubject, hours?: number) => {
    if (!classId) return
    try {
      const created = await createTimetableAssignment(project.id, {
        classroom_id: classId,
        subject_id: subject.id,
        ...(hours ? { weekly_hours: hours } : {}),
      })
      setRows((prev) => [...prev, created])
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const patch = async (row: TimetableAssignment, payload: TimetableAssignmentPayload) => {
    try {
      const updated = await updateTimetableAssignment(row.id, payload)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const remove = async (row: TimetableAssignment) => {
    try {
      await deleteTimetableAssignment(row.id)
      setRows((prev) => prev.filter((r) => r.id !== row.id))
      if (isCommon(row.subject_id)) {
        setCommon((prev) => {
          if (!prev) return prev
          const key = String(row.classroom_id)
          const list = [...new Set([...(prev.excluded[key] || []), row.subject_id])]
          return { ...prev, excluded: { ...prev.excluded, [key]: list } }
        })
      }
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const removeAll = async () => {
    setBulkLoading(true)
    try {
      const ids = classRows.map((row) => row.id)
      const result = await bulkDeleteByIds(ids, (id) => deleteTimetableAssignment(Number(id)))
      const text = bulkDeleteResultMessage(result, 'ders')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      // Kaldırılan ortak derslerin listesi de güncellensin.
      await load()
      await ctx.reloadProject()
    } finally {
      setBulkLoading(false)
    }
  }

  const setLunch = async (cid: number, value: number | null) => {
    const next = { ...classLunch }
    if (value && value !== project.lunch_after) next[String(cid)] = value
    else delete next[String(cid)]
    try {
      await updateTimetableProject(project.id, { settings: { class_lunch: next } })
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const openCopy = () => {
    if (!classroom) return
    setCopyTargets(ctx.classrooms.filter((c) => c.class_level === classroom.class_level && c.id !== classroom.id).map((c) => c.id))
    setCopyReplace(false)
    setCopyTeachers(false)
    setCopyOpen(true)
  }

  const runCopy = async () => {
    if (!classId || !copyTargets.length) return
    try {
      const res = await copyTimetableAssignments(project.id, {
        source_classroom_id: classId,
        target_classroom_ids: copyTargets,
        replace: copyReplace,
        with_teachers: copyTeachers,
      })
      message.success(`${res.classrooms} şubeye ${res.created} ders eklendi${res.skipped ? `, ${res.skipped} zaten vardı` : ''}`)
      setCopyOpen(false)
      await load()
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const restoreRemoved = async () => {
    if (!classId) return
    try {
      const res = await restoreCommonAssignments(project.id, classId)
      message.success(res.created ? `${res.created} ortak ders geri eklendi` : 'Geri eklenecek ders yok')
      await load()
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const removedHere = classId ? (common?.excluded[String(classId)] || []).filter((id) => !inClass.has(id)) : []
  const choiceHere = classId
    ? (common?.needs_choice || []).filter((n) => n.classroom_id === classId && !inClass.has(n.subject_id))
    : []

  const roomOptions = ctx.rooms.map((r) => ({ value: r.id, label: r.name }))
  const selectedLoad = classId ? loads.classroom.get(classId) || 0 : 0
  const selectedCap = classId ? capacity.get(classId) || 0 : 0

  return (
    <>
      <Typography.Paragraph type="secondary">
        Açık saat, ders günü sayısı ile günlük ders saatinin çarpımıdır. Cumartesi ve pazar ders günü değildir;
        müsaitlikte görünürler ama şubenin saatine eklenmez. Ortak dersler şubelere kendiliğinden verilir; şubede
        okutulmayan bir ortak dersi silerseniz o şubeye bir daha eklenmez, "Kaldırılanları geri ekle" ile geri
        alırsınız. Seçmeli dersler (Temel Matematik gibi) sağdaki ders havuzundan <PlusOutlined /> ile verilir.
        Listede yalnız bu seviyenin saati olan dersler durur. Saat ve blok havuzdan gelir, şubeye özel
        değiştirebilirsiniz. Bir şubenin ders listesini aynı seviyedeki diğer şubelere
        kopyalayabilirsiniz; öğretmenler bir sonraki adımda atanır. Şubenin öğrencileri seçmelilere bölünüyorsa
        alternatif seçmelilere aynı "Seçmeli grup" kodunu yazın: bu dersler aynı saatte paralel işlenebilir ve
        şube saatine bir kez sayılır. Boş bırakılan ders tüm şubenin dersidir.
      </Typography.Paragraph>
      <Row gutter={12}>
        <Col xs={24} xl={6}>
          <Card size="small" title="Şubeler" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              pagination={false}
              dataSource={ctx.classrooms}
              scroll={{ y: 560 }}
              onRow={(c) => ({
                onClick: () => setClassId(c.id),
                style: { cursor: 'pointer', background: c.id === classId ? token.colorPrimaryBg : undefined },
              })}
              columns={[
                { title: 'Şube', key: 'name', render: (_, c) => shortClassroom(c) },
                { title: 'Açık', key: 'cap', width: 48, render: (_, c) => capacity.get(c.id) ?? '—' },
                { title: 'Atanan', key: 'load', width: 70, render: (_, c) => loads.classroom.get(c.id) || 0 },
                {
                  title: 'Kalan',
                  key: 'left',
                  width: 54,
                  render: (_, c) => {
                    const left = (capacity.get(c.id) || 0) - (loads.classroom.get(c.id) || 0)
                    return <Tag color={left < 0 ? 'red' : left === 0 ? 'green' : 'default'}>{left}</Tag>
                  },
                },
                {
                  title: 'Öğle',
                  key: 'lunch',
                  width: 64,
                  render: (_, c) => (
                    <InputNumber
                      size="small"
                      min={1}
                      max={project.periods_per_day - 1}
                      style={{ width: 52 }}
                      disabled={!editable}
                      placeholder={project.lunch_after ? String(project.lunch_after) : '—'}
                      value={classLunch[String(c.id)] ?? null}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || null
                        if (v !== (classLunch[String(c.id)] ?? null)) void setLunch(c.id, v)
                      }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} xl={11}>
          <Card
            size="small"
            title={
              classroom ? (
                <Space>
                  {shortClassroom(classroom)} dersleri
                  <Tag color={selectedLoad > selectedCap ? 'red' : 'blue'}>
                    {selectedLoad} / {selectedCap} saat
                  </Tag>
                </Space>
              ) : (
                'Şube seçin'
              )
            }
            extra={
              classroom && (editable || ctx.canDelete) ? (
                <Space>
                  {editable && (
                    <Button size="small" icon={<CopyOutlined />} disabled={!classRows.length} onClick={openCopy}>
                      Diğer şubelere kopyala
                    </Button>
                  )}
                  {ctx.canDelete && (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={!classRows.length}
                      onClick={() => setBulkOpen(true)}
                    >
                      Toplu sil ({classRows.length})
                    </Button>
                  )}
                </Space>
              ) : undefined
            }
          >
            {removedHere.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
                message={`Bu şubeden kaldırılan ortak dersler: ${removedHere
                  .map((id) => subjectById.get(id)?.name || `#${id}`)
                  .join(', ')}`}
                action={
                  ctx.canCreate && (
                    <Button size="small" icon={<UndoOutlined />} onClick={restoreRemoved}>
                      Kaldırılanları geri ekle
                    </Button>
                  )
                }
              />
            )}
            {choiceHere.length > 0 && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 8 }}
                message="Saati seçilmesi gereken ortak dersler"
                description={
                  <>
                    {choiceHere.map((n) => `${n.subject_name} (${n.options.join(' veya ')} saat)`).join(', ')}. Sağdaki
                    ders havuzundan saatini seçerek ekleyin.
                  </>
                }
              />
            )}
            {selectedLoad > selectedCap && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 8 }}
                message={`Şubenin haftalık dersi (${selectedLoad}) açık saatten (${selectedCap}) fazla.`}
              />
            )}
            {!classroom ? (
              <Empty />
            ) : (
              <Table<TimetableAssignment>
                rowKey="id"
                size="small"
                loading={loading}
                pagination={false}
                dataSource={classRows}
                scroll={{ x: 900, y: 520 }}
                columns={[
                  {
                    title: 'Ders',
                    key: 'subject',
                    width: 230,
                    fixed: 'left',
                    render: (_, r) => {
                      const s = subjectById.get(r.subject_id)
                      return (
                        <Space size={4} direction="vertical" style={{ lineHeight: 1.2 }}>
                          <span>
                            {s?.code && <b>{s.code} </b>}
                            {r.Subject?.name}
                            {r.source === 'pool' && (
                              <Tag color="blue" style={{ marginInlineStart: 6, fontSize: 11 }}>
                                ortak · otomatik
                              </Tag>
                            )}
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>
                            {assignmentTeacherIds(r)
                              .map((id) => teacherFullName(teacherById.get(id)))
                              .join(', ') || 'öğretmen yok'}
                          </span>
                        </Space>
                      )
                    },
                  },
                  {
                    title: 'Saat',
                    dataIndex: 'weekly_hours',
                    width: 70,
                    render: (v: number, r) => (
                      <InputNumber
                        size="small"
                        min={1}
                        max={40}
                        value={v}
                        disabled={!editable}
                        style={{ width: 56 }}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isInteger(n) && n > 0 && n !== v) void patch(r, { weekly_hours: n })
                        }}
                      />
                    ),
                  },
                  {
                    title: 'Blok',
                    dataIndex: 'block_pattern',
                    width: 150,
                    render: (v: string | null, r) => (
                      <Select
                        size="small"
                        allowClear
                        placeholder="Otomatik"
                        disabled={!editable}
                        style={{ width: '100%' }}
                        value={v || undefined}
                        options={blockPatternChoices(r.weekly_hours, v)}
                        onChange={(next) => {
                          const value = next || null
                          if (value !== (v || null)) void patch(r, { block_pattern: value })
                        }}
                      />
                    ),
                  },
                  {
                    title: 'Seçmeli grup',
                    dataIndex: 'elective_group',
                    width: 96,
                    render: (v: string | null, r) => (
                      <Input
                        size="small"
                        key={`${r.id}-${v}`}
                        defaultValue={v || ''}
                        placeholder="tüm şube"
                        disabled={!editable}
                        maxLength={30}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next !== (v || '')) void patch(r, { elective_group: next || null })
                        }}
                      />
                    ),
                  },
                  {
                    title: 'Mekan',
                    key: 'room',
                    width: 120,
                    render: (_, r) => (
                      <Select
                        size="small"
                        allowClear
                        style={{ width: '100%' }}
                        disabled={!editable}
                        value={r.room_id ?? undefined}
                        onChange={(v) => patch(r, { room_id: v ?? null })}
                        options={roomOptions}
                        placeholder="—"
                      />
                    ),
                  },
                  {
                    title: '',
                    key: 'del',
                    width: 40,
                    render: (_, r) =>
                      ctx.canDelete && (
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(r)} />
                      ),
                  },
                ]}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card
            size="small"
            title={classroom ? `Ders havuzu (${classroom.class_level}. sınıf)` : 'Ders havuzu'}
            styles={{ body: { padding: 8 } }}
          >
            <Space direction="vertical" style={{ width: '100%', marginBottom: 8 }}>
              <Input.Search allowClear placeholder="Ders filtresi" value={poolFilter} onChange={(e) => setPoolFilter(e.target.value)} />
              <Checkbox checked={allSubjects} onChange={(e) => setAllSubjects(e.target.checked)}>
                Bu seviyede saati olmayan dersleri de göster
              </Checkbox>
            </Space>
            <Table
              rowKey={(r) => r.subject.id}
              size="small"
              pagination={false}
              loading={loading}
              dataSource={poolRows}
              scroll={{ y: 470 }}
              locale={{ emptyText: 'Bu seviye için havuzda ders yok. "Ders havuzu" adımında saat girin.' }}
              columns={[
                {
                  title: 'Ders',
                  key: 'name',
                  render: (_, r) => (
                    <span style={{ color: inClass.has(r.subject.id) ? '#1677ff' : undefined }}>
                      {r.subject.code && <b>{r.subject.code} </b>}
                      {r.subject.name}
                      {r.subject.is_elective && (
                        <Tag color="purple" style={{ marginInlineStart: 6 }}>
                          seçmeli
                        </Tag>
                      )}
                    </span>
                  ),
                },
                {
                  title: 'Saat',
                  key: 'hours',
                  width: 70,
                  render: (_, r) =>
                    r.hours.length ? (
                      <span>
                        {r.hours
                          .slice()
                          .sort((a, b) => a.weekly_hours - b.weekly_hours)
                          .map((hour) => hour.weekly_hours)
                          .join(' / ')}
                      </span>
                    ) : (
                      '—'
                    ),
                },
                {
                  title: '',
                  key: 'add',
                  width: 44,
                  render: (_, r) =>
                    ctx.canCreate &&
                    classroom &&
                    (inClass.has(r.subject.id) ? (
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                        ekli
                      </Tag>
                    ) : r.hours.length ? (
                      <AddFromOptions options={r.hours} onAdd={(h) => addLesson(r.subject, h)} />
                    ) : (
                      <AddWithHours onAdd={(h) => addLesson(r.subject, h)} />
                    )),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={copyOpen}
        title={classroom ? `${shortClassroom(classroom)} derslerini kopyala` : 'Kopyala'}
        onCancel={() => setCopyOpen(false)}
        onOk={runCopy}
        okText="Kopyala"
        cancelText="Vazgeç"
        okButtonProps={{ disabled: !copyTargets.length }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          Ders, saat, blok ve mekan kopyalanır. Hedef şubede zaten olan ders atlanır.
        </Typography.Paragraph>
        <Checkbox.Group
          value={copyTargets}
          onChange={(v) => setCopyTargets(v as number[])}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 4, marginBottom: 12 }}
          options={ctx.classrooms.filter((c) => c.id !== classId).map((c) => ({ value: c.id, label: shortClassroom(c) }))}
        />
        <Space direction="vertical">
          <Space>
            <Switch checked={copyReplace} onChange={setCopyReplace} />
            Hedef şubelerin mevcut derslerini silip baştan yaz
          </Space>
          <Space>
            <Switch checked={copyTeachers} onChange={setCopyTeachers} />
            Öğretmenleri de kopyala
          </Space>
        </Space>
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Şube derslerini toplu sil"
        description={
          classroom
            ? `${shortClassroom(classroom)} şubesindeki ${classRows.length} ders silinecek. Bağlı taslak ders saatleri de kalkar.`
            : ''
        }
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={removeAll}
      />
    </>
  )
}
