export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface ApiErrorBody {
  success: false;
  message?: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

export interface SessionUser {
  id: number;
  tenant_id: number;
  school_id: number | null;
  full_name: string;
  email: string;
  role: string;
}

export interface AuthSession {
  token: string;
  expires_at: string;
  user: SessionUser;
  permissions: string[];
}

export interface StudentClassroom {
  id: number;
  class_level: string;
  section: string;
}

export interface Student {
  id: number;
  tenant_id: number;
  student_number: string | null;
  first_name: string;
  last_name: string;
  Classroom?: StudentClassroom | null;
  photo_url: string | null;
}

export interface TeacherNotePayload {
  student_id: number;
  tags: string[];
  note?: string;
}

export interface TeacherNote {
  id: number;
  student_id: number;
  teacher_id: number;
  tags: string[];
  note: string | null;
  created_at: string;
  Student?: {
    id: number;
    first_name: string;
    last_name: string;
    student_number: string | null;
    Classroom?: StudentClassroom | null;
  } | null;
}

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  Sender?: { id: number; full_name: string } | null;
}
