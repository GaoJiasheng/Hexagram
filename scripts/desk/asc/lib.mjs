import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
// App Store Connect 接口的小封装(凭据同 scripts/tf-attach.mjs:.ios-ship.env + ~/.appstoreconnect/private_keys/;不打印任何凭据)
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const env = fs.readFileSync(ROOT + '/.ios-ship.env', 'utf8')
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.trim()
const KID = get('ASC_KEY_ID'), ISS = get('ASC_ISSUER_ID')
const PEM = fs.readFileSync(`${process.env.HOME}/.appstoreconnect/private_keys/AuthKey_${KID}.p8`, 'utf8')
const b64 = (b) => Buffer.from(b).toString('base64url')
function jwt() { const now = Math.floor(Date.now() / 1000); const h = b64(JSON.stringify({ alg: 'ES256', kid: KID, typ: 'JWT' })); const p = b64(JSON.stringify({ iss: ISS, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' })); return `${h}.${p}.` + crypto.sign('SHA256', Buffer.from(`${h}.${p}`), { key: PEM, dsaEncoding: 'ieee-p1363' }).toString('base64url') }
export const api = async (p, opt = {}) => {
  const r = await fetch(p.startsWith('http') ? p : 'https://api.appstoreconnect.apple.com' + p, { ...opt, headers: { Authorization: `Bearer ${jwt()}`, 'Content-Type': 'application/json', ...(opt.headers || {}) } })
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null } catch { j = { raw: t } }
  return { status: r.status, ok: r.ok, json: j }
}
export const DESK = '6837960311', HEXA = '6782626551'
