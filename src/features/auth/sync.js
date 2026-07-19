import {
  DATA_KEYS,
  applySyncSnapshot,
  getSyncSnapshot,
} from '../yijing/storage.js'

const SYNC_DEBOUNCE_MS = 60_000

let listening = false
let debounceTimer = null
let lifecycleGeneration = 0
let requestSerial = 0

function sameSnapshotTimes(left, right) {
  return DATA_KEYS.every((key) => left[key]?.at === right[key]?.at)
}

export async function syncNow() {
  const generation = lifecycleGeneration
  const serial = ++requestSerial
  const snapshot = getSyncSnapshot()

  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: snapshot }),
    })
    if (response.status === 401) return false
    if (!response.ok) return false
    const payload = await response.json().catch(() => null)
    if (!payload?.ok || !payload.data) return false

    // A logout/account switch, a newer sync request, or a local edit made
    // while this request was in flight makes this response stale. Skipping
    // the local apply preserves that edit; its data-changed debounce will
    // naturally send a fresh snapshot.
    if (generation !== lifecycleGeneration || serial !== requestSerial) return false
    if (!sameSnapshotTimes(snapshot, getSyncSnapshot())) return false
    const syncedAt = Date.now()
    const applied = applySyncSnapshot(payload.data, syncedAt)
    if (applied && typeof window !== 'undefined' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('gx:sync-complete', { detail: { at: syncedAt } }))
    }
    return applied
  } catch {
    return false
  }
}

function onDataChanged() {
  if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void syncNow()
  }, SYNC_DEBOUNCE_MS)
}

export function startSyncLoop() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('gx:data-changed', onDataChanged)
  listening = true
}

export function stopSyncLoop() {
  lifecycleGeneration += 1
  requestSerial += 1
  if (typeof window !== 'undefined') {
    if (listening) window.removeEventListener('gx:data-changed', onDataChanged)
    if (debounceTimer !== null) window.clearTimeout(debounceTimer)
  }
  listening = false
  debounceTimer = null
}
