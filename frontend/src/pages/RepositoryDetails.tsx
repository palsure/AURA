import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiClient, generateTests } from '../api/client'
import {
  FolderGit,
  TestTube,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Plus,
  Eye,
  Github,
  BarChart3
} from 'lucide-react'
import ModelSelector from '../components/ModelSelector'
import Toast, { ToastType } from '../components/Toast'
import FileViewerModal from '../components/FileViewerModal'
import TestPreviewModal from '../components/TestPreviewModal'
import AIWarningBanner from '../components/AIWarningBanner'
import { getAIStatus } from '../api/client'

type TabType = 'overview' | 'test-coverage' | 'issues' | 'predictions'

export default function RepositoryDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [files, setFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFileContent, setLoadingFileContent] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string | undefined>()
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>()
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean } | null>(null)
  const [generatingTest, setGeneratingTest] = useState<string | null>(null)
  const [previewTest, setPreviewTest] = useState<{
    code: string
    sourceCode: string
    fileName: string
    language: string
    coverage: number
    filePath: string
  } | null>(null)
  const [isRefiningTest, setIsRefiningTest] = useState(false)
  const [aiStatus, setAIStatus] = useState<{ openai_available: boolean; anthropic_available: boolean } | null>(null)

  useEffect(() => {
    if (id) {
      loadRepositoryDetails()
      loadRepositoryFiles()
    }
    checkAIStatus()
  }, [id])

  const checkAIStatus = async () => {
    try {
      const status = await getAIStatus()
      setAIStatus({
        openai_available: status.openai_available,
        anthropic_available: status.anthropic_available
      })
    } catch (error) {
      console.error('Failed to check AI status:', error)
    }
  }

  const loadRepositoryDetails = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/api/v1/repositories/${id}/details`)
      setData(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load repository details')
    } finally {
      setLoading(false)
    }
  }

  const loadRepositoryFiles = async () => {
    if (!id) return
    try {
      setLoadingFiles(true)
      const response = await apiClient.get(`/api/v1/repositories/${id}/files`)
      setFiles(response.data.files || [])
    } catch (err: any) {
      console.error('Failed to load files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  const loadFileContent = async (filePath: string) => {
    if (!id) return
    try {
      setLoadingFileContent(true)
      const response = await apiClient.get(`/api/v1/repositories/${id}/file-content`, {
        params: { file_path: filePath }
      })
      setFileContent(response.data.content)
      setSelectedFile(filePath)
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || 'Failed to load file content',
        type: 'error',
        isVisible: true
      })
    } finally {
      setLoadingFileContent(false)
    }
  }

  const handleGenerateTest = async (filePath: string, language: string, code?: string) => {
    if (!id) return
    
    // If code is not provided, load it first
    let codeToTest = code
    if (!codeToTest) {
      try {
        setLoadingFileContent(true)
        const response = await apiClient.get(`/api/v1/repositories/${id}/file-content`, {
          params: { file_path: filePath }
        })
        codeToTest = response.data.content
      } catch (err: any) {
        setToast({
          message: err.response?.data?.detail || 'Failed to load file content',
          type: 'error',
          isVisible: true
        })
        setLoadingFileContent(false)
        return
      } finally {
        setLoadingFileContent(false)
      }
    }
    
    if (!codeToTest) return
    
    setGeneratingTest(filePath)
    try {
      const response = await generateTests({
        code: codeToTest,
        language: language,
        test_type: 'unit',
        ai_model: selectedModel,
        ai_provider: selectedProvider,
        // Don't save immediately - show preview first
        // repository_id: id ? parseInt(id) : undefined,
        // file_path: filePath
      })
      
      // Show preview modal instead of saving immediately
      setPreviewTest({
        code: response.test_code,
        sourceCode: codeToTest,
        fileName: filePath.split('/').pop() || filePath,
        language: language,
        coverage: response.coverage_estimate || response.coverage || 0,
        filePath: filePath
      })
      
      setGeneratingTest(null)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to generate test'
      
      // Check if error is due to missing API keys
      const isAPIKeyError = errorMessage.includes('API key') || 
                           errorMessage.includes('not configured') ||
                           (!aiStatus?.openai_available && !aiStatus?.anthropic_available)
      
      let finalMessage = errorMessage
      if (isAPIKeyError) {
        finalMessage = `AI API keys not configured. ${errorMessage}\n\nTo enable AI features, add OPENAI_API_KEY or ANTHROPIC_API_KEY to backend/.env file and restart the server.`
      }
      
      setToast({
        message: finalMessage,
        type: 'error',
        isVisible: true
      })
      setGeneratingTest(null)
    }
  }

  const handleAcceptTest = async () => {
    if (!previewTest || !id) return
    
    try {
      // Save the test to the repository
      const response = await generateTests({
        code: previewTest.code,
        language: previewTest.language,
        test_type: 'unit',
        ai_model: selectedModel,
        ai_provider: selectedProvider,
        repository_id: parseInt(id),
        file_path: previewTest.filePath
      })
      
      let message = `Test saved successfully! Coverage: ${response.coverage_estimate?.toFixed(1) || response.coverage?.toFixed(1) || 0}%`
      if (response.test_file_path) {
        message += `\nTest file saved to: ${response.test_file_path}`
      }
      
      setToast({
        message: message,
        type: 'success',
        isVisible: true
      })
      
      // Close preview and reload
      setPreviewTest(null)
      await loadRepositoryDetails()
      await loadRepositoryFiles()
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || 'Failed to save test',
        type: 'error',
        isVisible: true
      })
    }
  }

  const handleDismissTest = () => {
    setPreviewTest(null)
  }

  const handleRefineTest = async (refinementInstructions: string) => {
    if (!previewTest || !id) return
    
    setIsRefiningTest(true)
    try {
      // Load original file content
      let codeToTest = fileContent
      if (!codeToTest && previewTest.filePath) {
        const response = await apiClient.get(`/api/v1/repositories/${id}/file-content`, {
          params: { file_path: previewTest.filePath }
        })
        codeToTest = response.data.content
      }
      
      if (!codeToTest) {
        throw new Error('Could not load file content for refinement')
      }
      
      // Create a refined prompt that includes both the original code and refinement instructions
      // Format the refinement request more explicitly
      const refinedCode = `${codeToTest}\n\n/*\nREFINEMENT INSTRUCTIONS:\n${refinementInstructions}\n\nIMPORTANT: Generate COMPLETE, RUNNABLE test code with full implementations. Do NOT use placeholders, TODOs, or empty test bodies. Every test must have complete logic, actual test data, and proper assertions.\n*/`
      
      const response = await generateTests({
        code: refinedCode,
        language: previewTest.language,
        test_type: 'unit',
        ai_model: selectedModel,
        ai_provider: selectedProvider
      })
      
      // Update preview with refined test (keep source code)
      setPreviewTest({
        ...previewTest,
        code: response.test_code,
        sourceCode: codeToTest, // Keep the source code
        coverage: response.coverage_estimate || response.coverage || 0
      })
      
      setToast({
        message: 'Test refined successfully!',
        type: 'success',
        isVisible: true
      })
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || 'Failed to refine test',
        type: 'error',
        isVisible: true
      })
    } finally {
      setIsRefiningTest(false)
    }
  }

  const getFileLanguage = (extension: string): string => {
    const ext = extension.toLowerCase()
    if (ext === '.py') return 'python'
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript'
    if (['.ts', '.tsx'].includes(ext)) return 'typescript'
    if (ext === '.java') return 'java'
    if (['.cpp', '.cc', '.cxx', '.hpp'].includes(ext)) return 'cpp'
    if (['.c', '.h'].includes(ext)) return 'c'
    if (ext === '.cs') return 'csharp'
    if (ext === '.go') return 'go'
    if (ext === '.rs') return 'rust'
    if (ext === '.rb') return 'ruby'
    if (['.php', '.phtml'].includes(ext)) return 'php'
    return 'python' // default
  }

  // Helper function to identify test files
  const isTestFile = (filePath: string, fileName: string): boolean => {
    const lowerPath = filePath.toLowerCase()
    const lowerName = fileName.toLowerCase()
    
    // Common test file patterns
    const testPatterns = [
      'test_', '_test', '.test.', '.spec.', 'tests/', 'test/', '__test__',
      'test/', 'spec/', 'tests/', 'test/', '__tests__'
    ]
    
    // Check if path or name contains test patterns
    return testPatterns.some(pattern => 
      lowerPath.includes(pattern) || lowerName.includes(pattern)
    )
  }

  // Separate source files and test files
  const allCodeFiles = files.filter(f => {
    const ext = f.extension?.toLowerCase() || ''
    return ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php'].includes(ext)
  })
  
  const sourceFiles = allCodeFiles.filter(f => !isTestFile(f.relative_path, f.name))
  const testFiles = allCodeFiles.filter(f => isTestFile(f.relative_path, f.name))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/repositories')}
          className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
        >
          <span>Back to Repositories</span>
        </button>
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error || 'Repository not found'}</p>
        </div>
      </div>
    )
  }

  const { repository, statistics, analyses, issues, tests, predictions } = data

  // Calculate coverage - only for source files, not test files
  // Coverage is based on how many source files have corresponding test files
  const sourceFilesWithTests = new Set<string>()
  
  // Match test files to source files
  testFiles.forEach(testFile => {
    const testName = testFile.name.toLowerCase()
    const testPath = testFile.relative_path.toLowerCase()
    
    // Extract potential source file name from test file
    // Patterns: test_*.py -> *.py, *_test.py -> *.py, *.test.js -> *.js
    let potentialSourceName = testName
      .replace(/^test_/, '')
      .replace(/_test\./, '.')
      .replace(/\.test\./, '.')
      .replace(/\.spec\./, '.')
    
    // Find matching source file
    const matchingSource = sourceFiles.find(sourceFile => {
      const sourceName = sourceFile.name.toLowerCase()
      const sourcePath = sourceFile.relative_path.toLowerCase()
      
      // Check if test file name matches source file name
      if (sourceName === potentialSourceName) return true
      
      // Check if test file is in same directory and matches naming pattern
      const testDir = testPath.substring(0, testPath.lastIndexOf('/'))
      const sourceDir = sourcePath.substring(0, sourcePath.lastIndexOf('/'))
      
      // Check common patterns
      if (testDir === sourceDir || testDir.includes('test') || testDir.includes('tests')) {
        // Remove test prefix/suffix and compare
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
      // Find source file that matches the test's target
      const analysisPath = testAnalysis.file_path.toLowerCase()
      const sourceFile = sourceFiles.find(f => {
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

  // Group source files by directory (exclude test files from display)
  const filesByDir: Record<string, any[]> = {}
  sourceFiles.forEach(file => {
    const dir = file.relative_path.substring(0, file.relative_path.lastIndexOf('/')) || '/'
    if (!filesByDir[dir]) filesByDir[dir] = []
    filesByDir[dir].push(file)
  })

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: Eye },
    { id: 'test-coverage' as TabType, label: 'Test Coverage', icon: BarChart3 },
    { id: 'issues' as TabType, label: 'Issues', icon: AlertTriangle },
    { id: 'predictions' as TabType, label: 'Predictions', icon: TrendingUp },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {repository.repo_type === 'github' ? (
            <Github className="h-8 w-8 text-slate-300" />
          ) : (
            <FolderGit className="h-8 w-8 text-primary-400" />
          )}
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold">{repository.name}</h1>
              <span className={`text-xs px-2 py-1 rounded ${
                repository.repo_type === 'github'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                  : 'bg-slate-600/50 text-slate-400 border border-slate-600'
              }`}>
                {repository.repo_type === 'github' ? 'GitHub' : 'Local'}
              </span>
            </div>
            {repository.language && (
              <p className="text-slate-400 text-sm">
                {repository.language.split(', ').filter((lang: string) => !lang.toLowerCase().includes('json')).join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center">
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
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center space-x-2 mb-1">
            <FileText className="h-4 w-4 text-slate-400" />
            <p className="text-slate-400 text-sm">Code Files</p>
          </div>
          <p className="text-2xl font-bold">{sourceFiles.length} files</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center space-x-2 mb-1">
            <BarChart3 className="h-4 w-4 text-green-400" />
            <p className="text-slate-400 text-sm">Test Coverage</p>
          </div>
          <p className="text-2xl font-bold">{totalCoverage.toFixed(1)}%</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Quality Score</p>
          <p className="text-2xl font-bold">{statistics.average_quality_score}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Total Issues</p>
          <p className="text-2xl font-bold">{statistics.total_issues} issues</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Fixed Issues</p>
          <p className="text-2xl font-bold text-green-400">{statistics.fixed_issues} fixed</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm mb-1">Open Issues</p>
          <p className="text-2xl font-bold text-red-400">{statistics.open_issues} open</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-600 text-white border-b-2 border-primary-400'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Code Files</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-400">
                    {sourceFiles.length} source files
                  </span>
                  {testFiles.length > 0 && (
                    <span className="text-sm text-slate-400">
                      {testFiles.length} test files
                    </span>
                  )}
                  <span className="text-sm text-slate-400">
                    Coverage: {totalCoverage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {loadingFiles ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                </div>
              ) : (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 max-h-[600px] overflow-y-auto">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Files</h3>
                  <div className="space-y-1">
                    {Object.entries(filesByDir).map(([dir, dirFiles]) => (
                      <div key={dir}>
                        <p className="text-xs text-slate-500 mb-1 mt-2">{dir}</p>
                        {dirFiles.map((file) => {
                          const fileAnalysis = analyses.find((a: any) => 
                            a.file_path && file.relative_path.includes(a.file_path.split('/').pop() || '')
                          )
                          const fileIssues = issues.filter((i: any) => 
                            fileAnalysis && i.analysis_id === fileAnalysis.id
                          )
                          // Check if this source file has corresponding test files
                          const sourceName = file.name.toLowerCase()
                          const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                          
                          // Find matching test files
                          const matchingTestFiles = testFiles.filter(testFile => {
                            const testName = testFile.name.toLowerCase()
                            const testBaseName = testName
                              .replace(/^test_/, '')
                              .replace(/_test\./, '.')
                              .replace(/\.test\./, '.')
                              .replace(/\.spec\./, '.')
                              .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            
                            return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                          })
                          
                          // Also check for generated tests in database
                          const fileTests = tests.filter((t: any) => {
                            const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                            if (!testAnalysis) return false
                            
                            const testPath = testAnalysis.file_path?.toLowerCase() || ''
                            return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                          })
                          
                          // Coverage: 100% if test files or generated tests exist, 0% otherwise
                          const fileCoverage = (matchingTestFiles.length > 0 || fileTests.length > 0) ? 100 : 0
                          return (
                            <button
                              key={file.path}
                              onClick={() => loadFileContent(file.relative_path)}
                              className="w-full text-left p-2 rounded hover:bg-slate-600 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  <span className="text-sm text-slate-300 truncate">{file.name}</span>
                                </div>
                                <div className="flex items-center space-x-3 flex-shrink-0">
                                  <div className="flex items-center space-x-1">
                                    <BarChart3 className="h-3 w-3 text-green-400" />
                                    <span className="text-xs text-slate-400">
                                      {fileCoverage > 0 ? `${fileCoverage.toFixed(0)}%` : '0%'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3 text-yellow-400" />
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      fileIssues.length === 0
                                        ? 'bg-green-500/20 text-green-400'
                                        : fileIssues.some((i: any) => i.severity === 'critical')
                                        ? 'bg-red-500/20 text-red-400'
                                        : fileIssues.some((i: any) => i.severity === 'high')
                                        ? 'bg-orange-500/20 text-orange-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {fileIssues.length}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* File Viewer Modal */}
              <FileViewerModal
                isOpen={selectedFile !== null}
                fileName={selectedFile}
                fileContent={fileContent}
                loading={loadingFileContent}
                onClose={() => {
                  setSelectedFile(null)
                  setFileContent(null)
                }}
              />

              {/* Issues Summary */}
              {issues.length > 0 && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Issues Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(statistics.issues_by_severity || {}).map(([severity, count]: [string, any]) => (
                      <div key={severity} className="text-center">
                        <p className="text-2xl font-bold capitalize">{severity}</p>
                        <p className="text-sm text-slate-400">{count} issues</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Coverage Tab */}
          {activeTab === 'test-coverage' && (
            <div className="space-y-6">
              <AIWarningBanner />
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Test Coverage</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-400">
                    Overall Coverage: <span className="font-semibold text-white">{totalCoverage.toFixed(1)}%</span>
                  </span>
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
              </div>

              {/* Coverage Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-400">Source Files</span>
                  </div>
                  <p className="text-2xl font-bold">{sourceFiles.length}</p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-slate-400">Files with Tests</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    {sourceFiles.filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = testFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = tests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length > 0 || fileTests.length > 0
                    }).length}
                  </p>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-slate-400">Files Needing Tests</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {sourceFiles.filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = testFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = tests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length === 0 && fileTests.length === 0
                    }).length}
                  </p>
                </div>
              </div>

              {/* Files Needing Test Coverage */}
              <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                {aiStatus && !aiStatus.openai_available && !aiStatus.anthropic_available && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm text-yellow-400">
                        AI not configured: Generated tests will be templates. Configure API keys for complete test generation.
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Files Needing Test Coverage</h3>
                  <span className="text-sm text-slate-400">
                    {sourceFiles.filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = testFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = tests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length === 0 && fileTests.length === 0
                    }).length} files
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sourceFiles
                    .filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = testFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = tests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length === 0 && fileTests.length === 0
                    })
                    .slice(0, 20)
                    .map((file) => {
                      const fileLanguage = getFileLanguage(file.extension || '')
                      return (
                        <div
                          key={file.path}
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-600 hover:border-slate-500 transition-colors"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-300 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500 truncate">{file.relative_path}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-slate-700 rounded text-slate-400">
                              {fileLanguage}
                            </span>
                          </div>
                          <button
                            onClick={() => handleGenerateTest(file.relative_path, fileLanguage)}
                            disabled={generatingTest === file.relative_path}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                          >
                            {generatingTest === file.relative_path ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4" />
                                <span>Generate Test</span>
                              </>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  {sourceFiles.filter(f => {
                    const sourceName = f.name.toLowerCase()
                    const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                    const matchingTestFiles = testFiles.filter(testFile => {
                      const testName = testFile.name.toLowerCase()
                      const testBaseName = testName
                        .replace(/^test_/, '')
                        .replace(/_test\./, '.')
                        .replace(/\.test\./, '.')
                        .replace(/\.spec\./, '.')
                        .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                    })
                    const fileTests = tests.filter((t: any) => {
                      const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                      if (!testAnalysis) return false
                      const testPath = testAnalysis.file_path?.toLowerCase() || ''
                      return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                    })
                    return matchingTestFiles.length === 0 && fileTests.length === 0
                  }).length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                      <p className="text-slate-400">All source files have test coverage!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Tests */}
              {tests.length > 0 && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Generated Tests</h3>
                  <div className="space-y-4">
                    {tests.map((test: any) => (
                      <div
                        key={test.id}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <TestTube className="h-5 w-5 text-green-400" />
                            <span className="text-sm font-semibold capitalize">{test.test_type} Test</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-slate-300">
                              Coverage: <span className="font-semibold">{test.coverage_percentage?.toFixed(1)}%</span>
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                test.status === 'passed'
                                  ? 'bg-green-500/20 text-green-400'
                                  : test.status === 'failed'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}
                            >
                              {test.status}
                            </span>
                          </div>
                        </div>
                        {test.test_code && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm text-primary-400 hover:text-primary-300">
                              View Test Code
                            </summary>
                            <pre className="mt-2 p-3 bg-slate-900 rounded text-xs overflow-x-auto text-slate-300">
                              {test.test_code}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Test Section for Selected File */}
              {selectedFile && fileContent && (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300">Generate Test for: {selectedFile}</h3>
                    <button
                      onClick={() => handleGenerateTest(selectedFile, getFileLanguage(selectedFile.split('.').pop() || ''), fileContent)}
                      disabled={generatingTest === selectedFile}
                      className="flex items-center space-x-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingTest === selectedFile ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span>Generate Test</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Language: {getFileLanguage(selectedFile.split('.').pop() || '')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Issues Tab */}
          {activeTab === 'issues' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Issues</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-400">
                    Total: <span className="font-semibold text-white">{issues.length}</span>
                  </span>
                  <span className="text-sm text-slate-400">
                    Fixed: <span className="font-semibold text-green-400">{statistics.fixed_issues}</span>
                  </span>
                  <span className="text-sm text-slate-400">
                    Open: <span className="font-semibold text-red-400">{statistics.open_issues}</span>
                  </span>
                </div>
              </div>

              {issues.length === 0 ? (
                <div className="bg-slate-700/50 rounded-lg p-8 border border-slate-600 text-center">
                  <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                  <p className="text-slate-400">No issues found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue: any) => (
                    <div
                      key={issue.id}
                      className={`bg-slate-700/50 rounded-lg p-4 border ${
                        issue.fixed
                          ? 'border-green-500/50'
                          : issue.severity === 'critical'
                          ? 'border-red-500/50'
                          : issue.severity === 'high'
                          ? 'border-orange-500/50'
                          : 'border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-600 capitalize">
                            {issue.issue_type}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded capitalize ${
                              issue.severity === 'critical'
                                ? 'bg-red-500/20 text-red-400'
                                : issue.severity === 'high'
                                ? 'bg-orange-500/20 text-orange-400'
                                : issue.severity === 'medium'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {issue.severity}
                          </span>
                          {issue.fixed && (
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          )}
                        </div>
                        {issue.line_number && (
                          <span className="text-xs text-slate-500">Line {issue.line_number}</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 mt-2 mb-2">{issue.message}</p>
                      {issue.suggestion && (
                        <div className="mt-2 p-3 bg-slate-800 rounded border border-slate-600">
                          <p className="text-xs font-semibold text-primary-400 mb-1">💡 Fix Suggestion:</p>
                          <p className="text-sm text-slate-300">{issue.suggestion}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Regression Predictions</h2>
                <span className="text-sm text-slate-400">
                  {predictions.length} predictions
                </span>
              </div>

              {predictions.length === 0 ? (
                <div className="bg-slate-700/50 rounded-lg p-8 border border-slate-600 text-center">
                  <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No predictions yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {predictions.map((prediction: any) => (
                    <div
                      key={prediction.id}
                      className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-1">
                            {prediction.file_path || 'Repository-wide'}
                          </h3>
                          <p className="text-xs text-slate-400 capitalize">
                            {prediction.prediction_type} Prediction
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold mb-1 ${
                            prediction.risk_score > 0.7
                              ? 'text-red-400'
                              : prediction.risk_score > 0.4
                              ? 'text-yellow-400'
                              : 'text-green-400'
                          }`}>
                            {(prediction.risk_score * 100).toFixed(1)}%
                          </div>
                          <p className="text-xs text-slate-400">Risk Score</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Confidence</p>
                          <p className="text-sm font-semibold text-slate-300">
                            {(prediction.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Status</p>
                          <p className={`text-sm font-semibold ${
                            prediction.triggered ? 'text-yellow-400' : 'text-slate-400'
                          }`}>
                            {prediction.triggered ? 'Triggered' : 'Pending'}
                          </p>
                        </div>
                      </div>
                      {prediction.predicted_issues && Array.isArray(prediction.predicted_issues) && prediction.predicted_issues.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-600">
                          <p className="text-xs font-semibold text-slate-400 mb-2">Predicted Issues:</p>
                          <ul className="space-y-1">
                            {prediction.predicted_issues.map((issue: string, idx: number) => (
                              <li key={idx} className="text-sm text-slate-300">• {issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-4">
                        {new Date(prediction.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onClose={() => setToast(null)}
        />
      )}

      {/* Test Preview Modal */}
      {previewTest && (
        <TestPreviewModal
          isOpen={true}
          testCode={previewTest.code}
          sourceCode={previewTest.sourceCode}
          fileName={previewTest.fileName}
          language={previewTest.language}
          coverage={previewTest.coverage}
          onAccept={handleAcceptTest}
          onDismiss={handleDismissTest}
          onRefine={handleRefineTest}
          isRefining={isRefiningTest}
        />
      )}
    </div>
  )
}
