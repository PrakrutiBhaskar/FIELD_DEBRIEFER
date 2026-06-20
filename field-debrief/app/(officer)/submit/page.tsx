'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAM_AREAS } from '@/lib/schemas'

type Location = { id: string; name: string; district: string }

export default function SubmitVisitPage() {
  const [recording, setRecording] = useState(false)
const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
const [recordingTime, setRecordingTime] = useState(0)
const timerRef = useRef<NodeJS.Timeout | null>(null)
const chunksRef = useRef<Blob[]>([])
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    location_id:   '',
    visit_date:    new Date().toISOString().split('T')[0],
    program_area:  '',
    stakeholders:  '',
    duration_mins: '',
    text_notes:    '',
  })

  const [voiceFile, setVoiceFile] = useState<File | null>(null)

  // Restore from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem('visit_form_draft')
    if (saved) setForm(JSON.parse(saved))
  }, [])

  // Save to sessionStorage on every change
  useEffect(() => {
    sessionStorage.setItem('visit_form_draft', JSON.stringify(form))
  }, [form])

  // Fetch locations
  useEffect(() => {
    fetch('/api/v1/locations')
      .then(r => r.json())
      .then(d => setLocations(d.locations || []))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleVoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Voice memo must be under 10MB')
      return
    }
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp3']
    if (!allowed.includes(file.type)) {
      setError('Only MP3, WAV, or WebM audio files are allowed')
      return
    }
    setError('')
    setVoiceFile(file)
  }

  const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' })
      setVoiceFile(file)
      stream.getTracks().forEach(t => t.stop())
    }

    recorder.start()
    setMediaRecorder(recorder)
    setRecording(true)
    setRecordingTime(0)

    timerRef.current = setInterval(() => {
      setRecordingTime(t => {
        if (t >= 89) {
          stopRecording()
          return 90
        }
        return t + 1
      })
    }, 1000)
  } catch {
    setError('Microphone access denied. Please allow microphone access and try again.')
  }
}

const stopRecording = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  setRecording(false)
  if (timerRef.current) clearInterval(timerRef.current)
}

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.text_notes && !voiceFile) {
      setError('Please provide text notes or a voice memo')
      return
    }

    setLoading(true)

    try {
      let voice_memo_path = null

      // Upload voice memo if present
      if (voiceFile) {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const path = `${user!.id}/${Date.now()}.${voiceFile.name.split('.').pop()}`
        const { error: uploadError } = await supabase.storage
          .from('voice-memos')
          .upload(path, voiceFile)
        if (uploadError) throw new Error('Voice upload failed')
        voice_memo_path = path
      }

      const res = await fetch('/api/v1/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          duration_mins: form.duration_mins ? Number(form.duration_mins) : undefined,
          stakeholders: form.stakeholders
            ? form.stakeholders.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          voice_memo_path,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Submission failed')

      sessionStorage.removeItem('visit_form_draft')
      router.push(`/visits/${data.visit_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Submit Field Visit</h1>
          <p className="text-slate-500 text-sm mt-1">All fields marked * are required</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
            <select
              name="location_id"
              value={form.location_id}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a location</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name} — {l.district}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Visit Date *</label>
            <input
              type="date"
              name="visit_date"
              value={form.visit_date}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Program Area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Program Area *</label>
            <select
              name="program_area"
              value={form.program_area}
              onChange={handleChange}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select program area</option>
              {PROGRAM_AREAS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Stakeholders */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Stakeholders Met <span className="text-slate-400">(comma separated)</span>
            </label>
            <input
              type="text"
              name="stakeholders"
              value={form.stakeholders}
              onChange={handleChange}
              placeholder="e.g. Gram Panchayat head, SHG leader"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
            <input
              type="number"
              name="duration_mins"
              value={form.duration_mins}
              onChange={handleChange}
              placeholder="e.g. 90"
              min="1"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Text Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes <span className="text-slate-400">(required if no voice memo)</span>
            </label>
            <textarea
              name="text_notes"
              value={form.text_notes}
              onChange={handleChange}
              rows={5}
              placeholder="What happened during the visit? Key observations, conversations, issues..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Voice Memo */}
          {/* Voice Memo */}
<div>
  <label className="block text-sm font-medium text-slate-700 mb-2">
    Voice Memo <span className="text-slate-400">(max 90s)</span>
  </label>

  {/* In-app recorder */}
  <div className="flex items-center gap-3 mb-3">
    {!recording ? (
      <button
        type="button"
        onClick={startRecording}
        className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        Record Voice Note
      </button>
    ) : (
      <button
        type="button"
        onClick={stopRecording}
        className="flex items-center gap-2 bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors animate-pulse"
      >
        <span className="w-2 h-2 rounded-full bg-white"></span>
        Stop Recording ({recordingTime}s)
      </button>
    )}
  </div>

  {/* File upload fallback */}
  <p className="text-xs text-slate-400 mb-2">Or upload a file (MP3/WAV/WebM, max 10MB)</p>
  <input
    type="file"
    accept="audio/mpeg,audio/wav,audio/webm"
    onChange={handleVoiceChange}
    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
  />
  {voiceFile && (
    <div className="flex items-center justify-between mt-2">
      <p className="text-xs text-green-600">✓ {voiceFile.name}</p>
      <button
        type="button"
        onClick={() => setVoiceFile(null)}
        className="text-xs text-red-500 hover:underline"
      >
        Remove
      </button>
    </div>
  )}
</div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Visit'}
          </button>
        </form>
      </div>
    </div>
  )
}