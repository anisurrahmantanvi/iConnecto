import { useEffect, useState } from 'react'
import { getIsPrivate, setMyPrivate, getWhoCanMessage, setWhoCanMessage, getWhoCanComment, setWhoCanComment, type WhoCanComment, type WhoCanMessage } from '@/services/privateAccount'
import { Link } from 'react-router-dom'
import { BellOff, ChevronRight, Eye, Lock, MonitorSmartphone, UserX } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { signOutOtherDevices } from '@/services/account'
import { getMyShowActivity, setMyShowActivity } from '@/services/presence'

export default function PrivacyPage() {
  const toast = useToast()
  const me = useMe()
  const [showActivity, setShowActivity] = useState<boolean | null>(null)
  useEffect(() => {
    void getMyShowActivity(me.id).then(setShowActivity)
  }, [me.id])
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null)
  useEffect(() => {
    void getIsPrivate(me.id).then(setIsPrivate)
  }, [me.id])
  const [whoMsg, setWhoMsg] = useState<WhoCanMessage | null>(null)
  useEffect(() => {
    void getWhoCanMessage(me.id).then(setWhoMsg)
  }, [me.id])
  const [whoCom, setWhoCom] = useState<WhoCanComment | null>(null)
  useEffect(() => {
    void getWhoCanComment(me.id).then(setWhoCom)
  }, [me.id])
  const changeWhoCom = async (v: WhoCanComment) => {
    const before = whoCom
    setWhoCom(v)
    try {
      await setWhoCanComment(me.id, v)
    } catch (err) {
      setWhoCom(before)
      toast.error(errorMessage(err))
    }
  }
  const changeWhoMsg = async (v: WhoCanMessage) => {
    const before = whoMsg
    setWhoMsg(v)
    try {
      await setWhoCanMessage(me.id, v)
    } catch (err) {
      setWhoMsg(before)
      toast.error(errorMessage(err))
    }
  }
  const changePrivate = async (on: boolean) => {
    const before = isPrivate
    setIsPrivate(on)
    try {
      await setMyPrivate(me.id, on)
    } catch (err) {
      setIsPrivate(before)
      toast.error(errorMessage(err))
    }
  }
  const changeActivity = async (on: boolean) => {
    const before = showActivity
    setShowActivity(on)
    try {
      await setMyShowActivity(me.id, on)
    } catch (err) {
      setShowActivity(before)
      toast.error(errorMessage(err))
    }
  }
  const [devBusy, setDevBusy] = useState(false)

  const signOutOthers = async () => {
    setDevBusy(true)
    try {
      await signOutOtherDevices()
      toast.show('Signed out of your other devices')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDevBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Privacy and security" back="/settings" />
      <div className="stack">
        <h2 className="section-title">What others can see</h2>
        <GlassPanel padded className="col">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Eye size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">
              Your profile, posts and friends list are visible to anyone who has an account. Posts in a private
              community are visible to its members only.
            </p>
          </div>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Lock size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">
              Messages can be read only by the two people in the conversation. Your likes, bookmarks and notifications are visible
              only to you. Your email address is never shown to other users.
            </p>
          </div>
        </GlassPanel>

        {isPrivate !== null ? (
          <>
            <h2 className="section-title">Private account</h2>
            <GlassPanel padded className="col">
              <p className="small">
                When your account is private, only your friends can see your posts. Anyone can still send you a friend request. Switching back to public lets everyone see your public posts.
              </p>
              <div role="group" aria-label="Private account" className="chip-row">
                <button type="button" className="chip" aria-pressed={isPrivate} onClick={() => void changePrivate(true)}>Private</button>
                <button type="button" className="chip" aria-pressed={!isPrivate} onClick={() => void changePrivate(false)}>Public</button>
              </div>
              <Link to="/friend-requests" className="btn btn--glass btn--sm" style={{ alignSelf: 'flex-start' }}>Friend requests</Link>
            </GlassPanel>
          </>
        ) : null}

        {whoMsg !== null ? (
          <>
            <h2 className="section-title">Who can message you</h2>
            <GlassPanel padded className="col">
              <p className="small">
                Choose who can start a chat with you. If you have already written to someone, they can always reply. Blocked people can never message you.
              </p>
              <div role="group" aria-label="Who can message you" className="chip-row">
                <button type="button" className="chip" aria-pressed={whoMsg === 'everyone'} onClick={() => void changeWhoMsg('everyone')}>Everyone</button>
                <button type="button" className="chip" aria-pressed={whoMsg === 'followers'} onClick={() => void changeWhoMsg('followers')}>My friends</button>
                <button type="button" className="chip" aria-pressed={whoMsg === 'nobody'} onClick={() => void changeWhoMsg('nobody')}>Nobody</button>
              </div>
            </GlassPanel>
          </>
        ) : null}

        {whoCom !== null ? (
          <>
            <h2 className="section-title">Who can comment on your posts</h2>
            <GlassPanel padded className="col">
              <p className="small">Choose who can comment on your posts. You can always comment on your own posts.</p>
              <div role="group" aria-label="Who can comment on your posts" className="chip-row">
                <button type="button" className="chip" aria-pressed={whoCom === 'everyone'} onClick={() => void changeWhoCom('everyone')}>Everyone</button>
                <button type="button" className="chip" aria-pressed={whoCom === 'followers'} onClick={() => void changeWhoCom('followers')}>My friends</button>
                <button type="button" className="chip" aria-pressed={whoCom === 'nobody'} onClick={() => void changeWhoCom('nobody')}>Nobody</button>
              </div>
            </GlassPanel>
          </>
        ) : null}

        {showActivity !== null ? (
          <>
            <h2 className="section-title">Activity status</h2>
            <GlassPanel padded className="col">
              <p className="small">
                Show when you are online or were last active (for example "Online" or "Active 5 minutes ago") to people you chat with.
                If you turn it off, you will not see other people's status either.
              </p>
              <div role="group" aria-label="Show my activity status" className="chip-row">
                <button type="button" className="chip" aria-pressed={showActivity} onClick={() => void changeActivity(true)}>Show</button>
                <button type="button" className="chip" aria-pressed={!showActivity} onClick={() => void changeActivity(false)}>Hide</button>
              </div>
            </GlassPanel>
          </>
        ) : null}

        <h2 className="section-title">Safety</h2>
        <GlassPanel className="settings-list">
          <Link to="/settings/blocked" className="list-row">
            <UserX size={22} aria-hidden />
            <span className="grow">
              <strong style={{ display: 'block' }}>Blocked accounts</strong>
              <span className="small muted">People you blocked can't message, call or follow you.</span>
            </span>
            <ChevronRight size={18} className="chev" aria-hidden />
          </Link>
        </GlassPanel>

        <h2 className="section-title">Password</h2>
        <GlassPanel className="settings-list" as="nav" aria-label="Password">
          <Link to="/settings/change-password" className="list-row">
            <Lock size={22} color="var(--accent)" aria-hidden />
            <strong className="grow">Change password</strong>
            <ChevronRight size={18} className="chev" aria-hidden />
          </Link>
        </GlassPanel>

        <h2 className="section-title">Devices</h2>
        <GlassPanel padded className="col">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <MonitorSmartphone size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small">Signed in somewhere you don't recognise? End every other session and keep this one.</p>
          </div>
          <div><Button variant="glass" loading={devBusy} onClick={() => void signOutOthers()}>Sign out other devices</Button></div>
        </GlassPanel>

        <h2 className="section-title">Notifications</h2>
        <GlassPanel padded>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <BellOff size={22} color="var(--text-faint)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
            <p className="small muted">
              Browser push notifications are not set up in this version. You will see alerts inside the app while it is open.
            </p>
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
