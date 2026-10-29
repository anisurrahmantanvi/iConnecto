import { Briefcase, CalendarDays, GraduationCap, Heart, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProfileAbout as About } from '@/types/db'
import { GlassPanel } from '@/components/ui/GlassPanel'

const STATUS_LABEL = { single: 'Single', married: 'Married' } as const

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <li className="about-row">
      <span className="about-row__icon" aria-hidden>{icon}</span>
      <span className="about-row__text"><span className="muted small">{label}</span><span>{value}</span></span>
    </li>
  )
}

/** "About" card on a profile. Rows appear only when filled in; "Joined" always shows. */
export function ProfileAbout({ about, joinedAt }: { about: About | null; joinedAt: string }) {
  const joined = new Date(joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  return (
    <GlassPanel as="section" padded aria-label="About" className="col">
      <h2 className="section-title" style={{ margin: 0 }}>About</h2>
      <ul className="about-list">
        {about?.work ? <Row icon={<Briefcase size={20} />} label="Work" value={about.work} /> : null}
        {about?.education ? <Row icon={<GraduationCap size={20} />} label="Education" value={about.education} /> : null}
        {about?.location ? <Row icon={<MapPin size={20} />} label="Lives in" value={about.location} /> : null}
        {about?.relationship_status ? <Row icon={<Heart size={20} />} label="Relationship status" value={STATUS_LABEL[about.relationship_status]} /> : null}
        <Row icon={<CalendarDays size={20} />} label="Joined" value={joined} />
      </ul>
    </GlassPanel>
  )
}
