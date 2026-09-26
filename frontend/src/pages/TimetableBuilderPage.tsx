import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Checkbox, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, Tabs, Tag, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import {
  createTimetableProject,
  deleteTimetableProject,
  fetchTimetableMeta,
  getTimetableProject,
  listTimetableProjects,
  listTimetableRooms,
} from '../api/timetable'
import { fetchCurrentAcademicYear } from '../api/academicYears'
import { listClassrooms } from '../api/classrooms'
import { listTeachers } from '../api/teachers'
import { listSubjects } from '../api/subjects'
import { getErrorMessage } from '../api/client'
import { DAY_OPTIONS } from '../types/scheduleEntry'
import { sortClassrooms, type Classroom } from '../types/classroom'
import type { Subject } from '../types/subject'
import type { Teacher } from '../types/teacher'
import type { TimetableMeta, TimetableProject, TimetableProjectPayload, TimetableRoom } from '../types/timetable'
import { ProjectSettingsTab } from '../components/timetable/ProjectSettingsTab'
import { LessonPoolTab } from '../components/timetable/LessonPoolTab'
import { RoomsTab } from '../components/timetable/RoomsTab'
import { AssignmentsTab } from '../components/timetable/AssignmentsTab'
import { ConstraintsTab } from '../components/timetable/ConstraintsTab'
import { SolveTab } from '../components/timetable/SolveTab'
import { TimetableGridTab } from '../components/timetable/TimetableGridTab'
import type { TimetableCtx } from '../components/timetable/shared'

const STATUS_TAG: Record<TimetableProject['status'], { label: string; color: string }> = {
  taslak: { label: 'Taslak', color: 'default' },
  yayinda: { label: 'Yayında', color: 'green' },
  arsiv: { label: 'Arşiv', color: 'default' },
}

function storageKey(schoolId: number) {
  return `timetable.project.${schoolId}`
}

export function TimetableBuilderPage() {
  const { message } = App.useApp()
  const { hasPermission } = useAuth()
  const { activeSchoolId } = useActiveSchool()
  const [meta, setMeta] = useState<TimetableMeta | null>(null)
  const [projects, setProjects] = useState<TimetableProject[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [project, setProject] = useState<TimetableProject | null>(null)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [rooms, setRooms] = useState<TimetableRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('settings')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm<TimetableProjectPayload>()

  const canCreate = hasPermission('schedule.create')
  const canUpdate = hasPermission('schedule.update')
  const canDelete = hasPermission('schedule.delete')

  const loadProjects = useCallback(async () => {
    if (!activeSchoolId) return []
    const list = await listTimetableProjects(activeSchoolId)
    setProjects(list)
    return list
  }, [activeSchoolId])

  // Okul değişince tüm referans verileri yeniden yüklenir.
  useEffect(() => {
    if (!activeSchoolId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [m, list, cls, tch, sbj, rms] = await Promise.all([
          fetchTimetableMeta(),
          listTimetableProjects(activeSchoolId),
          listClassrooms({ school_id: activeSchoolId, is_active: true }),
          listTeachers({ scope: 'teachers', school_id: activeSchoolId }),
          listSubjects({ is_active: true }),
          listTimetableRooms(activeSchoolId),
        ])
        if (cancelled) return
        setMeta(m)
        setProjects(list)
        setClassrooms(sortClassrooms(cls))
        setTeachers(tch.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'tr')))
        setSubjects(sbj)
        setRooms(rms)
        let saved: number | null = null
        try {
          saved = Number(localStorage.getItem(storageKey(activeSchoolId))) || null
        } catch {
          saved = null
        }
        const pick = list.find((p) => p.id === saved) || list[0] || null
        setProjectId(pick?.id ?? null)
      } catch (err) {
        message.error(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSchoolId, message])

  const reloadProject = useCallback(async () => {
    if (!projectId) {
      setProject(null)
      return
    }
    try {
      setProject(await getTimetableProject(projectId))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [projectId, message])

  useEffect(() => {
    void reloadProject()
    if (projectId && activeSchoolId) {
      try {
        localStorage.setItem(storageKey(activeSchoolId), String(projectId))
      } catch {
        // tarayıcı depolaması kapalı olabilir
      }
    }
  }, [projectId, activeSchoolId, reloadProject])

  const reloadRooms = useCallback(async () => {
    if (!activeSchoolId) return
    setRooms(await listTimetableRooms(activeSchoolId))
  }, [activeSchoolId])

  const openCreate = async () => {
    createForm.resetFields()
    let year: string | null = null
    try {
      year = (await fetchCurrentAcademicYear())?.label ?? null
    } catch {
      year = null
    }
    createForm.setFieldsValue({
      name: year ? `${year} Ders Programı` : 'Ders Programı',
      academic_year: year,
      days: [1, 2, 3, 4, 5],
      periods_per_day: 8,
      lunch_after: null,
    })
    setCreateOpen(true)
  }

  const onCreate = async () => {
    if (!activeSchoolId) return
    const values = await createForm.validateFields()
    try {
      const created = await createTimetableProject({ ...values, school_id: activeSchoolId })
      setCreateOpen(false)
      await loadProjects()
      setProjectId(created.id)
      setTab('settings')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDelete = async () => {
    if (!project) return
    try {
      await deleteTimetableProject(project.id)
      const list = await loadProjects()
      setProjectId(list[0]?.id ?? null)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const ctx: TimetableCtx | null = useMemo(
    () =>
      project && meta
        ? { project, classrooms, teachers, subjects, rooms, meta, canCreate, canUpdate, canDelete, reloadProject, reloadRooms }
        : null,
    [project, meta, classrooms, teachers, subjects, rooms, canCreate, canUpdate, canDelete, reloadProject, reloadRooms],
  )

  return (
    <AppLayout title="Otomatik Ders Programı">
      <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Otomatik Ders Programı
          </Typography.Title>
          <Typography.Text type="secondary">
            Sırayla ilerleyin: okul saatleri, ders havuzu, hangi derse kim girecek, istekler, sonra programı oluşturun.
          </Typography.Text>
        </div>
        <Space wrap>
          <Select
            style={{ width: 280 }}
            placeholder="Program çalışması seçin"
            value={projectId ?? undefined}
            onChange={setProjectId}
            loading={loading}
            options={projects.map((p) => ({
              value: p.id,
              label: (
                <Space>
                  {p.name}
                  <Tag color={STATUS_TAG[p.status].color}>{STATUS_TAG[p.status].label}</Tag>
                </Space>
              ),
            }))}
          />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} disabled={!activeSchoolId}>
              Yeni Çalışma
            </Button>
          )}
          {canDelete && project && (
            <Popconfirm
              title="Çalışma silinsin mi?"
              description="Atamalar, kısıtlar ve taslak program silinir. Yayınlanmış ders programı etkilenmez."
              okText="Sil"
              okButtonProps={{ danger: true }}
              cancelText="Vazgeç"
              onConfirm={onDelete}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      </Space>

      {!activeSchoolId ? (
        <Empty description="Önce üst menüden bir okul seçin" />
      ) : loading ? (
        <Spin />
      ) : !ctx ? (
        <Empty description="Henüz program çalışması yok">
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Yeni Çalışma Oluştur
            </Button>
          )}
        </Empty>
      ) : (
        <>
          {project?.status === 'yayinda' && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 12 }}
              message="Bu çalışma yayında. Değişiklik yapıp tekrar yayınlarsanız ders programı güncellenir."
            />
          )}
          <Tabs
            activeKey={tab}
            onChange={setTab}
            destroyOnHidden
            items={[
              { key: 'settings', label: '1. Okul saatleri', children: <ProjectSettingsTab ctx={ctx} /> },
              { key: 'pool', label: '2. Ders havuzu', children: <LessonPoolTab ctx={ctx} /> },
              {
                key: 'assignments',
                label: `3. Ders ve öğretmen (${project?.counts?.assignments ?? 0})`,
                children: <AssignmentsTab ctx={ctx} />,
              },
              { key: 'rooms', label: `Özel derslik (${rooms.length})`, children: <RoomsTab ctx={ctx} /> },
              {
                key: 'constraints',
                label: `4. İstekler (${project?.counts?.constraints ?? 0})`,
                children: <ConstraintsTab ctx={ctx} />,
              },
              { key: 'solve', label: '5. Programı oluştur', children: <SolveTab ctx={ctx} onShowGrid={() => setTab('grid')} /> },
              {
                key: 'grid',
                label: `6. Ders programı${project?.counts?.lessons ? ` (${project.counts.lessons})` : ''}`,
                children: <TimetableGridTab ctx={ctx} />,
              },
            ]}
          />
        </>
      )}

      <Modal
        open={createOpen}
        title="Yeni Program Çalışması"
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="Ad" rules={[{ required: true, message: 'Ad gerekli' }]}>
            <Input maxLength={150} />
          </Form.Item>
          <Form.Item name="academic_year" label="Eğitim öğretim yılı">
            <Input placeholder="2026-2027" maxLength={20} />
          </Form.Item>
          <Form.Item name="days" label="Ders günleri" rules={[{ required: true, message: 'Gün seçin' }]}>
            <Checkbox.Group options={DAY_OPTIONS} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="periods_per_day" label="Günlük ders saati" rules={[{ required: true }]}>
              <InputNumber min={1} max={12} />
            </Form.Item>
            <Form.Item name="lunch_after" label="Öğle arası (kaçıncı saatten sonra)">
              <InputNumber min={1} max={11} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </AppLayout>
  )
}
