import { useState } from 'react'
import { Alert, App, Button, Modal, Space, Typography } from 'antd'
import { ChromeOutlined } from '@ant-design/icons'
import { downloadEokulExtension, fetchEokulPayload, fetchExtensionVersion } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { EOKUL_EXTENSION_ID, isExtensionOutdated } from '../../constants/eokulExtension'
import { downloadBlob } from '../../utils/download'

interface ChromeRuntime {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: { ok?: boolean; version?: string } | undefined) => void,
  ) => void
  lastError?: { message?: string }
}

function runtime(): ChromeRuntime | null {
  const chromeRuntime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  return chromeRuntime?.sendMessage ? chromeRuntime : null
}

function askExtension(message: unknown): Promise<{ ok: boolean; version?: string }> {
  const chromeRuntime = runtime()
  if (!chromeRuntime) return Promise.resolve({ ok: false })
  return new Promise((resolve) => {
    try {
      chromeRuntime.sendMessage(EOKUL_EXTENSION_ID, message, (response) => {
        if (chromeRuntime.lastError || !response?.ok) {
          resolve({ ok: false })
          return
        }
        resolve({ ok: true, version: response.version })
      })
    } catch {
      resolve({ ok: false })
    }
  })
}

export function EokulExtensionButton({ projectId, hasLessons }: { projectId: number; hasLessons: boolean }) {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [installedVersion, setInstalledVersion] = useState<string>()
  const [latestVersion, setLatestVersion] = useState<string>()
  const [downloading, setDownloading] = useState(false)
  const [loadingProgram, setLoadingProgram] = useState(false)
  const outdated = Boolean(installed && isExtensionOutdated(installedVersion, latestVersion))

  const openModal = async () => {
    setOpen(true)
    const [ping, latest] = await Promise.all([
      askExtension({ type: 'oids-ping' }),
      fetchExtensionVersion().catch(() => null),
    ])
    setInstalled(ping.ok)
    setInstalledVersion(ping.version)
    setLatestVersion(latest?.version)
  }

  const onDownload = async () => {
    setDownloading(true)
    try {
      const blob = await downloadEokulExtension()
      downloadBlob(blob, 'oids-eokul-eklentisi.zip')
      message.success(
        outdated
          ? 'Yeni paket indirildi. Zip’i eski eklenti klasörünün üzerine ayıklayın, chrome://extensions sayfasında Yenile’ye basın.'
          : 'Eklenti indirildi. Zip’i ayıklayıp çıkan klasörü Chrome’a yükleyin; zip dosyasını seçmeyin.',
      )
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setDownloading(false)
    }
  }

  const onLoad = async () => {
    setLoadingProgram(true)
    try {
      const program = await fetchEokulPayload(projectId)
      const sent = await askExtension({ type: 'oids-program', program })
      if (!sent.ok) {
        setInstalled(false)
        message.warning('Eklentiye ulaşılamadı. Kurduktan sonra bu sayfayı yenileyin.')
        return
      }
      setInstalled(true)
      setInstalledVersion(sent.version)
      message.success('Program eklentiye yüklendi. e-Okul ders programı ekranında Doldur’a basın.')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingProgram(false)
    }
  }

  return (
    <>
      <Button icon={<ChromeOutlined />} onClick={() => void openModal()}>
        e-Okul eklentisi
      </Button>
      <Modal
        open={open}
        title="OIDS e-Okul eklentisi"
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {installed ? (
            outdated ? (
              <Alert
                type="warning"
                showIcon
                message={`Eklentinin yeni sürümü var${latestVersion ? ` (${latestVersion})` : ''}.`}
                description="Zip’i eski eklenti klasörünün üzerine ayıklayın, chrome://extensions sayfasında Yenile’ye basın. Klasör değiştiyse önce kaldırıp yeni klasörü yükleyin."
              />
            ) : (
              <Alert
                type="success"
                showIcon
                message={installedVersion ? `Eklenti bu tarayıcıda kurulu (${installedVersion}).` : 'Eklenti bu tarayıcıda kurulu.'}
              />
            )
          ) : (
            <Alert
              type="info"
              showIcon
              message="Eklenti kurulu değil."
              description="Chrome zip dosyasını eklenti olarak kabul etmez. Zip’i indirip ayıklayın, çıkan klasörü seçin. Windows .zip uzantısını gizler; Downloads içindeki oids-eokul-eklentisi dosyasını seçmeyin."
            />
          )}
          <div data-attention="eokul-extension-download">
            <Button type="primary" icon={<ChromeOutlined />} loading={downloading} onClick={() => void onDownload()}>
              {outdated ? 'Güncellemeyi indir' : 'Eklentiyi indir'}
            </Button>
          </div>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>İndirilen zip’e sağ tıklayıp Tümünü ayıkla deyin. Zip dosyasını Chrome’a vermeyin.</li>
              <li>Chrome’da adres çubuğuna chrome://extensions yazın.</li>
              <li>Sağ üstten Geliştirici modunu açın.</li>
              <li>Paketlenmemiş öğe yükle deyip ayıklanan klasörü seçin. Klasörün içinde manifest.json ve KURULUM.txt görünmeli.</li>
              <li>Güncellemede zip’i aynı klasörün üzerine ayıklayıp eklentiler sayfasında Yenile’ye basın.</li>
              <li>Bu sekmeye dönüp sayfayı yenileyin, sonra programı eklentiye yükleyin.</li>
              <li>e-Okul ders programı sayfasında “Sınıfları e-Okul’dan al” şube adlarını okula yazar. AMP ve ATP ayrıysa şube AMP-A olur.</li>
            </ol>
          </Typography.Paragraph>
          <Button loading={loadingProgram} disabled={!hasLessons || installed === false} onClick={() => void onLoad()}>
            Bu programı eklentiye yükle
          </Button>
          {!hasLessons && <Typography.Text type="secondary">Yüklenecek yerleşmiş ders yok.</Typography.Text>}
        </Space>
      </Modal>
    </>
  )
}
