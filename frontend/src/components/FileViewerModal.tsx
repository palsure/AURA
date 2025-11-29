import { X } from 'lucide-react'

interface FileViewerModalProps {
  isOpen: boolean
  fileName: string | null
  fileContent: string | null
  loading: boolean
  onClose: () => void
}

export default function FileViewerModal({
  isOpen,
  fileName,
  fileContent,
  loading,
  onClose
}: FileViewerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white truncate flex-1 mr-4">
            {fileName || 'File Content'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
            </div>
          ) : fileContent ? (
            <div className="bg-slate-900 rounded p-4">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                {fileContent}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-slate-400">No content available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

