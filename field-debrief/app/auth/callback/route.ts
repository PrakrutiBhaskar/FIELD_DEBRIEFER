import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  console.log('callback hit, code:', code, 'origin:', origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('exchange error:', error)
    if (!error) {
      return NextResponse.redirect(`https://field-debriefer.vercel.app/officer/visits`)
    }
  }

  return NextResponse.redirect(`https://field-debriefer.vercel.app/login?error=callback_failed`)
}