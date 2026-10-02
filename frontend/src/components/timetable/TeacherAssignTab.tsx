import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Button, Card, Col, Empty, Input, InputNumber, Row, Select, Space, Table, Tabs, Tag, Tooltip, Typography, theme } from 'antd'
import { CloseOutlined, PlusOutlined, UsergroupAddOutlined } from '@ant-design/icons'
import { getLessonPool, listTimetableAssignments, updateTimetableAssignment, updateTimetableProject } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import type { LessonPool, TeacherDistributionOverride, TimetableAssignment, TimetableAssignmentPayload } from '../../types/timetable'
import type { Teacher } from '../../types/teacher'
import { useActiveSchool } from '../../auth/ActiveSchoolContext'
import {
  assignmentTeacherIds,
  branchKey,
  isGuidanceLesson,
  computeLoads,
  lessonTeacherOptions,
  shortClassroom,
  teacherFullName,
  teacherMatchesLesson,
  type TimetableCtx,
} from './shared'

const MAX_TEACHERS = 5

function TeacherDistributionCard({ ctx, teacherId, teacherName }: { ctx: TimetableCtx; teacherId: number | null; teacherName: string }) {
  const { message } = App.useApp()
  const saved = teacherId ? ctx.project.settings.teacher_overrides?.[String(teacherId)] : undefined
  const [daily, setDaily] = useState<number | null>(saved?.max_daily_hours ?? null)
  const [windows, setWindows] = useState<number | null>(saved?.max_windows ?? null)
  const [freeDay, setFreeDay] = useState<'inherit' | 'on' | 'off'>(
    saved?.free_day === true ? 'on' : saved?.free_day === false ? 'off' : 'inherit',
  )
  const [sameDay, setSameDay] = useState<'inherit' | 'on' | 'off'>(
    saved?.same_class_subjects === 'on' || saved?.same_class_subjects === 'off' ? saved.same_class_subjects : 'inherit',
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDaily(saved?.max_daily_hours ?? null)
    setWindows(saved?.max_windows ?? null)
    setFreeDay(saved?.free_day === true ? 'on' : saved?.free_day === false ? 'off' : 'inherit')
    setSameDay(saved?.same_class_subjects === 'on' || saved?.same_class_subjects === 'off' ? saved.same_class_subjects : 'inherit')
  }, [teacherId, saved?.max_daily_hours, saved?.max_windows, saved?.free_day, saved?.same_class_subjects])

  if (!teacherId) return null

  const save = async () => {
    const next: TeacherDistributionOverride = {}
    if (daily != null) next.max_daily_hours = daily
    if (windows != null) next.max_windows = windows
    if (freeDay === 'on') next.free_day = true
    if (freeDay === 'off') next.free_day = false
    if (sameDay === 'on' || sameDay === 'off') next.same_class_subjects = sameDay
    const overrides = { ...(ctx.project.settings.teacher_overrides || {}) }
    if (Object.keys(next).length) overrides[String(teacherId)] = next
    else delete overrides[String(teacherId)]
    setSaving(true)
    try {
      await updateTimetableProject(ctx.project.id, { settings: { teacher_overrides: overrides } })
      message.success('Öğretmen parametreleri kaydedildi')
      await ctx.reloadProject()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card size="small" title={`${teacherName} için dağıtım`} style={{ marginTop: 12 }}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Boş bırakılan alan çalışma genelindeki ayarı kullanır. 0 sınır yok demektir.
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>1 günde en fazla kaç saat</div>
          <InputNumber min={0} max={12} value={daily ?? undefined} placeholder="Genel ayar" onChange={(v) => setDaily(v ?? null)} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>En fazla kaç pencere</div>
          <InputNumber min={0} max={40} value={windows ?? undefined} placeholder="Genel ayar" onChange={(v) => setWindows(v ?? null)} style={{ width: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Boş gün vermeye çalış</div>
          <Select
            style={{ width: '100%' }}
            value={freeDay}
            onChange={setFreeDay}
            options={[
              { value: 'inherit', label: 'Genel ayar' },
              { value: 'on', label: 'Evet' },
              { value: 'off', label: 'Hayır' },
            ]}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Aynı sınıfa farklı dersler aynı güne gelmesin</div>
          <Select
            style={{ width: '100%' }}
            value={sameDay}
            onChange={setSameDay}
            options={[
              { value: 'inherit', label: 'Genel ayar' },
              { value: 'on', label: 'Evet' },
              { value: 'off', label: 'Hayır' },
            ]}
          />
        </div>
        {ctx.canUpdate && (
          <Button type="primary" onClick={() => void save()} loading={saving}>
            Bu öğretmeni kaydet
          </Button>
        )}
      </Space>
    </Card>
  )
}

export function TeacherAssignTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { project } = ctx
  const { activeSchool } = useActiveSchool()
  const languages = useMemo(
    () => ({
      first: activeSchool?.meta?.first_foreign_language || null,
      second: activeSchool?.meta?.second_foreign_language || null,
    }),
    [activeSchool],
  )
  const autoFilled = useRef(new Set<number>())
  const [rows, setRows] = useState<TimetableAssignment[]>([])
  const [pool, setPool] = useState<LessonPool>({ subjects: [], hours: [], branches: [] })
  const [loading, setLoading] = useState(false)
  const [teacherId, setTeacherId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [lessonSearch, setLessonSearch] = useState('')
  const [classIds, setClassIds] = useState<number[]>(ctx.classrooms[0]?.id ? [ctx.classrooms[0].id] : [])
  const [lessonId, setLessonId] = useState<number | null>(null)
  const editable = ctx.canUpdate

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [a, p] = await Promise.all([listTimetableAssignments(project.id), getLessonPool(project.id)])
      setRows(a)
      setPool(p)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, message])

  useEffect(() => {
    void load()
  }, [load])

  const loads = useMemo(() => computeLoads(rows), [rows])
  const teacherById = useMemo(() => new Map(ctx.teachers.map((t) => [t.id, t])), [ctx.teachers])
  const branchName = useMemo(() => new Map(pool.branches.map((b) => [b.id, b.name])), [pool.branches])
  const subjectBranch = useMemo(
    () => new Map(pool.subjects.map((s) => [s.id, s.branch_id ? branchName.get(s.branch_id) || '' : ''])),
    [pool.subjects, branchName],
  )
  const subjectCode = useMemo(() => new Map(pool.subjects.map((s) => [s.id, s.code])), [pool.subjects])
  const teacher = teacherId ? teacherById.get(teacherId) || null : null

  const teacherRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR')
    return ctx.teachers.filter(
      (t) => !q || `${t.first_name} ${t.last_name} ${t.brans || ''}`.toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [ctx.teachers, search])

  const teacherLessons = useMemo(
    () => (teacherId ? rows.filter((a) => assignmentTeacherIds(a).includes(teacherId)) : []),
    [rows, teacherId],
  )

  // Şube durumu: tüm derslerin en az bir öğretmeni varsa "Tamam".
  const classMissing = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of rows) if (!a.teacher_id) map.set(a.classroom_id, (map.get(a.classroom_id) || 0) + 1)
    return map
  }, [rows])
  const classHasLessons = useMemo(() => new Set(rows.map((a) => a.classroom_id)), [rows])

  const lessonQuery = lessonSearch.trim().toLocaleLowerCase('tr-TR')
  const matchesLesson = (a: TimetableAssignment) => {
    if (!lessonQuery) return true
    const text = `${subjectCode.get(a.subject_id) || ''} ${a.Subject?.name || ''} ${shortClassroom(a.Classroom)}`.toLocaleLowerCase(
      'tr-TR',
    )
    return text.includes(lessonQuery)
  }

  const classLessons = useMemo(
    () =>
      rows
        .filter((a) => classIds.includes(a.classroom_id) && matchesLesson(a))
        .sort(
          (a, b) =>
            shortClassroom(a.Classroom).localeCompare(shortClassroom(b.Classroom), 'tr', { numeric: true }) ||
            (a.Subject?.name || '').localeCompare(b.Subject?.name || '', 'tr'),
        ),
    [rows, classIds, lessonQuery, subjectCode],
  )

  const branchLessons = useMemo(() => {
    if (!teacher) return []
    const key = branchKey(teacher.brans)
    if (!key) return []
    return rows
      .filter(
        (a) =>
          (isGuidanceLesson(a.Subject?.name) || branchKey(subjectBranch.get(a.subject_id)) === key) && matchesLesson(a),
      )
      .sort((a, b) => Number(Boolean(a.teacher_id)) - Number(Boolean(b.teacher_id)) || shortClassroom(a.Classroom).localeCompare(shortClassroom(b.Classroom), 'tr', { numeric: true }))
  }, [rows, teacher, subjectBranch, lessonQuery, subjectCode])

  const lesson = rows.find((a) => a.id === lessonId) || null

  const patch = async (row: TimetableAssignment, payload: TimetableAssignmentPayload) => {
    try {
      const updated = await updateTimetableAssignment(row.id, payload)
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)))
      return updated
    } catch (err) {
      message.error(getErrorMessage(err))
      return null
    }
  }

  useEffect(() => {
    if (!editable || loading || ctx.teachers.length === 0) return
    for (const row of rows) {
      if (autoFilled.current.has(row.id)) continue
      autoFilled.current.add(row.id)
      if (row.teacher_id) continue
      const matches = ctx.teachers.filter((teacher) =>
        teacherMatchesLesson(teacher, row.Subject?.name || '', languages),
      )
      if (matches.length === 1) void patch(row, { teacher_id: matches[0].id })
    }
  }, [rows, loading, languages, ctx.teachers, editable])

  // Aynı dersin, seçili şubelerdeki kopyaları. Çoklu seçimde + boş olanlara da yazar.
  const sameSubjectInSelection = (row: TimetableAssignment) =>
    classIds.length > 1
      ? rows.filter((a) => a.subject_id === row.subject_id && classIds.includes(a.classroom_id))
      : [row]

  // + : tıklanan satırın öğretmenini değiştirir. Birden fazla şube seçiliyse öğretmeni boş olan diğer şubelere de yazar.
  const assignMain = async (row: TimetableAssignment) => {
    if (!teacherId) return
    const same = sameSubjectInSelection(row)
    const targets = same.filter((a) => a.id === row.id || !a.teacher_id)
    const skipped = same.length - targets.length
    const pending = targets.filter((a) => a.teacher_id !== teacherId || (a.co_teacher_ids || []).includes(teacherId))
    const results = await Promise.all(
      pending.map((a) =>
        patch(a, {
          teacher_id: teacherId,
          co_teacher_ids: (a.co_teacher_ids || []).filter((id) => id !== teacherId),
        }),
      ),
    )
    const ok = results.filter(Boolean).length
    if (ok && classIds.length > 1 && (targets.length > 1 || skipped > 0)) {
      message.success(
        `${row.Subject?.name || 'Ders'} ${ok} şubede atandı${skipped ? `. ${skipped} şubede mevcut öğretmen korundu` : ''}.`,
      )
    }
  }

  const addCo = (row: TimetableAssignment) => {
    if (!teacherId) return
    if (!row.teacher_id) return assignMain(row)
    if (assignmentTeacherIds(row).includes(teacherId)) return
    if (assignmentTeacherIds(row).length >= MAX_TEACHERS) {
      message.warning(`Bir derse en fazla ${MAX_TEACHERS} öğretmen atanabilir`)
      return
    }
    void patch(row, { co_teacher_ids: [...(row.co_teacher_ids || []), teacherId] })
  }

  const unassign = (row: TimetableAssignment, id: number) => {
    if (row.teacher_id === id) {
      const [next, ...rest] = row.co_teacher_ids || []
      void patch(row, { teacher_id: next ?? null, co_teacher_ids: rest })
    } else {
      void patch(row, { co_teacher_ids: (row.co_teacher_ids || []).filter((x) => x !== id) })
    }
  }

  const names = (a: TimetableAssignment) =>
    assignmentTeacherIds(a)
      .map((id) => teacherFullName(teacherById.get(id)))
      .join(', ')

  const lessonColumns = (showClass: boolean) => [
    ...(showClass
      ? [{ title: 'Şube', key: 'class', width: 64, render: (_: unknown, r: TimetableAssignment) => shortClassroom(r.Classroom) }]
      : []),
    {
      title: 'Ders',
      key: 'subject',
      render: (_: unknown, r: TimetableAssignment) => (
        <span>
          {subjectCode.get(r.subject_id) && <b>{subjectCode.get(r.subject_id)} </b>}
          {r.Subject?.name}
        </span>
      ),
    },
    { title: 'Saat', dataIndex: 'weekly_hours', width: 50 },
    {
      title: 'Öğretmen(ler)',
      key: 'teachers',
      render: (_: unknown, r: TimetableAssignment) =>
        r.teacher_id ? names(r) : <Typography.Text type="warning">atanmadı</Typography.Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 76,
      render: (_: unknown, r: TimetableAssignment) =>
        editable &&
        teacherId && (
          <Space size={2} onClick={(e) => e.stopPropagation()}>
            <Tooltip
              title={(() => {
                const emptyOthers = sameSubjectInSelection(r).filter((a) => a.id !== r.id && !a.teacher_id).length
                if (emptyOthers) return `Seçili öğretmene ata; öğretmeni boş ${emptyOthers} şubeye de yazılır`
                return r.teacher_id ? 'Seçili öğretmeni 1. öğretmen yap' : 'Seçili öğretmene ata'
              })()}
            >
              <Button
                size="small"
                type={
                  !r.teacher_id || sameSubjectInSelection(r).some((a) => a.id !== r.id && !a.teacher_id)
                    ? 'primary'
                    : 'default'
                }
                icon={<PlusOutlined />}
                disabled={
                  !sameSubjectInSelection(r).some(
                    (a) =>
                      (a.id === r.id &&
                        (a.teacher_id !== teacherId || (a.co_teacher_ids || []).includes(teacherId))) ||
                      (a.id !== r.id && !a.teacher_id),
                  )
                }
                onClick={() => void assignMain(r)}
              />
            </Tooltip>
            {r.teacher_id && (
              <Tooltip title="Ortak öğretmen olarak ekle">
                <Button
                  size="small"
                  icon={<UsergroupAddOutlined />}
                  disabled={assignmentTeacherIds(r).includes(teacherId)}
                  onClick={() => addCo(r)}
                />
              </Tooltip>
            )}
          </Space>
        ),
    },
  ]

  return (
    <>
      <Typography.Paragraph type="secondary">
        Soldan öğretmeni seçin. Sağda bir veya birden fazla şube işaretleyin; dersleri birlikte görürsünüz.{' '}
        <PlusOutlined /> dersi öğretmene verir. Birden fazla şube seçiliyken aynı ders, öğretmeni boş olan diğer seçili
        şubelere de yazılır. <UsergroupAddOutlined /> ortak öğretmen ekler (aynı saatte birlikte girerler). Bir derse en
        fazla {MAX_TEACHERS} öğretmen atanabilir.
      </Typography.Paragraph>
      <Row gutter={12}>
        <Col xs={24} xl={9}>
          <Card size="small" title="Öğretmenler" styles={{ body: { padding: 8 } }} style={{ marginBottom: 12 }}>
            <Input.Search
              allowClear
              placeholder="Öğretmen ara"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Table<Teacher>
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
              dataSource={teacherRows}
              scroll={{ y: 300 }}
              onRow={(t) => ({
                onClick: () => {
                  if (t.id === teacherId) return
                  setTeacherId(t.id)
                  setClassIds([])
                  setLessonId(null)
                },
                style: {
                  cursor: 'pointer',
                  background: t.id === teacherId ? token.colorPrimaryBg : undefined,
                  color: token.colorText,
                },
              })}
              columns={[
                { title: 'Adı Soyadı', key: 'name', render: (_, t) => teacherFullName(t) },
                { title: 'Branş', dataIndex: 'brans', width: 120, ellipsis: true },
                {
                  title: 'Toplam',
                  key: 'load',
                  width: 80,
                  sorter: (a, b) => (loads.teacher.get(a.id) || 0) - (loads.teacher.get(b.id) || 0),
                  render: (_, t) => {
                    const h = loads.teacher.get(t.id) || 0
                    return <Tag color={h === 0 ? 'default' : h > 30 ? 'red' : 'blue'}>{h}</Tag>
                  },
                },
              ]}
            />
          </Card>
          <Card
            size="small"
            title={teacher ? `${teacherFullName(teacher)} — atanan dersler (${loads.teacher.get(teacher.id) || 0} saat)` : 'Atanan dersler'}
            styles={{ body: { padding: 8 } }}
          >
            {!teacher ? (
              <Empty description="Öğretmen seçin" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table<TimetableAssignment>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={teacherLessons}
                scroll={{ y: 240 }}
                columns={[
                  { title: 'Şube', key: 'class', width: 64, render: (_, r) => shortClassroom(r.Classroom) },
                  { title: 'Ders', key: 'subject', render: (_, r) => r.Subject?.name },
                  { title: 'Saat', dataIndex: 'weekly_hours', width: 50 },
                  {
                    title: 'Görev',
                    key: 'role',
                    width: 70,
                    render: (_, r) => (r.teacher_id === teacher.id ? <Tag>1. öğr.</Tag> : <Tag color="purple">ortak</Tag>),
                  },
                  {
                    title: '',
                    key: 'x',
                    width: 40,
                    render: (_, r) =>
                      editable && (
                        <Tooltip title="Öğretmenden al">
                          <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={() => unassign(r, teacher.id)} />
                        </Tooltip>
                      ),
                  },
                ]}
              />
            )}
          </Card>
          <TeacherDistributionCard
            ctx={ctx}
            teacherId={teacher?.id ?? null}
            teacherName={teacher ? teacherFullName(teacher) : ''}
          />
        </Col>

        <Col xs={24} xl={15}>
          <Tabs
            items={[
              {
                key: 'class',
                label: 'Sınıf dersleri',
                children: (
                  <Row gutter={8}>
                    <Col span={8}>
                      <Table
                        rowKey="id"
                        size="small"
                        pagination={false}
                        dataSource={ctx.classrooms}
                        scroll={{ y: 520 }}
                        rowSelection={{
                          selectedRowKeys: classIds,
                          onChange: (keys) => setClassIds(keys as number[]),
                        }}
                        onRow={(c) => ({
                          onClick: (event) => {
                            if ((event.target as HTMLElement).closest('.ant-table-selection-column, .ant-checkbox')) return
                            setClassIds((prev) => (prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                          },
                          style: {
                            cursor: 'pointer',
                            background: classIds.includes(c.id) ? token.colorPrimaryBg : undefined,
                            color: token.colorText,
                          },
                        })}
                        columns={[
                          { title: 'Şube', key: 'name', render: (_, c) => shortClassroom(c) },
                          {
                            title: 'Atama',
                            key: 'status',
                            width: 72,
                            render: (_, c) => {
                              if (!classHasLessons.has(c.id)) return <Tag>ders yok</Tag>
                              const miss = classMissing.get(c.id) || 0
                              return miss ? <Tag color="orange">{miss} eksik</Tag> : <Tag color="green">Tamam</Tag>
                            },
                          },
                        ]}
                      />
                    </Col>
                    <Col span={16}>
                      <Input.Search
                        allowClear
                        size="small"
                        placeholder="Ders ara (ad veya kod)"
                        value={lessonSearch}
                        onChange={(e) => setLessonSearch(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <Table<TimetableAssignment>
                        rowKey="id"
                        size="small"
                        pagination={false}
                        loading={loading}
                        dataSource={classLessons}
                        scroll={{ y: 330 }}
                        onRow={(r) => ({
                          onClick: () => setLessonId(r.id),
                          style: { cursor: 'pointer', background: r.id === lessonId ? token.colorWarningBg : undefined, color: token.colorText },
                        })}
                        columns={lessonColumns(classIds.length > 1)}
                        locale={{
                          emptyText: !classIds.length
                            ? 'Soldan en az bir şube seçin.'
                            : lessonQuery
                              ? 'Aramanızla eşleşen ders yok.'
                              : 'Seçili şubelere henüz ders verilmedi ("Sınıfa ders verme" adımı).',
                        }}
                      />
                      <Card size="small" title="Dersin öğretmenleri" style={{ marginTop: 8 }}>
                        {!lesson || !classIds.includes(lesson.classroom_id) ? (
                          <Typography.Text type="secondary">Yukarıdan bir ders seçin.</Typography.Text>
                        ) : (
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Typography.Text strong>
                              {shortClassroom(lesson.Classroom)} · {lesson.Subject?.name} ({lesson.weekly_hours} saat)
                            </Typography.Text>
                            <Space wrap>
                              <span>Mekan:</span>
                              <Select
                                size="small"
                                allowClear
                                style={{ width: 180 }}
                                disabled={!editable}
                                value={lesson.room_id ?? undefined}
                                onChange={(v) => patch(lesson, { room_id: v ?? null })}
                                options={ctx.rooms.map((r) => ({ value: r.id, label: r.name }))}
                                placeholder="Kendi sınıfı"
                              />
                              <span>1. öğretmen:</span>
                              <Select
                                size="small"
                                allowClear
                                showSearch
                                optionFilterProp="label"
                                style={{ width: 240 }}
                                disabled={!editable}
                                value={lesson.teacher_id ?? undefined}
                                onChange={(v) =>
                                  patch(lesson, {
                                    teacher_id: v ?? null,
                                    co_teacher_ids: (lesson.co_teacher_ids || []).filter((id) => id !== v),
                                  })
                                }
                                options={lessonTeacherOptions(ctx.teachers, lesson.Subject?.name || '', languages)}
                              />
                            </Space>
                            <Space wrap style={{ width: '100%' }}>
                              <span>2.-5. öğretmen:</span>
                              <Select
                                size="small"
                                mode="multiple"
                                showSearch
                                optionFilterProp="label"
                                style={{ minWidth: 360 }}
                                disabled={!editable || !lesson.teacher_id}
                                maxCount={MAX_TEACHERS - 1}
                                value={lesson.co_teacher_ids || []}
                                onChange={(v: number[]) => patch(lesson, { co_teacher_ids: v })}
                                options={lessonTeacherOptions(ctx.teachers, lesson.Subject?.name || '', languages).filter(
                                  (option) => option.value !== lesson.teacher_id,
                                )}
                                placeholder={lesson.teacher_id ? 'Ortak öğretmen yok' : 'Önce 1. öğretmeni seçin'}
                              />
                            </Space>
                          </Space>
                        )}
                      </Card>
                    </Col>
                  </Row>
                ),
              },
              {
                key: 'branch',
                label: teacher ? `Branş dersleri (${teacher.brans || 'branş yok'})` : 'Branş dersleri',
                children: !teacher ? (
                  <Empty description="Öğretmen seçin" />
                ) : !branchKey(teacher.brans) ? (
                  <Empty description="Öğretmenin branşı tanımlı değil" />
                ) : (
                  <>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                      Branşı "{teacher.brans}" olan derslerin tüm şubelerdeki listesi; öğretmeni olmayanlar üstte. Ders
                      havuzunda derse branş bağlanmamışsa burada görünmez.
                    </Typography.Paragraph>
                    <Input.Search
                      allowClear
                      size="small"
                      placeholder="Ders ara (ad veya kod)"
                      value={lessonSearch}
                      onChange={(e) => setLessonSearch(e.target.value)}
                      style={{ marginBottom: 8, maxWidth: 280 }}
                    />
                    <Table<TimetableAssignment>
                      rowKey="id"
                      size="small"
                      pagination={false}
                      loading={loading}
                      dataSource={branchLessons}
                      scroll={{ y: 520 }}
                      columns={lessonColumns(true)}
                      locale={{ emptyText: lessonQuery ? 'Aramanızla eşleşen ders yok.' : 'Bu branşa bağlı ders ataması yok.' }}
                    />
                  </>
                ),
              },
            ]}
          />
        </Col>
      </Row>
    </>
  )
}
