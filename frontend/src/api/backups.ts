import client from './client'
import type { BackupFile, BackupSettings } from '../types/backup'

interface Envelope<T> {
  success: true
  data: T
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const { data } = await client.get<Envelope<BackupSettings>>('/api/backups/settings')
  return data.data
}

export async function updateBackupSettings(retention_days: number): Promise<BackupSettings> {
  const { data } = await client.put<Envelope<BackupSettings>>('/api/backups/settings', { retention_days })
  return data.data
}

export async function listBackups(): Promise<BackupFile[]> {
  const { data } = await client.get<Envelope<BackupFile[]>>('/api/backups')
  return data.data
}

export async function deleteBackup(filename: string): Promise<void> {
  await client.delete(`/api/backups/${encodeURIComponent(filename)}`)
}
