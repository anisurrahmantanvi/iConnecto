import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { EmptyState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { supabase } from '@/lib/supabase'

interface Row { id: string; media_urls: string[] }

export default function MyMediaPage() {
  const me = useMe()
  const { data, loading } = useAsync(async () => {
    const { data: rows } = await supabase.from('posts').select('id, media_urls').eq('author_id', me.id).order('created_at', { ascending: false }).limit(200)
    return ((rows ?? []) as Row[]).flatMap((r) => (r.media_urls ?? []).map((url) => ({ id: r.id, url })))
  }, [me.id])
  return (
    <>
      <PageHeader title="Manage Uploaded Media" back />
      <div className="stack">
        {loading ? <ListSkeleton rows={2} /> : null}
        {data && !data.length ? <EmptyState icon={<ImageOff size={28} />} title="No uploaded photos" body="Photos you add to posts will show here." /> : null}
        {data?.length ? (
          <>
            <p className="small muted" style={{ padding: '0 16px' }}>{data.length} photos. Tap one to open its post, where you can delete it.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {data.map((m, i) => (
                <Link key={m.url + i} to={`/p/${m.id}`} style={{ aspectRatio: '1', overflow: 'hidden', display: 'block' }}>
                  <img src={m.url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
