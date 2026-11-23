// 观象 · 书桌 —— 插画 prompt 预备(art-prompts-*)的固定句与禁词表(唯一一份)。
// 两个出图脚本(gen-art.mjs / gen-art-guanshu.mjs)写 brief 时原样引用这里的句子,
// art-prompts-check.mjs 按同一份核:PROMPT 必须以画风句开头、含本类版式句、以收尾句结束。

// 每类图的版式句:brief 里逐字给出,写手照抄进 PROMPT(放在场景描写之后)
export const LAYOUT_PHRASE = {
  head: 'Layout: landscape 3:2; the top third of the canvas stays nearly blank rice paper, and the scene spreads across the lower two thirds and most of the width.',
  cover: 'Layout: portrait 2:3; the picture fills the upper two thirds, and the bottom third stays clean and quiet, paper-colored with only faint washes.',
  banner: 'Layout: landscape 3:2; the main subject sits in the right or central part, and the lower-left area stays calm with soft washes only.',
}

// 收尾句:PROMPT 必须以这一句结束(硬规矩的提醒;正文里不再点名任何禁画之物)
export const CLOSING = 'No text, letters, numerals, seals, signatures or frames anywhere in the picture; no human faces, and any people are small, seen from behind or far away.'

// 各类图的尺寸说法(出图指令与 brief 共用)
export const SIZE = { head: 'landscape 3:2, 1536x1024', banner: 'landscape 3:2, 1536x1024', cover: 'portrait 2:3, 1024x1536' }

// 禁词(从硬规矩与门类规矩里派生;只在 PROMPT 正文里查——画风句与收尾句先剔掉)。
// 写手被要求「只写画里有的东西、不写否定句」,所以正文里出现这些词即算犯规。
export const BANNED = {
  all: ['portrait of', 'calligraphy', 'inscription', 'seal stamp', 'signature', 'logo', 'cartoon', 'cute', 'clip-art', 'infographic', 'halo'],
  guanshu: ['light bulb', 'handshake', 'chess king', 'brain', 'gears', 'rising arrow', 'bar chart', 'puzzle piece', 'rocket', 'dartboard', 'darts', 'ladder to the sky', 'raising their arms', 'trademark', 'licence plate', 'license plate', 'nude', 'nudity', 'corpse', 'gore', 'blood'],
  health: ['doctor', 'hospital', 'syringe', 'pill', 'pills', 'scan', 'stethoscope', 'surgery', 'organ', 'organs', 'anatomical', 'patient'],
  classics: ['megalith', 'dolmen', 'stonehenge', 'castle', 'stone arch', 'classical column', 'greek temple'],
  易: ['bagua', 'yarrow', 'coins', 'hexagram', 'diviner', 'fortune'],
  佛: ['buddha', 'bodhisattva', 'arhat', 'monk', 'statue', 'altar', 'deity'],
  道: ['immortal', 'immortals', 'deity', 'deities', 'talisman', 'elixir', 'altar'],
  中医: ['acupuncture', 'needle', 'needles', 'moxa', 'pulse', 'patient', 'pharmacy', 'medicine', 'remedy', 'body chart'],
  命理: ['fortune', 'diviner', 'almanac', 'birth chart', 'bagua', 'coins', 'palm reading', 'zodiac'],
  谋略: ['throne', 'assassin', 'bribe', 'triumph', 'splendour', 'splendor'],
  兵: ['gore', 'blood', 'corpse', 'corpses', 'slaughter', 'severed'],
  法: ['torture', 'execution', 'executioner', 'punishment', 'flogging'],
  儒: ['confucius', 'disciples', 'worship'],
}

// 「本书其他图已用过的题材」:读某目录下 cover / banner / head-N 的 .txt 里的 CHOSEN 段(不含 .ready.txt)
export function chosenOf(text) {
  const m = /CHOSEN:\s*([\s\S]*?)(?:\n\s*PROMPT:|$)/.exec(text)
  return m ? m[1].replace(/\s+/g, ' ').trim() : ''
}
