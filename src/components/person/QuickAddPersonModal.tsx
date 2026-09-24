import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { MemberGender, QuickAddKind } from '@/types/models'

interface QuickAddPersonModalProps {
  open: boolean
  kind: QuickAddKind | null
  loading?: boolean
  onSubmit: (values: { firstName: string; lastName: string; gender: MemberGender }) => void
  onClose: () => void
}

export function QuickAddPersonModal({ open, kind, loading, onSubmit, onClose }: QuickAddPersonModalProps) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [gender, setGender] = useState<MemberGender>('unknown')

  if (!kind) return null

  const genderOptions = [
    { value: 'unknown', label: t('person.genderUnknown') },
    { value: 'female', label: t('person.genderFemale') },
    { value: 'male', label: t('person.genderMale') },
    { value: 'other', label: t('person.genderOther') },
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) return
    onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), gender })
    setFirstName('')
    setLastName('')
    setGender('unknown')
  }

  return (
    <Modal open={open} onClose={onClose} title={t('person.addTitle', { relation: t(`relations.${kind}`) })} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('person.firstName')} required autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <Input label={t('person.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <Select label={t('person.gender')} value={gender} onChange={(v) => setGender(v as MemberGender)} options={genderOptions} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={loading} disabled={!firstName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
