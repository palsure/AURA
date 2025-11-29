import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRepositories, createRepository, connectGitHubRepository, validateGitHubUrl, deleteRepository, refreshRepositoryFiles, listRepositoryFiles, apiClient } from '../api/client'
import { FolderGit, Plus, Trash2, Github, CheckCircle, XCircle, FolderOpen, RefreshCw, Sparkles, ArrowLeft, BarChart3, AlertTriangle } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'
import Toast, { ToastType } from '../components/Toast'

interface Repository {
  id: number
  name: string
  path: string
  language: string | null
  repo_type?: string
  github_url?: string
  total_files: number
  last_analyzed: string | null
  created_at: string
}

export default function Repositories() {
  const navigate = useNavigate()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [repositoryType, setRepositoryType] = useState<'local' | 'github' | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showGitHubForm, setShowGitHubForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    language: '',
  })
  const [githubData, setGithubData] = useState({
    github_url: '',
    github_token: '',
    name: '',
    language: '',
  })
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; repoId: number; repoName: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean } | null>(null)
  const [repoStats, setRepoStats] = useState<Record<number, { issues: number; coverage: number }>>({})

  useEffect(() => {
    loadRepositories()
  }, [])

  // Force re-render when stats change
  useEffect(() => {
    // This ensures the UI updates when stats are loaded
  }, [repoStats])

  const loadRepositories = async () => {
    try {
      const data = await getRepositories()
      setRepos(data)
      
      // Load stats for each repository
      const stats: Record<number, { issues: number; coverage: number }> = {}
      for (const repo of data) {
        try {
          const details = await apiClient.get(`/api/v1/repositories/${repo.id}/details`)
          const statsData = details.data.statistics
          const analyses = details.data.analyses || []
          const tests = details.data.tests || []
          
          // Use same coverage calculation as RepositoryDetails
          // Fetch files from repository
          let files: any[] = []
          try {
            const filesResponse = await listRepositoryFiles(repo.id)
            // Handle both array response and object with data property
            files = Array.isArray(filesResponse) ? filesResponse : (filesResponse?.data || filesResponse?.files || [])
            if (!Array.isArray(files)) {
              console.warn(`Files response is not an array for repo ${repo.id}:`, filesResponse)
              files = []
            }
          } catch (fileErr) {
            console.warn(`Failed to load files for repo ${repo.id}:`, fileErr)
            files = []
          }
          
          // Helper to identify test files (same as RepositoryDetails)
          const isTestFile = (filePath: string, fileName: string): boolean => {
            const lowerPath = filePath.toLowerCase()
            const lowerName = fileName.toLowerCase()
            const testPatterns = [
              'test_', '_test', '.test.', '.spec.', 'tests/', 'test/', '__test__',
              'test/', 'spec/', 'tests/', 'test/', '__tests__'
            ]
            return testPatterns.some(pattern => 
              lowerPath.includes(pattern) || lowerName.includes(pattern)
            )
          }
          
          // Filter for code files only
          const allCodeFiles = files.filter((f: any) => {
            const ext = f.extension?.toLowerCase() || ''
            return ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php'].includes(ext)
          })
          
          // Separate source files and test files
          const sourceFiles = allCodeFiles.filter((f: any) => !isTestFile(f.relative_path, f.name))
          const testFiles = allCodeFiles.filter((f: any) => isTestFile(f.relative_path, f.name))
          
          // Match test files to source files (same logic as RepositoryDetails)
          const sourceFilesWithTests = new Set<string>()
          
          testFiles.forEach((testFile: any) => {
            const testName = testFile.name.toLowerCase()
            const testPath = testFile.relative_path.toLowerCase()
            
            // Extract potential source file name from test file
            let potentialSourceName = testName
              .replace(/^test_/, '')
              .replace(/_test\./, '.')
              .replace(/\.test\./, '.')
              .replace(/\.spec\./, '.')
            
            // Find matching source file
            const matchingSource = sourceFiles.find((sourceFile: any) => {
              const sourceName = sourceFile.name.toLowerCase()
              const sourcePath = sourceFile.relative_path.toLowerCase()
              
              if (sourceName === potentialSourceName) return true
              
              const testDir = testPath.substring(0, testPath.lastIndexOf('/'))
              const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
              
              if (testDir === sourceDir || testDir.includes('test') || testDir.includes('tests')) {
                const baseTestName = testName.replace(/^(test_|_test|\.test|\.spec)/, '').replace(/\.(py|js|ts|java)$/, '')
                const baseSourceName = sourceName.replace(/\.(py|js|ts|java)$/, '')
                if (baseTestName === baseSourceName) return true
              }
              
              return false
            })
            
            if (matchingSource) {
              sourceFilesWithTests.add(matchingSource.relative_path)
            }
          })
          
          // Also check for generated tests in database
          tests.forEach((test: any) => {
            const testAnalysis = analyses.find((a: any) => a.id === test.analysis_id)
            if (testAnalysis && testAnalysis.file_path) {
              const analysisPath = testAnalysis.file_path.toLowerCase()
              const sourceFile = sourceFiles.find((f: any) => {
                const filePath = f.relative_path.toLowerCase()
                const fileName = f.name.toLowerCase()
                return analysisPath.includes(fileName) || filePath === analysisPath
              })
              if (sourceFile) {
                sourceFilesWithTests.add(sourceFile.relative_path)
              }
            }
          })
          
          // Calculate coverage: percentage of source files that have tests
          const totalCoverage = sourceFiles.length > 0
            ? (sourceFilesWithTests.size / sourceFiles.length) * 100
            : 0
          
          // Debug logging
          console.log(`[Coverage] Repo ${repo.id} (${repo.name}):`, {
            totalFiles: files.length,
            sourceFiles: sourceFiles.length,
            testFiles: testFiles.length,
            filesWithTests: sourceFilesWithTests.size,
            coverage: totalCoverage.toFixed(1) + '%',
            analyses: analyses.length,
            tests: tests.length
          })
          
          stats[repo.id] = {
            issues: statsData.total_issues || 0,
            coverage: Math.round(totalCoverage * 10) / 10 // Round to 1 decimal place, keep as number
          }
        } catch (err) {
          // If details fail, set defaults
          stats[repo.id] = { issues: 0, coverage: 0 }
        }
      }
      setRepoStats(stats)
    } catch (error) {
      console.error('Failed to load repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault()
    const repoName = formData.name
    try {
      await createRepository(
        formData.name,
        formData.path,
        formData.language || undefined
      )
      setFormData({ name: '', path: '', language: '' })
      setShowAddForm(false)
      setShowAddModal(false)
      setRepositoryType(null)
      setToast({
        message: `Repository "${repoName}" added successfully`,
        type: 'success',
        isVisible: true
      })
      loadRepositories()
    } catch (error: any) {
      console.error('Failed to create repository:', error)
      setToast({
        message: error.response?.data?.detail || 'Failed to create repository. Please try again.',
        type: 'error',
        isVisible: true
      })
    }
  }

  const handleValidateGitHub = async () => {
    if (!githubData.github_url.trim()) return
    
    setValidating(true)
    setValidationResult(null)
    try {
      const result = await validateGitHubUrl(
        githubData.github_url,
        githubData.github_token || undefined
      )
      setValidationResult(result)
      if (result.valid && !githubData.name) {
        setGithubData({ ...githubData, name: result.name })
      }
    } catch (error) {
      console.error('Failed to validate GitHub URL:', error)
      setValidationResult({ valid: false, error: 'Validation failed' })
    } finally {
      setValidating(false)
    }
  }

  const handleConnectGitHub = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await connectGitHubRepository({
        github_url: githubData.github_url,
        name: githubData.name || undefined,
        language: githubData.language || undefined,
        github_token: githubData.github_token || undefined,
      })
      setGithubData({ github_url: '', github_token: '', name: '', language: '' })
      setValidationResult(null)
      setShowGitHubForm(false)
      setToast({
        message: 'GitHub repository connected successfully',
        type: 'success',
        isVisible: true
      })
      loadRepositories()
    } catch (error: any) {
      console.error('Failed to connect GitHub repository:', error)
      setToast({
        message: error.response?.data?.detail || 'Failed to connect GitHub repository. Please try again.',
        type: 'error',
        isVisible: true
      })
    }
  }

  const handleDeleteRepository = async (repoId: number, repoName: string) => {
    setDeleteModal({ isOpen: true, repoId, repoName })
  }

  const confirmDelete = async () => {
    if (!deleteModal) return

    try {
      await deleteRepository(deleteModal.repoId)
      setDeleteModal(null)
      setToast({
        message: `Repository "${deleteModal.repoName}" deleted successfully`,
        type: 'success',
        isVisible: true
      })
      loadRepositories()
    } catch (error) {
      console.error('Failed to delete repository:', error)
      setDeleteModal(null)
      setToast({
        message: 'Failed to delete repository. Please try again.',
        type: 'error',
        isVisible: true
      })
    }
  }

  const cancelDelete = () => {
    setDeleteModal(null)
  }

  const handleAuraReview = (repoId: number) => {
    navigate(`/repositories/${repoId}`)
  }

  const handleRefreshFiles = async (repoId: number) => {
    try {
      const result = await refreshRepositoryFiles(repoId)
      const languageMsg = result.language ? ` (Language: ${result.language})` : ''
      setToast({
        message: `File count refreshed successfully${languageMsg}`,
        type: 'success',
        isVisible: true
      })
      loadRepositories()
    } catch (error: any) {
      console.error('Failed to refresh files:', error)
      setToast({
        message: error.response?.data?.detail || 'Failed to refresh file count',
        type: 'error',
        isVisible: true
      })
    }
  }

  const handleBrowseDirectory = async () => {
    // Try File System Access API first (Chrome, Edge)
    if ('showDirectoryPicker' in window) {
      try {
        const directoryHandle = await (window as any).showDirectoryPicker()
        // Get the directory name
        const dirName = directoryHandle.name
        
        // Try to build path by traversing up the directory tree
        let pathParts = [dirName]
        let currentHandle = directoryHandle
        
        // Try to get parent directories (up to 5 levels)
        for (let i = 0; i < 5; i++) {
          try {
            if (currentHandle.getParent) {
              const parentHandle = await currentHandle.getParent()
              const parentName = parentHandle.name
              pathParts.unshift(parentName)
              currentHandle = parentHandle
            } else {
              break
            }
          } catch {
            break
          }
        }
        
        // Build path - if we got multiple parts, join them
        // Otherwise, just use the directory name
        let selectedPath = pathParts.length > 1 
          ? pathParts.join('/') 
          : dirName
        
        // On Windows, try to detect if it's a Windows path
        // Note: Browsers still don't expose full absolute paths for security
        setFormData({ ...formData, path: selectedPath })
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name !== 'AbortError') {
          console.error('Error selecting directory:', error)
          setToast({
            message: 'Error selecting directory. Please enter the path manually.',
            type: 'error',
            isVisible: true
          })
        }
      }
    } else {
      // Fallback: Use hidden file input with webkitdirectory
      directoryInputRef.current?.click()
    }
  }

  const handleDirectoryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Get the directory name from the first file's relative path
      const firstFile = files[0]
      const relativePath = firstFile.webkitRelativePath
      const dirName = relativePath.split('/')[0]
      
      setFormData({ ...formData, path: dirName })
      
      setToast({
        message: `Selected directory: ${dirName}. Please verify or complete the full path if needed.`,
        type: 'info',
        isVisible: true
      })
    }
    // Reset input so same directory can be selected again
    if (directoryInputRef.current) {
      directoryInputRef.current.value = ''
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
      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <ConfirmModal
          isOpen={deleteModal.isOpen}
          title="Delete Repository"
          message={`Are you sure you want to delete the repository "${deleteModal.repoName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          type="danger"
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Repositories</h1>
          <p className="text-slate-400">Add repository to perform AURA review</p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Repository</span>
          </button>
        </div>
      </div>

      {/* Add Repository Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg p-6 shadow-xl max-w-md w-full border border-slate-700 relative">
            <button
              onClick={() => {
                setShowAddModal(false)
                setRepositoryType(null)
                setShowAddForm(false)
                setShowGitHubForm(false)
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
            
            {!repositoryType ? (
              <>
                <h3 className="text-xl font-semibold mb-4 text-white">Add Repository</h3>
                <p className="text-slate-400 mb-6">Choose how you want to add a repository:</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setRepositoryType('local')
                      setShowAddForm(true)
                    }}
                    className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
                  >
                    <FolderOpen className="h-6 w-6 text-primary-400" />
                    <div>
                      <p className="font-semibold text-white">Local Repository</p>
                      <p className="text-sm text-slate-400">Add a repository from your local file system</p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      setRepositoryType('github')
                      setShowGitHubForm(true)
                    }}
                    className="w-full flex items-center space-x-3 p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-left"
                  >
                    <Github className="h-6 w-6 text-slate-300" />
                    <div>
                      <p className="font-semibold text-white">GitHub Repository</p>
                      <p className="text-sm text-slate-400">Connect a repository from GitHub</p>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setRepositoryType(null)
                  }}
                  className="mt-4 w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {showAddForm && repositoryType === 'local' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg p-6 shadow-xl max-w-2xl w-full mx-4 border border-slate-700 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowAddForm(false)
                setShowAddModal(false)
                setRepositoryType(null)
                setFormData({ name: '', path: '', language: '' })
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setRepositoryType(null)
                setShowAddForm(false)
              }}
              className="mb-4 flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
            <h2 className="text-xl font-semibold mb-4">Add New Repository</h2>
          <form onSubmit={handleAddRepository} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Repository Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Repository Path
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  className="flex-1 bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="/path/to/repository"
                  required
                />
                <button
                  type="button"
                  onClick={handleBrowseDirectory}
                  className="flex items-center space-x-2 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded border border-slate-500 transition-colors"
                  title="Browse for directory"
                >
                  <FolderOpen className="h-5 w-5" />
                  <span>Browse</span>
                </button>
              </div>
              <input
                ref={directoryInputRef}
                type="file"
                {...({ webkitdirectory: '', directory: '' } as any)}
                multiple
                style={{ display: 'none' }}
                onChange={handleDirectoryInputChange}
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the full path to your repository directory, or use Browse to select a folder.
                <br />
                <span className="text-slate-600">
                  Note: Due to browser security restrictions, Browse may only show the directory name. 
                  You may need to manually complete the full path (e.g., /Users/username/projects/repo-name).
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Language (optional)
              </label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Auto-detect</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Add Repository
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setShowAddModal(false)
                  setRepositoryType(null)
                  setFormData({ name: '', path: '', language: '' })
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {showGitHubForm && repositoryType === 'github' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-lg p-6 shadow-xl max-w-2xl w-full mx-4 border border-slate-700 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setShowGitHubForm(false)
                setShowAddModal(false)
                setRepositoryType(null)
                setGithubData({ github_url: '', github_token: '', name: '', language: '' })
                setValidationResult(null)
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setRepositoryType(null)
                setShowGitHubForm(false)
              }}
              className="mb-4 flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          <div className="flex items-center space-x-2 mb-4">
            <Github className="h-6 w-6 text-slate-300" />
            <h2 className="text-xl font-semibold">Connect GitHub Repository</h2>
          </div>
          <form onSubmit={handleConnectGitHub} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                GitHub URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={githubData.github_url}
                  onChange={(e) => setGithubData({ ...githubData, github_url: e.target.value })}
                  className="flex-1 bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="https://github.com/owner/repo or owner/repo"
                  required
                />
                <button
                  type="button"
                  onClick={handleValidateGitHub}
                  disabled={validating || !githubData.github_url.trim()}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded border border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {validating ? 'Validating...' : 'Validate'}
                </button>
              </div>
              {validationResult && (
                <div className={`mt-2 p-3 rounded flex items-start space-x-2 ${
                  validationResult.valid
                    ? 'bg-green-500/10 border border-green-500/50'
                    : 'bg-red-500/10 border border-red-500/50'
                }`}>
                  {validationResult.valid ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-green-400 font-semibold">Repository found!</p>
                        <p className="text-xs text-slate-400">{validationResult.name}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-400 font-semibold mb-1">Validation Failed</p>
                        <p className="text-xs text-red-300 whitespace-pre-line">{validationResult.error || 'Invalid repository'}</p>
                        {validationResult.error && validationResult.error.toLowerCase().includes('rate limit') && (
                          <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-300">
                            <p className="font-semibold mb-1">💡 Tip:</p>
                            <p>Create a GitHub token at: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:underline">github.com/settings/tokens</a></p>
                            <p className="mt-1">No special permissions needed for public repos. This increases your rate limit from 60 to 5,000 requests/hour.</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                GitHub Token (optional, for private repos)
              </label>
              <input
                type="password"
                value={githubData.github_token}
                onChange={(e) => setGithubData({ ...githubData, github_token: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="ghp_xxxxxxxxxxxx"
              />
              <p className="text-xs text-slate-500 mt-1">
                Required for private repositories. Create token at: github.com/settings/tokens
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Repository Name (optional)
              </label>
              <input
                type="text"
                value={githubData.name}
                onChange={(e) => setGithubData({ ...githubData, name: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Auto-filled from GitHub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Language (optional)
              </label>
              <select
                value={githubData.language}
                onChange={(e) => setGithubData({ ...githubData, language: e.target.value })}
                className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Auto-detect</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!validationResult?.valid}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect Repository
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowGitHubForm(false)
                  setGithubData({ github_url: '', github_token: '', name: '', language: '' })
                  setValidationResult(null)
                }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {repos.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 border border-slate-700 text-center">
          <FolderGit className="h-16 w-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">No repositories connected yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-primary-400 hover:text-primary-300"
          >
            Add your first repository
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-primary-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {repo.repo_type === 'github' ? (
                    <Github className="h-8 w-8 text-slate-300" />
                  ) : (
                    <FolderGit className="h-8 w-8 text-primary-400" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{repo.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      repo.repo_type === 'github'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                        : 'bg-slate-600/50 text-slate-400 border border-slate-600'
                    }`}>
                      {repo.repo_type === 'github' ? 'GitHub' : 'Local'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteRepository(repo.id, repo.name)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                  title="Delete repository"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-slate-400">Test Coverage</span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {repoStats[repo.id]?.coverage ? `${repoStats[repo.id].coverage.toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-slate-400">Issues</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    (repoStats[repo.id]?.issues || 0) > 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {repoStats[repo.id]?.issues || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Files:</span>
                  <span className="text-sm text-white">{repo.total_files}</span>
                </div>
                {repo.language && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Language:</span>
                    <span className="text-sm text-white">
                      {repo.language.split(', ').filter(lang => !lang.toLowerCase().includes('json')).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="mt-4 flex space-x-2">
                {repo.repo_type === 'local' && (
                  <>
                    <button
                      onClick={() => handleAuraReview(repo.id)}
                      className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>AURA Review</span>
                    </button>
                    <button
                      onClick={() => handleRefreshFiles(repo.id)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors"
                      title="Refresh file count"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

