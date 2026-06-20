import { z } from 'zod'

export const PROGRAM_AREAS = [
  'Rural Livelihoods',
  'Agriculture',
  'Skilling',
  'Economic Inclusion',
  'Other',
] as const

export const visitSubmitSchema = z.object({
  location_id:   z.string().uuid({ message: 'Please select a location' }),
  visit_date:    z.string().refine(d => new Date(d) <= new Date(), {
    message: 'Visit date cannot be in the future',
  }),
  program_area:  z.enum(PROGRAM_AREAS, { message: 'Please select a program area' }),
  stakeholders:  z.array(z.string()).optional(),
  duration_mins: z.coerce.number().positive().optional(),
  text_notes:    z.string().optional(),
})

export const debriefOutputSchema = z.object({
  key_findings:        z.array(z.string()).min(1),
  blockers:            z.array(z.string()),
  community_sentiment: z.enum(['Positive', 'Mixed', 'Negative']),
  follow_ups:          z.array(z.string()),
  nudge_flag:          z.enum(['Routine', 'Needs Attention', 'Escalate']),
  recurring_issues:    z.array(z.string()),
  summary:             z.string().min(20),
})

export const officerNoteSchema = z.object({
  note: z.string().min(1).max(2000),
})

export const patternRequestSchema = z.object({
  visit_ids: z.array(z.string().uuid()).min(3).max(30),
  filter_context: z.object({
    location:     z.string().optional(),
    program_area: z.string().optional(),
    date_range:   z.object({
      from: z.string(),
      to:   z.string(),
    }).optional(),
  }).optional(),
})