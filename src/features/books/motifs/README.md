# 封面母题 · 外挂目录

每本书一个专属母题。以前全部内联在 `../BookCover.jsx` 里,于是「加一本书」= 「改那个共享文件」,
并发产书必撞。现在新母题一律放这里,**一个文件一个母题,互不相干**。

## 怎么加

文件名即母题名(`index.json` 里 `cover.motif` 填的就是它):`your-motif-name.jsx`

```jsx
// 母题:一句话说明它画的是什么、为什么配这本书
const CINNABAR = '#c3272b'   // 需要朱色时自行声明,本目录不依赖 BookCover 的内部常量

export default function YourMotifName() {
  return (
    <g>
      {/* 画布 300×420,原点左上。背景由 BookCover 铺本书 accent 色,
          这里只叠形状 —— 用半透明白/黑做明暗,朱色做点睛。 */}
      <path d="…" fill="rgba(255,255,255,0.10)" />
      <circle cx="150" cy="190" r="30" fill={CINNABAR} opacity="0.9" />
    </g>
  )
}
```

## 两条约束

1. **只返回 `<g>`**,不要自带 `<svg>`(外层已有)。
2. **别写死书名文字** —— 书名由 BookCover 竖排渲染,母题只管图形。
