import client from './client'
import type { BackupFile, BackupRunResult, BackupSettings } from '../types/backup'

interface Envelope<T> {
  success: true
  data: T
}

const LONG_TIMEOUT_MS = 180000

export async function getBackupSettings(): Promise<BackupSettings> {
  const { data } = await client.get<Envelope<BackupSettings>>('/api/backups/settings')
  return data.data
}

export async function updateBackupSettings(payload: {
  retention_days: number
  backup_dir: string
  schedule_time: string
}): Promise<BackupSettings> {
  const { data } = await client.put<Envelope<BackupSettings>>('/api/backups/settings', payload)
  return data.data
}

export async function listBackups(): Promise<BackupFile[]> {
  const { data } = await client.get<Envelope<BackupFile[]>>('/api/backups')
  return data.data
}

export async function runBackup(): Promise<BackupRunResult> {
  const { data } = await client.post<Envelope<BackupRunResult>>('/api/backups/run', null, {
    timeout: LONG_TIMEOUT_MS,
  })
  return data.data
}

export async function restoreBackup(filename: string): Promise<void> {
  await client.post(`/api/backups/${encodeURIComponent(filename)}/restore`, null, {
    timeout: LONG_TIMEOUT_MS,
  })
}

export async function deleteBackup(filename: string): Promise<void> {
  await client.delete(`/api/backups/${encodeURIComponent(filename)}`)
}
