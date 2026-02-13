"use client"
import { useState } from "react"

export default function Home() {
  const [hunger, setHunger] = useState(50)
  const [happiness, setHappiness] = useState(50)

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <div className="text-6xl">🐶</div>

      <div className="w-64">
        <div>Hunger: {hunger}</div>
        <div>Happiness: {happiness}</div>
      </div>

      <div className="flex gap-4">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setHunger(Math.max(0, hunger - 10))}
        >
          Feed
        </button>

        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={() => setHappiness(Math.min(100, happiness + 10))}
        >
          Play
        </button>

        <button
          className="px-4 py-2 bg-purple-500 text-white rounded"
          onClick={() => {
            setHunger(Math.min(100, hunger + 5))
            setHappiness(Math.max(0, happiness - 5))
          }}
        >
          Sleep
        </button>
      </div>
    </main>
  )
}
