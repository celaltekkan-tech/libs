import client from './client'

interface Envelope<T> {
  success: true
  data: T
}

export interface ExportTemplate {
  id: number
  tenant_id: number
  user_id: number | null
  entity_type: string
  name: string
  columns: string[]
  filters: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export async function listExportTemplates(entityType: string): Promise<ExportTemplate[]> {
  const { data } = await client.get<Envelope<ExportTemplate[]>>('/api/export-templates', {
    params: { entity_type: entityType },
  })
  return data.data
}

export async function createExportTemplate(
  tenantId: number,
  payload: { entity_type: string; name: string; columns: string[]; filters?: Record<string, unknown> },
): Promise<ExportTemplate> {
  const { data } = await client.post<Envelope<ExportTemplate>>('/api/export-templates', {
    tenant_id: tenantId,
    ...payload,
  })
  return data.data
}

export async function deleteExportTemplate(id: number): Promise<void> {
  await client.delete(`/api/export-templates/${id}`)
}
