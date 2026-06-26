import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const contacts = await req.json()
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'Expected array of contacts' }, { status: 400 })
  }

  const rows = contacts.map((c: { name: string; phone: string; notes?: string }) => ({
    name: c.name,
    phone: c.phone,
    notes: c.notes ?? null,
    whatsapp: false,
  }))

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert(rows, { onConflict: 'phone' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 })
}
