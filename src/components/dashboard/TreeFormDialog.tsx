import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input, TextArea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

interface TreeFormDialogProps {
  open: boolean
  mode: 'create' | 'rename'
  initialName?: string
  initialDescription?: string
  loading?: boolean
  onSubmit: (values: { name: string; description: string }) => void
  onClose: () => void
}

export function TreeFormDialog({
  open,
  mode,
  initialName = '',
  initialDescription = '',
  loading,
  onSubmit,
  onClose,
}: TreeFormDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setDescription(initialDescription)
    }
  }, [open, initialName, initialDescription])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('dashboard.newTreeTitle') : t('dashboard.renameTitle')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('dashboard.newTreeTitle')}
          placeholder={t('dashboard.newTreeNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        {mode === 'create' && (
          <TextArea
            label={`${t('common.optional')}`}
            placeholder={t('dashboard.newTreeDescriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>
            {mode === 'create' ? t('dashboard.create') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
