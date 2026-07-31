# 诗经诗级白话 · 共用作业规格

## 产出位置(一诗一独立文件,零并发竞争)
`/private/tmp/claude-501/-Users-gavin-work-hexagram/90534f8c-c7f7-4db5-be53-f015a98cc8b4/scratchpad/shijing-parts/<键>.json`
文件内容就是文章对象本身(不包一层键)。**每写完一篇立刻落盘**,不要攒到最后
——scratchpad 被清过一次,攒着的全丢了。**不要碰 `src/`**。

## 取原文(硬规矩:脚本切片,严禁手打)
```python
import json,re
cl=json.load(open('/Users/gavin/work/hexagram/src/data/ru/classics/shijing.json'))
def poem(key):                      # key 形如 '7-17'(组-序)
    g,o=map(int,key.split('-'))
    c=[x for x in cl['chapters'] if x['no']==g][0]
    h=[i for i,p in enumerate(c['paragraphs']) if re.fullmatch(r'《[^》]+》',p['original'].strip())]
    s=h[o-1]; e=h[o] if o<len(h) else len(c['paragraphs'])
    return c['paragraphs'][s:e]     # [0] 是诗题段,其后为诗句段(含 translation)
```
`quote.original` 必须是**本篇那一首诗**的精确连续子串,跨篇引用直接判错。
异体字/生僻字/标点一律照底本,别「顺手规范化」。

## 先读标杆
`src/data/ru/baihua/shijing.json` 里的 `1-1`(关雎);短诗写法看 `3-11`(式微)。
python 只打印你要的那一条,别整文件读入。

## 格式
普通档,**3000–4500 字**、**3–5 张**内联 SVG 图。顶层 `{title, subtitle, centralIdea, blocks}`,**无 hero/featured**。
`blocks[]`:`lead`/`h2`/`p`/`quote`(`original`+**`translation`**)/`figure`(`svg`+`caption`+`ftype`)/
`list`(`items`)/`callout`(`tone`: note青/warn赭/mute灰,`items`,可选 `label` ≤8字)/`pull`(**至多 1**)/`refs`。
- **quote 的白话字段名是 `translation` 不是 `text`**(渲染器只认前者)
- SVG 着色**只能** `style="fill:var(--cinnabar)"` 这种 style 属性形式;不能 `fill="#xxx"`,
  也不能 `fill="var(...)"`(SVG presentation 属性不认 var())。字体 `var(--font-serif)`
- **中文引号一律「」,不用弯引号**
- `figure` 的 `caption` **不走 rich()**,别在 caption 里写 `**加粗**`

## 内容分寸
- 讲给**完全没读过诗经的人**听:中心思想优先 → 脑回路 → 生活化比喻 → 逐句服务主线
- **《毛诗序》读法与今人读法两说并陈、不裁断**;本事不见于诗句者标「**无从坐实**」
- 通假字、古今异义**必须点破**(这是读不通的主因)
- **红线(儒)**:思想史与文学视角。**不作现代成功学/恋爱指南/职场鸡汤/政治影射**
- 极短的诗不许注水——功夫下到训诂、手法、语义演变、文学史脉络(看 `3-11` 式微)

## 方法(前几波验证有效,务必照办)
- 引他篇诗句或他书文句作旁证**必须先 grep 站内原文坐实**再写,**不得凭记忆**
  (前几波 agent 六次纠正主会话凭记忆写的 briefing)
- 归给「站内注疏」的训释须真的核对 `src/data/ru/zhushi-anchored/shijing.json`,
  **注疏没收的一律明写「注疏未收、为注家通说」**(每一波抽查都逮到过冒领)
- **同名诗按键派活,不按名字**——柏舟/谷风/扬之水/羔裘/甫田/杕杜/无衣/黄鸟/白华
  各有两三首。引同名的另一首**只入正文、不进 quote 块**(引文校验池收窄到本首)

## 自查(必过)
```python
import json,re
a=json.load(open(f'.../shijing-parts/<键>.json')); b=a['blocks']
P=''.join(p['original'] for p in poem(key))
s=json.dumps(a,ensure_ascii=False)
n=len(re.findall(r'[一-鿿]', re.sub(r'"svg":"[^"]*"','',s)))
bad=[q['original'][:14] for q in b if q.get('type')=='quote' and q.get('original','') not in P]
print(n,'字', len([x for x in b if x['type']=='figure']),'图', bad or 0,
      'hero' if ('hero' in a or 'featured' in a) else '',
      '写死色' if ('fill="#' in s or 'fill="var' in s) else '',
      '弯引号' if ('“' in s or '”' in s) else '')
```
通过线:**3000–4500 字**(初稿常写到 5000+,**必须裁到 4500 内再交**)、坏引文 0、
pull ≤1、无 hero、无写死色、无弯引号。

## 不要做
不 git 提交、不跑 build/check-data、不碰 `src/`、**不许转包子 agent**(踩过:父 agent
转包后提前返回,产出没落到约定目录)。

## 临时脚本命名
放 scratchpad,文件名带你负责的第一个键作前缀(如 `7-3-build.py`),**不许用通名**。

## 回报
**极简:每首一行**(键/篇名/字数/图数/引文数 + 一句要点)。
