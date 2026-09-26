import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { signOut } from '@/services/authService'
import { useAuthStore } from '@/stores/authStore'
import { toastError } from '@/stores/toastStore'

export function AppHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      toastError(err)
    } finally {
      setConfirmLogout(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-lg font-semibold text-root-700">
            {t('app.name')}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LanguageSwitcher className="hidden sm:block" />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-root-200"
              aria-label={t('nav.account')}
            >
              <Avatar firstName={profile?.display_name ?? undefined} size="sm" />
            </button>
            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-hidden
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-cream-200 bg-surface py-1 shadow-lg">
                  <div className="sm:hidden px-3 py-2">
                    <LanguageSwitcher />
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-ink-600 hover:bg-cream-100"
                  >
                    {t('nav.settings')}
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmLogout(true)
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-cream-100"
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title={t('nav.logout')}
        body={t('auth.logoutConfirm')}
        confirmLabel={t('nav.logout')}
        danger
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </header>
  )
}
