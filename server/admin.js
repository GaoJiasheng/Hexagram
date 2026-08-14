// 「谁是管理员」的唯一判据 —— 服务端与边缘中间件共用这一份,别各写各的。
//
// 两条来源,满足其一即是:
//   ① D1 `users.is_owner = 1` —— 老的那条,`/api/admin/*` 一直在用
//   ② 邮箱在 `ADMIN_EMAILS` 里(逗号分隔的 secret)
//
// 为什么要第二条:改名单不必碰数据库,一条 `wrangler pages secret put` 即可。
// owner 2026-08-13 明确「先用我的 gmail,其他的后来加」——那正是这条的用法。
//
// ⚠️ 邮箱比对**大小写不敏感并去空白**:名单是手填的,`A@b.com ` 这种迟早出现。

export function adminEmails(env) {
  return String(env?.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminUser(userRow, env) {
  if (!userRow) return false
  if (userRow.is_owner) return true
  const email = String(userRow.email || '').trim().toLowerCase()
  return !!email && adminEmails(env).includes(email)
}
