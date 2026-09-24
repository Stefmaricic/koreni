import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input, Select, TextArea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { createPerson, updatePerson, updatePersonPhoto } from '@/services/personService'
import { deletePersonPhoto, PhotoValidationError, uploadPersonPhoto } from '@/services/storageService'
import { useAuthStore } from '@/stores/authStore'
import { toastError } from '@/stores/toastStore'
import { personFullName } from '@/utils/mappers'
import type { MemberGender, Person, PersonFormInput } from '@/types/models'

interface PersonFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  treeId: string
  person?: Person | null
  onSaved: (person: Person) => void
  onClose: () => void
}

const emptyForm: PersonFormInput = {
  firstName: '',
  lastName: '',
  maidenName: '',
  gender: 'unknown',
  birthDate: '',
  birthPlace: '',
  deathDate: '',
  deathPlace: '',
  bio: '',
}

function toFormInput(person: Person): PersonFormInput {
  return {
    firstName: person.firstName,
    lastName: person.lastName ?? '',
    maidenName: person.maidenName ?? '',
    gender: person.gender,
    birthDate: person.birthDate ?? '',
    birthPlace: person.birthPlace ?? '',
    deathDate: person.deathDate ?? '',
    deathPlace: person.deathPlace ?? '',
    bio: person.bio ?? '',
  }
}

export function PersonFormModal({ open, mode, treeId, person, onSaved, onClose }: PersonFormModalProps) {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const [form, setForm] = useState<PersonFormInput>(emptyForm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(person ? toFormInput(person) : emptyForm)
    setPhotoFile(null)
    setPreviewUrl(null)
  }, [open, person])

  const set = <K extends keyof PersonFormInput>(key: K, value: PersonFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !userId) return
    setSaving(true)
    try {
      let saved: Person
      if (mode === 'create') {
        saved = await createPerson(treeId, form, userId)
      } else {
        saved = await updatePerson(person!.id, form)
      }

      if (photoFile) {
        const url = await uploadPersonPhoto(treeId, saved.id, photoFile)
        await updatePersonPhoto(saved.id, url)
        if (mode === 'edit' && person?.photoUrl) await deletePersonPhoto(person.photoUrl)
        saved = { ...saved, photoUrl: url }
      }

      onSaved(saved)
    } catch (err) {
      if (err instanceof PhotoValidationError) {
        toastError(err)
      } else {
        toastError(err, t('person.saveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  const genderOptions = [
    { value: 'unknown', label: t('person.genderUnknown') },
    { value: 'female', label: t('person.genderFemale') },
    { value: 'male', label: t('person.genderMale') },
    { value: 'other', label: t('person.genderOther') },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? t('person.profileTitle') : t('person.editTitle', { name: person ? personFullName(person) : '' })}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            photoUrl={previewUrl ?? person?.photoUrl}
            firstName={form.firstName}
            lastName={form.lastName}
            gender={form.gender}
            size="xl"
          />
          <div className="flex flex-col gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              {person?.photoUrl || previewUrl ? t('person.changePhoto') : t('person.uploadPhoto')}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('person.firstName')} required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          <Input label={t('person.lastName')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          <Input label={t('person.maidenName')} value={form.maidenName} onChange={(e) => set('maidenName', e.target.value)} />
          <Select
            label={t('person.gender')}
            value={form.gender}
            onChange={(v) => set('gender', v as MemberGender)}
            options={genderOptions}
          />
          <Input
            label={t('person.birthDate')}
            type="date"
            value={form.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
          <Input label={t('person.birthPlace')} value={form.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} />
          <Input
            label={t('person.deathDate')}
            type="date"
            hint={t('person.living')}
            value={form.deathDate}
            onChange={(e) => set('deathDate', e.target.value)}
          />
          <Input label={t('person.deathPlace')} value={form.deathPlace} onChange={(e) => set('deathPlace', e.target.value)} />
        </div>

        <TextArea
          label={t('person.bio')}
          placeholder={t('person.bioPlaceholder')}
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saving} disabled={!form.firstName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
