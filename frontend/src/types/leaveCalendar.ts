export interface LeaveCalendarTeacher {
  teacher_id: number
  teacher_name: string | null
  personnel_no: string | null
  leave_type: string
}

export interface LeaveCalendarDay {
  date: string
  day: number
  is_holiday: boolean
  holiday_name: string | null
  leave_count: number
  leave_ratio: number
  teachers: LeaveCalendarTeacher[]
}

export interface LeaveCalendarResponse {
  total_personnel: number
  days: LeaveCalendarDay[]
}
