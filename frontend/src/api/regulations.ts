import client from './client'

export async function downloadRegulation(slug: string): Promise<Blob> {
  const { data } = await client.get(`/api/regulations/${slug}/download`, {
    responseType: 'blob',
    timeout: 60000,
  })
  return data as Blob
}
