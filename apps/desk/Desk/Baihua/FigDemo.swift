#if DEBUG
import Foundation

/// 调试样张(DESK_DEMO=figs):一屏把十种图解各摆一张,外加几种「宽松形态」(栏里的小标题 + 说明、body 为数组、
/// 循环流程、带 children 的树、不认识的 kind)。例子取自 docs/desk-baihua-spec.md §2。
enum FigDemo {
    static let json = #"""
    { "v": 1, "id": "demo", "chapters": { "1": {
      "title": "图解样张 · 十种版式", "subtitle": "每种 kind 一张,外加宽松形态与兜底",
      "idea": "这一屏只给开发出图用:看每种图解在手机、iPad 竖横屏、浅色深色下都排得开、读得清。",
      "hero": { "badge": "调试 · 样张", "headline": "上善若水", "tagline": "封面级章的题头样式也在这里看" },
      "blocks": [
        { "t": "lead", "x": "这是一段导语,**加粗的字**用主题色。长按可以选字、划线、写批注。" },
        { "t": "h2", "x": "一、金句卡 quote" },
        { "t": "fig", "cap": "金句卡:插画底 + 原生排的字。", "fig": { "kind": "quote", "text": "夫唯弗居，是以不去。", "gloss": "正因为不居功，功绩才不会离他而去。", "source": "《道德经 · 二章》" } },
        { "t": "h2", "x": "二、并列 / 对比 cols" },
        { "t": "fig", "cap": "两栏对比。", "fig": { "kind": "cols", "title": "看世界的两只眼睛,都得睁着",
          "cols": [ { "head": "常无欲 · 观其妙", "lines": ["放空功利心地看", "看见整体·本源·微妙", "像静静看娃玩", { "head": "只用这只 → 易飘、空谈", "accent": true }] },
                    { "head": "常有欲 · 观其徼", "lines": ["带着目的去看", "看清轮廓·边界·苗头", "像评估娃的能力", "只用这只 → 易窄、短视"] } ],
          "foot": ["两个「常」字并列:不是二选一,是两副眼都常用"] } },
        { "t": "fig", "cap": "三栏,栏里是「小标题 + 说明」。", "fig": { "kind": "cols", "title": "三宝各有所得",
          "cols": [ { "head": "慈", "accent": true, "lines": [ { "head": "慈 → 能勇", "body": "有要护的人，豁得出去" } ] },
                    { "head": "俭", "lines": [ { "head": "俭 → 能广", "body": ["平日省着", "用时才宽裕"] } ] },
                    { "head": "不敢为天下先", "lines": [ { "head": "→ 能成器长", "body": "不抢头，反被推为长" } ] } ] } },
        { "t": "h2", "x": "三、列举 / 层次 rows" },
        { "t": "fig", "cap": "四层递进。", "fig": { "kind": "rows", "title": "「道之贵」的四层递进",
          "items": [ { "mark": "一", "head": "无所不庇", "body": "万物之奥 · 善人宝,不善人所保" },
                     { "mark": "二", "head": "美言可以市", "body": "好话能换来尊重" },
                     { "mark": "三", "head": "人之不善,何弃之有", "body": ["不挑人", "连不善的人也不弃"], "accent": true },
                     { "mark": "四", "head": "不如坐进此道", "body": "献玉璧驷马,不如献上这个道" } ],
          "foot": ["贵不在稀有难得,而在普惠不挑人"] } },
        { "t": "h2", "x": "四、流程 flow" },
        { "t": "fig", "cap": "推理链,带结论格。", "fig": { "kind": "flow", "title": "四句话,一条推理链",
          "steps": [ { "head": "天地不仁", "body": "天道:不偏私" }, { "head": "圣人不仁", "body": "治道:别折腾" }, { "head": "多言数穷", "body": "话多反而走投无路" }, { "head": "不如守中", "body": "守住空虚之中" } ],
          "result": { "head": "夫唯不争，故无尤" }, "loop": false } },
        { "t": "fig", "cap": "首尾相接的循环。", "fig": { "kind": "flow", "title": "四时周而复始",
          "steps": [ { "head": "春生", "body": "万物萌发" }, { "head": "夏长", "body": "枝叶繁盛" }, { "head": "秋收", "body": "果实归仓", "accent": true }, { "head": "冬藏", "body": "敛藏待时" } ], "loop": true } },
        { "t": "h2", "x": "五、结构 tree" },
        { "t": "fig", "cap": "一根三支。", "fig": { "kind": "tree", "title": "三个「不」，堵三个钩子",
          "root": { "head": "不见可欲，使民心不乱" },
          "branches": [ { "head": "不尚贤", "body": "堵住「争」" }, { "head": "不贵难得之货", "body": "堵住「盗」", "accent": true }, { "head": "不见可欲", "body": "堵住「乱」", "children": [ { "head": "虚其心" }, { "head": "实其腹" } ] } ] } },
        { "t": "fig", "cap": "没有根、只有并排的几支。", "fig": { "kind": "tree", "title": "并排三支",
          "branches": [ { "head": "道", "body": "无名之始" }, { "head": "德", "body": "得道于身" }, { "head": "用", "body": "施于日用" } ] } },
        { "t": "h2", "x": "六、时间线 timeline" },
        { "t": "fig", "cap": "版本流变。", "fig": { "kind": "timeline", "title": "「绝圣弃智」一句的版本流变",
          "points": [ { "when": "战国", "head": "郭店楚简本", "body": "多释「绝智弃辩」", "accent": true }, { "when": "西汉", "head": "马王堆帛书本", "body": "作「绝圣弃知」" }, { "when": "魏", "head": "王弼注本", "body": "作「绝圣弃智」,通行至今" } ] } },
        { "t": "h2", "x": "七、表格 table" },
        { "t": "fig", "cap": "有行有列、每格都短。", "fig": { "kind": "table", "title": "八卦取象", "heads": ["卦", "象", "德", "家人"],
          "rows": [["乾", "天", "健", "父"], ["坤", "地", "顺", "母"], ["震", "雷", "动", "长男"], ["巽", "风", "入", "长女"]] } },
        { "t": "h2", "x": "八、卦画 gua" },
        { "t": "fig", "cap": "单卦逐爻。", "fig": { "kind": "gua", "title": "乾卦 · 六爻自下而上（全是阳爻）",
          "guas": [ { "name": "乾", "form": "hex" } ],
          "yao": [ { "label": "上九", "text": "亢龙，有悔（飞过头了）" }, { "label": "九五", "text": "飞龙在天（鼎盛 · 卦主）", "accent": true }, { "label": "九四", "text": "或跃在渊（试跳）" },
                   { "label": "九三", "text": "终日乾乾（勤勉警惕）" }, { "label": "九二", "text": "见龙在田（崭露头角）" }, { "label": "初九", "text": "潜龙，勿用（藏在水底）" } ],
          "foot": ["六条实线＝六阳爻；读卦从最下「初九」往上读到「上九」"] } },
        { "t": "fig", "cap": "上下卦分解。", "fig": { "kind": "gua", "title": "泰:地在上、天在下",
          "guas": [ { "name": "坤", "form": "tri", "head": "上卦 坤 为地", "lines": ["地气下降"] }, { "name": "乾", "form": "tri", "head": "下卦 乾 为天", "lines": ["天气上升"], "accent": true } ] } },
        { "t": "fig", "cap": "错综卦一排。", "fig": { "kind": "gua", "title": "屯的错卦与综卦",
          "guas": [ { "name": "屯", "form": "hex", "head": "本卦", "accent": true }, { "name": "鼎", "form": "hex", "head": "错卦：阴阳全换" }, { "name": "蒙", "form": "hex", "head": "综卦：上下颠倒" } ] } },
        { "t": "h2", "x": "九、方位 ring" },
        { "t": "fig", "cap": "后天八卦方位(上南下北)。", "fig": { "kind": "ring", "title": "后天八卦方位", "center": "帝出乎震",
          "items": [ { "at": "S", "head": "离", "body": "火 · 夏", "accent": true }, { "at": "SW", "head": "坤", "body": "地" }, { "at": "W", "head": "兑", "body": "泽 · 秋" }, { "at": "NW", "head": "乾", "body": "天" },
                     { "at": "N", "head": "坎", "body": "水 · 冬" }, { "at": "NE", "head": "艮", "body": "山" }, { "at": "E", "head": "震", "body": "雷 · 春" }, { "at": "SE", "head": "巽", "body": "风" } ] } },
        { "t": "h2", "x": "十、兜底 notes 与不认识的 kind" },
        { "t": "fig", "cap": "notes 只留文字。", "fig": { "kind": "notes", "title": "只留文字", "lines": ["第一行说明", "第二行说明"] } },
        { "t": "fig", "cap": "不认识的 kind:把字都列出来,不崩。", "fig": { "kind": "spiral", "title": "未知版式", "parts": [ { "head": "甲", "body": "一" }, "乙" ] } },
        { "t": "fig", "cap": "没有 fig 数据的图只显示这一句图注(还没转好的图)。" },
        { "t": "quote", "o": "上善若水。水善利万物而不争，", "tr": "最高的善像水一样。水善于滋利万物而不与之相争，" },
        { "t": "callout", "tone": "warn", "items": ["提示框 warn:**留神**这里。"] },
        { "t": "callout", "tone": "tip", "label": "打个比方", "items": ["提示框 tip,带 label。"] },
        { "t": "pull", "x": "更值得学的是水那样的——往下流、不争抢、默默滋养。" },
        { "t": "steps", "items": ["第一步", "第二步,稍长一点的一段字,看换行与连线", "第三步"] },
        { "t": "list", "ordered": true, "items": ["有序一", "有序二"] },
        { "t": "mystery", "x": "不认识的块:跳过" },
        { "t": "refs", "items": ["出处:样张,无。"] }
      ] } } }
    """#

    static var chapter: BHChapter? { (try? BHFile(data: Data(json.utf8)))?.chapters[1] }
}
#endif
