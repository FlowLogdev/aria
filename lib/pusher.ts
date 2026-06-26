import Pusher from 'pusher'
import PusherJS from 'pusher-js'

// Server-side Pusher (for triggering events from API routes)
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export const ARIA_CHANNEL = 'aria-calls'

export type PusherEvent =
  | { type: 'INCOMING_KNOWN'; call: import('./supabase').Call }
  | { type: 'INCOMING_UNKNOWN'; call: import('./supabase').Call }
  | { type: 'CALL_SCREENING'; callId: string; vapiCallId: string }
  | { type: 'TRANSCRIPT_UPDATE'; callId: string; text: string }
  | { type: 'CALLER_INFO_READY'; callId: string; callerName: string; callerCompany: string; callerPhone: string; callerReason: string; line: string }
  | { type: 'CALL_ENDED'; callId: string; duration: number }

export async function pushEvent(event: PusherEvent) {
  await pusherServer.trigger(ARIA_CHANNEL, event.type, event)
}

// Client-side Pusher singleton
let pusherClient: PusherJS | null = null

export function getPusherClient(): PusherJS {
  if (!pusherClient) {
    pusherClient = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
  }
  return pusherClient
}
