// 线性图标：单一路径表，避免引入图标库。

import type { CSSProperties } from 'react'

export type IconName =
  | 'home'
  | 'plan'
  | 'calendar'
  | 'project'
  | 'me'
  | 'check'
  | 'plus'
  | 'clock'
  | 'flame'
  | 'chevron'
  | 'link'
  | 'bell'
  | 'download'
  | 'trash'
  | 'close'
  | 'target'
  | 'pin'
  | 'refresh'
  | 'run'
  | 'upload'

const PATHS: Record<IconName, string> = {
  home: 'M3 10.8 12 3.5l9 7.3V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  plan: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  calendar: 'M4 6.5h16v14H4zM4 10h16M8 3.5v4M16 3.5v4',
  project: 'M4 7.5h6l2 2h8v9H4zM4 7.5V5h6l2 2',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  check: 'M4.5 12.5 9 17l10.5-10.5',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  flame: 'M12 3c1 3.5 4.5 5 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.5 2-4.5.5 2 1.5 3 2.5 3.5-.5-3 0-5.5 0-8z',
  chevron: 'M9.5 6 15.5 12l-6 6',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.6 1.6M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6',
  bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2.5 6.5H3.5C4.5 14.5 6 13 6 9zM9.5 19a2.5 2.5 0 0 0 5 0',
  download: 'M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 20h15',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13',
  close: 'M6 6l12 12M18 6 6 18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  pin: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11zM12 12.4a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5',
  run: 'M13.5 5.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zM8 21l3-6 2.5 2 1.5 4M11 15l-1-4 3-2.5 3 3 2.5 1M10 11 6.5 13 5 16.5',
  upload: 'M12 16.5V4.5M7 9l5-4.5L17 9M4.5 20.5h15',
}

interface IconProps {
  name: IconName
  size?: number
  style?: CSSProperties
}

export function Icon({ name, size = 20, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
