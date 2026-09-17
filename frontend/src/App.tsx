import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd'
import trTR from 'antd/locale/tr_TR'
import { AuthProvider } from './auth/AuthContext'
import { ActiveSchoolProvider } from './auth/ActiveSchoolContext'
import { ThemeProvider, useThemeMode } from './theme/ThemeContext'
import { GuestRoute, LicenseGuard, ModuleRoute, PlatformAdminRoute, ProtectedRoute } from './auth/routes'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { TenantsListPage } from './pages/platform/TenantsListPage'
import { TenantDetailPage } from './pages/platform/TenantDetailPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { FeedbackListPage } from './pages/platform/FeedbackListPage'
import { PlatformNotificationsPage } from './pages/platform/PlatformNotificationsPage'
import { LicensesPage } from './pages/platform/LicensesPage'
import { BackupsPage } from './pages/platform/BackupsPage'
import { SchoolsPage } from './pages/SchoolsPage'
import { TeachersPage } from './pages/TeachersPage'
import { StudentsPage } from './pages/StudentsPage'
import { ClassroomsPage } from './pages/ClassroomsPage'
import { UsersPage } from './pages/UsersPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { SchedulePage } from './pages/SchedulePage'
import { SubjectsPage } from './pages/SubjectsPage'
import { LeavesPage } from './pages/LeavesPage'
import { NormPositionsPage } from './pages/NormPositionsPage'
import { AcademicYearsPage } from './pages/AcademicYearsPage'
import { DutyPage } from './pages/DutyPage'
import { ExtraLessonsPage } from './pages/ExtraLessonsPage'
import { AttendancePage } from './pages/AttendancePage'
import { AbsencesPage } from './pages/AbsencesPage'
import { DykPage } from './pages/DykPage'
import { CommunicationsPage } from './pages/CommunicationsPage'
import { ExamsPage } from './pages/ExamsPage'
import { KelebekPage } from './pages/KelebekPage'
import { DisciplinePage } from './pages/DisciplinePage'
import { GuidancePage } from './pages/GuidancePage'
import { TeacherDocumentsPage } from './pages/TeacherDocumentsPage'
import { OtherPersonnelPage } from './pages/OtherPersonnelPage'
import { WorkTasksPage } from './pages/WorkTasksPage'
import { CalendarPage } from './pages/CalendarPage'
import { MessageLogsPage } from './pages/MessageLogsPage'

function ThemedApp() {
  const { mode } = useThemeMode()

  const theme = {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#1d4e89',
      borderRadius: 8,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    },
  }

  return (
    <ConfigProvider
      locale={trTR}
      theme={theme}
      popupOverflow="scroll"
      getPopupContainer={(node) => {
        if (node) {
          const overlay = node.closest('.ant-modal-wrap, .ant-drawer-content-wrapper, .ant-drawer-body')
          if (overlay instanceof HTMLElement) return overlay
        }
        return document.body
      }}
    >
      <AntApp>
        <AuthProvider>
          <ActiveSchoolProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<LicenseGuard />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route element={<ModuleRoute module="audit" />}>
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                  </Route>
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route path="/work-tasks" element={<WorkTasksPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/message-logs" element={<MessageLogsPage />} />
                  <Route element={<ModuleRoute module="schools" />}>
                    <Route path="/schools" element={<SchoolsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="teachers" />}>
                    <Route path="/teachers" element={<TeachersPage />} />
                    <Route path="/other-personnel" element={<OtherPersonnelPage />} />
                    <Route path="/norm-positions" element={<NormPositionsPage />} />
                    <Route path="/teacher-documents" element={<TeacherDocumentsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="exams" />}>
                    <Route path="/exams" element={<ExamsPage />} />
                    <Route path="/kelebek" element={<KelebekPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="discipline" />}>
                    <Route path="/discipline" element={<DisciplinePage />} />
                  </Route>
                  <Route element={<ModuleRoute module="guidance" />}>
                    <Route path="/guidance" element={<GuidancePage />} />
                  </Route>
                  <Route path="/academic-years" element={<AcademicYearsPage />} />
                  <Route element={<ModuleRoute module="duty" />}>
                    <Route path="/duty" element={<DutyPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="payroll" />}>
                    <Route path="/extra-lessons" element={<ExtraLessonsPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                  </Route>
                  <Route element={<ModuleRoute module="attendance" />}>
                    <Route path="/absences" element={<AbsencesPage />} />
                    <Route path="/dyk" element={<DykPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="communications" />}>
                    <Route path="/communications" element={<CommunicationsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="students" />}>
                    <Route path="/students" element={<StudentsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="classrooms" />}>
                    <Route path="/classrooms" element={<ClassroomsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="users" />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="schedule" />}>
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/subjects" element={<SubjectsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="leaves" />}>
                    <Route path="/leaves" element={<LeavesPage />} />
                  </Route>
                </Route>
                <Route element={<PlatformAdminRoute />}>
                  <Route path="/platform/tenants" element={<TenantsListPage />} />
                  <Route path="/platform/tenants/:id" element={<TenantDetailPage />} />
                  <Route path="/platform/licenses" element={<LicensesPage />} />
                  <Route path="/platform/feedback" element={<FeedbackListPage />} />
                  <Route path="/platform/notifications" element={<PlatformNotificationsPage />} />
                  <Route path="/platform/backups" element={<BackupsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          </ActiveSchoolProvider>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  )
}
