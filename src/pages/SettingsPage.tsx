import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppHeader } from '@/components/layout/AppHeader'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { updatePassword } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { toastError, useToastStore } from '@/stores/toastStore'

export function SettingsPage() {
  const { t } = useTranslation()
  const profile = useAuthStore((s) => s.profile)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const push = useToastStore((s) => s.push)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [savingName, setSavingName] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const saveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSavingName(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName }).eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      push(t('common.save'), 'success')
    } catch (err) {
      toastError(err)
    } finally {
      setSavingName(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toastError(new Error(t('auth.passwordTooShort')))
      return
    }
    setSavingPassword(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      push(t('common.save'), 'success')
    } catch (err) {
      toastError(err)
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink-700">{t('settings.title')}</h1>

        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">{t('settings.language')}</h2>
            <LanguageSwitcher />
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">{t('settings.account')}</h2>
            <form onSubmit={saveDisplayName} className="flex flex-col gap-3">
              <Input label={t('settings.displayName')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <Button type="submit" loading={savingName} className="self-start">
                {t('common.save')}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink-700">{t('settings.changePassword')}</h2>
            <form onSubmit={savePassword} className="flex flex-col gap-3">
              <Input
                label={t('auth.password')}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button type="submit" loading={savingPassword} className="self-start" disabled={!newPassword}>
                {t('common.save')}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-red-600">{t('settings.dangerZone')}</h2>
            <p className="mb-3 text-sm text-ink-500">{t('common.comingSoon')}</p>
            <Button variant="danger" disabled>
              {t('settings.deleteAccount')}
            </Button>
          </Card>
        </div>
      </main>
    </div>
  )
}
