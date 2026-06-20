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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navLinks = [
    { href: '/visits', label: 'My Visits', roles: ['officer', 'manager', 'admin'] },
    { href: '/submit', label: 'Submit Visit', roles: ['officer', 'manager', 'admin'] },
    { href: '/dashboard', label: 'Dashboard', roles: ['manager', 'admin'] },
    { href: '/admin', label: 'Admin', roles: ['admin'] },
  ]

  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-slate-800 text-sm">Field Debrief</span>
          <div className="flex gap-4">
            {navLinks
              .filter(l => profile?.role && l.roles.includes(profile.role))
              .map(l => (
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
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-xs text-slate-400">{profile.full_name} · {profile.role}</span>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}