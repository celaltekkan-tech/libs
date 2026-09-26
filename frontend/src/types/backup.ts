export interface BackupSettings {
  retention_days: number
  backup_dir: string
  schedule_time: string
  last_run_at: string | null
  last_run_status: 'success' | 'error' | 'running' | null
  last_run_message: string | null
  cron_enabled: boolean
  dir_warning: string | null
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

export type BackupLogAction = 'backup' | 'prune' | 'delete' | 'import' | 'restore' | 'download' | 'config'
export type BackupLogStatus = 'running' | 'success' | 'error' | 'skipped' | 'warning'

export interface BackupLog {
  id: number
  action: BackupLogAction
  trigger: 'scheduled' | 'manual' | 'host' | 'system'
  status: BackupLogStatus
  filename: string | null
  size_bytes: number | null
  duration_ms: number | null
  backup_dir: string | null
  message: string | null
  user_label: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  /** Yalnızca başarılı backup/import satırlarında: dosya şu an nerede? */
  file_state?: 'present' | 'deleted' | 'pruned' | 'missing'
}
