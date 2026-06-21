'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAM_AREAS } from '@/lib/schemas'
import { toast } from '@/components/toast'

type Location = { id: string; name: string; district: string }

const inputStyle = {
  width: '100%',
  border: '1px solid #DDD6C8',
  borderRadius: '0.75rem',
  padding: '0.625rem 0.75rem',
  fontSize: '0.875rem',
  background: '#FDFAF5',
  color: '#1E2A22',
  outline: 'none',
}

export default function SubmitVisitPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const [form, setForm] = useState({
    location_id: '', visit_date: new Date().toISOString().split('T')[0],
    program_area: '', stakeholders: '', duration_mins: '', text_notes: '',
  })
  const [voiceFile, setVoiceFile] = useState<File | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  useEffect(() => {
    const saved = sessionStorage.getItem('visit_form_draft')
    if (saved) setForm(JSON.parse(saved))
  }, [])
  useEffect(() => { sessionStorage.setItem('visit_form_draft', JSON.stringify(form)) }, [form])
  useEffect(() => {
    const cached = sessionStorage.getItem('locations_cache')
    if (cached) { setLocations(JSON.parse(cached)); return }
    fetch('/api/v1/locations').then(r => r.json()).then(d => {
      const locs = d.locations || []
      setLocations(locs)
      sessionStorage.setItem('locations_cache', JSON.stringify(locs))
    })
  }, [])

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, [photoPreviews])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const total = photos.length + files.length
    if (total > 5) { setError('Maximum 5 photos allowed'); return }

    const oversized = files.find(f => f.size > 5 * 1024 * 1024)
    if (oversized) { setError('Each photo must be under 5MB'); return }

    const newPreviews = files.map(f => URL.createObjectURL(f))
    setPhotos(prev => [...prev, ...files])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
    setError('')
    // reset input so same file can be re-added after removal
    e.target.value = ''
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotos(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setVoiceFile(new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 89) { stopRecording(); return 90 }
          return t + 1
        })
      }, 1000)
    } catch { setError('Microphone access denied. Please allow microphone access and try again.') }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.text_notes && !voiceFile) { setError('Please provide text notes or a voice memo'); return }
    setLoading(true)
    try {
      let voice_memo_path = null
      if (voiceFile) {
        const fd = new FormData()
        fd.append('file', voiceFile)
        const ur = await fetch('/api/v1/upload', { method: 'POST', body: fd })
        const ud = await ur.json()
        if (!ur.ok) throw new Error(ud.error || 'Voice upload failed')
        voice_memo_path = ud.path
      }

      // Upload photos
      const photo_paths: string[] = []
      for (const photo of photos) {
        const fd = new FormData()
        fd.append('file', photo)
        const ur = await fetch('/api/v1/upload', { method: 'POST', body: fd })
        const ud = await ur.json()
        if (!ur.ok) throw new Error(ud.error || 'Photo upload failed')
        photo_paths.push(ud.path)
      }

      const res = await fetch('/api/v1/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration_mins: form.duration_mins ? Number(form.duration_mins) : undefined,
          stakeholders: form.stakeholders ? form.stakeholders.split(',').map(s => s.trim()).filter(Boolean) : [],
          voice_memo_path,
          photo_paths: photo_paths.length > 0 ? photo_paths : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Submission failed')
      sessionStorage.removeItem('visit_form_draft')
      toast('Visit submitted — debrief generating…')
      router.push(`/visits/${data.visit_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  const Label = ({ children, required: req }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-sm font-medium mb-1.5" style={{ color: '#4A3728' }}>
      {children}{req && <span style={{ color: '#B5521B' }}> *</span>}
    </label>
  )

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#F5F0E8' }}>
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1E2A22' }}>New Visit</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7C74' }}>Fields marked * are required</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl p-6 space-y-5"
          style={{ background: '#FDFAF5', border: '1px solid #DDD6C8' }}>

          <div>
            <Label required>Location</Label>
            <select name="location_id" value={form.location_id} onChange={handleChange} required style={inputStyle}>
              <option value="">Select a location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}, {l.district} district</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label required>Visit date</Label>
              <input type="date" name="visit_date" value={form.visit_date} onChange={handleChange}
                max={new Date().toISOString().split('T')[0]} required style={inputStyle} />
            </div>
            <div>
              <Label>Duration</Label>
              <div className="relative">
                <input type="number" name="duration_mins" value={form.duration_mins} onChange={handleChange}
                  placeholder="mins" min="1" style={{ ...inputStyle, paddingRight: '2.5rem' }} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#6B7C74' }}>min</span>
              </div>
            </div>
          </div>

          <div>
            <Label required>Program area</Label>
            <select name="program_area" value={form.program_area} onChange={handleChange} required style={inputStyle}>
              <option value="">Select program area</option>
              {PROGRAM_AREAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <Label>Stakeholders met</Label>
            <input type="text" name="stakeholders" value={form.stakeholders} onChange={handleChange}
              placeholder="e.g. Gram Panchayat head, SHG leader" style={inputStyle} />
          </div>

          <div>
            <Label>Notes <span className="font-normal" style={{ color: '#6B7C74' }}>(required if no voice memo)</span></Label>
            <textarea name="text_notes" value={form.text_notes} onChange={handleChange} rows={5}
              placeholder="What happened during the visit? Key observations, conversations, issues…"
              style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {/* Voice memo */}
          <div>
            <Label>Voice memo <span className="font-normal" style={{ color: '#6B7C74' }}>(max 90s)</span></Label>
            <div className="rounded-xl p-4" style={{ background: '#FAE8DF', border: '1px solid #F4BFA3' }}>
              <div className="flex items-center gap-3">
                {!recording ? (
                  <button type="button" onClick={startRecording}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ background: '#B5521B', color: '#FDFAF5' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: '#FDFAF5' }}></span>
                    Tap to record
                  </button>
                ) : (
                  <button type="button" onClick={stopRecording}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium animate-pulse"
                    style={{ background: '#991B1B', color: 'white' }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: 'white' }}></span>
                    Stop ({recordingTime}s / 90s)
                  </button>
                )}
                {voiceFile && !recording && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: '#2D4A3E' }}>✓ Recorded</span>
                    <button type="button" onClick={() => setVoiceFile(null)}
                      className="text-xs" style={{ color: '#B5521B' }}>Remove</button>
                  </div>
                )}
              </div>
              <p className="text-xs mt-2" style={{ color: '#92400E' }}>
                Or upload a file (MP3/WAV/WebM, max 10MB)
              </p>
              <input type="file" accept="audio/mpeg,audio/wav,audio/webm"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (f.size > 10 * 1024 * 1024) { setError('Voice memo must be under 10MB'); return }
                  setError(''); setVoiceFile(f)
                }}
                className="mt-2 w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium"
                style={{ color: '#6B7C74' }} />
            </div>
          </div>

          {/* Photos */}
          <div>
            <Label>Photos <span className="font-normal" style={{ color: '#6B7C74' }}>(up to 5, max 5MB each)</span></Label>
            <div className="rounded-xl p-4" style={{ background: '#F0F4F2', border: '1px solid #C8D9D3' }}>

              {/* Previews grid */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden"
                      style={{ aspectRatio: '1', background: '#DDD6C8' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: 'rgba(0,0,0,0.55)', color: 'white', lineHeight: 1 }}>
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Add more tile */}
                  {photos.length < 5 && (
                    <button type="button" onClick={() => photoInputRef.current?.click()}
                      className="rounded-lg flex flex-col items-center justify-center gap-1 transition-colors"
                      style={{ aspectRatio: '1', border: '1.5px dashed #8FAF9F', background: 'transparent' }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4V16M4 10H16" stroke="#2D4A3E" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <span className="text-xs" style={{ color: '#2D4A3E' }}>Add</span>
                    </button>
                  )}
                </div>
              )}

              {/* Empty state — tap to pick */}
              {photoPreviews.length === 0 && (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-lg py-6 transition-colors"
                  style={{ border: '1.5px dashed #8FAF9F', background: 'transparent' }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="2" y="6" width="24" height="18" rx="3" stroke="#2D4A3E" strokeWidth="1.5"/>
                    <circle cx="14" cy="15" r="4" stroke="#2D4A3E" strokeWidth="1.5"/>
                    <path d="M9 6L10.5 3H17.5L19 6" stroke="#2D4A3E" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span className="text-sm font-medium" style={{ color: '#2D4A3E' }}>Tap to add photos</span>
                  <span className="text-xs" style={{ color: '#6B7C74' }}>JPG, PNG or HEIC</span>
                </button>
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/webp"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
              />

              {photos.length > 0 && (
                <p className="text-xs mt-2" style={{ color: '#6B7C74' }}>
                  {photos.length} / 5 photo{photos.length !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-xl px-4 py-3 text-sm"
              style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium transition-colors"
            style={{ background: loading ? '#D9A08A' : '#B5521B', color: '#FDFAF5', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Submitting…' : 'Submit visit'}
          </button>
        </form>
      </div>
    </div>
  )
}