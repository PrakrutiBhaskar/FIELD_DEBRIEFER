import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/visits')

  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F0E8' }}>
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: '#B5521B' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3L19 7V11C19 15.4 15.4 19.4 11 20C6.6 19.4 3 15.4 3 11V7L11 3Z"
                fill="white" fillOpacity="0.9"/>
              <path d="M8 11L10 13L14 9" stroke="#B5521B" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>Field Debrief</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>The/Nudge Foundation</p>
        </div>

        <div className="rounded-2xl p-6 shadow-sm" style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm mb-4"
              style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {error === 'oauth_failed'
                ? 'Sign-in failed. Please try again.'
                : 'An error occurred. Please try again.'}
            </div>
          )}

          <p className="text-sm mb-5 text-center" style={{ color: '#6B7C74' }}>
            Use your The/Nudge Foundation email to sign in
          </p>

          <form action="/auth/login" method="POST">
            <button type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all"
              style={{ background: '#FDFAF5', border: '1px solid #DDD6C8', color: '#1E2A22' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#6B7C74' }}>
          Access restricted to The/Nudge Foundation staff
        </p>
      </div>
    </div>
  )
}