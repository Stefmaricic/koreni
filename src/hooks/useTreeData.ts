import { useCallback, useEffect, useMemo, useState } from 'react'
import { listChildLinkCurves } from '@/services/childLinkCurveService'
import { listPeople } from '@/services/personService'
import { listRelationships } from '@/services/relationshipService'
import { getMyRole, getTree } from '@/services/treeService'
import { useAuthStore } from '@/stores/authStore'
import { FamilyGraph } from '@/utils/familyGraph'
import type { MembershipRole } from '@/types/models'
import type { FamilyTreeRow } from '@/types/database'

export function useTreeData(treeId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id)
  const [tree, setTree] = useState<FamilyTreeRow | null>(null)
  const [graph, setGraph] = useState<FamilyGraph>(() => new FamilyGraph([], []))
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!treeId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const [treeRow, people, relationships, childLinkCurves, myRole] = await Promise.all([
        getTree(treeId),
        listPeople(treeId),
        listRelationships(treeId),
        listChildLinkCurves(treeId),
        getMyRole(treeId, userId),
      ])
      setTree(treeRow)
      setGraph(new FamilyGraph(people, relationships, childLinkCurves))
      setRole(myRole)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tree'))
    } finally {
      setLoading(false)
    }
  }, [treeId, userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const canEdit = useMemo(() => role === 'owner' || role === 'editor', [role])

  return { tree, graph, role, canEdit, loading, error, refresh }
}
