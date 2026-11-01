"""Makes the call ringtone that the phone plays when the app is closed (our own melody, no outside audio).
Run: python3 scripts/make-ringtone.py   ->  mobile/android-res/raw/iconnecto_ring.wav"""
import math, struct, wave
RATE = 16000
CYCLE = 2.6
CYCLES = 11  # ~28 seconds, then the phone stops it
notes = [(0, 659.25), (0.22, 783.99), (0.44, 1046.5), (0.66, 783.99), (1.1, 659.25), (1.32, 783.99), (1.54, 1046.5), (1.76, 783.99)]
DUR = 0.2
total = int(RATE * CYCLE * CYCLES)
buf = [0.0] * total
for c in range(CYCLES):
    for at, f in notes:
        s0 = int(RATE * (c * CYCLE + at))
        n = int(RATE * DUR)
        for i in range(n):
            t = i / RATE
            env = min(1.0, t / 0.02, (DUR - t) / 0.04) if t < DUR else 0
            v = 0.55 * math.sin(2 * math.pi * f * t) + 0.25 * math.sin(2 * math.pi * 2 * f * t)
            if s0 + i < total:
                buf[s0 + i] += 0.5 * env * v
with wave.open('mobile/android-res/raw/iconnecto_ring.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x)) * 32767)) for x in buf))
