export interface BackupSettings {
  retention_days: number
}

export interface BackupFile {
  filename: string
  size_bytes: number
  created_at: string
}
