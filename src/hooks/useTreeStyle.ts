import { useCallback, useState } from 'react'
import type { TreeStyle } from '@/utils/treeLayout'

const storageKey = (treeId: string) => `koreni.treeStyle.${treeId}`

const DEFAULT_STYLE: TreeStyle = 'rooted'

function readStoredStyle(treeId: string | undefined): TreeStyle {
  if (!treeId) return DEFAULT_STYLE
  try {
    const stored = localStorage.getItem(storageKey(treeId))
    return stored === 'classic' || stored === 'rooted' ? stored : DEFAULT_STYLE
  } catch {
    return DEFAULT_STYLE
  }
}

/** Per-tree, per-device preference for the chart layout (classic vs. rooted). */
export function useTreeStyle(treeId: string | undefined) {
  const [style, setStyle] = useState<TreeStyle>(() => readStoredStyle(treeId))

  const updateStyle = useCallback(
    (next: TreeStyle) => {
      setStyle(next)
      if (!treeId) return
      try {
        localStorage.setItem(storageKey(treeId), next)
      } catch {
        // best-effort persistence only (private browsing, quota, etc.)
      }
    },
    [treeId],
  )

  return [style, updateStyle] as const
}
