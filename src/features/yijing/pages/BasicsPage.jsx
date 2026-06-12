import { Link } from 'react-router-dom'
import { getProgress } from '../storage.js'

// 主题注册表(v3 §7.4)——「我的·研习」共用
export const LEARN_TOPICS = [
  {
    id: 'yinyang',
    to: '/basics/yinyang',
    title: '阴阳八卦',
    desc: '阴阳与爻、太极生八卦、八卦取象、先天后天方位图',
    time: '约 5 分钟',
    quiz: true,
    usedKeys: null,
  },
  {
    id: 'hetu-luoshu',
    to: '/basics/hetu-luoshu',
    title: '河图洛书',
    desc: '河图五行生成数、洛书九宫纵横之和，与先后天八卦的配属',
    time: '约 3 分钟',
    quiz: true,
    usedKeys: null,
  },
  {
    id: 'xiaoxi',
    to: '/basics/xiaoxi',
    title: '十二消息卦',
    desc: '阳息阴消十二辟卦，对应十二月与十二地支节气',
    time: '约 4 分钟',
    quiz: true,
    usedKeys: null,
  },
  {
    id: 'shicao',
    to: '/basics/shicao',
    title: '揲蓍成卦',
    desc: '大衍之数，三变成爻，六爻成卦——逐步演示古法起卦过程',
    time: '约 8 分钟',
    quiz: true,
    usedKeys: ['dayan'],
  },
  {
    id: 'meihua',
    to: '/basics/meihua',
    title: '梅花易数',
    desc: '观物起数：先天卦数、时间与数字起卦、体用断法',
    time: '约 6 分钟',
    quiz: true,
    usedKeys: ['meihua-time', 'meihua-number'],
  },
  {
    id: 'jinqian',
    to: '/basics/jinqian',
    title: '金钱卦',
    desc: '三枚铜钱六掷成卦，背三字二，最通行的简易起卦法',
    time: '约 4 分钟',
    quiz: true,
    usedKeys: ['jinqian'],
  },
  {
    id: 'yuanliu',
    to: '/basics/yuanliu',
    title: '易学源流',
    desc: '从伏羲画卦到程朱集成——易学三千年脉络与本站功能的出处地图',
    time: '约 5 分钟',
    quiz: false,
    usedKeys: null,
  },
  {
    id: 'shili',
    to: '/shili',
    title: '春秋筮例',
    desc: '左传/国语二十余条占筮与引易实录——现存最早的周易应用现场',
    time: '约 20 分钟',
    quiz: false,
    usedKeys: null,
  },
  {
    id: 'shishi',
    to: '/basics/shishi',
    title: '爻辞中的商周史事',
    desc: '王亥丧牛、高宗伐鬼方、帝乙归妹——藏在爻辞里的历史化石',
    time: '约 10 分钟',
    quiz: false,
    usedKeys: null,
  },
  {
    id: 'glossary',
    to: '/basics/glossary',
    title: '名词表',
    desc: '易学常用术语汇编：卦际关系、爻位、八宫纳甲、占法、图书',
    time: '随查随用',
    quiz: false,
    usedKeys: null,
  },
]

// 计算某主题的读/练/用状态(无该层则为 null)
export function topicStatus(topic, progress) {
  return {
    read: !!progress.read[topic.id],
    quiz: topic.quiz ? !!progress.quiz[topic.id]?.passed : null,
    used: topic.usedKeys ? topic.usedKeys.some(k => progress.used[k]) : null,
  }
}

function ProgressDots({ topic, progress }) {
  const st = topicStatus(topic, progress)
  const dots = [
    ['读', st.read],
    ...(st.quiz !== null ? [['练', st.quiz]] : []),
    ...(st.used !== null ? [['用', st.used]] : []),
  ]
  return (
    <span className="topic-dots" aria-label={dots.map(([l, on]) => `${l}${on ? '已完成' : '未完成'}`).join('，')}>
      {dots.map(([label, on]) => (
        <span key={label} className={`topic-dot ${on ? 'topic-dot--on' : ''}`}>{label}</span>
      ))}
    </span>
  )
}

export default function BasicsPage() {
  const progress = getProgress()
  return (
    <div className="basics-index-page">
      <div className="page-header">
        <h1 className="page-title">学堂</h1>
        <p className="page-subtitle">从阴阳基础到象数占法，按推荐次序渐进——每篇读完可以练一练，占法篇还能直接去工作台实操。</p>
      </div>
      <div className="basics-index-list">
        {LEARN_TOPICS.map((s, i) => (
          <Link key={s.to} to={s.to} className="basics-index-card">
            <span className="basics-index-card__num">{i + 1}</span>
            <div className="basics-index-card__body">
              <div className="basics-index-card__title">{s.title}</div>
              <div className="basics-index-card__desc">{s.desc}</div>
            </div>
            <div className="basics-index-card__meta">
              <ProgressDots topic={s} progress={progress} />
              <span className="basics-index-card__time">{s.time}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
