import { useEffect, useState } from 'react'
import { getIssues, markIssueFixed, Issue } from '../api/client'
import { AlertCircle, CheckCircle, Filter, X } from 'lucide-react'

export default function Issues() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    severity: '',
    issue_type: '',
    fixed: undefined as boolean | undefined,
  })

  useEffect(() => {
    loadIssues()
  }, [filters])

  const loadIssues = async () => {
    try {
      const data = await getIssues({
        severity: filters.severity || undefined,
        issue_type: filters.issue_type || undefined,
        fixed: filters.fixed,
      })
      setIssues(data)
    } catch (error) {
      console.error('Failed to load issues:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkFixed = async (issueId: number) => {
    try {
      await markIssueFixed(issueId)
      loadIssues()
    } catch (error) {
      console.error('Failed to mark issue as fixed:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/50'
    }
  }

  const clearFilters = () => {
    setFilters({ severity: '', issue_type: '', fixed: undefined })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Issues</h1>
        <p className="text-slate-400">View and manage detected code issues</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-slate-400" />
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filters.issue_type}
            onChange={(e) => setFilters({ ...filters, issue_type: e.target.value })}
            className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
          >
            <option value="">All Types</option>
            <option value="bug">Bug</option>
            <option value="security">Security</option>
            <option value="performance">Performance</option>
            <option value="style">Style</option>
            <option value="best_practice">Best Practice</option>
          </select>
          <select
            value={filters.fixed === undefined ? '' : filters.fixed ? 'true' : 'false'}
            onChange={(e) =>
              setFilters({
                ...filters,
                fixed: e.target.value === '' ? undefined : e.target.value === 'true',
              })
            }
            className="bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
          >
            <option value="">All Status</option>
            <option value="false">Open</option>
            <option value="true">Fixed</option>
          </select>
          {(filters.severity || filters.issue_type || filters.fixed !== undefined) && (
            <button
              onClick={clearFilters}
              className="flex items-center space-x-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Issues List */}
      {issues.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <p className="text-slate-400">No issues found with current filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {issues.map((issue: any) => (
            <div
              key={issue.id}
              className={`p-4 rounded-lg border ${
                issue.fixed
                  ? 'bg-slate-800/50 border-slate-700 opacity-60'
                  : getSeverityColor(issue.severity)
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold uppercase text-sm">{issue.issue_type}</span>
                    <span className="text-xs px-2 py-1 rounded bg-slate-700">
                      Line {issue.line_number}
                    </span>
                    {issue.fixed && (
                      <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/50">
                        Fixed
                      </span>
                    )}
                  </div>
                  <p className="text-sm mb-2">{issue.message}</p>
                  <div className="bg-slate-900/50 rounded p-2">
                    <p className="text-xs text-slate-300">
                      <span className="font-semibold">Suggestion:</span> {issue.suggestion}
                    </p>
                  </div>
                </div>
                {!issue.fixed && (
                  <button
                    onClick={() => handleMarkFixed(issue.id)}
                    className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold transition-colors flex items-center space-x-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Mark Fixed</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

