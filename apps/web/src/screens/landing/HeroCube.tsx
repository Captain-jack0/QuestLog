/**
 * The object in the hero: a slowly turning cube whose faces are a 3×3 grid, lit from one
 * side so most of it stays in the dark. Built from CSS transforms rather than a model file
 * or a WebGL bundle — it costs nothing to load and it cannot fail to render.
 *
 * Each face carries a few lit tiles. That is the whole metaphor: a handful of threads are
 * visible at a time, the rest are still there in the dark.
 */

const FACES = [
  { transform: 'translateZ(var(--half))', lit: [0, 4, 8] },
  { transform: 'rotateY(90deg) translateZ(var(--half))', lit: [2, 4] },
  { transform: 'rotateY(180deg) translateZ(var(--half))', lit: [1, 5, 6] },
  { transform: 'rotateY(-90deg) translateZ(var(--half))', lit: [3, 7] },
  { transform: 'rotateX(90deg) translateZ(var(--half))', lit: [4] },
  { transform: 'rotateX(-90deg) translateZ(var(--half))', lit: [0, 8] },
]

export function HeroCube() {
  return (
    <div className="hero-cube-stage" aria-hidden>
      <div className="hero-cube">
        {FACES.map((face, i) => (
          <div key={i} className="hero-cube-face" style={{ transform: face.transform }}>
            {Array.from({ length: 9 }, (_, tile) => (
              <span
                key={tile}
                className={`hero-cube-tile${face.lit.includes(tile) ? ' is-lit' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
