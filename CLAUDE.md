@AGENTS.md

# Aria — AI Virtual Secretary for RJ40F LLC

## What this project is
Aria is a 24/7 AI phone receptionist for RJ40F LLC (Miami). It answers calls on +1 786-841-8180, screens unknown callers via Vapi AI, logs everything in Supabase, sends SMS alerts to the owner, and shows a live dashboard.

All secrets are in `.env.local` — NEVER commit that file. It is gitignored.

---

## Phone number routing
- Owner's T-Mobile: **+1 305-988-2215** — unconditional forward set to 786-841-8180 (`**21*1+17868418180#`)
- Twilio/Vapi number: **+1 786-841-8180** — receives all forwarded calls
- Owner forward (Google Voice): **+1 786-440-0090** — where known contacts get transferred
- Owner SMS alerts: **+1 305-988-2215** — receives Twilio SMS when unknown caller is screened

## Call flow
1. Someone calls 305-988-2215 → T-Mobile forwards to 786-841-8180
2. Twilio webhook → `https://api.vapi.ai/twilio/inbound_call` (Vapi owns the number)
3. Vapi sends `assistant-request` to our server → `/api/webhook/vapi`
4. **Known contact** → webhook returns inline transfer assistant → LLM calls `transferCall` to +17864400090
5. **Unknown caller** → webhook returns `{ assistantId: "9c56de30-..." }` → Aria screens them
6. Aria collects name/company/phone/reason → calls `checkAvailability` tool → webhook sends SMS to owner → Aria holds caller

---

## Service configuration (current, as of Jun 2026)

### Vapi
- All keys/IDs are in `.env.local` (VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_SERVER_SECRET)
- Aria assistant ID: see VAPI_ASSISTANT_ID in .env.local
- Phone number ID: see aria_keys_docs.txt (do NOT commit)
- Phone number has NO `assistantId` — relies on `assistant-request` to our webhook
- Phone number server URL: `https://aria-weld-two.vercel.app/api/webhook/vapi`
- Aria assistant server URL: same webhook, same secret (VAPI_SERVER_SECRET)
- Aria assistant has `checkAvailability` tool (server-side, calls our webhook)

### Twilio
- Credentials in `.env.local` (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
- Phone number +17868418180 voice webhook: `https://api.vapi.ai/twilio/inbound_call` (POST)
- SMS sending works from this number (used for owner alerts)

### Supabase
- URL and keys in `.env.local` (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- Tables: `calls`, `contacts`
- Contacts table columns: `id`, `name`, `phone`, `notes`, `whatsapp`

### Pusher
- Keys in `.env.local` (NEXT_PUBLIC_PUSHER_KEY, PUSHER_APP_ID, PUSHER_SECRET)
- Cluster: us2

### Vercel
- Project: `flowlog-2-dev/aria` → `aria-weld-two.vercel.app`
- Deploy command: `vercel --prod --scope flowlog-2-dev --yes`
- All env vars are set in Vercel dashboard

---

## Key files
- `app/api/webhook/vapi/route.ts` — main brain: handles `assistant-request` (contact check + routing), `tool-calls` (checkAvailability → SMS), call lifecycle
- `app/api/webhook/twilio/route.ts` — legacy, not actively used (Vapi owns the number)
- `app/api/contacts/route.ts` — GET/POST contacts
- `lib/twilio.ts` — Twilio client + `sendSMSAlert()`
- `lib/supabase.ts` — Supabase helpers
- `app/page.tsx` — live dashboard (calls + contacts tabs)

---

## Whitelisted contacts (bypass Aria, transfer to owner)
Stored in Supabase `contacts` table. To add more: tell Claude the name and number.
- Fabio / +13059882215
- Fabio Mobile / +17864400090

---

## Deploy
```
git add -A && git commit -m "description" && git push origin main
vercel --prod --scope flowlog-2-dev --yes
```

## Bugs fixed (history)
- Twilio 404 → Vapi changed URL to `/twilio/inbound_call`; fixed by re-importing phone number
- 403 on assistant-request → leading spaces in Vapi secret header
- transferCall at wrong level → moved from `assistant.tools` to `model.tools`
- firstMessage blocked LLM tool call → removed firstMessage for transfer assistant
- checkAvailability not registered → added to Aria assistant via Vapi PATCH API

---

## Dashboard
https://aria-weld-two.vercel.app
