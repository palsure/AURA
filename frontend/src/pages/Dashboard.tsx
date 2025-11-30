import { useEffect, useState } from 'react'
import { getDashboardStats, getQualityTrends, DashboardStats } from '../api/client'
import { TrendingUp, AlertTriangle, CheckCircle, Code, Activity, TestTube, BarChart3 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trends, setTrends] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [statsData, trendsData] = await Promise.all([
        getDashboardStats(),
        getQualityTrends(30),
      ])
      console.log('Dashboard stats loaded:', statsData)
      setStats(statsData)
      setTrends(trendsData)
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error)
      console.error('Error details:', error.response?.data || error.message)
      // Set empty stats to show error state
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">No data available. Start analyzing code to see insights!</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
        >
          Retry Loading
        </button>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Analyses',
      value: stats.total_analyses,
      icon: Code,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Open Issues',
      value: stats.open_issues,
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      title: 'Fixed Issues',
      value: stats.fixed_issues,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Avg Quality Score',
      value: `${stats.average_quality_score.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Test Coverage',
      value: `${stats.average_test_coverage.toFixed(1)}%`,
      icon: BarChart3,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      title: 'Total Tests',
      value: stats.total_tests,
      icon: TestTube,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ]

  // Process issues by type data, handling empty or null values
  const issuesByTypeData = stats.issues_by_type && typeof stats.issues_by_type === 'object'
    ? Object.entries(stats.issues_by_type)
        .filter(([type, count]) => type && count > 0) // Filter out null/empty types and zero counts
        .map(([type, count]) => ({
          type: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
          count: Number(count) || 0,
        }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-slate-400">Overview of your codebase health and insights</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.title}
              className={`${stat.bgColor} rounded-lg p-6 border border-slate-700`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Trends */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Quality Score Trends</h2>
          {trends && trends.data_points && trends.data_points.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends.data_points}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <Line
                  type="monotone"
                  dataKey="quality_score"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ fill: '#0ea5e9' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              No trend data available
            </div>
          )}
        </div>

        {/* Issues by Type */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Issues by Type</h2>
          {issuesByTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={issuesByTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                />
                <Bar dataKey="count" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              No issues data available
            </div>
          )}
        </div>
      </div>

      {/* Test Metrics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tests by Type */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Tests by Type</h2>
          {stats.tests_by_type && Object.keys(stats.tests_by_type).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(stats.tests_by_type).map(([type, count]) => ({
                type: type.charAt(0).toUpperCase() + type.slice(1) || 'Unknown',
                count
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                />
                <Bar dataKey="count" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              No test data available
            </div>
          )}
        </div>

        {/* Test Coverage Overview */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Test Coverage Overview</h2>
          <div className="space-y-4">
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">Average Coverage</span>
                <span className="text-2xl font-bold text-cyan-400">
                  {stats.average_test_coverage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2 mt-2">
                <div
                  className="bg-cyan-400 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(stats.average_test_coverage, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Total Tests</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.total_tests}</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400 mb-1">Last 7 Days</p>
                <p className="text-2xl font-bold text-green-400">{stats.tests_created_last_7_days}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold">Recent Activity</h2>
        </div>
        <div className="space-y-2 text-slate-300">
          <p>• {stats.recent_analyses} analyses performed in the last 7 days</p>
          <p>• {stats.total_repositories} repositories connected</p>
          <p>• {stats.fixed_issues} issues resolved</p>
          <p>• {stats.tests_created_last_7_days} tests created in the last 7 days</p>
          <p>• {stats.total_tests} total tests generated</p>
        </div>
      </div>
    </div>
  )
}

