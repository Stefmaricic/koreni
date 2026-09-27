import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { TextArea } from '@/components/ui/Input'
import { submitFeedback } from '@/services/feedbackService'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const push = useToastStore((s) => s.push)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !message.trim()) return
    setSending(true)
    try {
      await submitFeedback(user.id, user.email ?? null, message, location.pathname)
      setMessage('')
      onClose()
      push(t('feedback.sent'), 'success')
    } catch {
      push(t('feedback.error'), 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('feedback.title')} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-ink-500">{t('feedback.subtitle')}</p>
        <TextArea
          autoFocus
          required
          rows={5}
          placeholder={t('feedback.placeholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={sending} disabled={!message.trim()}>
            {t('feedback.send')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
