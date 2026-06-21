'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

type Profile = {
  full_name: string
  role: string
}

export default function Navbar() {
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const cached = sessionStorage.getItem('user_profile')
    if (cached) { setProfile(JSON.parse(cached)); return }
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) { setProfile(data); sessionStorage.setItem('user_profile', JSON.stringify(data)) }
        })
    })
  }, [])

  const handleSignOut = async () => {
    sessionStorage.clear()
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'global' })
    window.location.href = '/login'
  }

  if (pathname.startsWith('/login') || pathname.startsWith('/auth')) return null

  const navLinks = [
    { href: '/visits',    label: 'My Visits',   roles: ['officer', 'manager', 'admin'] },
    { href: '/submit',    label: 'New Visit',    roles: ['officer', 'manager', 'admin'] },
    { href: '/dashboard', label: 'Dashboard',    roles: ['manager', 'admin'] },
    { href: '/admin',     label: 'Admin',        roles: ['admin'] },
  ]

  const visibleLinks = navLinks.filter(l => profile?.role && l.roles.includes(profile.role))

  return (
    <nav style={{ background: '#FDFAF5', borderBottom: '1px solid #DDD6C8' }} className="px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: '#B5521B', fontWeight: 700, fontSize: '1rem' }}>Field Debrief</span>
          <span style={{ color: '#DDD6C8', fontSize: '0.75rem' }}>·</span>
          <span style={{ color: '#6B7C74', fontSize: '0.75rem' }}>The/Nudge Foundation</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          <div className="flex gap-1">
            {visibleLinks.map(l => (
              <Link key={l.href} href={l.href}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                style={pathname === l.href
                  ? { background: '#FAE8DF', color: '#B5521B', fontWeight: 600 }
                  : { color: '#6B7C74' }
                }
              >
                {l.label}
              </Link>
            ))}
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <div style={{ background: '#EDE7D9', borderRadius: '999px', padding: '0.25rem 0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#4A3728', fontWeight: 500 }}>
                  {profile.full_name.split(' ')[0]}
                </span>
              </div>
              <button onClick={handleSignOut}
                className="text-xs transition-colors"
                style={{ color: '#6B7C74' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="sm:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen} aria-label="Toggle navigation menu"
        >
          <span className={`block w-5 h-0.5 transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}
            style={{ background: '#4A3728' }}></span>
          <span className={`block w-5 h-0.5 transition-opacity ${menuOpen ? 'opacity-0' : ''}`}
            style={{ background: '#4A3728' }}></span>
          <span className={`block w-5 h-0.5 transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}
            style={{ background: '#4A3728' }}></span>
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #DDD6C8' }}>
          {visibleLinks.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-sm rounded-lg transition-colors"
              style={pathname === l.href
                ? { background: '#FAE8DF', color: '#B5521B', fontWeight: 600 }
                : { color: '#4A3728' }
              }
            >
              {l.label}
            </Link>
          ))}
          {profile && (
            <div className="pt-2 mt-2" style={{ borderTop: '1px solid #DDD6C8' }}>
              <p className="px-3 text-xs mb-2" style={{ color: '#6B7C74' }}>
                {profile.full_name} · {profile.role}
              </p>
              <button onClick={handleSignOut}
                className="w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors"
                style={{ color: '#C0392B' }}
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