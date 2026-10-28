import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ImagePlus, Trash2, Users } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { EmptyState, ErrorBanner, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { slugify } from '@/lib/format'
import { validateImage } from '@/lib/image'
import { errorMessage } from '@/lib/supabase'
import {
  createCommunity,
  deleteCommunity,
  getCommunityBySlug,
  getMyRole,
  updateCommunity,
  type CommunityInput,
} from '@/services/communities'
import type { Community } from '@/types/db'

const MAX_NAME = 60
const MAX_DESCRIPTION = 300
const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024 // the storage service compresses and enforces the real 2 MB limit

interface EditorProps {
  mode: 'create' | 'edit'
  initial?: Community
  onSubmit: (values: CommunityInput) => Promise<void>
  children?: ReactNode
}

/** The shared form for creating and editing a community. */
function CommunityEditor({ mode, initial, onSubmit, children }: EditorProps) {
  const toast = useToast()
  const picker = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initial?.name ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPrivate, setIsPrivate] = useState(initial?.is_private ?? false)
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Object URLs are created in an effect and revoked in its cleanup so React StrictMode's double-run stays safe.
  useEffect(() => {
    if (!image) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const effectiveSlug = mode === 'edit' ? (initial?.slug ?? '') : slugTouched ? slugify(slug) : slugify(name)

  const onPickImage = (file: File | undefined) => {
    if (!file) return
    const problem = validateImage(file, { maxBytes: MAX_ORIGINAL_BYTES })
    if (problem) {
      toast.error(problem)
      return
    }
    setImage(file)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (name.trim().length < 2) return setError('Give your community a name (at least 2 characters).')
    if (mode === 'create' && effectiveSlug.length < 3) return setError('The community address needs at least 3 letters or numbers.')
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name, slug: effectiveSlug, description, isPrivate, image })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="col" onSubmit={(e) => void submit(e)} noValidate>
      <GlassPanel padded className="col">
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <div className="image-pick">
          <Avatar src={preview ?? initial?.avatar_url} name={name || 'Community'} size="xl" />
          <div className="col" style={{ gap: 6 }}>
            <Button variant="glass" size="sm" icon={<ImagePlus size={16} />} onClick={() => picker.current?.click()} disabled={busy}>
              {preview || initial?.avatar_url ? 'Change image' : 'Add image'}
            </Button>
            <span className="small faint">Optional. JPEG, PNG or WebP.</span>
          </div>
          <input
            ref={picker}
            className="file-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              onPickImage(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <TextField
          label="Name"
          value={name}
          maxLength={MAX_NAME}
          autoComplete="off"
          required
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />

        {mode === 'create' ? (
          <TextField
            label="Community address"
            value={slugTouched ? slug : effectiveSlug}
            maxLength={40}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            hint={`Your link will be /c/${effectiveSlug || 'your-community'}. Letters, numbers and dashes only.`}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
          />
        ) : (
          <p className="small muted">Address: <strong>/c/{initial?.slug}</strong> (it can't be changed after creation)</p>
        )}

        <div className="col" style={{ gap: 4 }}>
          <TextAreaField
            label="Description"
            value={description}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            disabled={busy}
            hint="What is this community about? Emoji are welcome."
            onChange={(e) => setDescription(e.target.value)}
          />
          <span className="char-count" aria-hidden>{description.length}/{MAX_DESCRIPTION}</span>
        </div>
      </GlassPanel>

      <GlassPanel>
        <Switch
          label="Private community"
          description="Hidden from search and from everyone who isn't a member. Inviting people isn't built yet, so a private community can't gain new members for now."
          checked={isPrivate}
          disabled={busy}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
      </GlassPanel>

      <div className="form-actions">
        <Button type="submit" variant="primary" loading={busy}>{mode === 'create' ? 'Create community' : 'Save changes'}</Button>
      </div>

      {children}
    </form>
  )
}

function CreateCommunity() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  return (
    <>
      <PageHeader title="New community" back />
      <CommunityEditor
        mode="create"
        onSubmit={async (values) => {
          const created = await createCommunity(me.id, values)
          toast.show(`${created.name} is ready`)
          navigate(`/c/${created.slug}`, { replace: true })
        }}
      />
    </>
  )
}

function EditCommunity() {
  const { slug = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data, loading, error, reload } = useAsync(async () => {
    const community = await getCommunityBySlug(slug)
    const role = community ? await getMyRole(community.id, me.id) : null
    return { community, role }
  }, [slug, me.id])

  if (loading) return (<><PageHeader title="Edit community" back /><ListSkeleton rows={3} /></>)
  if (error) return (<><PageHeader title="Edit community" back /><ErrorState message={error} onRetry={reload} /></>)

  const community = data?.community ?? null
  const role = data?.role ?? null
  if (!community) {
    return (
      <>
        <PageHeader title="Edit community" back />
        <EmptyState icon={<Users size={28} />} title="Community not found" action={<Link to="/communities" className="btn btn--primary">Browse communities</Link>} />
      </>
    )
  }
  if (role !== 'owner' && role !== 'moderator') {
    return (
      <>
        <PageHeader title="Edit community" back />
        <EmptyState
          icon={<Users size={28} />}
          title="You can't edit this community"
          body="Only the owner and moderators can change its details."
          action={<Link to={`/c/${community.slug}`} className="btn btn--primary">Back to community</Link>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Edit community" back={`/c/${community.slug}`} />
      <CommunityEditor
        mode="edit"
        initial={community}
        onSubmit={async ({ name, description, isPrivate, image }) => {
          await updateCommunity(me.id, community, { name, description, isPrivate, image })
          toast.show('Community updated')
          navigate(`/c/${community.slug}`, { replace: true })
        }}
      >
        {role === 'owner' ? (
          <GlassPanel padded className="col danger-zone">
            <h2>Delete community</h2>
            <p className="small muted">Permanently removes the community, its member list and every post made in it. This can't be undone.</p>
            <div><Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>Delete community</Button></div>
          </GlassPanel>
        ) : null}
      </CommunityEditor>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${community.name}?`}
        message="All posts in this community will be deleted too. This can't be undone."
        confirmLabel="Delete forever"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteCommunity(community.id)
          toast.show('Community deleted')
          navigate('/communities', { replace: true })
        }}
      />
    </>
  )
}

export default function CommunityFormPage({ mode }: { mode: 'create' | 'edit' }) {
  return mode === 'create' ? <CreateCommunity /> : <EditCommunity />
}
