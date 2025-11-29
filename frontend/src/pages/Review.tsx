import { useState, useEffect } from 'react'
import { Sparkles, AlertTriangle, TestTube, TrendingUp, Zap, Code, FolderGit } from 'lucide-react'
import { apiClient, getRepositories } from '../api/client'
import ModelSelector from '../components/ModelSelector'
import AIWarningBanner from '../components/AIWarningBanner'

const EXAMPLE_CODE = `def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total

def process_user_data(data):
    password = "admin123"  # Security issue
    api_key = "sk-1234567890"  # Security issue
    eval(data)  # Dangerous!
    return {"status": "ok"}`

export default function Review() {
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [language, setLanguage] = useState('python')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | undefined>()
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>()
  const [repositories, setRepositories] = useState<any[]>([])
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null)
  const [reviewMode, setReviewMode] = useState<'code' | 'repository'>('code')

  useEffect(() => {
    loadRepositories()
  }, [])

  const loadRepositories = async () => {
    try {
      const data = await getRepositories()
      setRepositories(data)
    } catch (error) {
      console.error('Failed to load repositories:', error)
    }
  }

  const handleReview = async () => {
    if (reviewMode === 'repository') {
      if (!selectedRepoId) {
        setError('Please select a repository to review')
        return
      }
      
      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const response = await apiClient.post(`/api/v1/review/repository/${selectedRepoId}`, {
          generate_tests: true,
          predict_regression: true,
          trigger_actions: true,
          ai_model: selectedModel,
          ai_provider: selectedProvider,
          max_files: 50,
        })
        setResult(response.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to review repository')
      } finally {
        setLoading(false)
      }
    } else {
      if (!code.trim()) {
        setError('Please enter some code to review')
        return
      }

      setLoading(true)
      setError(null)
      setResult(null)

      try {
        const response = await apiClient.post('/api/v1/review/', {
          code,
          language,
          generate_tests: true,
          predict_regression: true,
          trigger_actions: true,
          ai_model: selectedModel,
          ai_provider: selectedProvider,
        })
        setResult(response.data)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to perform review')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AURA Unified Review</h1>
        <p className="text-slate-400">Complete autonomous review: analysis, tests, predictions, and actions</p>
      </div>

      <AIWarningBanner />

      <div className="flex justify-end">
        <ModelSelector
          selectedModel={selectedModel}
          selectedProvider={selectedProvider}
          onModelChange={(model, provider) => {
            setSelectedModel(model)
            setSelectedProvider(provider)
          }}
          compact
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          {/* Review Mode Selection */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => {
                  setReviewMode('code')
                  setSelectedRepoId(null)
                  setResult(null)
                }}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  reviewMode === 'code'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Review Code
              </button>
              <button
                onClick={() => {
                  setReviewMode('repository')
                  setCode('')
                  setResult(null)
                }}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                  reviewMode === 'repository'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <FolderGit className="h-4 w-4 inline mr-2" />
                Review Repository
              </button>
            </div>
          </div>

          {reviewMode === 'code' ? (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Code Input</h2>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                  <option value="java">Java</option>
                </select>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-96 bg-slate-900 text-slate-100 p-4 rounded border border-slate-600 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter your code here..."
              />
              <button
                onClick={handleReview}
                disabled={loading}
                className="mt-4 w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>AURA is reviewing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    <span>Start AURA Review</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <h2 className="text-xl font-semibold mb-4">Select Repository</h2>
              {repositories.length === 0 ? (
                <div className="text-center py-8">
                  <FolderGit className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No repositories available</p>
                  <a
                    href="/repositories"
                    className="text-primary-400 hover:text-primary-300 text-sm"
                  >
                    Add a repository first
                  </a>
                </div>
              ) : (
                <>
                  <select
                    value={selectedRepoId || ''}
                    onChange={(e) => setSelectedRepoId(Number(e.target.value) || null)}
                    className="w-full bg-slate-700 text-white px-4 py-3 rounded border border-slate-600 mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a repository...</option>
                    {repositories
                      .filter((repo) => repo.repo_type === 'local')
                      .map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.name} ({repo.total_files} files)
                        </option>
                      ))}
                  </select>
                  {selectedRepoId && (
                    <div className="bg-slate-700/50 rounded p-3 mb-4">
                      <p className="text-sm text-slate-300">
                        <span className="font-semibold">Path:</span>{' '}
                        {repositories.find((r) => r.id === selectedRepoId)?.path}
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        <span className="font-semibold">Language:</span>{' '}
                        {repositories.find((r) => r.id === selectedRepoId)?.language || 'Auto-detect'}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleReview}
                    disabled={loading || !selectedRepoId}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>AURA is reviewing repository...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        <span>Review Complete Repository</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    This will review all code files in the repository (up to 50 files)
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
              <AlertTriangle className="h-5 w-5 inline mr-2" />
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h2 className="text-xl font-semibold mb-4">Review Summary</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-400 text-sm">Quality Score</p>
                    <p className="text-2xl font-bold">{result.summary?.quality_score?.toFixed(1) || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-400 text-sm">Issues Found</p>
                    <p className="text-2xl font-bold">{result.summary?.issues_found || 0}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-400 text-sm">Tests Generated</p>
                    <p className="text-2xl font-bold">{result.summary?.tests_generated || 0}</p>
                  </div>
                  <div className="bg-slate-700/50 rounded p-3">
                    <p className="text-slate-400 text-sm">Actions Taken</p>
                    <p className="text-2xl font-bold">{result.summary?.actions_taken || 0}</p>
                  </div>
                </div>
              </div>

              {/* Analysis */}
              {result.analysis && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <Code className="h-5 w-5 text-primary-400" />
                    <h3 className="text-lg font-semibold">Code Analysis</h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Quality Score: <span className="font-semibold">{result.analysis.quality_score?.toFixed(1)}</span>
                  </p>
                  <p className="text-sm text-slate-300">
                    Issues: <span className="font-semibold">{result.analysis.total_issues}</span>
                  </p>
                  {result.analysis.files_reviewed && (
                    <p className="text-sm text-slate-300">
                      Files Reviewed: <span className="font-semibold">{result.analysis.files_reviewed}</span>
                    </p>
                  )}
                  {result.analysis.file_analyses && result.analysis.file_analyses.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-primary-400 text-sm">
                        View File-by-File Analysis ({result.analysis.file_analyses.length} files)
                      </summary>
                      <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                        {result.analysis.file_analyses.map((fileAnalysis: any, idx: number) => (
                          <div key={idx} className="bg-slate-700/50 rounded p-2 text-xs">
                            <p className="font-semibold text-slate-200">{fileAnalysis.file}</p>
                            <p className="text-slate-400">
                              {fileAnalysis.issues} issues • Quality: {fileAnalysis.quality_score.toFixed(1)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Tests */}
              {result.tests && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <TestTube className="h-5 w-5 text-green-400" />
                    <h3 className="text-lg font-semibold">Generated Tests</h3>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">
                    Coverage: <span className="font-semibold">{result.tests.coverage?.toFixed(1)}%</span>
                  </p>
                  <p className="text-sm text-slate-300">
                    Test Count: <span className="font-semibold">{result.tests.test_count}</span>
                  </p>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-primary-400 text-sm">View Test Code</summary>
                    <pre className="mt-2 p-3 bg-slate-900 rounded text-xs overflow-x-auto">
                      {result.tests.test_code}
                    </pre>
                  </details>
                </div>
              )}

              {/* Predictions */}
              {result.prediction && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold">Regression Prediction</h3>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">
                    Risk Level: <span className={`font-semibold ${
                      result.prediction.risk_level === 'critical' ? 'text-red-400' :
                      result.prediction.risk_level === 'high' ? 'text-orange-400' :
                      result.prediction.risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400'
                    }`}>{result.prediction.risk_level?.toUpperCase()}</span>
                  </p>
                  <p className="text-sm text-slate-300">
                    Risk Score: <span className="font-semibold">{(result.prediction.risk_score * 100).toFixed(1)}%</span>
                  </p>
                  {result.prediction.recommendations && result.prediction.recommendations.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {result.prediction.recommendations.map((rec: string, idx: number) => (
                        <p key={idx} className="text-xs text-slate-400">• {rec}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {result.actions && result.actions.length > 0 && (
                <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center space-x-2 mb-4">
                    <Zap className="h-5 w-5 text-purple-400" />
                    <h3 className="text-lg font-semibold">Automated Actions</h3>
                  </div>
                  <div className="space-y-2">
                    {result.actions.map((action: any, idx: number) => (
                      <div key={idx} className="bg-slate-700/50 rounded p-2">
                        <p className="text-sm font-semibold">{action.action_type}</p>
                        <p className="text-xs text-slate-400">Status: {action.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!result && !error && (
            <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
              <Sparkles className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Enter code and click "Start AURA Review" to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

