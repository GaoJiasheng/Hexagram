const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000
const MAX_SYNC_DIVINATIONS = 400

function isObjectMap(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function objectMap(value) {
  return isObjectMap(value) ? value : {}
}

function parsedTime(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
}

function newerRecord(cloudRecord, clientRecord) {
  // Equal timestamps deliberately keep the cloud record: neither side is
  // numerically newer, and retaining the already-persisted value makes a
  // repeated sync idempotent.
  return parsedTime(clientRecord?.at) > parsedTime(cloudRecord?.at)
    ? clientRecord
    : cloudRecord
}

export function mergeScalar(cloudEntry, clientEntry, serverNow) {
  if (clientEntry === undefined) return cloudEntry
  const clientResult = {
    value: clientEntry.value,
    at: Math.min(clientEntry.at, serverNow + FUTURE_CLOCK_SKEW_MS),
  }
  if (cloudEntry === undefined) return clientResult
  return clientEntry.at > cloudEntry.at ? clientResult : cloudEntry
}

export function mergeRecordMaps(cloudValue, clientValue) {
  const cloud = objectMap(cloudValue)
  const client = objectMap(clientValue)
  const merged = []

  for (const recordKey of new Set([...Object.keys(cloud), ...Object.keys(client)])) {
    const hasCloud = Object.hasOwn(cloud, recordKey)
    const hasClient = Object.hasOwn(client, recordKey)
    let record
    if (!hasCloud) record = client[recordKey]
    else if (!hasClient) record = cloud[recordKey]
    else record = newerRecord(cloud[recordKey], client[recordKey])
    merged.push([recordKey, record])
  }

  return Object.fromEntries(merged)
}

function divinationsById(value) {
  if (!Array.isArray(value)) return {}
  return Object.fromEntries(value.map((record) => [String(record?.id), record]))
}

function createdAtTime(record) {
  return parsedTime(record?.createdAt)
}

export function mergeDivinations(cloudValue, clientValue) {
  const merged = Object.values(mergeRecordMaps(
    divinationsById(cloudValue),
    divinationsById(clientValue),
  ))
  merged.sort((left, right) => createdAtTime(right) - createdAtTime(left))
  return merged.slice(0, MAX_SYNC_DIVINATIONS)
}

function earlierFirstSeen(cloudValue, clientValue) {
  return parsedTime(clientValue) < parsedTime(cloudValue) ? clientValue : cloudValue
}

function mergeFirstSeenMap(cloudValue, clientValue) {
  const cloud = objectMap(cloudValue)
  const client = objectMap(clientValue)
  const merged = []

  for (const topic of new Set([...Object.keys(cloud), ...Object.keys(client)])) {
    const hasCloud = Object.hasOwn(cloud, topic)
    const hasClient = Object.hasOwn(client, topic)
    const value = !hasCloud
      ? client[topic]
      : !hasClient
        ? cloud[topic]
        : earlierFirstSeen(cloud[topic], client[topic])
    merged.push([topic, value])
  }

  return Object.fromEntries(merged)
}

function mergeQuizRecord(cloudRecord, clientRecord) {
  const clientIsNewer = parsedTime(clientRecord?.at) > parsedTime(cloudRecord?.at)
  const recent = clientIsNewer ? clientRecord : cloudRecord
  return {
    passed: Boolean(cloudRecord?.passed || clientRecord?.passed),
    best: Math.max(Number(cloudRecord?.best) || 0, Number(clientRecord?.best) || 0),
    total: recent?.total,
    at: recent?.at,
  }
}

function mergeQuizMap(cloudValue, clientValue) {
  const cloud = objectMap(cloudValue)
  const client = objectMap(clientValue)
  const merged = []

  for (const topic of new Set([...Object.keys(cloud), ...Object.keys(client)])) {
    const hasCloud = Object.hasOwn(cloud, topic)
    const hasClient = Object.hasOwn(client, topic)
    const value = !hasCloud
      ? client[topic]
      : !hasClient
        ? cloud[topic]
        : mergeQuizRecord(cloud[topic], client[topic])
    merged.push([topic, value])
  }

  return Object.fromEntries(merged)
}

export function mergeProgress(cloudValue, clientValue) {
  const cloud = objectMap(cloudValue)
  const client = objectMap(clientValue)
  return {
    read: mergeFirstSeenMap(cloud.read, client.read),
    quiz: mergeQuizMap(cloud.quiz, client.quiz),
    used: mergeFirstSeenMap(cloud.used, client.used),
  }
}

export function mergeCollectionEntry(cloudEntry, clientEntry, serverNow, mergeValue) {
  if (clientEntry === undefined) return cloudEntry
  return {
    value: mergeValue(cloudEntry?.value, clientEntry.value),
    at: serverNow,
  }
}

export const syncMergeLimits = {
  futureClockSkewMs: FUTURE_CLOCK_SKEW_MS,
  maxDivinations: MAX_SYNC_DIVINATIONS,
}
