// Turnstile 站点公钥(Cloudflare 人机验证)。**这是公开值** —— 它会出现在网页源码里,
// 真正的机密是 TURNSTILE_SECRET_KEY,配在 Pages 环境变量里、只有服务端见得到。
//
// 这里曾长期留着 Cloudflare 官方测试 key `1x00000000000000000000AA`(永远直接判过),
// 本是给本地开发跑通链路用的 —— 留在生产等于评论区没有任何机器人防护。
// 换 key 时记得 Turnstile 后台的域名列表要含 hexa.gavin.pub 与 localhost,
// 它按 hostname 精确校验,漏一个那一端就永远过不了。
export const TURNSTILE_SITE_KEY = '0x4AAAAAAEEfc0sGSrkQXqXQ'
