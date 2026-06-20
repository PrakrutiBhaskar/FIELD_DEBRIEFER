'use client'

import { useEffect, useState } from 'react'

type User = {
  id: string
  full_name: string
  role: string
  region: string | null
  is_active: boolean
  created_at: string
}

const roleColor: Record<string, string> = {
  officer: 'bg-slate-100 text-slate-600',
  manager: 'bg-blue-100 text-blue-700',
  admin: 'bg-purple-100 text-purple-700',
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ role: '', region: '' })

  const fetchUsers = async () => {
    const res = await fetch('/api/v1/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const startEdit = (user: User) => {
    setEditing(user.id)
    setEditForm({ role: user.role, region: user.region || '' })
  }

  const saveEdit = async (userId: string) => {
    await fetch(`/api/v1/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditing(null)
    await fetchUsers()
  }

  const toggleActive = async (user: User) => {
    await fetch(`/api/v1/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    await fetchUsers()
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} users</p>
        </div>

        {loading && (
          <p className="text-slate-400 text-sm text-center py-12">Loading...</p>
        )}

        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{user.full_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor[user.role]}`}>
                      {user.role}
                    </span>
                    {!user.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  {user.region && (
                    <p className="text-xs text-slate-400 mt-0.5">Region: {user.region}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(user)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(user)}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>

              {editing === user.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Role</label>
                      <select
                        value={editForm.role}
                        onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="officer">Officer</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Region</label>
                      <input
                        type="text"
                        value={editForm.region}
                        onChange={e => setEditForm(p => ({ ...p, region: e.target.value }))}
                        placeholder="e.g. North Karnataka"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(user.id)}
                      className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}