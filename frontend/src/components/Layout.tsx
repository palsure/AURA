import { Link, useLocation } from 'react-router-dom'
import { Sparkles, LayoutDashboard, FolderGit } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: FolderGit, label: 'Repositories' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Row: Logo, Title, and Navigation Tabs */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <Sparkles className="h-8 w-8 text-primary-400" />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold">AURA</h1>
                <span className="text-base text-slate-400">Autonomous Unified Review Agent</span>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <nav className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

