import type { ReactNode } from 'react'
import {
  AlertOutlined,
  AuditOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  CommentOutlined,
  ContactsOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  HomeOutlined,
  IdcardOutlined,
  MailOutlined,
  NotificationOutlined,
  ReadOutlined,
  RiseOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  AppstoreOutlined,
  TableOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'

export interface NavLeaf {
  key: string
  icon?: ReactNode
  label: string
}

export interface NavGroup {
  key: string
  icon: ReactNode
  label: string
  children: NavLeaf[]
}

export type NavNode = NavLeaf | NavGroup

export function isNavGroup(item: NavNode): item is NavGroup {
  return 'children' in item && Array.isArray(item.children)
}

export function flattenNavLeaves(nodes: NavNode[]): NavLeaf[] {
  const out: NavLeaf[] = []
  for (const node of nodes) {
    if (isNavGroup(node)) out.push(...node.children)
    else out.push(node)
  }
  return out
}

const GROUP_ICONS: Record<string, ReactNode> = {
  'grp-definitions': <AppstoreOutlined />,
  'grp-personnel': <SolutionOutlined />,
  'grp-programs': <ScheduleOutlined />,
  'grp-students': <ReadOutlined />,
  'grp-system': <SettingOutlined />,
}

export function groupIconFor(key: string): ReactNode {
  return GROUP_ICONS[key] || <AppstoreOutlined />
}

export function buildTenantMenu(opts: {
  hasModule: (m: string) => boolean
}): NavNode[] {
  const { hasModule } = opts
  const nodes: NavNode[] = [{ key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' }]

  const definitions: NavLeaf[] = []
  if (hasModule('schools')) {
    definitions.push({ key: '/schools', icon: <BankOutlined />, label: 'Okullar' })
  }
  if (hasModule('classrooms')) {
    definitions.push({ key: '/classrooms', icon: <ClusterOutlined />, label: 'Sınıflar' })
  }
  if (hasModule('students')) {
    definitions.push({ key: '/students', icon: <ReadOutlined />, label: 'Öğrenciler' })
  }
  if (hasModule('teachers')) {
    definitions.push({ key: '/teachers', icon: <TeamOutlined />, label: 'Öğretmenler' })
    definitions.push({
      key: '/other-personnel',
      icon: <ContactsOutlined />,
      label: 'Diğer Personeller',
    })
  }
  if (hasModule('schedule')) {
    definitions.push({ key: '/subjects', icon: <IdcardOutlined />, label: 'Dersler' })
  }
  definitions.push({
    key: '/academic-years',
    icon: <CalendarOutlined />,
    label: 'Eğitim Öğretim Yılları',
  })
  if (definitions.length > 0) {
    nodes.push({
      key: 'grp-definitions',
      icon: groupIconFor('grp-definitions'),
      label: 'Temel Tanımlar',
      children: definitions,
    })
  }

  const personnel: NavLeaf[] = []
  if (hasModule('teachers')) {
    personnel.push(
      { key: '/promotions', icon: <RiseOutlined />, label: 'Terfi Takibi' },
      { key: '/teacher-documents', icon: <FileProtectOutlined />, label: 'Öğretmen Evrak Arşivi' },
    )
  }
  if (hasModule('leaves')) {
    personnel.push({ key: '/leaves', icon: <CalendarOutlined />, label: 'İzin Takibi' })
  }
  if (hasModule('duty')) {
    personnel.push({ key: '/duty', icon: <FieldTimeOutlined />, label: 'Nöbet Programı' })
  }
  if (hasModule('payroll')) {
    personnel.push(
      { key: '/extra-lessons', icon: <DollarOutlined />, label: 'Ek Ders Puantajı' },
      { key: '/attendance', icon: <ClockCircleOutlined />, label: 'İşçi / TYP Puantaj' },
    )
  }
  if (personnel.length > 0) {
    nodes.push({
      key: 'grp-personnel',
      icon: groupIconFor('grp-personnel'),
      label: 'Personel İşleri',
      children: personnel,
    })
  }

  const programs: NavLeaf[] = []
  if (hasModule('schedule')) {
    programs.push({ key: '/schedule', icon: <ScheduleOutlined />, label: 'Ders Programı' })
  }
  if (hasModule('exams')) {
    programs.push(
      { key: '/exams', icon: <FileDoneOutlined />, label: 'Sınav Programı Hazırlama' },
      { key: '/kelebek', icon: <TableOutlined />, label: 'Kelebek Sistemi' },
    )
  }
  if (programs.length > 0) {
    nodes.push({
      key: 'grp-programs',
      icon: groupIconFor('grp-programs'),
      label: 'Programlar',
      children: programs,
    })
  }

  const studentOps: NavLeaf[] = []
  if (hasModule('attendance')) {
    studentOps.push({
      key: '/absences',
      icon: <AlertOutlined />,
      label: 'DYK Devamsızlık Takibi',
    })
  }
  if (hasModule('communications')) {
    studentOps.push({ key: '/communications', icon: <NotificationOutlined />, label: 'Veli İletişim' })
  }
  if (hasModule('discipline')) {
    studentOps.push({ key: '/discipline', icon: <ExclamationCircleOutlined />, label: 'Disiplin' })
  }
  if (studentOps.length > 0) {
    nodes.push({
      key: 'grp-students',
      icon: groupIconFor('grp-students'),
      label: 'Öğrenci İşleri',
      children: studentOps,
    })
  }

  if (hasModule('guidance')) {
    nodes.push({ key: '/guidance', icon: <SafetyOutlined />, label: 'Rehberlik' })
  }

  const system: NavLeaf[] = []
  if (hasModule('users')) system.push({ key: '/users', icon: <UserOutlined />, label: 'Yetkilendirme' })
  if (hasModule('audit')) {
    system.push({ key: '/audit-logs', icon: <AuditOutlined />, label: 'Denetim Kayıtları' })
  }
  system.push({ key: '/work-tasks', icon: <CheckSquareOutlined />, label: 'İş Takibi' })
  system.push({ key: '/calendar', icon: <CalendarOutlined />, label: 'Kurum Takvimi' })
  system.push({ key: '/message-logs', icon: <MailOutlined />, label: 'SMS / E-posta Kayıtları' })
  system.push({ key: '/feedback', icon: <CommentOutlined />, label: 'Geri Bildirim' })
  nodes.push({
    key: 'grp-system',
    icon: groupIconFor('grp-system'),
    label: 'Sistem',
    children: system,
  })

  return nodes
}

/** Layout düzenleyici için varsayılan yapıdan düz katalog. */
export function catalogFromNodes(nodes: NavNode[]): {
  leaves: Map<string, NavLeaf>
  defaultGroups: Map<string, { label: string; children: string[] }>
  defaultOrder: string[]
} {
  const leaves = new Map<string, NavLeaf>()
  const defaultGroups = new Map<string, { label: string; children: string[] }>()
  const defaultOrder: string[] = []

  for (const node of nodes) {
    if (isNavGroup(node)) {
      defaultOrder.push(node.key)
      defaultGroups.set(node.key, {
        label: node.label,
        children: node.children.map((c) => c.key),
      })
      for (const child of node.children) leaves.set(child.key, child)
    } else {
      defaultOrder.push(node.key)
      leaves.set(node.key, node)
    }
  }

  return { leaves, defaultGroups, defaultOrder }
}
