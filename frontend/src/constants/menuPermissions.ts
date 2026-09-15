/** Menü yolu → görünürlük için gereken permission (backend permissionCatalog ile senkron). */
export const MENU_PATH_PERMISSION: Record<string, string> = {
  '/schools': 'schools.read',
  '/classrooms': 'classrooms.read',
  '/students': 'students.read',
  '/teachers': 'teachers.read',
  '/other-personnel': 'teachers.read',
  '/subjects': 'schedule.read',
  '/academic-years': 'academic_years.read',
  '/norm-positions': 'norm_positions.read',
  '/teacher-documents': 'teacher_documents.read',
  '/leaves': 'leaves.read',
  '/duty': 'duty.read',
  '/extra-lessons': 'payroll.read',
  '/attendance': 'payroll.read',
  '/schedule': 'schedule.read',
  '/exams': 'exams.read',
  '/kelebek': 'exams.read',
  '/dyk': 'attendance.read',
  '/absences': 'attendance.read',
  '/communications': 'communications.read',
  '/discipline': 'discipline.read',
  '/guidance': 'guidance.read',
  '/users': 'users.read',
  '/audit-logs': 'audit.read',
  '/feedback': 'feedback.read',
}

export const ACTION_LABELS: Record<string, string> = {
  read: 'Görüntüle',
  create: 'Ekle',
  update: 'Düzenle',
  delete: 'Sil',
}
