import { createClient } from '@supabase/supabase-js'

export type Contact = {
  id: string
  name: string
  phone: string
  whatsapp: boolean
  notes: string | null
  created_at: string
}

export type Call = {
  id: string
  call_sid: string | null
  vapi_call_id: string | null
  from_number: string
  display_name: string | null
  channel: 'phone' | 'whatsapp'
  line: string | null
  status: 'ringing' | 'screening' | 'holding' | 'picked_up' | 'voicemail' | 'ended'
  caller_name: string | null
  caller_company: string | null
  caller_reason: string | null
  duration_seconds: number | null
  transcript: string | null
  summary: string | null
  recording_url: string | null
  started_at: string
  ended_at: string | null
  owner_decision: 'pickup' | 'voicemail' | null
}

export type CallInsert = Omit<Call, 'id' | 'started_at'>
export type CallUpdate = Partial<Omit<Call, 'id'>>

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient(supabaseUrl, supabaseAnonKey) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey) as any

export async function findContactByPhone(phone: string): Promise<Contact | null> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('phone', phone)
    .single()
  return data as Contact | null
}

export async function insertCall(call: CallInsert): Promise<Call | null> {
  const { data } = await supabaseAdmin
    .from('calls')
    .insert(call)
    .select()
    .single()
  return data as Call | null
}

export async function updateCall(id: string, updates: CallUpdate): Promise<Call | null> {
  const { data } = await supabaseAdmin
    .from('calls')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return data as Call | null
}

export async function getCallByVapiId(vapiCallId: string): Promise<Call | null> {
  const { data } = await supabaseAdmin
    .from('calls')
    .select('*')
    .eq('vapi_call_id', vapiCallId)
    .single()
  return data as Call | null
}

export async function getCallBySid(callSid: string): Promise<Call | null> {
  const { data } = await supabaseAdmin
    .from('calls')
    .select('*')
    .eq('call_sid', callSid)
    .single()
  return data as Call | null
}

export async function getRecentCalls(limit = 50): Promise<Call[]> {
  const { data } = await supabaseAdmin
    .from('calls')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  return (data as Call[]) ?? []
}

export async function getAllContacts(): Promise<Contact[]> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .order('name', { ascending: true })
  return (data as Contact[]) ?? []
}
