import test from 'node:test'
import assert from 'node:assert/strict'
import { emojiToCodepoints, emojiUrl, isEmojiOnly, splitEmoji } from '../src/lib/emoji'

const vals = (t: string) => splitEmoji(t).map((s) => `${s.type}:${s.value}`)

test('splits plain text and simple emoji', () => {
  assert.deepEqual(vals('hi 😀 there'), ['text:hi ', 'emoji:😀', 'text: there'])
})

test('keeps ZWJ sequences, skin tones, flags and keycaps as single emoji', () => {
  assert.deepEqual(vals('👨‍👩‍👧'), ['emoji:👨‍👩‍👧'])
  assert.deepEqual(vals('👍🏽'), ['emoji:👍🏽'])
  assert.deepEqual(vals('🇧🇩'), ['emoji:🇧🇩'])
  assert.deepEqual(vals('1️⃣'), ['emoji:1️⃣'])
  assert.deepEqual(vals('❤️'), ['emoji:❤️'])
})

test('plain digits, hash, star and (c) stay text; (c) with VS16 is emoji', () => {
  assert.deepEqual(vals('call 123 #tag * (c) © 2026'), ['text:call 123 #tag * (c) © 2026'])
  assert.deepEqual(vals('©️'), ['emoji:©️'])
})

test('Bengali and other scripts are untouched', () => {
  assert.deepEqual(vals('আমি ভালো আছি 😊'), ['text:আমি ভালো আছি ', 'emoji:😊'])
})

test('two adjacent emoji stay separate', () => {
  assert.deepEqual(vals('😀😂'), ['emoji:😀', 'emoji:😂'])
})

test('twemoji file names', () => {
  assert.equal(emojiToCodepoints('😀'), '1f600')
  assert.equal(emojiToCodepoints('❤️'), '2764') // VS16 dropped
  assert.equal(emojiToCodepoints('👨‍👩‍👧'), '1f468-200d-1f469-200d-1f467') // ZWJ sequence keeps every code point
  assert.equal(emojiToCodepoints('🇧🇩'), '1f1e7-1f1e9')
  assert.equal(emojiToCodepoints('1️⃣'), '31-20e3')
  assert.equal(emojiUrl('😀', 'https://x.test/e'), 'https://x.test/e/1f600.svg')
  assert.equal(emojiUrl('😀', 'https://x.test/e/'), 'https://x.test/e/1f600.svg')
})

test('isEmojiOnly', () => {
  assert.equal(isEmojiOnly('😀'), true)
  assert.equal(isEmojiOnly(' 😀 😂 '), true)
  assert.equal(isEmojiOnly('😀😂🔥👍'), false) // more than 3
  assert.equal(isEmojiOnly('hi 😀'), false)
  assert.equal(isEmojiOnly(''), false)
})
