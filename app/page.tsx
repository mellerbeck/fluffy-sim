"use client"

import { useEffect, useRef, useState } from "react"

export default function Home() {
  const [target, setTarget] = useState({ x: 0, y: 0 })
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [tailAngle, setTailAngle] = useState(0)

  // center on load
  useEffect(() => {
    const x = window.innerWidth / 2
    const y = window.innerHeight / 2
    setTarget({ x, y })
    setPos({ x, y })
  }, [])

  // smooth follow (lerp)
  const followRafRef = useRef<number | null>(null)
  const posRef = useRef(pos)
  const targetRef = useRef(target)

  useEffect(() => {
    posRef.current = pos
  }, [pos])

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    const tick = () => {
      const p = posRef.current
      const t = targetRef.current

      const k = 0.12
      const nx = p.x + (t.x - p.x) * k
      const ny = p.y + (t.y - p.y) * k

      posRef.current = { x: nx, y: ny }
      setPos({ x: nx, y: ny })

      followRafRef.current = requestAnimationFrame(tick)
    }

    followRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current)
    }
  }, [])

  // tail wag via time-based sine wave
  const wagRafRef = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now()

    const wag = (now: number) => {
      const t = (now - start) / 1000 // seconds
      // 5 wags per second-ish, +/- 22 degrees
      const angle = Math.sin(t * Math.PI * 2 * 5) * 22
      setTailAngle(angle)
      wagRafRef.current = requestAnimationFrame(wag)
    }

    wagRafRef.current = requestAnimationFrame(wag)
    return () => {
      if (wagRafRef.current) cancelAnimationFrame(wagRafRef.current)
    }
  }, [])

  const dx = target.x - pos.x
  const dy = target.y - pos.y
  const speed = Math.min(30, Math.hypot(dx, dy))
  const squishX = 1 + speed / 320
  const squishY = 1 - speed / 600

  return (
    <main
      className="min-h-screen overflow-hidden select-none bg-sky-50"
      onPointerDown={(e) => setTarget({ x: e.clientX, y: e.clientY })}
    >
      <div className="fixed left-0 top-0 p-4 text-sm opacity-70">
        Click anywhere. Fluffy follows.
      </div>

      <div
        className="fixed will-change-transform"
        style={{
          transform: `translate(${pos.x - 60}px, ${pos.y - 60}px) scale(${squishX}, ${squishY})`,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* tail (behind body) */}
          <g transform={`rotate(${tailAngle} 90 78)`}>
            <path
              d="M88 78 C 102 70, 112 78, 110 90 C 104 88, 96 86, 88 78 Z"
              fill="#e8c48c"
            />
          </g>

          {/* body */}
          <ellipse cx="60" cy="78" rx="40" ry="30" fill="#f5d6a1" />

          {/* head */}
          <circle cx="60" cy="45" r="28" fill="#f5d6a1" />

          {/* ears */}
          <ellipse cx="35" cy="30" rx="12" ry="18" fill="#e8c48c" />
          <ellipse cx="85" cy="30" rx="12" ry="18" fill="#e8c48c" />

          {/* eyes */}
          <circle cx="50" cy="45" r="4" fill="#222" />
          <circle cx="70" cy="45" r="4" fill="#222" />

          {/* nose */}
          <circle cx="60" cy="55" r="3" fill="#444" />

          {/* mouth */}
          <path d="M55 60 Q60 65 65 60" stroke="#444" strokeWidth="2" fill="none" />

          {/* feet */}
          <ellipse cx="45" cy="105" rx="8" ry="6" fill="#e8c48c" />
          <ellipse cx="75" cy="105" rx="8" ry="6" fill="#e8c48c" />
        </svg>
      </div>
    </main>
  )
}
