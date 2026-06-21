# Privacy & Data Handling Policy
## Field Visit Debrief Tool — The/Nudge Foundation

**Last updated:** June 2026

---

## What data is collected

Field officers submit visit records containing:
- Location name and district
- Visit date, program area, duration
- Stakeholder names and roles (e.g. "Gram Panchayat head", "SHG leader")
- Text notes describing observations, conversations, and community issues
- Voice memos (audio recordings of field notes)

This data may contain personally identifiable information (PII) about community members who have not directly consented to this system.

---

## What is sent to third-party processors

### Groq (LLM inference)
- Text notes submitted by officers
- Voice transcripts generated from audio
- Aggregated visit summaries (for pattern reports)
- **Purpose:** Generate structured debrief intelligence and pattern reports
- **Retention:** Groq does not retain data beyond the API request per their [privacy policy](https://groq.com/privacy-policy/)
- **What is NOT sent:** Officer names, user IDs, authentication tokens

### AssemblyAI (voice transcription)
- Raw audio files from voice memos
- **Purpose:** Transcribe spoken field notes to text
- **Retention:** AssemblyAI deletes audio files after transcription per their [data deletion policy](https://www.assemblyai.com/docs/concepts/data-deletion)
- **What is NOT sent:** Officer names, user IDs, authentication tokens

---

## Data stored in Supabase

| Data | Location | Retention |
|---|---|---|
| Visit records | `visits` table | Indefinite (no automated deletion) |
| AI debriefs | `debriefs` table | Indefinite |
| Voice memos | `voice-memos` storage bucket | Indefinite |
| Transcripts | `visits.transcript` column | Indefinite |
| User profiles | `profiles` table | Until account deletion |

---

## PII handling commitments

1. **Stakeholder names** are stored as free text entered by officers. They are sent to Groq for debrief generation. Officers should use roles/titles rather than full names where possible (e.g. "Gram Panchayat head" rather than a person's full name).

2. **Voice memos** may contain names of community members. These are sent to AssemblyAI for transcription and then to Groq for analysis.

3. **No data is sold** to third parties or used for advertising.

4. **Access is role-gated** — officers see only their own visits, managers see only their region, admins see all.

---

## Recommended improvements (V2)

- Automated deletion of voice memos from storage after transcription is complete
- PII redaction step before sending text to Groq (replace names with role descriptors)
- Configurable data retention period with automated purge jobs
- Explicit consent mechanism for community members referenced in visit notes

---

## Contact

For data deletion requests or privacy concerns, contact The/Nudge Foundation's data officer.
