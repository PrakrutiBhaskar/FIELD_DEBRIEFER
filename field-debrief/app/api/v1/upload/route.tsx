import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp3']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Server-side type validation
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({
      error: 'Invalid file type. Only MP3, WAV, and WebM audio files are allowed.'
    }, { status: 400 })
  }

  // Server-side size validation
  if (file.size > MAX_SIZE) {
    return NextResponse.json({
      error: 'File too large. Maximum size is 10MB.'
    }, { status: 400 })
  }

  // UUID-based path to prevent collisions
  const ext = file.name.split('.').pop()
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('voice-memos')
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ path }, { status: 201 })
}