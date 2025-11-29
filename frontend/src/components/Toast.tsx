import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  message: string
  type: ToastType
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function Toast({
  message,
  type,
  isVisible,
  onClose,
  duration = 3000
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  const typeStyles = {
    success: {
      bg: 'bg-green-500/10 border-green-500/50',
      icon: CheckCircle,
      iconColor: 'text-green-400',
      text: 'text-green-300'
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/50',
      icon: XCircle,
      iconColor: 'text-red-400',
      text: 'text-red-300'
    },
    warning: {
      bg: 'bg-yellow-500/10 border-yellow-500/50',
      icon: AlertCircle,
      iconColor: 'text-yellow-400',
      text: 'text-yellow-300'
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/50',
      icon: Info,
      iconColor: 'text-blue-400',
      text: 'text-blue-300'
    }
  }

  const styles = typeStyles[type]
  const Icon = styles.icon

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div
        className={`${styles.bg} border rounded-lg p-4 shadow-lg max-w-md flex items-start space-x-3`}
      >
        <Icon className={`h-5 w-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
        <p className={`flex-1 ${styles.text}`}>{message}</p>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

