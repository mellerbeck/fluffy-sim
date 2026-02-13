"use client"

import { useEffect, useRef, useState } from "react"

type Vec = { x: number; y: number }
type Mode = "idle" | "ball_flying" | "chasing" | "returning"

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)

export default function Home() {
  const [mode, setMode] = useState<Mode>("idle")

  const [dogPos, setDogPos] = useState<Vec>({ x: 0, y: 0 })
  const [ballPos, setBallPos] = useState<Vec>({ x: 0, y: 0 })
  const [ballVisible, setBallVisible] = useState(false)

  const dogPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballPosRef = useRef<Vec>({ x: 0, y: 0 })
  const ballVelRef = useRef<Vec>({ x: 0, y: 0 })
  const modeRef = useRef<Mode>("idle")

  const cursorRef = useRef<Vec>({ x: 0, y: 0 })
  const hasBallRef = useRef(false)

  const rafRef = useRef<number | null>(null)
  const lastTRef = useRef<number>(0)

  // init positions
  useEffect(() => {
    const x = window.innerWidth / 2
    const y = window.innerHeight / 2
    setDogPos({ x, y })
    setBallPos({ x, y })
    dogPosRef.current = { x, y }
    ballPosRef.current = { x, y }
    cursorRef.current = { x, y }
  }, [])

  // keep refs in sync
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { dogPosRef.current = dogPos }, [dogPos])
  useEffect(() => { ballPosRef.current = ballPos }, [ballPos])

  // track cursor
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [])

  // main loop
  useEffect(() => {
    const gravity = 1800 // px/s^2
    const groundPad = 24 // keep things above bottom
    const dogSpeed = 520 // px/s
    const pickupRadius = 28
    const returnRadius = 26

    const tick = (t: number) => {
      const last = lastTRef.current || t
      const dt = clamp((t - last) / 1000, 0, 0.05)
      lastTRef.current = t

      const w = window.innerWidth
      const h = window.innerHeight
      const groundY = h - groundPad

      // clamp dog to viewport
      let d = dogPosRef.current
      d = { x: clamp(d.x, 20, w - 20), y: clamp(d.y, 20, groundY) }

      let b = ballPosRef.current
      let bv = ballVelRef.current
      const m = modeRef.current

      if (m === "ball_flying") {
        // ball physics
        bv = { x: bv.x, y: bv.y + gravity * dt }
        b = { x: b.x + bv.x * dt, y: b.y + bv.y * dt }

        // ground collide
        if (b.y >= groundY) {
          b = { x: b.x, y: groundY }
          // small bounce then stop
          bv = { x: bv.x * 0.55, y: -bv.y * 0.35 }
          if (Math.abs(bv.y) < 120) {
            bv = { x: 0, y: 0 }
            modeRef.current = "chasing"
            setMode("chasing")
          }
        }

        // side walls
        if (b.x < 12 || b.x > w - 12) {
          b = { x: clamp(b.x, 12, w - 12), y: b.y }
          bv = { x: -bv.x * 0.6, y: bv.y }
        }
      }

      if (m === "chasing") {
        // dog moves to ball
        const to = b
        const dx = to.x - d.x
        const dy = to.y - d.y
        const L = Math.hypot(dx, dy) || 1
        const step = dogSpeed * dt
        const move = Math.min(step, L)
        d = { x: d.x + (dx / L) * move, y: d.y + (dy / L) * move }

        // pickup
        if (dist(d, b) <= pickupRadius) {
          hasBallRef.current = true
          modeRef.current = "returning"
          setMode("returning")
        }
      }

      if (m === "returning") {
        const cur = cursorRef.current
        const dx = cur.x - d.x
        const dy = cur.y - d.y
        const L = Math.hypot(dx, dy) || 1
        const step = dogSpeed * dt
        const move = Math.min(step, L)
        d = { x: d.x + (dx / L) * move, y: d.y + (dy / L) * move }

        // ball carried by dog
        b = { x: d.x + 22, y: d.y + 10 }
        bv = { x: 0, y: 0 }

        // drop near cursor
        if (dist(d, cur) <= returnRadius) {
          hasBallRef.current = false
          modeRef.current = "idle"
          setMode("idle")
          // leave ball at drop point
          b = { x: cur.x + 18, y: cur.y + 18 }
        }
      }

      // commit
      dogPosRef.current = d
      ballPosRef.current = b
      ballVelRef.current = bv

      setDogPos(d)
      setBallPos(b)

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const throwBall = (target: Vec) => {
    const start = dogPosRef.current
    const dx = target.x - start.x
    const dy = target.y - start.y

    // aim with a bit of arc: flatter for short throws, higher for long
    const d = Math.hypot(dx, dy)
    const time = clamp(d / 900, 0.35, 0.9) // seconds
    const vx = dx / time
    // give it upward kick (negative y), tuned for "fun"
    const vy = dy / time - 700

    ballPosRef.current = { x: start.x, y: start.y }
    ballVelRef.current = { x: vx, y: vy }

    setBallVisible(true)
    setBallPos({ x: start.x, y: start.y })
    hasBallRef.current = false
    modeRef.current = "ball_flying"
    setMode("ball_flying")
  }

  return (
    <main
      className="min-h-screen overflow-hidden select-none bg-sky-50"
      onPointerDown={(e) => {
        // left mouse only
        if (e.button !== 0) return
        throwBall({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className="fixed left-0 top-0 p-4 text-sm opacity-70">
        Left click to throw. Mode: {mode}
      </div>

      {/* ball */}
      {ballVisible && (
        <div
          className="fixed w-4 h-4 rounded-full bg-red-500 shadow"
          style={{ transform: `translate(${ballPos.x - 8}px, ${ballPos.y - 8}px)` }}
        />
      )}

      {/* dog */}
      <div
        className="fixed will-change-transform"
        style={{ transform: `translate(${dogPos.x - 60}px, ${dogPos.y - 60}px)` }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* tail */}
          <path d="M92 78 C 108 70, 114 82, 108 92 C 102 90, 96 86, 92 78 Z" fill="#e8c48c" />
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
