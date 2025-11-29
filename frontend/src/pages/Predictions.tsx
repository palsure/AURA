import { useState } from 'react'
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { apiClient } from '../api/client'

const EXAMPLE_CODE = `def process_data(data):
    # Recent changes made here
    result = []
    for item in data:
        if item.value > 100:
            result.append(item.value * 2)
    return result`

export default function Predictions() {
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [filePath, setFilePath] = useState('src/main.py')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handlePredict = async () => {
    if (!code.trim()) return

    setLoading(true)
    try {
      const response = await apiClient.post('/api/v1/predict/regression', {
        code,
        file_path: filePath,
      })
      setResult(response.data)
    } catch (error) {
      console.error('Failed to predict regression:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-400 bg-red-500/10 border-red-500/50'
      case 'high':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/50'
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50'
      default:
        return 'text-green-400 bg-green-500/10 border-green-500/50'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Regression Prediction</h1>
        <p className="text-slate-400">ML-based regression risk assessment</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Code Input</h2>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="File path"
            className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-64 bg-slate-900 text-slate-100 p-4 rounded border border-slate-600 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handlePredict}
            disabled={loading}
            className="mt-4 w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <TrendingUp className="h-5 w-5" />
                <span>Predict Regression Risk</span>
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          {result ? (
            <>
              <div className={`bg-slate-800 rounded-lg p-6 border ${getRiskColor(result.risk_level)}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Prediction Result</h2>
                  <TrendingUp className="h-8 w-8" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Risk Level</p>
                    <p className="text-2xl font-bold uppercase">{result.risk_level}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Risk Score</p>
                    <div className="w-full bg-slate-700 rounded-full h-3">
                      <div
                        className="bg-primary-500 h-3 rounded-full transition-all"
                        style={{ width: `${result.risk_score * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-sm mt-1">{(result.risk_score * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 mb-1">Confidence</p>
                    <p className="text-lg font-semibold">{(result.confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {result.recommendations && result.recommendations.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start space-x-2 text-sm">
                        <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-300">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.predicted_issues && result.predicted_issues.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Predicted Issues</h3>
                  <div className="space-y-2">
                    {result.predicted_issues.map((issue: any, idx: number) => (
                      <div key={idx} className="bg-slate-700/50 rounded p-3">
                        <p className="font-semibold text-sm">{issue.type}</p>
                        <p className="text-xs text-slate-400 mt-1">{issue.message}</p>
                        <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                          issue.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                          issue.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Enter code and predict regression risk</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

