import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_TYPES: Record<string, { ext: string; bucket: string }> = {
  'audio/mpeg':  { ext: 'mp3',  bucket: 'voice-memos' },
  'audio/mp3':   { ext: 'mp3',  bucket: 'voice-memos' },
  'audio/wav':   { ext: 'wav',  bucket: 'voice-memos' },
  'audio/webm':  { ext: 'webm', bucket: 'voice-memos' },
  'image/jpeg':  { ext: 'jpg',  bucket: 'visit-photos' },
  'image/jpg':   { ext: 'jpg',  bucket: 'visit-photos' },
  'image/png':   { ext: 'png',  bucket: 'visit-photos' },
  'image/webp':  { ext: 'webp', bucket: 'visit-photos' },
  'image/heic':  { ext: 'heic', bucket: 'visit-photos' },
}

const MAX_AUDIO = 10 * 1024 * 1024  // 10MB
const MAX_IMAGE =  5 * 1024 * 1024  //  5MB

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const typeConfig = ALLOWED_TYPES[file.type]
  if (!typeConfig) {
    return NextResponse.json({
      error: 'Invalid file type. Allowed: MP3, WAV, WebM, JPG, PNG, WebP, HEIC.'
    }, { status: 400 })
  }

  const maxSize = typeConfig.bucket === 'voice-memos' ? MAX_AUDIO : MAX_IMAGE
  if (file.size > maxSize) {
    return NextResponse.json({
      error: `File too large. Max size: ${maxSize / 1024 / 1024}MB.`
    }, { status: 400 })
  }

  const path = `${user.id}/${crypto.randomUUID()}.${typeConfig.ext}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(typeConfig.bucket)
    .upload(path, buffer, { contentType: file.type })

  if (uploadError) {
    console.error('Upload error:', uploadError.message)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  return NextResponse.json({ path, bucket: typeConfig.bucket }, { status: 201 })
}