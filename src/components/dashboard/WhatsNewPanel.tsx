import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { CHANGELOG } from '@/data/changelog'

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

export function WhatsNewPanel() {
  const { t, i18n } = useTranslation()
  const isCyrillic = i18n.resolvedLanguage === 'sr-Cyrl'

  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink-700">{t('dashboard.whatsNew')}</h2>
      <div className="max-h-56 overflow-y-auto pr-1">
        <ul className="flex flex-col gap-3">
          {CHANGELOG.map((entry) => (
            <li key={entry.date} className="flex gap-3 text-sm">
              <span className="w-16 shrink-0 pt-0.5 text-xs text-ink-500">{formatShortDate(entry.date)}</span>
              <ul className="flex-1 list-disc space-y-0.5 pl-4 text-ink-600">
                {(isCyrillic ? entry.cyrl : entry.latn).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
