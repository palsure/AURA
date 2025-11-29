import { useState, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { getAIStatus, AIStatus } from '../api/client'

interface AIWarningBannerProps {
  onDismiss?: () => void
  compact?: boolean
}

export default function AIWarningBanner({ onDismiss, compact = false }: AIWarningBannerProps) {
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    checkAIStatus()
  }, [])

  const checkAIStatus = async () => {
    try {
      const status = await getAIStatus()
      setAIStatus(status)
    } catch (error) {
      console.error('Failed to check AI status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    if (onDismiss) {
      onDismiss()
    }
  }

  if (loading || dismissed) return null

  // Check if AI is not available
  const aiNotAvailable = aiStatus && !aiStatus.openai_available && !aiStatus.anthropic_available

  if (!aiNotAvailable) return null

  if (compact) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-yellow-400">
            AI features disabled: API keys not configured
          </span>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="text-yellow-400 hover:text-yellow-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-yellow-500/10 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1">
              AI Integration Not Configured
            </h3>
            <p className="text-sm text-yellow-300/80 mb-2">
              AI features are currently disabled because API keys are not configured. 
              Test generation and code analysis will use template/mock mode instead of real AI.
            </p>
            <div className="text-xs text-yellow-300/70 space-y-1">
              <p>To enable AI features:</p>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Get API keys from OpenAI (https://platform.openai.com/api-keys) or Anthropic (https://console.anthropic.com/)</li>
                <li>Create a <code className="bg-yellow-500/20 px-1 rounded">backend/.env</code> file</li>
                <li>Add: <code className="bg-yellow-500/20 px-1 rounded">OPENAI_API_KEY=sk-...</code></li>
                <li>Restart the backend server</li>
              </ol>
            </div>
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="text-yellow-400 hover:text-yellow-300 flex-shrink-0 ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}

