import { useState } from 'react'
import { TestTube, Copy, CheckCircle } from 'lucide-react'
import { apiClient } from '../api/client'
import ModelSelector from '../components/ModelSelector'
import AIWarningBanner from '../components/AIWarningBanner'
import Toast, { ToastType } from '../components/Toast'

const EXAMPLE_CODE = `def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total`

export default function Tests() {
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [language, setLanguage] = useState('python')
  const [testType, setTestType] = useState('unit')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>()
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>()
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean } | null>(null)

  const handleGenerate = async () => {
    if (!code.trim()) return

    setLoading(true)
    try {
      const response = await apiClient.post('/api/v1/tests/generate', {
        code,
        language,
        test_type: testType,
        ai_model: selectedModel,
        ai_provider: selectedProvider,
      })
      setResult(response.data)
    } catch (error: any) {
      console.error('Failed to generate tests:', error)
      const errorMessage = error.response?.data?.detail || 'Failed to generate test'
      
      // Check if error is due to missing API keys
      const isAPIKeyError = errorMessage.includes('API key') || 
                           errorMessage.includes('not configured') ||
                           error.response?.status === 400
      
      let finalMessage = errorMessage
      if (isAPIKeyError) {
        finalMessage = `AI API keys not configured.\n\n${errorMessage}\n\nTo enable AI features:\n1. Get API keys from OpenAI (https://platform.openai.com/api-keys) or Anthropic (https://console.anthropic.com/)\n2. Create backend/.env file\n3. Add: OPENAI_API_KEY=sk-... or ANTHROPIC_API_KEY=sk-ant-...\n4. Restart the backend server`
      }
      
      setToast({
        message: finalMessage,
        type: 'error',
        isVisible: true
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (result?.test_code) {
      navigator.clipboard.writeText(result.test_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Test Generation</h1>
        <p className="text-slate-400">AI-powered automatic test generation</p>
      </div>

      <AIWarningBanner />

      <ModelSelector
        selectedModel={selectedModel}
        selectedProvider={selectedProvider}
        onModelChange={(model, provider) => {
          setSelectedModel(model)
          setSelectedProvider(provider)
        }}
        compact
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Code Input</h2>
            <div className="flex space-x-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600 text-sm"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
              </select>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="bg-slate-700 text-white px-3 py-1 rounded border border-slate-600 text-sm"
              >
                <option value="unit">Unit</option>
                <option value="integration">Integration</option>
                <option value="regression">Regression</option>
              </select>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-64 bg-slate-900 text-slate-100 p-4 rounded border border-slate-600 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <TestTube className="h-5 w-5" />
                <span>Generate Tests</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          {result ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Generated Tests</h2>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1 text-primary-400 hover:text-primary-300 text-sm"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="mb-4 flex items-center space-x-4 text-sm">
                <div>
                  <span className="text-slate-400">Coverage: </span>
                  <span className="font-semibold">{result.coverage_estimate?.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-slate-400">Tests: </span>
                  <span className="font-semibold">{result.test_count}</span>
                </div>
              </div>
              <pre className="bg-slate-900 p-4 rounded border border-slate-600 text-xs overflow-x-auto max-h-96 overflow-y-auto">
                {result.test_code}
              </pre>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <TestTube className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                <p>Generate tests to see results here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

