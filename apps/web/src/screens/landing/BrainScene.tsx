/**
 * The hero object: a brain where a handful of threads are lit at any moment and the rest
 * wait in the dark. The lights move — a different thread has your attention every few
 * seconds — but nothing ever goes out completely. That is the promise of the product,
 * drawn instead of explained.
 *
 * SVG plus CSS: nothing to download, nothing to fail, and it scales to any screen.
 */

// Points along the brain where a thread can light up.
const NODES = [
  { cx: 96, cy: 74, delay: 0 },
  { cx: 138, cy: 58, delay: 1.6 },
  { cx: 176, cy: 82, delay: 3.2 },
  { cx: 118, cy: 104, delay: 4.8 },
  { cx: 158, cy: 118, delay: 2.4 },
  { cx: 84, cy: 118, delay: 6.4 },
  { cx: 196, cy: 112, delay: 5.6 },
  { cx: 132, cy: 142, delay: 0.8 },
]

// The links between them, so a lit node reads as part of a network.
const LINKS = [
  [0, 1],
  [1, 2],
  [0, 3],
  [3, 4],
  [2, 4],
  [3, 5],
  [2, 6],
  [4, 7],
  [5, 7],
]

export function BrainScene() {
  return (
    <div className="brain-scene" aria-hidden>
      <div className="brain-orbit" />
      <div className="brain-float">
        <svg viewBox="0 0 260 200" className="brain-svg">
          <defs>
            <radialGradient id="brain-glow" cx="50%" cy="45%">
              <stop offset="0%" stopColor="rgb(var(--accent) / 0.35)" />
              <stop offset="100%" stopColor="rgb(var(--accent) / 0)" />
            </radialGradient>
            <linearGradient id="brain-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent) / 0.9)" />
              <stop offset="100%" stopColor="rgb(var(--success) / 0.55)" />
            </linearGradient>
          </defs>

          <ellipse cx="130" cy="100" rx="120" ry="92" fill="url(#brain-glow)" />

          {/* outline: two hemispheres with the fold down the middle */}
          <g fill="none" stroke="url(#brain-stroke)" strokeWidth="2" strokeLinecap="round">
            <path d="M130 36c-16-14-42-13-56 3-16-3-31 8-33 24-13 6-18 22-11 34-7 13-2 30 12 36 4 16 21 26 37 21 10 12 28 14 40 5" />
            <path d="M130 36c16-14 42-13 56 3 16-3 31 8 33 24 13 6 18 22 11 34 7 13 2 30-12 36-4 16-21 26-37 21-10 12-28 14-40 5" />
            <path d="M130 36v123" strokeOpacity="0.35" />
            {/* folds */}
            <path d="M104 62c-12 4-16 18-8 27" strokeOpacity="0.5" />
            <path d="M156 62c12 4 16 18 8 27" strokeOpacity="0.5" />
            <path d="M92 108c10 2 16 12 14 22" strokeOpacity="0.5" />
            <path d="M168 108c-10 2-16 12-14 22" strokeOpacity="0.5" />
          </g>

          <g stroke="rgb(var(--accent) / 0.35)" strokeWidth="1.5">
            {LINKS.map(([a, b], i) => (
              <line key={i} x1={NODES[a].cx} y1={NODES[a].cy} x2={NODES[b].cx} y2={NODES[b].cy} />
            ))}
          </g>

          <g>
            {NODES.map((node, i) => (
              <circle
                key={i}
                className="brain-node"
                cx={node.cx}
                cy={node.cy}
                r="5"
                style={{ animationDelay: `${node.delay}s` }}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
