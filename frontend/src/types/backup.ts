export interface BackupSettings {
  retention_days: number
  backup_dir: string
  schedule_time: string
  last_run_at: string | null
  last_run_status: 'success' | 'error' | 'running' | null
  last_run_message: string | null
}

export interface BackupFile {
  filename: string
  size_bytes: number
  created_at: string
}

export interface BackupRunResult {
  filename: string
  backup_dir: string
}
