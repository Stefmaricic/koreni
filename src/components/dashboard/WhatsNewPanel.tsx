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
    <Card className="p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {t('dashboard.whatsNew')}
      </h2>
      <div className="max-h-64 overflow-y-auto pr-1">
        <div className="flex flex-col gap-3">
          {CHANGELOG.map((entry) => (
            <div key={entry.date}>
              <span className="text-[11px] font-medium text-ink-500">{formatShortDate(entry.date)}</span>
              <ul className="mt-1 list-disc space-y-1 pl-3.5 text-xs leading-snug text-ink-600">
                {(isCyrillic ? entry.cyrl : entry.latn).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
