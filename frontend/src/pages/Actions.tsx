import { useEffect, useState } from 'react'
import { Zap, CheckCircle, Clock, XCircle } from 'lucide-react'
import { apiClient } from '../api/client'

export default function Actions() {
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadActions()
  }, [])

  const loadActions = async () => {
    try {
      const response = await apiClient.get('/api/v1/actions/')
      setActions(response.data)
    } catch (error) {
      console.error('Failed to load actions:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case 'executing':
        return <Clock className="h-5 w-5 text-yellow-400" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-400" />
      default:
        return <Clock className="h-5 w-5 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 border-green-500/50'
      case 'executing':
        return 'bg-yellow-500/10 border-yellow-500/50'
      case 'failed':
        return 'bg-red-500/10 border-red-500/50'
      default:
        return 'bg-slate-700/50 border-slate-600'
    }
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
        <h1 className="text-3xl font-bold mb-2">Automated Actions</h1>
        <p className="text-slate-400">History of automated actions triggered by AURA</p>
      </div>

      {actions.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <Zap className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No automated actions yet</p>
          <p className="text-slate-500 text-sm mt-2">Actions will appear here when AURA triggers them</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`bg-slate-800 rounded-lg p-6 border ${getStatusColor(action.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(action.status)}
                    <h3 className="text-lg font-semibold capitalize">
                      {action.action_type?.replace('_', ' ')}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      action.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      action.status === 'executing' ? 'bg-yellow-500/20 text-yellow-400' :
                      action.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">
                    Trigger: <span className="text-slate-300">{action.trigger_reason}</span>
                  </p>
                  {action.target_file && (
                    <p className="text-sm text-slate-400 mb-2">
                      File: <span className="text-slate-300 font-mono text-xs">{action.target_file}</span>
                    </p>
                  )}
                  {action.result && (
                    <div className="mt-3 bg-slate-900/50 rounded p-3">
                      <p className="text-xs text-slate-400 mb-1">Result:</p>
                      <p className="text-sm text-slate-300">{action.result.message || JSON.stringify(action.result)}</p>
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  {new Date(action.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Types Info */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Available Action Types</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded p-4">
            <h3 className="font-semibold mb-2">Auto Fix</h3>
            <p className="text-sm text-slate-400">Automatically fixes common code issues</p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <h3 className="font-semibold mb-2">Generate Tests</h3>
            <p className="text-sm text-slate-400">Creates test suites automatically</p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <h3 className="font-semibold mb-2">Block Deployment</h3>
            <p className="text-sm text-slate-400">Prevents deployment of risky code</p>
          </div>
          <div className="bg-slate-700/50 rounded p-4">
            <h3 className="font-semibold mb-2">Notify Team</h3>
            <p className="text-sm text-slate-400">Sends alerts to the team</p>
          </div>
        </div>
      </div>
    </div>
  )
}

