import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateUserSchema = z.object({
  role:      z.enum(['officer', 'manager', 'admin']).optional(),
  region:    z.string().max(200).optional(),
  is_active: z.boolean().optional(),
})

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!await checkAdmin(supabase, user.id)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
  }

  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.issues[0].message
    }, { status: 400 })
  }

  const updates = parsed.data

  // Prevent self-demotion or self-deactivation
  if (id === user.id) {
    if (updates.role && updates.role !== 'admin') {
      return NextResponse.json({
        error: 'SELF_DEMOTION',
        message: 'You cannot demote your own admin role.'
      }, { status: 400 })
    }
    if (updates.is_active === false) {
      return NextResponse.json({
        error: 'SELF_DEACTIVATION',
        message: 'You cannot deactivate your own account.'
      }, { status: 400 })
    }
  }

  // Last admin protection
  if (updates.role && updates.role !== 'admin') {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true)

    if ((count ?? 0) <= 1) {
      return NextResponse.json({
        error: 'LAST_ADMIN',
        message: 'Cannot demote the last active admin account.'
      }, { status: 400 })
    }
  }

  // Last active admin protection for deactivation
  if (updates.is_active === false) {
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (targetProfile?.role === 'admin') {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)

      if ((count ?? 0) <= 1) {
        return NextResponse.json({
          error: 'LAST_ADMIN',
          message: 'Cannot deactivate the last active admin account.'
        }, { status: 400 })
      }
    }
  }

  // Fetch existing for audit log
  const { data: existing } = await supabase
    .from('profiles')
    .select('role, is_active, region')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Admin update error:', error.message)
    return NextResponse.json({ error: 'DB_ERROR', message: 'Failed to update user.' }, { status: 500 })
  }

  // Write audit log
  await supabase.from('audit_logs').insert({
    event_type: 'admin_user_update',
    actor_id:   user.id,
    metadata: {
      target_user_id: id,
      changes:        updates,
      previous:       existing,
    },
  })

  return NextResponse.json({ success: true })
}