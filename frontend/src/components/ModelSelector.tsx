import { useState, useEffect } from 'react'
import { Brain, ChevronDown, Check } from 'lucide-react'
import { getAvailableModels, getCurrentModel, ModelInfo } from '../api/client'

interface ModelSelectorProps {
  selectedModel?: string
  selectedProvider?: string
  onModelChange?: (model: string, provider: string) => void
  compact?: boolean
}

export default function ModelSelector({
  selectedModel,
  selectedProvider,
  onModelChange,
  compact = false
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [current, setCurrent] = useState<{ model: string; provider: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<{ model: string; provider: string } | null>(null)

  useEffect(() => {
    loadModels()
  }, [])

  useEffect(() => {
    if (selectedModel && selectedProvider) {
      setSelected({ model: selectedModel, provider: selectedProvider })
    } else if (current) {
      setSelected(current)
    }
  }, [selectedModel, selectedProvider, current])

  const loadModels = async () => {
    try {
      setLoading(true)
      const [availableModels, currentModel] = await Promise.all([
        getAvailableModels(),
        getCurrentModel()
      ])
      setModels(availableModels)
      if (currentModel) {
        const provider = currentModel.preferred_provider || 'openai'
        const model = provider === 'openai' ? currentModel.openai_model : currentModel.anthropic_model
        setCurrent({ model, provider })
        if (!selectedModel && !selectedProvider) {
          setSelected({ model, provider })
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (model: ModelInfo) => {
    setSelected({ model: model.id, provider: model.provider })
    setIsOpen(false)
    if (onModelChange) {
      onModelChange(model.id, model.provider)
    }
  }

  const selectedModelInfo = models.find(
    m => m.id === selected?.model && m.provider === selected?.provider
  )

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-slate-400">
        <Brain className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Loading models...</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
        >
          <Brain className="h-4 w-4" />
          <span>{selectedModelInfo?.name || 'Select Model'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full mt-2 right-0 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-96 overflow-y-auto">
              <div className="p-2">
                {models.map((model) => (
                  <button
                    key={`${model.provider}-${model.id}`}
                    onClick={() => handleSelect(model)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selected?.model === model.id && selected?.provider === model.provider
                        ? 'bg-primary-600/20 border border-primary-500'
                        : 'hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{model.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-700 rounded">
                            {model.provider}
                          </span>
                          {selected?.model === model.id && selected?.provider === model.provider && (
                            <Check className="h-4 w-4 text-primary-400" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{model.description}</p>
                        <div className="flex items-center space-x-3 mt-2 text-xs text-slate-500">
                          <span>{model.speed}</span>
                          <span>{model.quality}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5 text-primary-400" />
          <h3 className="text-lg font-semibold">AI Model Selection</h3>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {selectedModelInfo && (
        <div className="mb-4 p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold">{selectedModelInfo.name}</span>
                <span className="text-xs px-2 py-0.5 bg-slate-600 rounded">
                  {selectedModelInfo.provider}
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{selectedModelInfo.description}</p>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {models.map((model) => (
            <button
              key={`${model.provider}-${model.id}`}
              onClick={() => handleSelect(model)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                selected?.model === model.id && selected?.provider === model.provider
                  ? 'bg-primary-600/20 border border-primary-500'
                  : 'hover:bg-slate-700 border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-semibold">{model.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-600 rounded">
                      {model.provider}
                    </span>
                    {selected?.model === model.id && selected?.provider === model.provider && (
                      <Check className="h-4 w-4 text-primary-400" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{model.description}</p>
                  <div className="flex items-center space-x-4 text-xs text-slate-500">
                    <span>{model.speed}</span>
                    <span>{model.quality}</span>
                    <span>{model.context_window}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

