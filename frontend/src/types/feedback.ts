export type FeedbackStatus = 'new' | 'read' | 'resolved'

export interface Feedback {
  id: number
  tenant_id: number
  user_id: number | null
  message: string
  status: FeedbackStatus
  created_at: string
  updated_at: string
  Tenant?: { id: number; name: string } | null
  User?: { id: number; full_name: string; email: string } | null
}
