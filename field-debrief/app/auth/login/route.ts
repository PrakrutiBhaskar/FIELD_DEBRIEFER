import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function POST() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `https://field-debriefer.vercel.app/auth/callback`,
    },
  })

  if (error) redirect('/login?error=oauth_failed')
  if (data.url) redirect(data.url)
}