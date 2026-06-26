'use client'

type Status = 'ringing' | 'screening' | 'holding' | 'picked_up' | 'voicemail' | 'ended'

const config: Record<Status, { label: string; classes: string }> = {
  ringing:   { label: 'Ringing',    classes: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  screening: { label: 'Screening',  classes: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  holding:   { label: 'On Hold',    classes: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  picked_up: { label: 'Picked Up',  classes: 'bg-green-500/20 text-green-300 border-green-500/40' },
  voicemail: { label: 'Voicemail',  classes: 'bg-red-500/20 text-red-300 border-red-500/40' },
  ended:     { label: 'Ended',      classes: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40' },
}

export function StatusBadge({ status }: { status: Status }) {
  const { label, classes } = config[status] ?? config.ended
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {label}
    </span>
  )
}
