import { useCallback, useEffect, useState } from 'react'
import { listMyTrees } from '@/services/treeService'
import { useAuthStore } from '@/stores/authStore'
import type { FamilyTreeSummary } from '@/types/models'

export function useMyTrees() {
  const userId = useAuthStore((s) => s.user?.id)
  const [trees, setTrees] = useState<FamilyTreeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      setTrees(await listMyTrees(userId))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load trees'))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { trees, loading, error, refresh }
}
