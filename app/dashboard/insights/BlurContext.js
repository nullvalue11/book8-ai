'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'book8.insights.blurEnabled'

const BlurContext = createContext({
  blurred: false,
  toggle: () => {}
})

export function BlurProvider({ children }) {
  const [blurred, setBlurred] = useState(false)

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true') {
        setBlurred(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setBlurred((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'b' && e.key !== 'B') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target && e.target.tagName) || ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  return <BlurContext.Provider value={{ blurred, toggle }}>{children}</BlurContext.Provider>
}

export function useBlur() {
  return useContext(BlurContext)
}
