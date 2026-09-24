import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function LandingPage() {
  const { t } = useTranslation()

  const features = [
    { title: t('landing.featureTreeTitle'), body: t('landing.featureTreeBody'), emoji: '🌳' },
    { title: t('landing.featureMobileTitle'), body: t('landing.featureMobileBody'), emoji: '📱' },
    { title: t('landing.featurePrivateTitle'), body: t('landing.featurePrivateBody'), emoji: '🔒' },
  ]

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-lg" />
          <span className="font-display text-xl font-semibold text-root-700">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link to="/login">
            <Button variant="ghost">{t('landing.login')}</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pt-10 pb-20 text-center sm:pt-16">
        <h1 className="whitespace-pre-line font-display text-3xl font-semibold leading-tight text-ink-700 sm:text-5xl">
          {t('landing.heroTitle')}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-ink-500 sm:text-lg">
          {t('landing.heroSubtitle')}
        </p>
        <Link to="/register">
          <Button size="lg" className="mt-8">
            {t('landing.getStarted')}
          </Button>
        </Link>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="p-6 text-left">
              <div className="mb-3 text-3xl">{f.emoji}</div>
              <h3 className="font-display text-lg font-semibold text-ink-700">{f.title}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{f.body}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
