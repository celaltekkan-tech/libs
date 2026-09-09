import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import trTR from 'antd/locale/tr_TR'
import { AuthProvider } from './auth/AuthContext'
import { GuestRoute, LicenseGuard, ModuleRoute, PlatformAdminRoute, ProtectedRoute, RoleRoute } from './auth/routes'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProfilePage } from './pages/ProfilePage'
import { TenantsListPage } from './pages/platform/TenantsListPage'
import { TenantDetailPage } from './pages/platform/TenantDetailPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { FeedbackListPage } from './pages/platform/FeedbackListPage'
import { LicensesPage } from './pages/platform/LicensesPage'
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
import { TrainingsPage } from './pages/TrainingsPage'
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

const theme = {
  token: {
    colorPrimary: '#1d4e89',
    borderRadius: 8,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
}

export default function App() {
  return (
    <ConfigProvider locale={trTR} theme={theme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<LicenseGuard />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route element={<ModuleRoute module="schools" />}>
                    <Route path="/schools" element={<SchoolsPage />} />
                  </Route>
                  <Route element={<ModuleRoute module="teachers" />}>
                    <Route path="/teachers" element={<TeachersPage />} />
                    <Route path="/norm-positions" element={<NormPositionsPage />} />
                    <Route path="/trainings" element={<TrainingsPage />} />
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
                  <Route element={<ModuleRoute module="audit" />}>
                    <Route element={<RoleRoute roles={['Müdür']} />}>
                      <Route path="/audit-logs" element={<AuditLogsPage />} />
                    </Route>
                  </Route>
                </Route>
                <Route element={<PlatformAdminRoute />}>
                  <Route path="/platform/tenants" element={<TenantsListPage />} />
                  <Route path="/platform/tenants/:id" element={<TenantDetailPage />} />
                  <Route path="/platform/licenses" element={<LicensesPage />} />
                  <Route path="/platform/feedback" element={<FeedbackListPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
