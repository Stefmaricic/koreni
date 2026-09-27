import { supabase } from '@/lib/supabase'
import type { FeedbackRow } from '@/types/database'

export async function submitFeedback(userId: string, userEmail: string | null, message: string, pagePath: string) {
  const { error } = await supabase.from('feedback').insert({
    user_id: userId,
    user_email: userEmail,
    message: message.trim(),
    page_path: pagePath,
  })
  if (error) throw error
}

/** Only ever returns rows for the app owner's account (enforced by RLS, not just this filter). */
export async function listFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as FeedbackRow[]
}
