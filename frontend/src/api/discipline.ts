import client from './client'
import type {
  DisciplineBehaviorPoint,
  DisciplineBehaviorPointSummary,
  DisciplineDecision,
  DisciplineExcelPreviewRow,
  DisciplineIncident,
  DisciplineIncidentPayload,
  DisciplineInfoRequest,
  DisciplineMeetingNotice,
  DisciplineNotification,
  DisciplineParticipant,
  DisciplineRegulationArticle,
  DisciplineSanctionedStudent,
  DisciplineStatement,
  DisciplineStats,
} from '../types/discipline'

interface Envelope<T> {
  success: true
  data: T
}

// ---- Olaylar ----
export async function listIncidents(params?: { school_id?: number; status?: string; academic_year?: string }): Promise<DisciplineIncident[]> {
  const { data } = await client.get<Envelope<DisciplineIncident[]>>('/api/discipline/incidents', { params })
  return data.data
}

export async function getIncident(id: number): Promise<DisciplineIncident> {
  const { data } = await client.get<Envelope<DisciplineIncident>>(`/api/discipline/incidents/${id}`)
  return data.data
}

export async function createIncident(payload: DisciplineIncidentPayload): Promise<DisciplineIncident> {
  const { data } = await client.post<Envelope<DisciplineIncident>>('/api/discipline/incidents', payload)
  return data.data
}

export async function updateIncident(id: number, payload: Partial<DisciplineIncidentPayload> & { status?: string }): Promise<DisciplineIncident> {
  const { data } = await client.patch<Envelope<DisciplineIncident>>(`/api/discipline/incidents/${id}`, payload)
  return data.data
}

export async function deleteIncident(id: number): Promise<void> {
  await client.delete(`/api/discipline/incidents/${id}`)
}

export async function fetchDisciplineStats(params?: { academic_year?: string }): Promise<DisciplineStats> {
  const { data } = await client.get<Envelope<DisciplineStats>>('/api/discipline/incidents/stats', { params })
  return data.data
}

export async function listSanctionedStudents(params?: { academic_year?: string; sanction_type?: string }): Promise<DisciplineSanctionedStudent[]> {
  const { data } = await client.get<Envelope<DisciplineSanctionedStudent[]>>('/api/discipline/incidents/sanctioned-students', { params })
  return data.data
}

export type IncidentDocumentType = 'sikayet_dilekcesi' | 'bildirim_tutanagi' | 'sinif_kontrol_formu' | 'dizi_pusulasi' | 'ek_sure_talebi'

export async function downloadIncidentDocument(id: number, type: IncidentDocumentType, extra?: { reasons?: string[] }): Promise<Blob> {
  const params: Record<string, string> = { type }
  if (extra?.reasons) params.reasons = JSON.stringify(extra.reasons)
  const { data } = await client.get(`/api/discipline/incidents/${id}/document`, { params, responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Katılımcılar ----
export async function addParticipant(incidentId: number, payload: { student_id: number; role: string }): Promise<DisciplineParticipant> {
  const { data } = await client.post<Envelope<DisciplineParticipant>>(`/api/discipline/incidents/${incidentId}/participants`, payload)
  return data.data
}

export async function updateParticipant(participantId: number, payload: Partial<DisciplineParticipant>): Promise<DisciplineParticipant> {
  const { data } = await client.patch<Envelope<DisciplineParticipant>>(`/api/discipline/incidents/participants/${participantId}`, payload)
  return data.data
}

export async function removeParticipant(participantId: number): Promise<void> {
  await client.delete(`/api/discipline/incidents/participants/${participantId}`)
}

export async function previewIncidentExcel(incidentId: number, file: File): Promise<DisciplineExcelPreviewRow[]> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post<Envelope<DisciplineExcelPreviewRow[]>>(
    `/api/discipline/incidents/${incidentId}/participants/excel-preview`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data.data
}

export async function commitIncidentExcel(
  incidentId: number,
  rows: Array<{ student_id: number; role: string }>,
): Promise<{ created: number; skipped: number }> {
  const { data } = await client.post<Envelope<DisciplineIncident> & { created: number; skipped: number }>(
    `/api/discipline/incidents/${incidentId}/participants/excel-commit`,
    { rows },
  )
  return { created: data.created, skipped: data.skipped }
}

// ---- Formlar: ifade / sözlü ifade / savunma ----
export async function listStatements(params: { incident_id?: number; participant_id?: number }): Promise<DisciplineStatement[]> {
  const { data } = await client.get<Envelope<DisciplineStatement[]>>('/api/discipline/forms/statements', { params })
  return data.data
}

export async function createStatement(payload: Partial<DisciplineStatement> & { participant_id: number; statement_type: string }): Promise<DisciplineStatement> {
  const { data } = await client.post<Envelope<DisciplineStatement>>('/api/discipline/forms/statements', payload)
  return data.data
}

export async function updateStatement(id: number, payload: Partial<DisciplineStatement>): Promise<DisciplineStatement> {
  const { data } = await client.patch<Envelope<DisciplineStatement>>(`/api/discipline/forms/statements/${id}`, payload)
  return data.data
}

export async function deleteStatement(id: number): Promise<void> {
  await client.delete(`/api/discipline/forms/statements/${id}`)
}

export async function downloadStatementDocument(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/discipline/forms/statements/${id}/document`, { responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Formlar: bilgi toplama ----
export async function listInfoRequests(params: { incident_id?: number; participant_id?: number }): Promise<DisciplineInfoRequest[]> {
  const { data } = await client.get<Envelope<DisciplineInfoRequest[]>>('/api/discipline/forms/info-requests', { params })
  return data.data
}

export async function createInfoRequest(
  payload: Partial<DisciplineInfoRequest> & { participant_id: number; source_type: string },
): Promise<DisciplineInfoRequest> {
  const { data } = await client.post<Envelope<DisciplineInfoRequest>>('/api/discipline/forms/info-requests', payload)
  return data.data
}

export async function updateInfoRequest(id: number, payload: Partial<DisciplineInfoRequest>): Promise<DisciplineInfoRequest> {
  const { data } = await client.patch<Envelope<DisciplineInfoRequest>>(`/api/discipline/forms/info-requests/${id}`, payload)
  return data.data
}

export async function deleteInfoRequest(id: number): Promise<void> {
  await client.delete(`/api/discipline/forms/info-requests/${id}`)
}

export async function downloadInfoRequestDocument(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/discipline/forms/info-requests/${id}/document`, { responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Formlar: çağrı pusulaları ----
export async function listMeetingNotices(incidentId: number): Promise<DisciplineMeetingNotice[]> {
  const { data } = await client.get<Envelope<DisciplineMeetingNotice[]>>('/api/discipline/forms/meeting-notices', { params: { incident_id: incidentId } })
  return data.data
}

export async function createMeetingNotice(
  payload: Partial<DisciplineMeetingNotice> & { incident_id: number; notice_type: string },
): Promise<DisciplineMeetingNotice> {
  const { data } = await client.post<Envelope<DisciplineMeetingNotice>>('/api/discipline/forms/meeting-notices', payload)
  return data.data
}

export async function updateMeetingNotice(id: number, payload: Partial<DisciplineMeetingNotice>): Promise<DisciplineMeetingNotice> {
  const { data } = await client.patch<Envelope<DisciplineMeetingNotice>>(`/api/discipline/forms/meeting-notices/${id}`, payload)
  return data.data
}

export async function deleteMeetingNotice(id: number): Promise<void> {
  await client.delete(`/api/discipline/forms/meeting-notices/${id}`)
}

export async function downloadMeetingNoticeDocument(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/discipline/forms/meeting-notices/${id}/document`, { responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Ceza ve Karar ----
export async function listDecisions(params: { incident_id?: number; participant_id?: number; status?: string }): Promise<DisciplineDecision[]> {
  const { data } = await client.get<Envelope<DisciplineDecision[]>>('/api/discipline/decisions', { params })
  return data.data
}

export async function createDecision(payload: Partial<DisciplineDecision> & { participant_id: number }): Promise<DisciplineDecision> {
  const { data } = await client.post<Envelope<DisciplineDecision>>('/api/discipline/decisions', payload)
  return data.data
}

export async function updateDecision(id: number, payload: Partial<DisciplineDecision>): Promise<DisciplineDecision> {
  const { data } = await client.patch<Envelope<DisciplineDecision>>(`/api/discipline/decisions/${id}`, payload)
  return data.data
}

export async function deleteDecision(id: number): Promise<void> {
  await client.delete(`/api/discipline/decisions/${id}`)
}

export async function downloadDecisionDocument(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/discipline/decisions/${id}/document`, { responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Tebligatlar ----
export async function listNotifications(decisionId: number): Promise<DisciplineNotification[]> {
  const { data } = await client.get<Envelope<DisciplineNotification[]>>('/api/discipline/decisions/notifications/list', { params: { decision_id: decisionId } })
  return data.data
}

export async function createNotification(
  payload: Partial<DisciplineNotification> & { decision_id: number; participant_id: number; notification_type: string },
): Promise<DisciplineNotification> {
  const { data } = await client.post<Envelope<DisciplineNotification>>('/api/discipline/decisions/notifications', payload)
  return data.data
}

export async function updateNotification(id: number, payload: Partial<DisciplineNotification>): Promise<DisciplineNotification> {
  const { data } = await client.patch<Envelope<DisciplineNotification>>(`/api/discipline/decisions/notifications/${id}`, payload)
  return data.data
}

export async function deleteNotification(id: number): Promise<void> {
  await client.delete(`/api/discipline/decisions/notifications/${id}`)
}

export async function downloadNotificationDocument(id: number): Promise<Blob> {
  const { data } = await client.get(`/api/discipline/decisions/notifications/${id}/document`, { responseType: 'blob', timeout: 30000 })
  return data as Blob
}

// ---- Davranış Puanı ----
export async function listBehaviorPoints(params?: { student_id?: number; academic_year?: string }): Promise<DisciplineBehaviorPoint[]> {
  const { data } = await client.get<Envelope<DisciplineBehaviorPoint[]>>('/api/discipline/behavior-points', { params })
  return data.data
}

export async function summarizeBehaviorPoints(params?: { academic_year?: string }): Promise<DisciplineBehaviorPointSummary[]> {
  const { data } = await client.get<Envelope<DisciplineBehaviorPointSummary[]>>('/api/discipline/behavior-points/summary', { params })
  return data.data
}

export async function createBehaviorPoint(payload: {
  student_id: number
  participant_id?: number | null
  decision_id?: number | null
  academic_year: string
  points_deducted?: number
  points_restored?: number
  restore_date?: string | null
  reason?: string | null
}): Promise<DisciplineBehaviorPoint> {
  const { data } = await client.post<Envelope<DisciplineBehaviorPoint>>('/api/discipline/behavior-points', payload)
  return data.data
}

export async function updateBehaviorPoint(id: number, payload: Partial<DisciplineBehaviorPoint>): Promise<DisciplineBehaviorPoint> {
  const { data } = await client.patch<Envelope<DisciplineBehaviorPoint>>(`/api/discipline/behavior-points/${id}`, payload)
  return data.data
}

export async function deleteBehaviorPoint(id: number): Promise<void> {
  await client.delete(`/api/discipline/behavior-points/${id}`)
}

// ---- Yönetmelik Maddeleri ----
export async function listRegulationArticles(): Promise<DisciplineRegulationArticle[]> {
  const { data } = await client.get<Envelope<DisciplineRegulationArticle[]>>('/api/discipline/regulation-articles')
  return data.data
}

export async function createRegulationArticle(payload: {
  article_no?: string
  title: string
  description?: string
  default_sanction_type?: string | null
}): Promise<DisciplineRegulationArticle> {
  const { data } = await client.post<Envelope<DisciplineRegulationArticle>>('/api/discipline/regulation-articles', payload)
  return data.data
}

export async function deleteRegulationArticle(id: number): Promise<void> {
  await client.delete(`/api/discipline/regulation-articles/${id}`)
}
