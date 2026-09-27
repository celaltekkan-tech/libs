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
  Popconfirm,
  Popover,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { CopyOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  copyTimetableAssignments,
  createTimetableAssignment,
  deleteTimetableAssignment,
  getLessonPool,
  listAvailability,
  listTimetableAssignments,
  updateTimetableAssignment,
  updateTimetableProject,
} from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import type {
  LessonPool,
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

const FLEX_OPTIONS = [
  { value: 'pool', label: 'Havuz' },
  { value: 'yes', label: 'Evet' },
  { value: 'no', label: 'Hayır' },
]

function flexValue(v: boolean | null): string {
  return v == null ? 'pool' : v ? 'yes' : 'no'
}

function flexPayload(v: string): boolean | null {
  return v === 'pool' ? null : v === 'yes'
}

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

export function ClassLessonsTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
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
  const editable = ctx.canUpdate

  const load = useCallback(async () => {
    setLoading(true)
    try {
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
  }, [project.id, message])

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
  const inClass = useMemo(() => new Set(classRows.map((a) => a.subject_id)), [classRows])

  const poolRows = useMemo(() => {
    if (!classroom) return []
    const level = classroom.class_level
    const hours = new Map(pool.hours.filter((h) => h.class_level === level).map((h) => [h.subject_id, h]))
    const q = poolFilter.trim().toLocaleLowerCase('tr-TR')
    return pool.subjects
      .filter((s) => (allSubjects ? s.is_active || hours.has(s.id) : hours.has(s.id)))
      .filter((s) => !q || `${s.code || ''} ${s.name}`.toLocaleLowerCase('tr-TR').includes(q))
      .map((s) => ({ subject: s, hour: hours.get(s.id) || null }))
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
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const removeAll = async () => {
    try {
      for (const r of classRows) await deleteTimetableAssignment(r.id)
      setRows((prev) => prev.filter((r) => r.classroom_id !== classId))
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
      await load()
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

  const roomOptions = ctx.rooms.map((r) => ({ value: r.id, label: r.name }))
  const selectedLoad = classId ? loads.classroom.get(classId) || 0 : 0
  const selectedCap = classId ? capacity.get(classId) || 0 : 0

  return (
    <>
      <Typography.Paragraph type="secondary">
        Soldan şubeyi seçin, sağdaki ders havuzundan <PlusOutlined /> ile şubeye ders verin. Saat ve blok havuzdan
        gelir, şubeye özel değiştirebilirsiniz. Bir şubenin ders listesini aynı seviyedeki diğer şubelere
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
                style: { cursor: 'pointer', background: c.id === classId ? '#e6f4ff' : undefined },
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
              classroom &&
              editable && (
                <Space>
                  <Button size="small" icon={<CopyOutlined />} disabled={!classRows.length} onClick={openCopy}>
                    Diğer şubelere kopyala
                  </Button>
                  {ctx.canDelete && (
                    <Popconfirm
                      title="Bu şubenin tüm dersleri silinsin mi?"
                      okText="Sil"
                      okButtonProps={{ danger: true }}
                      cancelText="Vazgeç"
                      onConfirm={removeAll}
                    >
                      <Button size="small" danger disabled={!classRows.length}>
                        Tümünü sil
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              )
            }
          >
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
                scroll={{ x: 740, y: 520 }}
                columns={[
                  {
                    title: 'Ders',
                    key: 'subject',
                    render: (_, r) => {
                      const s = subjectById.get(r.subject_id)
                      return (
                        <Space size={4} direction="vertical" style={{ lineHeight: 1.2 }}>
                          <span>
                            {s?.code && <b>{s.code} </b>}
                            {r.Subject?.name}
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
                    width: 80,
                    render: (v: string | null, r) => (
                      <Input
                        size="small"
                        key={`${r.id}-${v}`}
                        defaultValue={v || ''}
                        placeholder="oto"
                        disabled={!editable}
                        onBlur={(e) => {
                          const next = e.target.value.trim()
                          if (next !== (v || '')) void patch(r, { block_pattern: next || null })
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
                    title: 'B1',
                    key: 'split',
                    width: 84,
                    render: (_, r) => (
                      <Select
                        size="small"
                        style={{ width: 76 }}
                        disabled={!editable}
                        value={flexValue(r.allow_split)}
                        onChange={(v) => patch(r, { allow_split: flexPayload(v) })}
                        options={FLEX_OPTIONS}
                      />
                    ),
                  },
                  {
                    title: 'B2',
                    key: 'merge',
                    width: 84,
                    render: (_, r) => (
                      <Select
                        size="small"
                        style={{ width: 76 }}
                        disabled={!editable}
                        value={flexValue(r.allow_merge)}
                        onChange={(v) => patch(r, { allow_merge: flexPayload(v) })}
                        options={FLEX_OPTIONS}
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
                    </span>
                  ),
                },
                {
                  title: 'Saat',
                  key: 'hours',
                  width: 70,
                  render: (_, r) =>
                    r.hour ? (
                      <span>
                        {r.hour.weekly_hours}
                        {r.hour.block_pattern && <span style={{ fontSize: 11, color: '#6b7280' }}> ({r.hour.block_pattern})</span>}
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
                    ) : r.hour ? (
                      <Button size="small" icon={<PlusOutlined />} onClick={() => addLesson(r.subject)} />
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
          Ders, saat, blok, B1/B2 ve mekan kopyalanır. Hedef şubede zaten olan ders atlanır.
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
    </>
  )
}
