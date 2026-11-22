import { useState } from 'react'
import { StoreProvider, useStore } from './data/store'
import { Icon, type IconName } from './components/Icons'
import { ToastStack } from './components/ToastStack'
import { useReminderEngine } from './lib/reminders'
import { HomeScreen } from './screens/HomeScreen'
import { PlanScreen } from './screens/PlanScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { ProjectScreen } from './screens/ProjectScreen'
import { MeScreen } from './screens/MeScreen'
import { ExerciseScreen } from './screens/ExerciseScreen'

type TabId = 'home' | 'plan' | 'calendar' | 'exercise' | 'project' | 'me'

const TABS: Array<{ id: TabId; label: string; icon: IconName }> = [
  { id: 'home', label: '首页', icon: 'home' },
  { id: 'plan', label: '学习计划', icon: 'plan' },
  { id: 'calendar', label: '日历', icon: 'calendar' },
  { id: 'exercise', label: '运动', icon: 'run' },
  { id: 'project', label: '项目', icon: 'project' },
  { id: 'me', label: '我的', icon: 'me' },
]

function Shell() {
  const { state, ready } = useStore()
  const [tab, setTab] = useState<TabId>('home')
  useReminderEngine(state)

  if (!ready || !state) {
    return (
      <div className="boot">
        <span className="boot-spinner" />
        正在读取本地数据…
      </div>
    )
  }

  function go(next: TabId) {
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className={`app theme-${tab}`}>
      <main className="app-body">
        {tab === 'home' && <HomeScreen onOpenPlan={() => go('plan')} onOpenTab={go} />}
        {tab === 'plan' && <PlanScreen />}
        {tab === 'calendar' && <CalendarScreen />}
        {tab === 'exercise' && <ExerciseScreen />}
        {tab === 'project' && <ProjectScreen />}
        {tab === 'me' && <MeScreen />}
      </main>

      <nav className="tabbar" aria-label="主导航">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab ${tab === item.id ? 'is-active' : ''}`}
            onClick={() => go(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <ToastStack />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
