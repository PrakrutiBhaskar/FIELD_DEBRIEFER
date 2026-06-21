'use client'

import { useEffect, useState } from 'react'
import { SkeletonPage } from '@/components/skeleton'
import { toast } from '@/components/toast'

type User = {
  id: string; full_name: string; role: string
  region: string | null; is_active: boolean; created_at: string
}

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  officer: { bg: '#EDE7D9', color: '#4A3728' },
  manager: { bg: '#E2EDE9', color: '#2D4A3E' },
  admin:   { bg: '#FAE8DF', color: '#B5521B' },
}

const inputStyle = {
  width: '100%', border: '1px solid #DDD6C8', borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem', fontSize: '0.875rem',
  background: '#FDFAF5', color: '#1E2A22', outline: 'none',
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ role: '', region: '' })

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/admin/users')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setUsers(data.users || [])
    } catch { setFetchError('Failed to load users. Please refresh.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [])

  const saveEdit = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) { toast('User updated'); setEditing(null); await fetchUsers() }
      else { const d = await res.json(); toast(d.message || 'Failed to update', 'error') }
    } catch { toast('Failed to save changes', 'error') }
  }

  const toggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      })
      if (res.ok) { toast(user.is_active ? 'User deactivated' : 'User activated'); await fetchUsers() }
      else toast('Failed to update user', 'error')
    } catch { toast('Failed to update user', 'error') }
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>Admin Panel</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>{users.length} users</p>
        </div>

        {fetchError && (
          <div className="rounded-xl p-4 text-sm mb-4"
            style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {fetchError}
          </div>
        )}

        {loading && <SkeletonPage />}

        <div className="space-y-3">
          {users.map(user => {
            const roleStyle = ROLE_STYLE[user.role] || ROLE_STYLE.officer
            const isEditing = editing === user.id
            return (
              <div key={user.id} className="rounded-2xl p-5"
                style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium" style={{ color: '#1E2A22' }}>{user.full_name}</p>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={roleStyle}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                      {!user.is_active && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                          style={{ background: '#F3F4F6', color: '#6B7280' }}>Inactive</span>
                      )}
                    </div>
                    {user.region && (
                      <p className="text-xs mt-1" style={{ color: '#6B7C74' }}>Region: {user.region}</p>
                    )}
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button onClick={() => { setEditing(isEditing ? null : user.id); setEditForm({ role: user.role, region: user.region || '' }) }}
                      className="text-xs font-medium transition-colors" style={{ color: '#B5521B' }}>
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                    <button onClick={() => toggleActive(user)}
                      className="text-xs transition-colors" style={{ color: '#6B7C74' }}>
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #EDE7D9' }}>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium mb-1 block" style={{ color: '#6B7C74' }}>Role</label>
                        <select value={editForm.role}
                          onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                          style={inputStyle}>
                          <option value="officer">Officer</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium mb-1 block" style={{ color: '#6B7C74' }}>Region</label>
                        <input type="text" value={editForm.region}
                          onChange={e => setEditForm(p => ({ ...p, region: e.target.value }))}
                          placeholder="e.g. North Karnataka" style={inputStyle} />
                      </div>
                      <div className="flex items-end">
                        <button onClick={() => saveEdit(user.id)}
                          className="rounded-xl px-4 py-2 text-sm font-medium"
                          style={{ background: '#2D4A3E', color: '#FDFAF5' }}>
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}