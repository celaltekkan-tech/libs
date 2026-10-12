import { useState } from 'react'
import { Alert, App, Button, Modal, Space, Typography } from 'antd'
import { ChromeOutlined } from '@ant-design/icons'
import { downloadEokulExtension, fetchEokulPayload } from '../../api/timetable'
import { getErrorMessage } from '../../api/client'
import { EOKUL_EXTENSION_ID } from '../../constants/eokulExtension'
import { downloadBlob } from '../../utils/download'

interface ChromeRuntime {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: { ok?: boolean } | undefined) => void,
  ) => void
  lastError?: { message?: string }
}

function runtime(): ChromeRuntime | null {
  const chromeRuntime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime
  return chromeRuntime?.sendMessage ? chromeRuntime : null
}

function askExtension(message: unknown): Promise<boolean> {
  const chromeRuntime = runtime()
  if (!chromeRuntime) return Promise.resolve(false)
  return new Promise((resolve) => {
    try {
      chromeRuntime.sendMessage(EOKUL_EXTENSION_ID, message, (response) => {
        resolve(!chromeRuntime.lastError && Boolean(response?.ok))
      })
    } catch {
      resolve(false)
    }
  })
}

export function EokulExtensionButton({ projectId, hasLessons }: { projectId: number; hasLessons: boolean }) {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [loadingProgram, setLoadingProgram] = useState(false)

  const openModal = async () => {
    setOpen(true)
    setInstalled(await askExtension({ type: 'oids-ping' }))
  }

  const onDownload = async () => {
    setDownloading(true)
    try {
      const blob = await downloadEokulExtension()
      downloadBlob(blob, 'oids-eokul-eklentisi.zip')
      message.success('Eklenti indirildi. Zip’i ayıklayıp çıkan klasörü Chrome’a yükleyin; zip dosyasını seçmeyin.')
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
      const ok = await askExtension({ type: 'oids-program', program })
      if (!ok) {
        setInstalled(false)
        message.warning('Eklentiye ulaşılamadı. Kurduktan sonra bu sayfayı yenileyin.')
        return
      }
      setInstalled(true)
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
            <Alert type="success" showIcon message="Eklenti bu tarayıcıda kurulu." />
          ) : (
            <Alert
              type="info"
              showIcon
              message="Eklenti kurulu değil."
              description="Chrome zip dosyasını eklenti olarak kabul etmez. Zip’i indirip ayıklayın, çıkan klasörü seçin. Windows .zip uzantısını gizler; Downloads içindeki oids-eokul-eklentisi dosyasını seçmeyin."
            />
          )}
          <Button type="primary" icon={<ChromeOutlined />} loading={downloading} onClick={() => void onDownload()}>
            Eklentiyi indir
          </Button>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <li>İndirilen zip’e sağ tıklayıp Tümünü ayıkla deyin. Zip dosyasını Chrome’a vermeyin.</li>
              <li>Chrome’da adres çubuğuna chrome://extensions yazın.</li>
              <li>Sağ üstten Geliştirici modunu açın.</li>
              <li>Paketlenmemiş öğe yükle deyip ayıklanan klasörü seçin. Klasörün içinde manifest.json ve KURULUM.txt görünmeli.</li>
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
