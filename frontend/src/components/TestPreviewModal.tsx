import { useState, useEffect } from 'react'
import { X, Check, XCircle, RefreshCw, FileText, TestTube, AlertTriangle } from 'lucide-react'
import { getAIStatus } from '../api/client'

interface TestPreviewModalProps {
  isOpen: boolean
  testCode: string
  sourceCode: string
  fileName: string
  language: string
  coverage: number
  onAccept: () => void
  onDismiss: () => void
  onRefine: (refinementInstructions: string) => Promise<void>
  isRefining?: boolean
}

export default function TestPreviewModal({
  isOpen,
  testCode,
  sourceCode,
  fileName,
  language,
  coverage,
  onAccept,
  onDismiss,
  onRefine,
  isRefining = false
}: TestPreviewModalProps) {
  const [showRefineInput, setShowRefineInput] = useState(false)
  const [refinementInstructions, setRefinementInstructions] = useState('')
  const [isRefiningState, setIsRefiningState] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(true)

  useEffect(() => {
    if (isOpen) {
      checkAIStatus()
    }
  }, [isOpen])

  const checkAIStatus = async () => {
    try {
      const status = await getAIStatus()
      setAiAvailable(status.openai_available || status.anthropic_available)
    } catch (error) {
      console.error('Failed to check AI status:', error)
      setAiAvailable(false)
    }
  }

  if (!isOpen) return null

  const handleRefine = async () => {
    if (!refinementInstructions.trim()) {
      setShowRefineInput(false)
      return
    }
    
    setIsRefiningState(true)
    try {
      await onRefine(refinementInstructions)
      setRefinementInstructions('')
      setShowRefineInput(false)
    } catch (error) {
      console.error('Error refining test:', error)
    } finally {
      setIsRefiningState(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              Generated Test for: {fileName}
            </h3>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm text-slate-400">Language: {language}</span>
              <span className="text-sm text-slate-400">
                Coverage: <span className="font-semibold text-green-400">{coverage.toFixed(1)}%</span>
              </span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {!aiAvailable && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                <span className="text-sm text-yellow-400">
                  ⚠️ AI not configured: This test was generated using templates. Configure API keys for complete AI-generated tests.
                </span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Source Code */}
            <div className="bg-slate-900 rounded p-4 border border-slate-700">
              <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-700">
                <FileText className="h-4 w-4 text-blue-400" />
                <h4 className="text-sm font-semibold text-slate-300">Source Code</h4>
              </div>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                {sourceCode}
              </pre>
            </div>

            {/* Generated Test Code */}
            <div className="bg-slate-900 rounded p-4 border border-slate-700">
              <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-slate-700">
                <TestTube className="h-4 w-4 text-green-400" />
                <h4 className="text-sm font-semibold text-slate-300">Generated Test Code</h4>
              </div>
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                {testCode}
              </pre>
            </div>
          </div>

          {/* Refine Input Section */}
          {showRefineInput && (
            <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Refinement Instructions
              </label>
              <textarea
                value={refinementInstructions}
                onChange={(e) => setRefinementInstructions(e.target.value)}
                placeholder="Describe how you'd like to refine the test (e.g., 'Add more edge cases', 'Focus on error handling', 'Add integration tests')"
                className="w-full p-3 bg-slate-900 border border-slate-600 rounded text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                rows={4}
                disabled={isRefiningState || isRefining}
              />
              <div className="flex items-center space-x-2 mt-3">
                <button
                  onClick={handleRefine}
                  disabled={!refinementInstructions.trim() || isRefiningState || isRefining}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefiningState || isRefining ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Refining...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Refine Test</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRefineInput(false)
                    setRefinementInstructions('')
                  }}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                  disabled={isRefiningState || isRefining}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setShowRefineInput(!showRefineInput)}
            disabled={isRefiningState || isRefining}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{showRefineInput ? 'Hide Refine' : 'Refine Test'}</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onDismiss}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
            >
              <XCircle className="h-4 w-4" />
              <span>Dismiss</span>
            </button>
            <button
              onClick={onAccept}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              <Check className="h-4 w-4" />
              <span>Accept & Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

