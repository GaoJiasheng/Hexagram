function seedHash(seed) {
  let hash = 2166136261
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function avatarPixels(seed) {
  const hash = seedHash(seed)
  let state = hash || 0x9e3779b9
  const random = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0x100000000
  }
  const pixels = []
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      if (random() < 0.5) continue
      pixels.push([x, y])
      if (x < 2) pixels.push([4 - x, y])
    }
  }
  if (pixels.length === 0) pixels.push([2, 2])
  return pixels
}

export default function PixelAvatar({ seed, size = 32 }) {
  const pixels = avatarPixels(seed)
  return (
    <svg className="pixel-avatar" width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges" role="img" aria-label="默认像素头像">
      <rect width="5" height="5" fill="var(--paper-raised)" />
      {pixels.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="var(--cinnabar)" />)}
    </svg>
  )
}
