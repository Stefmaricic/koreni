import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <div className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <span className="font-display text-lg font-semibold text-root-700">{t('app.name')}</span>
        </Link>
        <LanguageSwitcher />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-12">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="font-display text-2xl font-semibold text-ink-700">{title}</h1>
            <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
          </div>
          <div className="rounded-card border border-cream-200 bg-white p-6 shadow-sm">{children}</div>
          {footer && <div className="mt-5 text-center text-sm text-ink-500">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
