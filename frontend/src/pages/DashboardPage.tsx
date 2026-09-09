import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Card, Col, List, Progress, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  BankOutlined,
  CommentOutlined,
  IdcardOutlined,
  ReadOutlined,
  RightOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { AppLayout } from '../components/AppLayout'
import { useAuth } from '../auth/AuthContext'
import { listSchools } from '../api/schools'
import { listTeachers } from '../api/teachers'
import { listStudents } from '../api/students'
import { listTenants } from '../api/tenants'
import { listLicenses } from '../api/licenses'
import { listFeedback } from '../api/feedback'
import { getErrorMessage } from '../api/client'
import type { Student } from '../types/student'
import { REGISTRATION_STATUS_OPTIONS } from '../types/student'
import type { TenantListItem } from '../types/tenant'
import type { License } from '../types/license'

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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [pendingFeedback, setPendingFeedback] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tenantRows, licenseRows, feedbackRows] = await Promise.all([
        listTenants(),
        listLicenses(),
        listFeedback({ status: 'pending' }).catch(() => []),
      ])
      setTenants(tenantRows)
      setLicenses(licenseRows)
      setPendingFeedback(feedbackRows.length)
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
      icon: <ApartmentOutlined />,
      color: '#1d4e89',
      path: '/platform/tenants',
    },
    {
      key: 'schools',
      title: 'Okullar',
      value: summary.schoolTotal,
      hint: 'Tüm hesaplar toplamı',
      icon: <BankOutlined />,
      color: '#0f766e',
      path: '/platform/tenants',
    },
    {
      key: 'users',
      title: 'Kullanıcılar',
      value: summary.userTotal,
      hint: 'Tüm hesaplar toplamı',
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
      icon: <IdcardOutlined />,
      color: '#b45309',
      path: '/platform/licenses',
    },
    {
      key: 'feedback',
      title: 'Bekleyen geri bildirim',
      value: pendingFeedback,
      hint: 'Yeni / inceleniyor',
      icon: <CommentOutlined />,
      color: '#be123c',
      path: '/platform/feedback',
    },
  ]

  return (
    <AppLayout title="Ana Sayfa">
      <div style={{ maxWidth: 1200 }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Platform özeti
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Tenant, okul ve lisans durumlarının genel görünümü
            </Typography.Paragraph>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {cards.map((card) => (
                  <Col xs={24} sm={12} lg={8} key={card.key}>
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
                  </Col>
                ))}
              </Row>

              <Row gutter={[16, 16]}>
                <Col xs={24} md={10}>
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
                </Col>

                <Col xs={24} md={14}>
                  <Card
                    title="Son hesaplar"
                    extra={
                      <Typography.Link onClick={() => navigate('/platform/tenants')}>
                        Tümü
                      </Typography.Link>
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={tenantColumns}
                      dataSource={recentTenants}
                      locale={{ emptyText: 'Henüz hesap yok' }}
                    />
                  </Card>
                </Col>
              </Row>
            </>
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

  const canSchools = hasModule('schools') && hasPermission('schools.read')
  const canTeachers = hasModule('teachers') && hasPermission('teachers.read')
  const canStudents = hasModule('students') && hasPermission('students.read')

  const load = useCallback(async () => {
    if (session?.is_platform_admin) return
    setLoading(true)
    try {
      const [schoolCount, teacherCount, studentRows] = await Promise.all([
        safeCount(listSchools(), canSchools),
        safeCount(listTeachers(), canTeachers),
        canStudents ? listStudents().catch(() => null) : Promise.resolve(null),
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

      setStudents(studentList)
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
  }, [canSchools, canTeachers, canStudents, message, session?.is_platform_admin])

  useEffect(() => {
    void load()
  }, [load])

  const statusTotal = useMemo(
    () => Object.values(stats.studentsByStatus).reduce((sum, n) => sum + n, 0) || 1,
    [stats.studentsByStatus],
  )

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
      <div style={{ maxWidth: 1100 }}>
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Merhaba, {session?.user.full_name}
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Okul, öğretmen ve öğrenci özetiniz
              {session?.license?.plan ? ` · Plan: ${session.license.plan}` : ''}
            </Typography.Paragraph>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              <Row gutter={[16, 16]}>
                {cards.map((card) => (
                  <Col xs={24} sm={12} md={8} key={card.key}>
                    <Card
                      hoverable={Boolean(card.path)}
                      onClick={() => card.path && navigate(card.path)}
                      styles={{ body: { padding: 20 } }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                        <Statistic
                          title={card.title}
                          value={card.value ?? '—'}
                          suffix={card.suffix}
                          valueStyle={{ color: card.color, fontWeight: 600 }}
                        />
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
                      {card.path && (
                        <Typography.Link style={{ marginTop: 12, display: 'inline-flex', gap: 4 }}>
                          Detaya git <RightOutlined />
                        </Typography.Link>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>

              <Row gutter={[16, 16]}>
                {canStudents && (
                  <Col xs={24} md={12}>
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
                  </Col>
                )}

                {canStudents && (
                  <Col xs={24} md={12}>
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
                  </Col>
                )}

                {(session?.schools.length ?? 0) > 0 && (
                  <Col xs={24} md={canStudents ? 24 : 12}>
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
                  </Col>
                )}
              </Row>
            </>
          )}
        </Space>
      </div>
    </AppLayout>
  )
}
