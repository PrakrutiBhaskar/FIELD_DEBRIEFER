'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type Profile = {
  full_name: string
  role: string
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const cached = sessionStorage.getItem('user_profile')
    if (cached) {
      setProfile(JSON.parse(cached))
      return
    }

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProfile(data)
            sessionStorage.setItem('user_profile', JSON.stringify(data))
          }
        })
    })
  }, [])

  const handleSignOut = async () => {
    sessionStorage.removeItem('user_profile')
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/login')
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) return null

  const navLinks = [
    { href: '/visits',    label: 'My Visits',   roles: ['officer', 'manager', 'admin'] },
    { href: '/submit',    label: 'Submit Visit', roles: ['officer', 'manager', 'admin'] },
    { href: '/dashboard', label: 'Dashboard',    roles: ['manager', 'admin'] },
    { href: '/admin',     label: 'Admin',        roles: ['admin'] },
  ]

  const visibleLinks = navLinks.filter(l => profile?.role && l.roles.includes(profile.role))

  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">

        <span className="font-bold text-slate-800 text-sm shrink-0">Field Debrief</span>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex gap-4">
            {visibleLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm transition-colors ${
                  pathname === l.href
                    ? 'text-blue-600 font-medium'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 truncate max-w-30">
                {profile.full_name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors shrink-0"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label="Toggle navigation menu"
        >
          <span className={`block w-5 h-0.5 bg-slate-600 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-slate-600 transition-opacity ${menuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-5 h-0.5 bg-slate-600 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>

      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="sm:hidden border-t border-slate-100 mt-3 pt-3 space-y-1">
          {visibleLinks.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-2 py-2.5 text-sm rounded-lg transition-colors ${
                pathname === l.href
                  ? 'text-blue-600 font-medium bg-blue-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
          {profile && (
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="px-2 text-xs text-slate-400 mb-2">
                {profile.full_name} · {profile.role}
              </p>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-2 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}