// 通知：优先系统通知，失败则退回应用内横幅。
// iPhone 的现实：网页 / PWA 在后台不能本地定时；真正可靠的是导出的 .ics 导入系统日历。

export interface ToastDetail {
  title: string
  body?: string
}

export const TOAST_EVENT = 'cybertrack:toast'

export function pushToast(title: string, body?: string): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { title, body } }))
}

export function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationSupported()) return 'unsupported'
  return Notification.permission
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

async function showViaServiceWorker(title: string, body?: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.showNotification(title, { body, tag: 'cybertrack-reminder', icon: '/pwa-192x192.png' })
    return true
  } catch {
    return false
  }
}

/** 尝试系统通知；不可用就发应用内横幅（一定能看到） */
export async function notify(title: string, body?: string): Promise<void> {
  let shown = false
  if (notificationSupported() && Notification.permission === 'granted') {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      shown = await showViaServiceWorker(title, body)
    }
    if (!shown) {
      try {
        new Notification(title, { body, tag: 'cybertrack-reminder', icon: '/pwa-192x192.png' })
        shown = true
      } catch {
        shown = false
      }
    }
  }
  if (!shown) pushToast(title, body)
}
