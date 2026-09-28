import { useCallback, useEffect, useMemo, useState } from 'react'
import { listChildLinkCurves } from '@/services/childLinkCurveService'
import { listPeople } from '@/services/personService'
import { listRelationships } from '@/services/relationshipService'
import { getMyMembership, getTree } from '@/services/treeService'
import { useAuthStore } from '@/stores/authStore'
import { FamilyGraph } from '@/utils/familyGraph'
import type { MembershipRole } from '@/types/models'
import type { FamilyTreeRow } from '@/types/database'

export function useTreeData(treeId: string | undefined) {
  const userId = useAuthStore((s) => s.user?.id)
  const [tree, setTree] = useState<FamilyTreeRow | null>(null)
  const [graph, setGraph] = useState<FamilyGraph>(() => new FamilyGraph([], []))
  const [role, setRole] = useState<MembershipRole | null>(null)
  const [claimedPersonId, setClaimedPersonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!treeId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const [treeRow, people, relationships, childLinkCurves, membership] = await Promise.all([
        getTree(treeId),
        listPeople(treeId),
        listRelationships(treeId),
        listChildLinkCurves(treeId),
        getMyMembership(treeId, userId),
      ])
      setTree(treeRow)
      setGraph(new FamilyGraph(people, relationships, childLinkCurves))
      setRole(membership?.role ?? null)
      setClaimedPersonId(membership?.claimedPersonId ?? null)
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

  // Only an 'editor' with a claimed identity is scoped -- an owner's edit
  // rights are never restricted, and a plain editor-with-no-claim-yet edits
  // nothing until they pick who they are (the ClaimIdentityModal gate).
  const editableScope = useMemo(
    () => (role === 'editor' && claimedPersonId ? graph.editableScope(claimedPersonId) : new Set<string>()),
    [role, claimedPersonId, graph],
  )

  const canEditPerson = useCallback(
    (personId: string) => role === 'owner' || editableScope.has(personId),
    [role, editableScope],
  )

  const needsIdentityClaim = role === 'editor' && claimedPersonId === null

  return {
    tree,
    graph,
    role,
    canEdit,
    claimedPersonId,
    editableScope,
    canEditPerson,
    needsIdentityClaim,
    loading,
    error,
    refresh,
  }
}
