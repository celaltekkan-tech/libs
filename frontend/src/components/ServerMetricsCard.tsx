import { useEffect, useState, type ReactNode } from 'react'
import { Card, Col, Progress, Row, Space, Spin, Tag, Typography } from 'antd'
import {
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  HddOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getServerMetrics } from '../api/serverMetrics'
import { getErrorMessage } from '../api/client'
import type { ServerDiskMetric, ServerMetrics } from '../types/serverMetrics'

const POLL_MS = 3000

function usageColor(percent: number): string {
  if (percent >= 90) return '#dc2626'
  if (percent >= 75) return '#d97706'
  return '#15803d'
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 || unit === 0 ? 0 : 1
  return `${value.toLocaleString('tr-TR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })} ${units[unit]}`
}

function formatPercent(percent: number): string {
  return `${percent.toLocaleString('tr-TR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days} gün ${hours} sa`
  if (hours > 0) return `${hours} sa ${mins} dk`
  return `${Math.max(mins, 0)} dk`
}

function diskLabel(mount: string): string {
  const trimmed = mount.replace(/[\\/]+$/, '')
  return trimmed || mount
}

function MetricBlock({
  icon,
  title,
  percent,
  detail,
}: {
  icon: ReactNode
  title: string
  percent: number | null
  detail: string
}) {
  const color = percent == null ? '#64748b' : usageColor(percent)
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', width: '100%', minWidth: 0, height: 72, overflow: 'hidden' }}>
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${color}14`,
          color,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Typography.Text type="secondary" ellipsis style={{ fontSize: 13, display: 'block', lineHeight: '20px' }}>
          {title}
        </Typography.Text>
        {percent == null ? (
          <Typography.Text style={{ display: 'block', lineHeight: '24px' }}>Ölçülemedi</Typography.Text>
        ) : (
          <Progress
            percent={percent}
            strokeColor={color}
            size="small"
            format={() => formatPercent(percent)}
            style={{ marginBottom: 0, width: '100%', fontVariantNumeric: 'tabular-nums' }}
            styles={{
              root: { width: '100%' },
              indicator: {
                width: 52,
                flex: 'none',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              },
            }}
          />
        )}
        <Typography.Text
          type="secondary"
          ellipsis={{ tooltip: detail }}
          style={{ fontSize: 12, display: 'block', lineHeight: '18px', fontVariantNumeric: 'tabular-nums' }}
        >
          {detail}
        </Typography.Text>
      </div>
    </div>
  )
}

function diskDetail(disks: ServerDiskMetric[]): { percent: number | null; detail: string; title: string } {
  if (!disks.length) {
    return { percent: null, detail: 'Disk bilgisi alınamadı', title: 'Disk' }
  }
  if (disks.length === 1) {
    const disk = disks[0]
    return {
      percent: disk.percent,
      title: `Disk (${diskLabel(disk.mount)})`,
      detail: `${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)}`,
    }
  }
  const fullest = disks.reduce((top, disk) => (disk.percent > top.percent ? disk : top), disks[0])
  const lines = disks
    .map((disk) => `${diskLabel(disk.mount)} ${formatPercent(disk.percent)} · ${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)}`)
    .join(' · ')
  return {
    percent: fullest.percent,
    title: 'Disk',
    detail: lines,
  }
}

function databaseDetail(metrics: ServerMetrics): string {
  const db = metrics.database
  if (!db) return 'Veritabanı ölçülemedi'
  const parts = [`${db.active} aktif sorgu`]
  if (db.idle_in_transaction > 0) parts.push(`${db.idle_in_transaction} açık işlem`)
  if (db.max_connections > 0) parts.push(`${db.connections}/${db.max_connections} bağlantı`)
  if (db.xact_per_sec != null) {
    parts.push(
      `${db.xact_per_sec.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} işlem/sn`,
    )
  }
  return parts.join(' · ')
}

export function ServerMetricsCard() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let pending = false

    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void tick()
      }, ms)
    }

    const tick = async () => {
      if (cancelled || pending) return
      if (document.hidden) {
        schedule(POLL_MS)
        return
      }
      pending = true
      try {
        const data = await getServerMetrics()
        if (!cancelled) {
          setMetrics(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        pending = false
        if (!cancelled) schedule(POLL_MS)
      }
    }

    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer)
        void tick()
      }
    }

    void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const disk = diskDetail(metrics?.disks ?? [])

  return (
    <Card
      style={{ width: '100%' }}
      styles={{ body: { width: '100%' } }}
      title={
        <Space size={8}>
          <CloudServerOutlined />
          Sunucu durumu
        </Space>
      }
      extra={
        metrics ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', maxWidth: '100%' }}>
            <Tag color="green" style={{ marginInlineEnd: 0 }}>
              Canlı
            </Tag>
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
              {metrics.hostname} · {formatUptime(metrics.uptime_sec)} açık · {dayjs(metrics.sampled_at).format('HH:mm:ss')}
            </Typography.Text>
          </span>
        ) : (
          <Typography.Text type="secondary">Ölçülüyor…</Typography.Text>
        )
      }
    >
      {!metrics && !error ? (
        <div style={{ padding: 12, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%', display: 'flex' }} styles={{ item: { width: '100%' } }}>
          {error && (
            <Typography.Text type="danger" ellipsis style={{ fontSize: 13, display: 'block' }}>
              {error}
            </Typography.Text>
          )}
          {metrics && (
            <Row gutter={[20, 16]} style={{ width: '100%', marginInline: 0 }}>
              <Col xs={24} sm={12} lg={6}>
                <MetricBlock
                  icon={<DashboardOutlined />}
                  title="İşlemci"
                  percent={metrics.cpu.percent}
                  detail={`${metrics.cpu.cores} çekirdek`}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <MetricBlock
                  icon={<ThunderboltOutlined />}
                  title="Bellek (RAM)"
                  percent={metrics.memory.percent}
                  detail={`${formatBytes(metrics.memory.used_bytes)} / ${formatBytes(metrics.memory.total_bytes)}`}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <MetricBlock
                  icon={<HddOutlined />}
                  title={disk.title}
                  percent={disk.percent}
                  detail={disk.detail}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <MetricBlock
                  icon={<DatabaseOutlined />}
                  title="Veritabanı yoğunluğu"
                  percent={metrics.database?.percent ?? null}
                  detail={databaseDetail(metrics)}
                />
              </Col>
            </Row>
          )}
        </Space>
      )}
    </Card>
  )
}
