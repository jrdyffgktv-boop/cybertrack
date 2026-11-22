import type { ReactNode } from 'react'

interface ProgressRingProps {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}

/** 圆环进度：用 SVG circle 的 dashoffset 绘制，不依赖图表库 */
export function ProgressRing({ value, size = 148, stroke = 10, children }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped)

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

interface BarProps {
  value: number
  color?: string
  height?: number
}

export function ProgressBar({ value, color = 'var(--accent)', height = 6 }: BarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div className="bar" style={{ height }}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color, height }} />
    </div>
  )
}
