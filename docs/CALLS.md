# Voice and video calls: how they work and what you must configure

iConnecto uses **WebRTC** for the audio/video itself (peer to peer) and **Supabase** only for signalling and call records:

* `call_sessions` — one row per call (caller, callee, type, status, timestamps). Status changes are validated by a database trigger
  (only the callee can accept/decline, only the caller can cancel/mark missed, finished calls cannot change).
* `call_signals` — the WebRTC offer / answer / ICE candidates. Only the two participants can read or write them (Row Level Security),
  and they are delivered over Supabase Realtime.
* The call screen shows **Connected only when the browser reports a working connection**. If ICE fails it shows a connection error; it never pretends.

## STUN and TURN (this is the part that needs setup)

WebRTC needs help to find a route between two devices:

| | What it does | Cost / limits |
|---|---|---|
| **STUN** | Tells each device its public address so they can connect directly. | Public servers are free (the default here is one public STUN server). They carry no media. |
| **TURN** | Relays the media when a direct path is impossible (mobile carriers, strict corporate Wi‑Fi, symmetric NAT). | Relays real traffic, so it costs bandwidth. **Without it, a noticeable share of calls will fail to connect.** |

With only the default STUN server, calls will work between many home Wi‑Fi networks and fail on others. Test on mobile data before trusting it.

### Options for TURN

1. **Self-host coturn** on a small VPS. Full control; you pay for the server and bandwidth and must keep it patched and secured. Free-tier VMs from some cloud providers can run it, but their terms and limits change.
2. **A managed TURN service.** Several providers offer limited free allowances and paid plans. Check current pricing, quotas and terms yourself; they change.

### Configuration

Set `VITE_ICE_SERVERS` in `.env` (JSON array) and rebuild:

```
VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"USER","credential":"PASS"}]
```

**Security warning:** every `VITE_` value is visible to anyone who opens the site's JavaScript. A permanent TURN username/password in the bundle can be copied
and used to relay somebody else's traffic at your expense. For a real launch use **short-lived TURN credentials** generated per call by a small server
or Supabase Edge Function (supported by coturn's REST-API/shared-secret mode and by most managed providers). That endpoint is **not implemented** in this project.

## Known limits

* One-to-one calls only (no group calls, screen sharing or call recording).
* An incoming call is shown only while the app is open and connected to Realtime. There are **no push notifications**, so a closed or sleeping browser tab will not ring.
* Signalling rows stay in the database until the call/account is deleted; add a scheduled clean-up if you want to purge old calls.
* Browsers require HTTPS (or `localhost`) for camera and microphone access.
* Not yet tested on a real network or device — see [STATUS.md](STATUS.md).
