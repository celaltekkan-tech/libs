import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Card, List, Progress, Space, Spin, Statistic, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import {
  ApartmentOutlined,
  BankOutlined,
  CheckOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  ReadOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { AppLayout } from '../components/AppLayout'
import { ServerMetricsCard } from '../components/ServerMetricsCard'
import { SortableDashboard } from '../components/SortableDashboard'
import { useAuth } from '../auth/AuthContext'
import { listSchools } from '../api/schools'
import { listTeachers } from '../api/teachers'
import { listStudents } from '../api/students'
import { listTenants } from '../api/tenants'
import { listLicenses } from '../api/licenses'
import { listFeedback } from '../api/feedback'
import { completeWorkTask, listWorkTasks } from '../api/workTasks'
import { getErrorMessage } from '../api/client'
import type { Student } from '../types/student'
import { REGISTRATION_STATUS_OPTIONS } from '../types/student'
import type { TenantListItem } from '../types/tenant'
import type { License } from '../types/license'
import type { WorkTask, WorkTaskDueState } from '../types/workTask'
import {
  FEEDBACK_STATUS_LABEL,
  type Feedback,
  type FeedbackStatus,
} from '../types/feedback'

const FEEDBACK_STATUS_ORDER: FeedbackStatus[] = [
  'new',
  'read',
  'waiting',
  'resolved',
  'cancelled',
]

function countFeedbackByStatus(rows: Feedback[]): Record<FeedbackStatus, number> {
  const counts = Object.fromEntries(FEEDBACK_STATUS_ORDER.map((s) => [s, 0])) as Record<
    FeedbackStatus,
    number
  >
  for (const row of rows) {
    if (counts[row.status] != null) counts[row.status] += 1
  }
  return counts
}

const UPCOMING_HORIZON_DAYS = 7
const UPCOMING_LIST_LIMIT = 8

function workTaskDueTag(state: WorkTaskDueState, mandatory: boolean) {
  const icon = mandatory ? <ExclamationCircleOutlined /> : undefined
  switch (state) {
    case 'overdue':
      return (
        <Tag color="red" icon={icon}>
          Gecikmiş
        </Tag>
      )
    case 'due_soon':
      return <Tag color="orange">Yaklaşıyor</Tag>
    default:
      return <Tag color="blue">Zamanında</Tag>
  }
}

function isDashboardUpcomingTask(task: WorkTask, nowMs: number, horizonMs: number) {
  if (task.status !== 'active') return false
  if (task.due_state === 'done_period' || task.due_state === 'completed' || task.due_state === 'cancelled') {
    return false
  }
  const dueMs = new Date(task.next_due_at).getTime()
  if (Number.isNaN(dueMs)) return false
  if (task.due_state === 'overdue' || task.due_state === 'due_soon') return true
  return dueMs <= horizonMs && dueMs >= nowMs - 60_000
}

interface DashboardStats {
  schools: number | null
  teachers: number | null
  students: number | null
  studentsByStatus: Record<string, number>
  studentsByClass: Array<{ label: string; count: number }>
}

const emptyStats: DashboardStats = {
  schools: null,
  teachers: null,
  students: null,
  studentsByStatus: {},
  studentsByClass: [],
}

function safeCount<T>(promise: Promise<T[]>, allowed: boolean): Promise<number | null> {
  if (!allowed) return Promise.resolve(null)
  return promise.then((rows) => rows.length).catch(() => null)
}

function isLicenseExpired(license: License): boolean {
  if (license.status !== 'active') return false
  if (!license.ends_at) return false
  return new Date(license.ends_at).getTime() < Date.now()
}

function PlatformAdminDashboard() {
  const { message } = App.useApp()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [feedbackCounts, setFeedbackCounts] = useState<Record<FeedbackStatus, number> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tenantRows, licenseRows, feedbackRows] = await Promise.all([
        listTenants(),
        listLicenses(),
        listFeedback().catch(() => [] as Feedback[]),
      ])
      setTenants(tenantRows)
      setLicenses(licenseRows)
      setFeedbackCounts(countFeedbackByStatus(feedbackRows))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    const activeTenants = tenants.filter((t) => t.is_active).length
    const schoolTotal = tenants.reduce((sum, t) => sum + (t.school_count || 0), 0)
    const userTotal = tenants.reduce((sum, t) => sum + (t.user_count || 0), 0)
    const activeLicenses = licenses.filter((l) => l.status === 'active' && !isLicenseExpired(l)).length
    const expiredLicenses = licenses.filter((l) => isLicenseExpired(l)).length
    const cancelledLicenses = licenses.filter((l) => l.status === 'cancelled').length
    const planCounts = new Map<string, number>()
    licenses
      .filter((l) => l.status === 'active' && !isLicenseExpired(l))
      .forEach((l) => {
        planCounts.set(l.plan, (planCounts.get(l.plan) || 0) + 1)
      })

    return {
      tenantTotal: tenants.length,
      activeTenants,
      inactiveTenants: tenants.length - activeTenants,
      schoolTotal,
      userTotal,
      activeLicenses,
      expiredLicenses,
      cancelledLicenses,
      planCounts: Array.from(planCounts.entries())
        .map(([plan, count]) => ({ plan, count }))
        .sort((a, b) => b.count - a.count),
    }
  }, [tenants, licenses])

  const recentTenants = useMemo(
    () =>
      [...tenants]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
    [tenants],
  )

  const tenantColumns: ColumnsType<TenantListItem> = [
    { title: 'Hesap', dataIndex: 'name' },
    {
      title: 'Durum',
      dataIndex: 'is_active',
      width: 100,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Aktif' : 'Pasif'}</Tag>
      ),
    },
    { title: 'Okul', dataIndex: 'school_count', width: 80 },
    { title: 'Kullanıcı', dataIndex: 'user_count', width: 90 },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 120,
      render: (plan: string | null) => plan || '—',
    },
    {
      title: '',
      width: 90,
      render: (_: unknown, record) => (
        <Typography.Link onClick={() => navigate(`/platform/tenants/${record.id}`)}>
          Detay <RightOutlined />
        </Typography.Link>
      ),
    },
  ]

  const cards = [
    {
      key: 'tenants',
      title: 'Hesaplar (Tenant)',
      value: summary.tenantTotal,
      hint:
        summary.inactiveTenants > 0
          ? `${summary.activeTenants} aktif · ${summary.inactiveTenants} pasif`
          : `${summary.activeTenants} aktif`,
      detail: null as React.ReactNode,
      icon: <ApartmentOutlined />,
      color: '#1d4e89',
      path: '/platform/tenants',
    },
    {
      key: 'schools',
      title: 'Okullar',
      value: summary.schoolTotal,
      hint: 'Tüm hesaplar toplamı',
      detail: null as React.ReactNode,
      icon: <BankOutlined />,
      color: '#0f766e',
      path: '/platform/tenants',
    },
    {
      key: 'users',
      title: 'Kullanıcılar',
      value: summary.userTotal,
      hint: 'Tüm hesaplar toplamı',
      detail: null as React.ReactNode,
      icon: <UserOutlined />,
      color: '#7c3aed',
      path: '/platform/tenants',
    },
    {
      key: 'licenses',
      title: 'Aktif lisans',
      value: summary.activeLicenses,
      hint:
        summary.expiredLicenses > 0
          ? `${summary.expiredLicenses} süresi dolmuş · ${summary.cancelledLicenses} iptal`
          : `${summary.cancelledLicenses} iptal`,
      detail: null as React.ReactNode,
      icon: <IdcardOutlined />,
      color: '#b45309',
      path: '/platform/licenses',
    },
    {
      key: 'feedback',
      title: 'Geri bildirim',
      value: feedbackCounts
        ? FEEDBACK_STATUS_ORDER.reduce((sum, s) => sum + feedbackCounts[s], 0)
        : null,
      hint: null as string | null,
      detail: feedbackCounts ? (
        <Space size={[4, 4]} wrap style={{ marginTop: 8 }}>
          {FEEDBACK_STATUS_ORDER.map((status) => (
            <Tag key={status} color={FEEDBACK_STATUS_LABEL[status].color}>
              {FEEDBACK_STATUS_LABEL[status].text}: {feedbackCounts[status]}
            </Tag>
          ))}
        </Space>
      ) : null,
      icon: <CommentOutlined />,
      color: '#be123c',
      path: '/platform/feedback',
    },
  ]

  return (
    <AppLayout title="Ana Sayfa">
      <div style={{ width: '100%' }}>
        <Space
          direction="vertical"
          size={20}
          style={{ width: '100%', display: 'flex' }}
          styles={{ item: { width: '100%', minWidth: 0 } }}
        >
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Platform özeti
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Sunucu yükü, tenant, okul ve lisans durumlarının genel görünümü
            </Typography.Paragraph>
          </div>

          <div style={{ width: '100%', minWidth: 0 }}>
            <ServerMetricsCard />
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <SortableDashboard
              layoutKey={`platform:${session?.user.id ?? 0}`}
              widgets={[
                ...cards.map((card) => ({
                  id: card.key,
                  label: card.title,
                  span: { xs: 24, sm: 12, lg: 8 },
                  node: (
                    <Card
                      hoverable
                      onClick={() => navigate(card.path)}
                      styles={{ body: { padding: 20 } }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                        <div>
                          <Statistic
                            title={card.title}
                            value={card.value ?? '—'}
                            valueStyle={{ color: card.color, fontWeight: 600, fontSize: 28 }}
                          />
                          {card.hint && (
                            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                              {card.hint}
                            </Typography.Text>
                          )}
                          {card.detail}
                        </div>
                        <span
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `${card.color}14`,
                            color: card.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                          }}
                        >
                          {card.icon}
                        </span>
                      </Space>
                      <Typography.Link style={{ marginTop: 12, display: 'inline-flex', gap: 4 }}>
                        Detaya git <RightOutlined />
                      </Typography.Link>
                    </Card>
                  ),
                })),
                {
                  id: 'license-summary',
                  label: 'Lisans özeti',
                  span: { xs: 24, md: 10 },
                  node: (
                    <Card title="Lisans özeti">
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>Aktif</Typography.Text>
                          <Tag color="green">{summary.activeLicenses}</Tag>
                        </Space>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>Süresi dolmuş</Typography.Text>
                          <Tag color="orange">{summary.expiredLicenses}</Tag>
                        </Space>
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Typography.Text>İptal</Typography.Text>
                          <Tag>{summary.cancelledLicenses}</Tag>
                        </Space>
                        {summary.planCounts.length > 0 && (
                          <>
                            <Typography.Text type="secondary">Aktif plan dağılımı</Typography.Text>
                            {summary.planCounts.map((row) => (
                              <Space key={row.plan} style={{ width: '100%', justifyContent: 'space-between' }}>
                                <Typography.Text>{row.plan}</Typography.Text>
                                <Typography.Text strong>{row.count}</Typography.Text>
                              </Space>
                            ))}
                          </>
                        )}
                      </Space>
                    </Card>
                  ),
                },
                {
                  id: 'recent-tenants',
                  label: 'Son hesaplar',
                  span: { xs: 24, md: 14 },
                  node: (
                    <Card
                      title="Son hesaplar"
                      extra={
                        <Typography.Link onClick={() => navigate('/platform/tenants')}>
                          Tümü
                        </Typography.Link>
                      }
                    >
                      <SortableTable
                        rowKey="id"
                        size="small"
                        pagination={false}
                        columns={tenantColumns}
                        dataSource={recentTenants}
                        locale={{ emptyText: 'Henüz hesap yok' }}
                        scroll={{ x: 'max-content' }}
                      />
                    </Card>
                  ),
                },
              ]}
            />
          )}
        </Space>
      </div>
    </AppLayout>
  )
}

export function DashboardPage() {
  const { message } = App.useApp()
  const { session, hasModule, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [students, setStudents] = useState<Student[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<WorkTask[]>([])
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null)

  const canSchools = hasModule('schools') && hasPermission('schools.read')
  const canTeachers = hasModule('teachers') && hasPermission('teachers.read')
  const canStudents = hasModule('students') && hasPermission('students.read')
  const canWorkTasks = hasPermission('work_tasks.read')
  const canUpdateWorkTasks = hasPermission('work_tasks.update')

  const load = useCallback(async () => {
    if (session?.is_platform_admin) return
    setLoading(true)
    try {
      const [schoolCount, teacherCount, studentRows, workTaskRows] = await Promise.all([
        safeCount(listSchools(), canSchools),
        safeCount(listTeachers({ scope: 'teachers' }), canTeachers),
        canStudents ? listStudents().catch(() => null) : Promise.resolve(null),
        canWorkTasks ? listWorkTasks({ status: 'active' }).catch(() => []) : Promise.resolve([]),
      ])

      const studentList = studentRows || []
      const byStatus: Record<string, number> = {}
      const byClassMap = new Map<string, number>()

      studentList.forEach((s) => {
        const status = s.registration_status || 'aktif'
        byStatus[status] = (byStatus[status] || 0) + 1
        const cls = s.class_level || 'Belirtilmemiş'
        byClassMap.set(cls, (byClassMap.get(cls) || 0) + 1)
      })

      const byClass = Array.from(byClassMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)

      const nowMs = Date.now()
      const horizonMs = nowMs + UPCOMING_HORIZON_DAYS * 24 * 60 * 60 * 1000
      const upcoming = (workTaskRows || [])
        .filter((task) => isDashboardUpcomingTask(task, nowMs, horizonMs))
        .sort((a, b) => new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime())
        .slice(0, UPCOMING_LIST_LIMIT)

      setStudents(studentList)
      setUpcomingTasks(upcoming)
      setStats({
        schools: schoolCount,
        teachers: teacherCount,
        students: studentRows ? studentRows.length : null,
        studentsByStatus: byStatus,
        studentsByClass: byClass,
      })
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [canSchools, canTeachers, canStudents, canWorkTasks, message, session?.is_platform_admin])

  useEffect(() => {
    void load()
  }, [load])

  const statusTotal = useMemo(
    () => Object.values(stats.studentsByStatus).reduce((sum, n) => sum + n, 0) || 1,
    [stats.studentsByStatus],
  )

  const onCompleteUpcoming = async (task: WorkTask) => {
    setCompletingTaskId(task.id)
    try {
      await completeWorkTask(task.id)
      message.success('Görev tamamlandı')
      void load()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCompletingTaskId(null)
    }
  }

  if (session?.is_platform_admin) {
    return <PlatformAdminDashboard />
  }

  const cards = [
    {
      key: 'schools',
      title: 'Okullar',
      value: canSchools ? stats.schools : session?.schools.length ?? 0,
      suffix: canSchools ? undefined : 'bağlı',
      icon: <BankOutlined />,
      color: '#1d4e89',
      path: canSchools ? '/schools' : null,
      visible: canSchools || (session?.schools.length ?? 0) > 0,
    },
    {
      key: 'teachers',
      title: 'Öğretmenler',
      value: stats.teachers,
      icon: <TeamOutlined />,
      color: '#0f766e',
      path: '/teachers',
      visible: canTeachers,
    },
    {
      key: 'students',
      title: 'Öğrenciler',
      value: stats.students,
      icon: <ReadOutlined />,
      color: '#b45309',
      path: '/students',
      visible: canStudents,
    },
  ].filter((c) => c.visible)

  return (
    <AppLayout title="Ana Sayfa">
      <div style={{ width: '100%' }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Merhaba, {session?.user.full_name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Okul, öğretmen, öğrenci ve yaklaşan iş özetiniz
              {session?.license?.plan ? ` · Plan: ${session.license.plan}` : ''}
            </Typography.Paragraph>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <SortableDashboard
              layoutKey={`tenant:${session?.user.id ?? 0}`}
              widgets={[
                ...cards.map((card) => ({
                  id: card.key,
                  label: card.title,
                  span: { xs: 24, sm: 12, md: 8 },
                  node: (
                    <Card
                      hoverable={Boolean(card.path)}
                      onClick={() => card.path && navigate(card.path)}
                      styles={{ body: { padding: 20 } }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Statistic
                            title={card.title}
                            value={card.value ?? '—'}
                            suffix={card.suffix}
                            valueStyle={{ color: card.color, fontWeight: 600 }}
                          />
                        </div>
                        <span
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: `${card.color}14`,
                            color: card.color,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 20,
                            flexShrink: 0,
                          }}
                        >
                          {card.icon}
                        </span>
                      </Space>
                      {card.path && (
                        <Typography.Link style={{ marginTop: 12, display: 'inline-flex', gap: 4 }}>
                          Detaya git <RightOutlined />
                        </Typography.Link>
                      )}
                    </Card>
                  ),
                })),
                ...(canWorkTasks
                  ? [
                      {
                        id: 'upcoming-work-tasks',
                        label: 'Yaklaşan işler',
                        span: { xs: 24, md: 24 },
                        node: (
                          <Card
                            title="Yaklaşan işler"
                            extra={
                              <Typography.Link onClick={() => navigate('/work-tasks')}>
                                Tümü <RightOutlined />
                              </Typography.Link>
                            }
                          >
                            {upcomingTasks.length === 0 ? (
                              <Typography.Text type="secondary">
                                Önümüzdeki {UPCOMING_HORIZON_DAYS} günde yaklaşan veya gecikmiş aktif görev yok.
                              </Typography.Text>
                            ) : (
                              <List
                                size="small"
                                dataSource={upcomingTasks}
                                renderItem={(task) => {
                                  const isAssignee = session?.user.id === task.assignee_user_id
                                  const canComplete =
                                    task.due_state !== 'done_period' && (isAssignee || canUpdateWorkTasks)
                                  return (
                                    <List.Item
                                      actions={
                                        canComplete
                                          ? [
                                              <Button
                                                key="done"
                                                size="small"
                                                type="link"
                                                icon={<CheckOutlined />}
                                                loading={completingTaskId === task.id}
                                                onClick={() => void onCompleteUpcoming(task)}
                                              >
                                                Yapıldı
                                              </Button>,
                                            ]
                                          : undefined
                                      }
                                    >
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <Space wrap size={6} style={{ marginBottom: 2 }}>
                                          {task.is_mandatory && (
                                            <ExclamationCircleOutlined style={{ color: '#cf1322' }} />
                                          )}
                                          <Typography.Text strong style={{ fontSize: 15 }}>
                                            {task.title}
                                          </Typography.Text>
                                          {workTaskDueTag(task.due_state, task.is_mandatory)}
                                        </Space>
                                        <div>
                                          <Typography.Text type="secondary">
                                            {dayjs(task.next_due_at).format('DD.MM.YYYY HH:mm')}
                                            {' · '}
                                            {task.Assignee?.full_name || 'Atanmamış'}
                                          </Typography.Text>
                                        </div>
                                      </div>
                                    </List.Item>
                                  )
                                }}
                              />
                            )}
                          </Card>
                        ),
                      },
                    ]
                  : []),
                ...(canStudents
                  ? [
                      {
                        id: 'students-status',
                        label: 'Öğrenci kayıt durumu',
                        span: { xs: 24, md: 12 },
                        node: (
                          <Card title="Öğrenci kayıt durumu">
                            {students.length === 0 ? (
                              <Typography.Text type="secondary">Henüz öğrenci kaydı yok.</Typography.Text>
                            ) : (
                              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                {REGISTRATION_STATUS_OPTIONS.map((opt) => {
                                  const count = stats.studentsByStatus[opt.value] || 0
                                  const pct = Math.round((count / statusTotal) * 100)
                                  return (
                                    <div key={opt.value}>
                                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Typography.Text>{opt.label}</Typography.Text>
                                        <Typography.Text strong>{count}</Typography.Text>
                                      </Space>
                                      <Progress percent={pct} showInfo={false} strokeColor="#1d4e89" size="small" />
                                    </div>
                                  )
                                })}
                              </Space>
                            )}
                          </Card>
                        ),
                      },
                      {
                        id: 'students-by-class',
                        label: 'Sınıflara göre öğrenci',
                        span: { xs: 24, md: 12 },
                        node: (
                          <Card title="Sınıflara göre öğrenci">
                            {stats.studentsByClass.length === 0 ? (
                              <Typography.Text type="secondary">Sınıf bilgisi bulunamadı.</Typography.Text>
                            ) : (
                              <List
                                size="small"
                                dataSource={stats.studentsByClass}
                                renderItem={(item) => (
                                  <List.Item>
                                    <Typography.Text>{item.label}</Typography.Text>
                                    <Tag color="blue">{item.count}</Tag>
                                  </List.Item>
                                )}
                              />
                            )}
                          </Card>
                        ),
                      },
                    ]
                  : []),
                ...((session?.schools.length ?? 0) > 0
                  ? [
                      {
                        id: 'linked-schools',
                        label: 'Bağlı okullarınız',
                        span: { xs: 24, md: canStudents ? 24 : 12 },
                        node: (
                          <Card title="Bağlı okullarınız">
                            <Space wrap>
                              {session!.schools.map((school) => (
                                <Tag key={school.id} color="geekblue">
                                  {school.name}
                                  {school.role ? ` · ${school.role}` : ''}
                                </Tag>
                              ))}
                            </Space>
                          </Card>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </Space>
      </div>
    </AppLayout>
  )
}
