# GetRight voice assistant foundation (inactive)

This branch contains an **inert contract**, not an activated assistant. The existing GPS, radar, navigation, load records, offline storage and weather code are unchanged.

## Planned architecture

1. **Wake/transport layer**: user-initiated microphone permission, push-to-talk first. Recognize the phrase "Hey GetRight" only while an explicitly active foreground listening session is running. iOS Safari/PWA background listening is not assumed; locked-screen wake requires a separately evaluated platform-specific solution. No microphone listener is included in this change.
2. **Conversation coordinator**: preserve bounded conversational context; route explicit trucking questions to domain-specific read-only tools, general questions to an optional conversational model adapter. Maintain mode labels `trucking`, `general`, and `auto`. Do not infer live data from the user's utterance.
3. **Data adapters**: read-only, provenance-tagged integrations for navigation/GPS, route weather and warnings, loads, earnings/expenses, equipment, maintenance, IFTA, ELD and regulations. Each adapter must report `live`, `simulated`, or `unavailable`, timestamps and authorization status. No fabricated GPS/ELD or weather.
4. **Server AI gateway**: future authenticated, rate-limited, audited backend with provider-specific adapters (e.g. OpenAI). Keep secrets on server; no API key or model calls in the client. Disabled until explicit approval and cost review. Do not pass sensitive loads/location/history to providers without a privacy review and user consent.
5. **Action policy**: all consequential actions, including calls, messaging, load changes, navigation starts, purchases and settings changes, require a fresh explicit confirmation of a complete action preview. The contract only constructs proposals; it never executes them.
6. **Retell AI adapter (future)**: outbound calls to brokers, repair shops and other businesses require explicit recipient, purpose, number verification and confirmation; consent, recording, disclosure and calling rules require separate review. Not connected.
7. **Voice quota**: server-authoritative future minute ledger with idempotent usage events, plan allowances, top-ups and 60/20-minute warnings. The pure local calculation here is illustrative only, not billing or a security boundary.
8. **Voice UX**: explicit microphone status, stop/mute, clear simulated/live badges, safe interruptions and hands-free readback. Never promise always-on wake or continuous iOS background access.

## Current scope and safeguards

`getright-voice-foundation.js` exports a pure, provider-independent contract for wake phrase parsing, bounded turns, source labels, action confirmation proposals, minute thresholds and a provider boundary that always rejects calls. It is not referenced by the production HTML, has no network or storage access, and makes no microphone calls.

The test file `tests/getright-voice-foundation.test.cjs` is designed for Node's built-in test runner:
`node --test tests/getright-voice-foundation.test.cjs`.

## Still required

- Actual repository checkout and full CI/browser regression, including pending Stage 8 GPS/weather browser tests.
- Privacy and retention design; backend auth, rate limits, quota ledger and provider cost approval.
- Real microphone/ASR/TTS integration and foreground wake phrase testing on physical iPhone/iPad.
- Read-only adapters to existing data APIs; strict confirmation and authenticated execution endpoints.
- Retell calling consent/compliance and usage accounting review.
- Explicit user authorization before any paid provider activation or deployment.
