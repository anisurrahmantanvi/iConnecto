import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarChart3, Trash2 } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { compactNumber } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import {
  cleanSlug, createPage, deletePage, getPageBySlug, getPageInsights, myPageRole, PAGE_CATEGORIES, updatePage, uploadPageImage,
  type PageInsights, type PageRow,
} from '@/services/pages'

function Insights({ pageId }: { pageId: string }) {
  const { data, loading } = useAsync(() => getPageInsights(pageId), [pageId])
  if (loading) return <ListSkeleton rows={1} />
  if (!data) return <GlassPanel padded><p className="small muted">Insights will be available after the next database update.</p></GlassPanel>
  const i: PageInsights = data
  const Stat = ({ n, l }: { n: number; l: string }) => (
    <div style={{ flex: '1 1 40%' }}><strong style={{ fontSize: 22 }}>{compactNumber(Number(n))}</strong><div className="small muted">{l}</div></div>
  )
  return (
    <GlassPanel padded>
      <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <Stat n={i.followers} l="Followers" />
        <Stat n={i.followers_7d} l="New followers (7 days)" />
        <Stat n={i.followers_30d} l="New followers (30 days)" />
        <Stat n={i.posts} l="Posts" />
        <Stat n={i.posts_30d} l="Posts (30 days)" />
        <Stat n={i.likes} l="Total likes" />
        <Stat n={i.comments} l="Total comments" />
      </div>
      {i.top_post ? <p className="small" style={{ marginTop: 12 }}><strong>Top post:</strong> {i.top_post.content || '(photo)'} · {i.top_post.likes} likes · {i.top_post.comments} comments</p> : null}
    </GlassPanel>
  )
}

export default function PageFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { slug: routeSlug = '' } = useParams()
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const [page, setPage] = useState<PageRow | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [err, setErr] = useState<string | null>(null)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('creator')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [cover, setCover] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (mode !== 'edit') return
    let off = false
    void (async () => {
      try {
        const p = await getPageBySlug(routeSlug)
        if (off) return
        if (!p) { setErr('Page not found.'); return }
        const role = await myPageRole(p.id, me.id)
        if (off) return
        if (role !== 'owner' && role !== 'admin') { setErr('Only the page owner can manage this page.'); return }
        setPage(p); setName(p.name); setCategory(p.category); setBio(p.bio); setWebsite(p.website ?? ''); setAvatar(p.avatar_url); setCover(p.cover_url)
      } catch (e) { if (!off) setErr(errorMessage(e)) } finally { if (!off) setLoading(false) }
    })()
    return () => { off = true }
  }, [mode, routeSlug, me.id])

  const pickImage = async (kind: 'avatar' | 'cover', file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadPageImage(kind, me.id, file)
      if (kind === 'avatar') setAvatar(url); else setCover(url)
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const save = async () => {
    if (busy) return
    const site = website.trim()
    if (site && !/^https?:\/\//i.test(site)) { toast.error('Website must start with http:// or https://'); return }
    setBusy(true)
    try {
      if (mode === 'create') {
        const id = await createPage({ slug, name: name.trim(), category, bio: bio.trim() })
        if (avatar || cover || site) {
          try { await updatePage(id, { avatar_url: avatar, cover_url: cover, website: site || null }) }
          catch (e) { toast.error(`Page created, but some details were not saved: ${errorMessage(e)}`) }
        }
        toast.show('Page created')
        navigate(`/page/${slug}`, { replace: true })
      } else if (page) {
        await updatePage(page.id, { name: name.trim(), category, bio: bio.trim(), website: site || null, avatar_url: avatar, cover_url: cover })
        toast.show('Page updated')
        navigate(`/page/${page.slug}`)
      }
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!page) return
    await deletePage(page.id)
    toast.show('Page deleted')
    navigate('/pages', { replace: true })
  }

  if (loading) return (<><PageHeader title="Page" back /><ListSkeleton rows={2} /></>)
  if (err) return (<><PageHeader title="Page" back /><ErrorState message={err} /></>)

  const valid = name.trim().length >= 2 && (mode === 'edit' || slug.length >= 3)

  return (
    <>
      <PageHeader title={mode === 'create' ? 'Create a page' : 'Manage page'} back />
      <div className="stack">
        {mode === 'edit' && page ? (
          <>
            <h2 className="section-title"><BarChart3 size={16} aria-hidden /> Insights</h2>
            <Insights pageId={page.id} />
          </>
        ) : null}
        <h2 className="section-title">Photos</h2>
        <GlassPanel padded>
          <div className="row" style={{ gap: 14, alignItems: 'center' }}>
            <Avatar src={avatar} name={name || 'Page'} size="xl" />
            <label className="btn btn--glass">{avatar ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => void pickImage('avatar', e.target.files?.[0])} />
            </label>
          </div>
          {cover ? <img src={cover} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 12, marginTop: 12 }} /> : null}
          <label className="btn btn--glass" style={{ marginTop: 12 }}>{cover ? 'Change cover' : 'Add cover'}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => void pickImage('cover', e.target.files?.[0])} />
          </label>
        </GlassPanel>

        <h2 className="section-title">Page name & details</h2>
        <GlassPanel padded>
          <div className="stack">
            <TextField label="Page name" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); if (mode === 'create' && !slugTouched) setSlug(cleanSlug(e.target.value.replace(/\s+/g, ''))) }} />
            {mode === 'create' ? (
              <TextField label="Page link" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(cleanSlug(e.target.value)) }} placeholder="mypage" hint="3–30 letters, numbers, dot or underscore. Cannot be changed later." autoCapitalize="none" />
            ) : null}
            <div className="field">
              <label htmlFor="page-cat">Category</label>
              <select id="page-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {PAGE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                {!PAGE_CATEGORIES.some((c) => c.id === category) ? <option value={category}>{category}</option> : null}
              </select>
            </div>
            <TextAreaField label="About" value={bio} maxLength={500} onChange={(e) => setBio(e.target.value)} />
            <TextField label="Website" value={website} maxLength={200} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            <Button variant="primary" loading={busy} disabled={!valid} onClick={() => void save()}>{mode === 'create' ? 'Create page' : 'Save'}</Button>
          </div>
        </GlassPanel>

        {mode === 'edit' && page?.owner_id === me.id ? (
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirm(true)}>Delete page</Button>
        ) : null}
      </div>
      <ConfirmDialog open={confirm} title="Delete this page?" message="The page and all of its posts will be removed. This cannot be undone." confirmLabel="Delete" danger onConfirm={remove} onClose={() => setConfirm(false)} />
    </>
  )
}
