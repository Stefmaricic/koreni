import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Input'
import {
  createInvite,
  listInvites,
  listTreeMembers,
  removeMember,
  revokeInvite,
  type InviteRole,
  type TreeMemberSummary,
} from '@/services/inviteService'
import { useAuthStore } from '@/stores/authStore'
import { toastError, useToastStore } from '@/stores/toastStore'
import type { TreeInviteRow } from '@/types/database'
import type { MembershipRole } from '@/types/models'

interface ShareTreeModalProps {
  open: boolean
  onClose: () => void
  treeId: string
}

function roleLabelKey(role: MembershipRole) {
  return role === 'owner' ? 'dashboard.roleOwner' : role === 'editor' ? 'dashboard.roleEditor' : 'dashboard.roleViewer'
}

function isActiveInvite(invite: TreeInviteRow) {
  return !invite.revoked && !invite.used_by && new Date(invite.expires_at) > new Date()
}

export function ShareTreeModal({ open, onClose, treeId }: ShareTreeModalProps) {
  const { t, i18n } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const push = useToastStore((s) => s.push)

  const [members, setMembers] = useState<TreeMemberSummary[] | null>(null)
  const [invites, setInvites] = useState<TreeInviteRow[] | null>(null)
  const [role, setRole] = useState<InviteRole>('editor')
  const [generating, setGenerating] = useState(false)
  const [removing, setRemoving] = useState<TreeMemberSummary | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    listTreeMembers(treeId).then(setMembers).catch((err) => toastError(err))
    listInvites(treeId).then(setInvites).catch((err) => toastError(err))
  }, [open, treeId])

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      push(t('tree.shareLinkCopied'), 'success')
    } catch {
      window.prompt(t('tree.shareCopyLink'), url)
    }
  }

  const handleGenerate = async () => {
    if (!userId) return
    setGenerating(true)
    try {
      const invite = await createInvite(treeId, role, userId)
      setInvites((prev) => [invite, ...(prev ?? [])])
      await copyLink(invite.token)
    } catch (err) {
      toastError(err, t('tree.shareCreateError'))
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite(id)
      setInvites((prev) => prev?.map((i) => (i.id === id ? { ...i, revoked: true } : i)) ?? null)
      push(t('tree.shareRevoked'), 'success')
    } catch (err) {
      toastError(err)
    }
  }

  const handleRemove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    try {
      await removeMember(treeId, removing.userId)
      setMembers((prev) => prev?.filter((m) => m.userId !== removing.userId) ?? null)
      setRemoving(null)
      push(t('tree.shareRemoved'), 'success')
    } catch (err) {
      toastError(err, t('tree.shareRemoveError'))
    } finally {
      setRemoveBusy(false)
    }
  }

  const activeInvites = invites?.filter(isActiveInvite) ?? []

  const roleOptions: { value: InviteRole; label: string }[] = [
    { value: 'editor', label: t('dashboard.roleEditor') },
    { value: 'viewer', label: t('dashboard.roleViewer') },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('tree.shareTitle')} size="md">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-700">{t('tree.shareMembersTitle')}</h3>
          <div className="flex flex-col gap-2">
            {members?.map((member) => (
              <div key={member.userId} className="flex items-center gap-2.5">
                <Avatar firstName={member.displayName ?? undefined} size="sm" />
                <span className="flex-1 text-sm text-ink-700">{member.displayName ?? t('common.unknown')}</span>
                <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">
                  {t(roleLabelKey(member.role))}
                </span>
                {member.role !== 'owner' && member.userId !== userId && (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    className="rounded-full px-2 py-1 text-xs font-medium text-red-600 hover:bg-cream-100"
                  >
                    {t('tree.shareRemoveMember')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-cream-200 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-ink-700">{t('tree.shareInviteTitle')}</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select
                label={t('tree.shareRoleLabel')}
                value={role}
                onChange={(v) => setRole(v as InviteRole)}
                options={roleOptions}
              />
            </div>
            <Button onClick={handleGenerate} loading={generating}>
              {t('tree.shareGenerateLink')}
            </Button>
          </div>
        </div>

        {activeInvites.length > 0 && (
          <div className="border-t border-cream-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-ink-700">{t('tree.sharePendingTitle')}</h3>
            <div className="flex flex-col gap-2">
              {activeInvites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-2 rounded-xl border border-cream-200 p-2.5">
                  <span className="rounded-full bg-cream-100 px-2.5 py-0.5 text-xs font-medium text-ink-600">
                    {t(roleLabelKey(invite.role))}
                  </span>
                  <span className="flex-1 text-xs text-ink-500">
                    {t('tree.shareExpiresAt', { date: new Date(invite.expires_at).toLocaleDateString(i18n.resolvedLanguage) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyLink(invite.token)}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-root-600 hover:bg-cream-100"
                  >
                    {t('tree.shareCopyLink')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite.id)}
                    className="rounded-full px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-cream-100"
                  >
                    {t('tree.shareRevoke')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('tree.shareRemoveConfirmTitle')}
        body={t('tree.shareRemoveConfirmBody', { name: removing?.displayName ?? t('common.unknown') })}
        confirmLabel={t('tree.shareRemoveMember')}
        danger
        loading={removeBusy}
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />
    </Modal>
  )
}
