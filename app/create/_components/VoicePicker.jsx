'use client'

import { Label } from '@/components/ui/label'
import { WIZARD_LANGUAGES } from '../_data/wizardLanguages'

// NOTE: voiceLang stores the user's preferred default language as an ISO code
// (e.g., 'en-US', 'es-419'). At agent provisioning time (Phase 4 / book8-core-api),
// this code must be mapped to a specific ElevenLabs voice ID.
//
// The mapping should live in book8-core-api/src/config/voiceMapping.js (TBD).
// Default voice characters per language (initial mapping):
//   en-US → Michael
//   en-GB → Oliver  (or similar British voice ID)
//   fr-FR → Camille
//   es-419 → Sofia
//   ar → Yusuf
//   ...etc
//
// Languages without a configured voice ID fall back to ElevenLabs's
// multilingual default voice (which still speaks the selected language correctly).
//
// DO NOT expose ElevenLabs technical settings to business owners:
// - Audio tags (Excited / Patient / US accent / Empathetically / etc.)
// - TTS model family (V3 Conversational vs others)
// - Stability / Speed / Similarity sliders
// - Expressive mode toggle
// These are advanced configuration meant for developers, not service-business owners.
// All of these should remain server-side defaults configured by Book8.

export default function VoicePicker({ value, onChange, defaultLang = 'en-US' }) {
  const selected = value || defaultLang || 'en-US'
  return (
    <div className="space-y-2">
      <Label className="text-[#E2E8F0]">Default language for your AI receptionist</Label>
      <select
        value={selected}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-11 w-full rounded-xl border border-white/10 bg-[#0A0A0F] px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40"
      >
        {WIZARD_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-[#64748B]">
        Your AI also automatically detects and switches to other languages when callers speak them. We
        support 70+ languages out of the box.
      </p>
    </div>
  )
}

