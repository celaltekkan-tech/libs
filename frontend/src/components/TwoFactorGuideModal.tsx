import type { ReactNode } from 'react'
import { Button, Modal, Typography } from 'antd'

interface TwoFactorGuideModalProps {
  open: boolean
  onClose: () => void
  onKnow: () => void
  onContinue: () => void
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 88 140" width="88" height="140" aria-hidden="true">
      <rect x="4" y="2" width="80" height="136" rx="12" fill="#f4f7fb" stroke="#1d4e89" strokeWidth="2" />
      <rect x="32" y="8" width="24" height="4" rx="2" fill="#c5d0e0" />
      {children}
    </svg>
  )
}

function StepArt({ kind }: { kind: 'store' | 'scan' | 'code' | 'paper' }) {
  if (kind === 'store') {
    return (
      <PhoneFrame>
        <rect x="16" y="28" width="56" height="16" rx="8" fill="#fff" stroke="#d0d7e2" />
        <text x="22" y="39" fontSize="7" fill="#5b6b7c">
          Authenticator
        </text>
        <rect x="16" y="52" width="56" height="22" rx="6" fill="#1d4e89" />
        <text x="24" y="66" fontSize="7" fill="#fff">
          Yükle
        </text>
        <rect x="16" y="80" width="56" height="22" rx="6" fill="#e8eef6" />
        <text x="22" y="94" fontSize="7" fill="#1d4e89">
          Ücretsiz
        </text>
      </PhoneFrame>
    )
  }
  if (kind === 'scan') {
    return (
      <svg viewBox="0 0 140 88" width="140" height="88" aria-hidden="true">
        <rect x="4" y="8" width="72" height="72" rx="6" fill="#fff" stroke="#1d4e89" strokeWidth="2" />
        <rect x="14" y="18" width="16" height="16" fill="#1d4e89" />
        <rect x="36" y="18" width="8" height="8" fill="#1d4e89" />
        <rect x="50" y="18" width="16" height="16" fill="#1d4e89" />
        <rect x="14" y="40" width="8" height="8" fill="#1d4e89" />
        <rect x="28" y="40" width="16" height="8" fill="#1d4e89" />
        <rect x="50" y="36" width="8" height="16" fill="#1d4e89" />
        <rect x="14" y="54" width="16" height="16" fill="#1d4e89" />
        <rect x="40" y="54" width="8" height="8" fill="#1d4e89" />
        <rect x="54" y="58" width="12" height="12" fill="#1d4e89" />
        <rect x="86" y="18" width="46" height="78" rx="8" fill="#f4f7fb" stroke="#1d4e89" strokeWidth="2" />
        <text x="96" y="58" fontSize="8" fill="#1d4e89">
          Tara
        </text>
      </svg>
    )
  }
  if (kind === 'code') {
    return (
      <PhoneFrame>
        <text x="18" y="58" fontSize="16" fontWeight="700" fill="#1d4e89" letterSpacing="1">
          482
        </text>
        <text x="18" y="78" fontSize="16" fontWeight="700" fill="#1d4e89" letterSpacing="1">
          913
        </text>
        <rect x="16" y="92" width="40" height="4" rx="2" fill="#d0d7e2" />
        <text x="16" y="112" fontSize="7" fill="#5b6b7c">
          30 sn içinde değişir
        </text>
      </PhoneFrame>
    )
  }
  return (
    <svg viewBox="0 0 110 88" width="110" height="88" aria-hidden="true">
      <rect x="8" y="8" width="94" height="72" rx="4" fill="#fffdf6" stroke="#c4a35a" strokeWidth="2" />
      <text x="18" y="32" fontSize="9" fill="#5c4a1f">
        Yedek kodlar
      </text>
      <text x="18" y="50" fontSize="10" fill="#1d4e89">
        a1b2-c3d4
      </text>
      <text x="18" y="66" fontSize="10" fill="#1d4e89">
        e5f6-g7h8
      </text>
    </svg>
  )
}

const STEPS: Array<{ title: string; body: string; kind: 'store' | 'scan' | 'code' | 'paper' }> = [
  {
    kind: 'store',
    title: '1. Telefona küçük bir uygulama kurun',
    body: 'Bu uygulama, internet olmasa da 6 haneli bir kod üretir. Telefonunuzun mağazasını açın (Play Store veya App Store). Arama kutusuna Google Authenticator veya Microsoft Authenticator yazın. Ücretsiz olanı yükleyin. Banka veya oyun uygulaması değildir; sadece kod gösterir.',
  },
  {
    kind: 'scan',
    title: '2. Ekrandaki kare kodu okutun',
    body: 'Kılavuzu kapattığınızda bu sayfada bir kare resim çıkar. Telefondaki uygulamayı açın, artı (+) veya Hesap ekle düğmesine basın, Kare kod tara deyin. Kamerayı bilgisayardaki kare resme tutun. Kamera açılmazsa alttaki manuel anahtarı uygulamaya elle yazın.',
  },
  {
    kind: 'code',
    title: '3. Uygulamadaki 6 rakamı yazın',
    body: 'Uygulama 6 rakam gösterir. Bu rakamlar yaklaşık 30 saniyede bir değişir. Süre dolmadan buradaki kutuya aynen yazıp Doğrula ve etkinleştir deyin. Bundan sonra her girişte şifreden sonra bu güncel rakamlar istenir.',
  },
  {
    kind: 'paper',
    title: '4. Yedek kodları bir yere yazın',
    body: 'Kurulum bitince bir kez yedek kod listesi çıkar. Telefonunuz kaybolursa bu kodlarla girersiniz. Deftere veya güvenli bir yere yazın. Ekranı kapatınca bir daha gösterilmez.',
  },
]

export function TwoFactorGuideModal({ open, onClose, onKnow, onContinue }: TwoFactorGuideModalProps) {
  return (
    <Modal
      open={open}
      title="İki adımlı doğrulama nasıl kurulur?"
      onCancel={onClose}
      width={640}
      footer={[
        <Button key="know" onClick={onKnow}>
          2FA hakkında bilgim var
        </Button>,
        <Button key="go" type="primary" onClick={onContinue}>
          Kuruluma geç
        </Button>,
      ]}
    >
      <Typography.Paragraph>
        Şifrenizin yanına telefondan gelen kısa bir kod eklenir. Şifreyi bilen biri yine de giremez.
        SMS açıksa kod mesaj olarak gelir; aşağıdaki adımlar telefon uygulaması içindir.
      </Typography.Paragraph>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {STEPS.map((step) => (
          <div key={step.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 auto' }}>
              <StepArt kind={step.kind} />
            </div>
            <div>
              <Typography.Text strong>{step.title}</Typography.Text>
              <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                {step.body}
              </Typography.Paragraph>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
