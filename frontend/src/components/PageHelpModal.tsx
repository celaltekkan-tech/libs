import { Modal, Space, Typography } from 'antd'
import type { PageHelpContent } from '../constants/pageHelp'

interface PageHelpModalProps {
  open: boolean
  onClose: () => void
  content: PageHelpContent
}

export function PageHelpModal({ open, onClose, content }: PageHelpModalProps) {
  return (
    <Modal
      title={`Yardım — ${content.title}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {content.summary}
      </Typography.Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {content.topics.map((topic) => (
          <div key={topic.title}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              {topic.title}
            </Typography.Title>
            {topic.body && <Typography.Paragraph style={{ marginBottom: topic.steps?.length ? 8 : 0 }}>{topic.body}</Typography.Paragraph>}
            {topic.steps && topic.steps.length > 0 && (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {topic.steps.map((step) => (
                  <li key={step} style={{ marginBottom: 4 }}>
                    <Typography.Text>{step}</Typography.Text>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </Space>
    </Modal>
  )
}
