import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { getInviteInfo, redeemInvite, type InviteInfo } from '@/services/inviteService'
import { useAuthStore } from '@/stores/authStore'
import { toastError } from '@/stores/toastStore'

function roleLabelKey(role: InviteInfo['role']) {
  return role === 'owner' ? 'dashboard.roleOwner' : role === 'editor' ? 'dashboard.roleEditor' : 'dashboard.roleViewer'
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const initializing = useAuthStore((s) => s.initializing)

  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) return
    getInviteInfo(token)
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [token])

  const handleAccept = async () => {
    if (!token) return
    setAccepting(true)
    try {
      const treeId = await redeemInvite(token)
      navigate(`/tree/${treeId}`, { replace: true })
    } catch (err) {
      toastError(err, t('invite.acceptError'))
    } finally {
      setAccepting(false)
    }
  }

  const loading = info === undefined || initializing

  return (
    <AuthLayout title={t('invite.title')} subtitle="">
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : !info || !info.isValid ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-ink-600">{!info ? t('invite.notFound') : t('invite.expiredOrUsed')}</p>
          <Link to="/dashboard" className="text-sm font-medium text-root-600 hover:underline">
            {t('errors.goToDashboard')}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-ink-600">
            {t('invite.description', { treeName: info.treeName, role: t(roleLabelKey(info.role)) })}
          </p>
          {user ? (
            <Button onClick={handleAccept} loading={accepting} className="w-full">
              {t('invite.acceptButton')}
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-3">
              <p className="text-xs text-ink-500">{t('invite.loginPrompt')}</p>
              <Link to="/login" state={{ from: `/invite/${token}` }} className="w-full">
                <Button className="w-full">{t('auth.signIn')}</Button>
              </Link>
              <Link to="/register" state={{ from: `/invite/${token}` }} className="w-full">
                <Button variant="secondary" className="w-full">
                  {t('auth.signUp')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </AuthLayout>
  )
}
