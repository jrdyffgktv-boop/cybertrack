import { useEffect, useState } from 'react'
import { TOAST_EVENT, type ToastDetail } from '../lib/notify'

interface ToastItem extends ToastDetail {
  id: number
}

export function ToastStack() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ToastDetail>).detail
      if (!detail?.title) return
      const id = Date.now() + Math.random()
      setItems((prev) => [...prev, { ...detail, id }])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }, 5000)
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast">
          <strong>{item.title}</strong>
          {item.body && <span>{item.body}</span>}
        </div>
      ))}
    </div>
  )
}
