import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_TYPES: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3':  'mp3',
  'audio/wav':  'wav',
  'audio/webm': 'webm',
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Server-side MIME type validation
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
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

  // Safe path — extension derived from validated MIME type, never from filename
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