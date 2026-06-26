-- ============================================================
-- Aria RJ40 — Database Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ============================================================

-- Contacts (known callers / address book)
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  whatsapp boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- Calls (every inbound call record)
create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  call_sid text unique,
  vapi_call_id text,
  from_number text not null,
  display_name text,
  channel text default 'phone',
  line text,
  status text default 'ringing',
  caller_name text,
  caller_company text,
  caller_reason text,
  duration_seconds integer,
  transcript text,
  summary text,
  recording_url text,
  started_at timestamptz default now(),
  ended_at timestamptz,
  owner_decision text
);

-- Indexes
create index if not exists calls_from_number_idx on calls(from_number);
create index if not exists calls_status_idx on calls(status);
create index if not exists calls_started_at_idx on calls(started_at desc);

-- Row Level Security
alter table contacts enable row level security;
alter table calls enable row level security;

-- Allow service_role full access (used by server-side API routes)
create policy "service_role_contacts" on contacts
  for all using (true) with check (true);

create policy "service_role_calls" on calls
  for all using (true) with check (true);
