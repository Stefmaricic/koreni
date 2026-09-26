import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { exportTreeAsPdf, exportTreeAsPng, exportTreeAsSvg } from '@/utils/exportTree'
import { toastError } from '@/stores/toastStore'
import type { FamilyGraph } from '@/utils/familyGraph'
import type { TreeStyle } from '@/utils/treeLayout'

interface ExportTreeModalProps {
  open: boolean
  onClose: () => void
  graph: FamilyGraph
  style: TreeStyle
  treeName: string
}

type Format = 'svg' | 'png' | 'pdf'

const LARGE_TREE_THRESHOLD = 40

export function ExportTreeModal({ open, onClose, graph, style, treeName }: ExportTreeModalProps) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<Format | null>(null)
  const peopleCount = graph.people.size
  const isLarge = peopleCount > LARGE_TREE_THRESHOLD

  const run = async (format: Format, action: () => void | Promise<void>) => {
    setBusy(format)
    try {
      await action()
      onClose()
    } catch (err) {
      toastError(err, t('tree.exportError'))
    } finally {
      setBusy(null)
    }
  }

  const options: { format: Format; title: string; body: string; icon: string; action: () => void | Promise<void> }[] = [
    {
      format: 'svg',
      title: t('tree.exportSvgTitle'),
      body: t('tree.exportSvgBody'),
      icon: '\u{1F5FA}\u{FE0F}',
      action: () => exportTreeAsSvg(graph, style, treeName),
    },
    {
      format: 'png',
      title: t('tree.exportPngTitle'),
      body: t('tree.exportPngBody'),
      icon: '\u{1F5BC}\u{FE0F}',
      action: () => exportTreeAsPng(graph, style, treeName),
    },
    {
      format: 'pdf',
      title: t('tree.exportPdfTitle'),
      body: t('tree.exportPdfBody'),
      icon: '\u{1F4C4}',
      action: () => exportTreeAsPdf(graph, style, treeName),
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('tree.exportTitle')} size="md">
      <p className="mb-4 text-sm text-ink-500">{t('tree.exportSubtitle')}</p>
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.format}
            type="button"
            disabled={busy !== null}
            onClick={() => run(opt.format, opt.action)}
            className="flex items-start gap-3 rounded-xl border border-cream-200 p-3.5 text-left hover:bg-cream-100 disabled:opacity-60"
          >
            <span className="text-2xl leading-none">{opt.icon}</span>
            <span className="flex-1">
              <span className="flex items-center gap-2">
                <span className="font-medium text-ink-700">{opt.title}</span>
                {opt.format === 'svg' && isLarge && (
                  <span className="rounded-full bg-root-100 px-2 py-0.5 text-xs font-medium text-root-700 dark:bg-root-900/50 dark:text-root-300">
                    {t('tree.exportRecommendedForLarge', { count: peopleCount })}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">{opt.body}</span>
            </span>
            {busy === opt.format && <Spinner className="mt-1 h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>
    </Modal>
  )
}
