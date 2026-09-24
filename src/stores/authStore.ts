import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/types/database'

interface AuthState {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  /** True until the initial session check + first profile fetch resolves. */
  initializing: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: ProfileRow | null) => void
  refreshProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initializing: true,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const userId = get().user?.id
    if (!userId) {
      set({ profile: null })
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    set({ profile: data ?? null })
  },
}))

let initialized = false

/** Wires up the Supabase auth listener exactly once for the app's lifetime. */
export function initAuthListener() {
  if (initialized) return
  initialized = true

  supabase.auth.getSession().then(async ({ data }) => {
    useAuthStore.getState().setSession(data.session)
    if (data.session) await useAuthStore.getState().refreshProfile()
    useAuthStore.setState({ initializing: false })
  })

  supabase.auth.onAuthStateChange(async (_event, session) => {
    useAuthStore.getState().setSession(session)
    if (session) {
      await useAuthStore.getState().refreshProfile()
    } else {
      useAuthStore.getState().setProfile(null)
    }
    useAuthStore.setState({ initializing: false })
  })
}
