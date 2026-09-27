import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Checkbox, Col, Empty, Row, Space, Table, Tag, Typography, theme } from 'antd'
import { SaveOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getElectives, listTimetableAssignments, saveElectives } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import type { ElectiveStudent, TimetableAssignment } from '../../types/timetable'
import { assignmentTeacherIds, shortClassroom, teacherFullName, type TimetableCtx } from './shared'

type Choices = Record<number, number[]>

export function ElectivesTab({ ctx }: { ctx: TimetableCtx }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { project } = ctx
  const [rows, setRows] = useState<TimetableAssignment[]>([])
  const [classId, setClassId] = useState<number | null>(null)
  const [students, setStudents] = useState<ElectiveStudent[]>([])
  const [choices, setChoices] = useState<Choices>({})
  const [saved, setSaved] = useState<Choices>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const editable = ctx.canUpdate

  const loadAssignments = useCallback(async () => {
    try {
      setRows(await listTimetableAssignments(project.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [project.id, message])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  const electives = useMemo(() => rows.filter((a) => a.elective_group), [rows])
  const classes = useMemo(() => {
    const ids = new Set(electives.map((a) => a.classroom_id))
    return ctx.classrooms.filter((c) => ids.has(c.id))
  }, [electives, ctx.classrooms])

  useEffect(() => {
    if (!classes.length) setClassId(null)
    else if (!classes.some((c) => c.id === classId)) setClassId(classes[0].id)
  }, [classes, classId])

  const loadClass = useCallback(async () => {
    if (!classId) return
    setLoading(true)
    try {
      const data = await getElectives(project.id, classId)
      const map: Choices = {}
      for (const c of data.choices) (map[c.student_id] ||= []).push(c.assignment_id)
      setStudents(data.students)
      setChoices(map)
      setSaved(map)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [project.id, classId, message])

  useEffect(() => {
    void loadClass()
  }, [loadClass])

  const classElectives = useMemo(() => electives.filter((a) => a.classroom_id === classId), [electives, classId])
  const groups = useMemo(() => {
    const map = new Map<string, TimetableAssignment[]>()
    for (const a of classElectives) map.set(a.elective_group!, [...(map.get(a.elective_group!) || []), a])
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [classElectives])
  const groupOf = useMemo(() => new Map(classElectives.map((a) => [a.id, a.elective_group!])), [classElectives])
  const teacherById = useMemo(() => new Map(ctx.teachers.map((t) => [t.id, t])), [ctx.teachers])

  const dirty = JSON.stringify(normalize(choices)) !== JSON.stringify(normalize(saved))

  // Aynı gruptaki seçmeliler alternatiftir: bir öğrenci gruptan tek ders alır.
  const toggle = (studentId: number, assignmentId: number, checked: boolean) => {
    setChoices((prev) => {
      const group = groupOf.get(assignmentId)
      const rest = (prev[studentId] || []).filter((id) => id !== assignmentId && groupOf.get(id) !== group)
      return { ...prev, [studentId]: checked ? [...rest, assignmentId] : rest }
    })
  }

  const assignAll = (assignmentId: number) => {
    setChoices((prev) => {
      const next: Choices = { ...prev }
      const group = groupOf.get(assignmentId)
      for (const s of students) {
        const current = next[s.id] || []
        if (current.some((id) => groupOf.get(id) === group)) continue
        next[s.id] = [...current, assignmentId]
      }
      return next
    })
  }

  const onSave = async () => {
    if (!classId) return
    setSaving(true)
    try {
      const payload = students
        .map((s) => ({ student_id: s.id, assignment_ids: choices[s.id] || [] }))
        .filter((c) => c.assignment_ids.length)
      await saveElectives(project.id, classId, payload)
      setSaved(choices)
      message.success('Seçmeli seçimleri kaydedildi')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => {
    const map = new Map<number, number>()
    for (const ids of Object.values(choices)) for (const id of ids) map.set(id, (map.get(id) || 0) + 1)
    return map
  }, [choices])

  const missing = useMemo(
    () =>
      groups
        .map(([g]) => ({
          group: g,
          count: students.filter((s) => !(choices[s.id] || []).some((id) => groupOf.get(id) === g)).length,
        }))
        .filter((x) => x.count > 0),
    [groups, students, choices, groupOf],
  )
  const hasAny = Object.values(saved).some((ids) => ids.length)

  const columns: ColumnsType<ElectiveStudent> = [
    { title: 'No', dataIndex: 'student_number', width: 70, fixed: 'left' },
    {
      title: 'Öğrenci',
      key: 'name',
      width: 200,
      fixed: 'left',
      render: (_, s) => `${s.first_name} ${s.last_name}`,
    },
    ...groups.map(([g, list]) => ({
      title: `Grup: ${g}`,
      children: list.map((a) => ({
        title: (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
            <span>{a.Subject?.name}</span>
            <span style={{ fontSize: 11, fontWeight: 400, color: '#6b7280' }}>
              {assignmentTeacherIds(a)
                .map((id) => teacherFullName(teacherById.get(id)))
                .join(', ') || 'öğretmen yok'}
            </span>
            <Space size={4}>
              <Tag style={{ marginInlineEnd: 0 }}>{counts.get(a.id) || 0} öğr.</Tag>
              {editable && (
                <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={() => assignAll(a.id)}>
                  seçmeyenler
                </Button>
              )}
            </Space>
          </Space>
        ),
        key: `a-${a.id}`,
        width: 150,
        align: 'center' as const,
        render: (_: unknown, s: ElectiveStudent) => (
          <Checkbox
            checked={(choices[s.id] || []).includes(a.id)}
            disabled={!editable}
            onChange={(e) => toggle(s.id, a.id, e.target.checked)}
          />
        ),
      })),
    })),
  ]

  return (
    <>
      <Typography.Paragraph type="secondary">
        Şubenin öğrencileri seçmelilere bölünüyorsa her öğrencinin hangi seçmeliyi aldığını işaretleyin. Aynı
        gruptaki dersler alternatiftir; öğrenci gruptan birini alır ve bu dersler aynı saatte paralel işlenebilir.
        Seçim girilen şubede çakışma öğrenci bazında denetlenir: ortak öğrencisi olan iki ders aynı saate konmaz.
        Seçim girilmezse aynı gruptaki dersler paralel, farklı gruptakiler ayrı saatlerde kabul edilir. Seçmeli
        grubu "Sınıfa ders verme" adımında yazılır.
      </Typography.Paragraph>
      {!classes.length ? (
        <Empty description='Seçmeli grubu tanımlı ders yok. "Sınıfa ders verme" adımında alternatif seçmelilere aynı grup kodunu yazın.' />
      ) : (
        <Row gutter={12}>
          <Col xs={24} xl={5}>
            <Card size="small" title="Seçmelisi olan şubeler" styles={{ body: { padding: 0 } }}>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={classes}
                onRow={(c) => ({
                  onClick: () => {
                    if (dirty && c.id !== classId) {
                      message.warning('Önce bu şubenin seçimlerini kaydedin veya geri alın')
                      return
                    }
                    setClassId(c.id)
                  },
                  style: { cursor: 'pointer', background: c.id === classId ? token.colorPrimaryBg : undefined, color: token.colorText },
                })}
                columns={[
                  { title: 'Şube', key: 'n', render: (_, c) => shortClassroom(c) },
                  {
                    title: 'Seçmeli',
                    key: 'e',
                    width: 70,
                    render: (_, c) => electives.filter((a) => a.classroom_id === c.id).length,
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={19}>
            <Card
              size="small"
              title={classId ? `${shortClassroom(ctx.classrooms.find((c) => c.id === classId))} — ${students.length} öğrenci` : ''}
              extra={
                editable && (
                  <Space>
                    <Button icon={<UndoOutlined />} disabled={!dirty} onClick={() => setChoices(saved)}>
                      Geri al
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} disabled={!dirty} loading={saving} onClick={onSave}>
                      Kaydet
                    </Button>
                  </Space>
                )
              }
            >
              {!hasAny && !dirty && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message="Bu şubede seçim girilmedi; programda aynı gruptaki seçmeliler paralel kabul edilir."
                />
              )}
              {(hasAny || dirty) && missing.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 8 }}
                  message={missing.map((m) => `${m.group} grubundan seçim yapmayan ${m.count} öğrenci`).join(' · ')}
                />
              )}
              <Table<ElectiveStudent>
                rowKey="id"
                size="small"
                bordered
                loading={loading}
                pagination={false}
                dataSource={students}
                columns={columns}
                scroll={{ x: 270 + classElectives.length * 150, y: 560 }}
                locale={{ emptyText: 'Bu şubede kayıtlı öğrenci yok' }}
              />
            </Card>
          </Col>
        </Row>
      )}
    </>
  )
}

function normalize(c: Choices): Array<[string, number[]]> {
  return Object.entries(c)
    .map(([k, v]) => [k, [...v].sort((a, b) => a - b)] as [string, number[]])
    .filter(([, v]) => v.length)
    .sort((a, b) => a[0].localeCompare(b[0]))
}
