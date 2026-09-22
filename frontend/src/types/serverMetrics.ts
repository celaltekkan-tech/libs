export interface ServerDiskMetric {
  mount: string
  percent: number
  used_bytes: number
  total_bytes: number
  free_bytes: number
}

export interface ServerDatabaseMetric {
  percent: number | null
  active: number
  idle_in_transaction: number
  connections: number
  max_connections: number
  xact_per_sec: number | null
  dialect: string
}

export interface ServerMetrics {
  sampled_at: string
  hostname: string
  platform: string
  uptime_sec: number
  cpu: { percent: number; cores: number }
  memory: { percent: number; used_bytes: number; total_bytes: number }
  disks: ServerDiskMetric[]
  database: ServerDatabaseMetric | null
}
