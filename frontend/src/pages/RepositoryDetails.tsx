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
  BarChart3,
  Sparkles,
  Shield,
  Zap,
  Code,
  Lightbulb
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
    testType?: 'unit' | 'e2e' | 'acceptance'  // Store test type to preserve it when accepting
  } | null>(null)
  const [isRefiningTest, setIsRefiningTest] = useState(false)
  const [aiStatus, setAIStatus] = useState<{ openai_available: boolean; anthropic_available: boolean } | null>(null)
  const [issueTypeFilter, setIssueTypeFilter] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [showLowCoverageOnly, setShowLowCoverageOnly] = useState(false)
  const [minIssuesFilter, setMinIssuesFilter] = useState<number>(0)
  const [reviewGenerateTests, setReviewGenerateTests] = useState(true)
  const [reviewGenerateIssues, setReviewGenerateIssues] = useState(true)
  const [reviewGeneratePredictions, setReviewGeneratePredictions] = useState(true)
  const [selectedTestType, setSelectedTestType] = useState<'unit' | 'e2e' | 'acceptance'>('unit')
  const [testCoverageTab, setTestCoverageTab] = useState<'unit' | 'e2e'>('unit')
  const [coverageViewTab, setCoverageViewTab] = useState<'covered' | 'needs'>('covered')
  const [viewingTest, setViewingTest] = useState<any>(null)
  const [viewingTestFile, setViewingTestFile] = useState<{ name: string; path: string } | null>(null)
  const [testFileContent, setTestFileContent] = useState<string | null>(null)
  const [loadingTestFileContent, setLoadingTestFileContent] = useState(false)

  // Helper function to count test methods/cases in test code
  const countTestMethods = (testCode: string): number => {
    if (!testCode) return 0
    // Count test methods/cases
    const patterns = [
      /def\s+test_/g,           // Python: def test_
      /test\s*\(/g,              // JavaScript/TypeScript: test(
      /it\s*\(/g,                // JavaScript/TypeScript: it(
      /@Test/g,                   // Java: @Test
      /void\s+test/g,            // Java: void test
      /describe\s*\(/g          // JavaScript/TypeScript: describe(
    ]
    let count = 0
    patterns.forEach(pattern => {
      const matches = testCode.match(pattern)
      if (matches) count += matches.length
    })
    // If no patterns found but code exists, estimate based on structure
    if (count === 0 && testCode.length > 100) {
      // Rough estimate: count lines that look like test definitions
      const lines = testCode.split('\n')
      count = lines.filter(line => {
        const trimmed = line.trim()
        return trimmed.startsWith('test') || 
               trimmed.startsWith('it(') || 
               trimmed.startsWith('def ') ||
               trimmed.includes('@Test')
      }).length
    }
    return count || 1 // At least 1 if test code exists
  }

  useEffect(() => {
    if (id) {
      loadRepositoryDetails()
      loadRepositoryFiles()
    }
    checkAIStatus()
    // Initialize default model selection
    const initializeModel = async () => {
      try {
        const { getCurrentModel } = await import('../api/client')
        const currentModel = await getCurrentModel()
        if (currentModel && !selectedModel) {
          setSelectedModel(currentModel.id)
          setSelectedProvider(currentModel.provider)
        }
      } catch (error) {
        console.error('Failed to load current model:', error)
      }
    }
    initializeModel()
  }, [id])

  // Debug viewingTest changes
  useEffect(() => {
    if (viewingTest) {
      console.log('viewingTest changed:', viewingTest)
    }
  }, [viewingTest])

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

  const loadTestFileContent = async (filePath: string) => {
    if (!id) return
    try {
      setLoadingTestFileContent(true)
      const response = await apiClient.get(`/api/v1/repositories/${id}/file-content`, {
        params: { file_path: filePath }
      })
      setTestFileContent(response.data.content)
    } catch (err: any) {
      setToast({
        message: err.response?.data?.detail || 'Failed to load test file content',
        type: 'error',
        isVisible: true
      })
      setTestFileContent(null)
    } finally {
      setLoadingTestFileContent(false)
    }
  }

  const handleViewTestFile = (testFile: any) => {
    const filePath = testFile.relative_path || testFile.path || testFile.name
    setViewingTestFile({ name: testFile.name, path: filePath })
    loadTestFileContent(filePath)
  }

  const handleGenerateTest = async (filePath: string, language: string, code?: string, testType: 'unit' | 'e2e' | 'acceptance' = 'unit') => {
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
      console.log('🔍 Generating tests with:', {
        language,
        test_type: testType,
        ai_model: selectedModel,
        ai_provider: selectedProvider,
        code_length: codeToTest.length,
        file_path: filePath
      })
      
      // Ensure model and provider are set
      if (!selectedModel || !selectedProvider) {
        // Try to get default model
        try {
          const { getCurrentModel } = await import('../api/client')
          const currentModel = await getCurrentModel()
          if (currentModel) {
            setSelectedModel(currentModel.id)
            setSelectedProvider(currentModel.provider)
          }
        } catch (error) {
          console.error('Failed to get default model:', error)
        }
      }
      
      const response = await generateTests({
        code: codeToTest,
        language: language,
        test_type: testType,
        ai_model: selectedModel || undefined,
        ai_provider: selectedProvider || undefined,
        // Don't save immediately - show preview first
        // repository_id: id ? parseInt(id) : undefined,
        // file_path: filePath
      })
      
      console.log('✅ Test generation response:', {
        has_test_code: !!response.test_code,
        test_code_length: response.test_code?.length || 0,
        test_count: response.test_count,
        coverage: response.coverage_estimate
      })
      
      // Show preview modal instead of saving immediately
      setPreviewTest({
        code: response.test_code,
        sourceCode: codeToTest,
        fileName: filePath.split('/').pop() || filePath,
        language: language,
        coverage: response.coverage_estimate || response.coverage || 0,
        filePath: filePath,
        testType: testType  // Store the test type so it persists when accepting
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
      // Use the test type from previewTest (which was set during generation)
      // Fall back to selectedTestType if not available
      const testTypeToSave = previewTest.testType || selectedTestType || 'unit'
      
      console.log('💾 Saving test with type:', testTypeToSave, {
        hasPreviewTestType: !!(previewTest as any).testType,
        selectedTestType,
        previewTest
      })
      
      // Save the test to the repository
      const response = await generateTests({
        code: previewTest.code,
        language: previewTest.language,
        test_type: testTypeToSave,
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
      
      // Small delay to ensure file system is updated
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Reload both repository details and files to get updated coverage
      await Promise.all([
        loadRepositoryDetails(),
        loadRepositoryFiles()
      ])
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
      
      // Use the test type from previewTest, fallback to 'unit'
      const testTypeToRefine = previewTest.testType || 'unit'
      
      const response = await generateTests({
        code: refinedCode,
        language: previewTest.language,
        test_type: testTypeToRefine,
        ai_model: selectedModel,
        ai_provider: selectedProvider
      })
      
      // Update preview with refined test (keep source code and test type)
      setPreviewTest({
        ...previewTest,
        code: response.test_code,
        sourceCode: codeToTest, // Keep the source code
        coverage: response.coverage_estimate || response.coverage || 0,
        testType: testTypeToRefine  // Preserve test type during refinement
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

  const { repository, statistics, analyses, issues: issuesFromData, tests, predictions } = data
  
  // Ensure issues is always an array
  const issues = Array.isArray(issuesFromData) ? issuesFromData : []
  
  // Debug logging
  if (issues.length > 0) {
    console.log(`[RepositoryDetails] Loaded ${issues.length} issues`)
    console.log(`[RepositoryDetails] Issue types:`, [...new Set(issues.map((i: any) => i.issue_type))])
  } else {
    console.log(`[RepositoryDetails] No issues found in data:`, {
      hasData: !!data,
      hasIssuesKey: 'issues' in (data || {}),
      issuesValue: issuesFromData,
      statistics: statistics?.total_issues
    })
  }

  // Calculate coverage - only for source files, not test files
  // Coverage is based on how many source files have corresponding test files (unit OR E2E)
  const sourceFilesWithTests = new Set<string>()
  
  // Helper function to match test file to source file
  const matchTestFileToSource = (testFile: any): string | null => {
    const testName = testFile.name.toLowerCase()
    const testPath = testFile.relative_path.toLowerCase()
    
    // Extract potential source file name from test file
    // Patterns: test_*.py -> *.py, *_test.py -> *.py, *.test.js -> *.js
    let potentialSourceName = testName
      .replace(/^test_/, '')
      .replace(/_test\./, '.')
      .replace(/\.test\./, '.')
      .replace(/\.spec\./, '.')
      .replace(/e2e\./, '.')
      .replace(/\.e2e\./, '.')
    
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
        const baseTestName = testName.replace(/^(test_|_test|\.test|\.spec|e2e|\.e2e)/, '').replace(/\.(py|js|ts|java)$/, '')
        const baseSourceName = sourceName.replace(/\.(py|js|ts|java)$/, '')
        if (baseTestName === baseSourceName) return true
      }
      
      // Also check if paths are similar
      if (testPath.includes(sourceName.replace(/\.(py|js|ts|java)$/, ''))) return true
      if (sourcePath.includes(testName.replace(/^(test_|_test|\.test|\.spec|e2e|\.e2e)/, '').replace(/\.(py|js|ts|java)$/, ''))) return true
      
      return false
    })
    
    return matchingSource ? matchingSource.relative_path : null
  }
  
  // Match test files to source files (both unit and E2E)
  testFiles.forEach(testFile => {
    const matchedPath = matchTestFileToSource(testFile)
    if (matchedPath) {
      sourceFilesWithTests.add(matchedPath)
    }
  })
  
  // Also check for generated tests in database (both unit and E2E)
  tests.forEach((test: any) => {
    let matchedSourceFile = null
    
    // First, try to match via analysis_id
    if (test.analysis_id) {
      const testAnalysis = analyses.find((a: any) => a.id === test.analysis_id)
      if (testAnalysis && testAnalysis.file_path) {
        // Find source file that matches the test's target
        const analysisPath = testAnalysis.file_path.toLowerCase()
        matchedSourceFile = sourceFiles.find(f => {
          const filePath = f.relative_path.toLowerCase()
          const fileName = f.name.toLowerCase()
          // More flexible matching - check if paths overlap
          return analysisPath.includes(fileName) || 
                 filePath === analysisPath || 
                 analysisPath.includes(filePath) || 
                 filePath.includes(analysisPath) ||
                 fileName === analysisPath.split('/').pop() ||
                 filePath.split('/').pop() === analysisPath.split('/').pop()
        })
      }
    }
    
    // If no match via analysis_id, try to match by test file path (for saved test files)
    // This handles cases where test was saved to file system but analysis_id wasn't set
    if (!matchedSourceFile && test.test_file_path) {
      const testFilePath = test.test_file_path.toLowerCase()
      // Try to extract source file name from test file path
      const testFileName = testFilePath.split('/').pop() || ''
      const potentialSourceName = testFileName
        .replace(/^test_/, '')
        .replace(/_test\./, '.')
        .replace(/\.test\./, '.')
        .replace(/\.spec\./, '.')
        .replace(/e2e\./, '.')
        .replace(/\.e2e\./, '.')
      
      matchedSourceFile = sourceFiles.find(f => {
        const fileName = f.name.toLowerCase()
        const filePath = f.relative_path.toLowerCase()
        return fileName === potentialSourceName || 
               testFilePath.includes(fileName) ||
               filePath.includes(potentialSourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, ''))
      })
    }
    
    if (matchedSourceFile) {
      sourceFilesWithTests.add(matchedSourceFile.relative_path)
    }
  })
  
  // Calculate overall coverage: percentage of source files that have ANY tests (unit OR E2E)
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
            <BarChart3 className={`h-4 w-4 ${
              totalCoverage < 50 ? 'text-red-400' :
              totalCoverage < 80 ? 'text-orange-400' :
              'text-green-400'
            }`} />
            <p className="text-slate-400 text-sm">Test Coverage</p>
          </div>
          <p className={`text-2xl font-bold ${
            totalCoverage < 50 ? 'text-red-400' :
            totalCoverage < 80 ? 'text-orange-400' :
            'text-green-400'
          }`}>{totalCoverage.toFixed(1)}%</p>
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
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <label className="flex items-center space-x-1 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewGenerateTests}
                          onChange={(e) => setReviewGenerateTests(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-800"
                        />
                        <span>Test Coverage</span>
                      </label>
                      <label className="flex items-center space-x-1 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewGenerateIssues}
                          onChange={(e) => setReviewGenerateIssues(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-800"
                        />
                        <span>Issues</span>
                      </label>
                      <label className="flex items-center space-x-1 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={reviewGeneratePredictions}
                          onChange={(e) => setReviewGeneratePredictions(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-800"
                        />
                        <span>Predictions</span>
                      </label>
                    </div>
                    <button
                      onClick={async () => {
                        if (!id) {
                          console.error('No repository ID')
                          return
                        }
                        if (analyzing) {
                          console.log('Analysis already in progress')
                          return
                        }
                        try {
                          setAnalyzing(true)
                          console.log(`Starting analysis for repository ${id}...`)
                          setToast({
                            message: 'Starting repository analysis...',
                            type: 'info',
                            isVisible: true
                          })
                          
                          const requestData = {
                            generate_tests: reviewGenerateTests,
                            predict_regression: reviewGeneratePredictions,
                            max_files: 50,
                            ...(selectedModel && { ai_model: selectedModel }),
                            ...(selectedProvider && { ai_provider: selectedProvider })
                          }
                        console.log('Sending request to:', `/api/v1/review/repository/${id}`, requestData)
                        
                        const response = await apiClient.post(`/api/v1/review/repository/${id}`, requestData)
                        console.log('Repository analysis response:', response.data)
                        
                        const issuesFound = response.data?.analysis?.total_issues || 0
                        const issuesInResponse = response.data?.analysis?.issues || []
                        console.log(`Found ${issuesFound} issues in review response, ${issuesInResponse.length} in issues array`)
                        
                        setToast({
                          message: `Analysis complete! Found ${issuesFound} issues. Saving and refreshing...`,
                          type: 'success',
                          isVisible: true
                        })
                        
                        // Wait longer for backend to save all issues to database
                        await new Promise(resolve => setTimeout(resolve, 3000))
                        
                        // Reload details to get saved issues (this will also get issues from review_result)
                        await loadRepositoryDetails()
                        
                        // Check if issues were loaded (including from review_result)
                        const detailsResponse = await apiClient.get(`/api/v1/repositories/${id}/details`)
                        const loadedIssues = detailsResponse.data?.issues || []
                        console.log(`After reload: ${loadedIssues.length} issues available (from DB + review_result)`)
                        
                        // Note: Even if not all are saved to DB, they should be available from review_result
                        // So we only warn if significantly fewer are available
                        if (loadedIssues.length < issuesFound * 0.8) {
                          setToast({
                            message: `Note: ${issuesFound} issues found, ${loadedIssues.length} available. Some may still be saving.`,
                            type: 'info',
                            isVisible: true
                          })
                        } else if (loadedIssues.length >= issuesFound) {
                          setToast({
                            message: `✅ All ${loadedIssues.length} issues loaded successfully!`,
                            type: 'success',
                            isVisible: true
                          })
                        }
                      } catch (err: any) {
                        console.error('Analysis error:', err)
                        setToast({
                          message: err.response?.data?.detail || err.message || 'Failed to analyze repository',
                          type: 'error',
                          isVisible: true
                        })
                      } finally {
                        setAnalyzing(false)
                      }
                    }}
                    disabled={analyzing || !id}
                    className={`flex items-center space-x-2 px-4 py-2 text-white text-sm rounded transition-colors ${
                      analyzing || !id
                        ? 'bg-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Review Again</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {loadingFiles ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                </div>
              ) : (
                <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-300">Files</h3>
                    <div className="flex items-center space-x-3">
                      <label className="flex items-center space-x-2 text-sm text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showLowCoverageOnly}
                          onChange={(e) => setShowLowCoverageOnly(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-800"
                        />
                        <span>Low Coverage Only</span>
                      </label>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-slate-400">Min Issues:</label>
                        <select
                          value={minIssuesFilter}
                          onChange={(e) => setMinIssuesFilter(Number(e.target.value))}
                          className="px-2 py-1 text-sm rounded border border-slate-600 bg-slate-800 text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value={0}>All</option>
                          <option value={1}>1+</option>
                          <option value={3}>3+</option>
                          <option value={5}>5+</option>
                          <option value={10}>10+</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto space-y-1">
                    {Object.entries(filesByDir).map(([dir, dirFiles]) => (
                      <div key={dir}>
                        <p className="text-xs text-slate-500 mb-1 mt-2">{dir}</p>
                        {dirFiles.map((file) => {
                          // Better matching: normalize paths and compare
                          const normalizePath = (path: string) => path.replace(/\\/g, '/').toLowerCase().trim()
                          const filePathNormalized = normalizePath(file.relative_path)
                          const fileName = file.name.toLowerCase()
                          
                          // Try to find analysis by exact path match first
                          let fileAnalysis = analyses.find((a: any) => {
                            if (!a.file_path) return false
                            const analysisPath = normalizePath(a.file_path)
                            // Exact match
                            if (analysisPath === filePathNormalized) return true
                            // Match by filename if paths are similar
                            const analysisFileName = analysisPath.split('/').pop() || ''
                            if (analysisFileName === fileName) {
                              // Check if directory structure is similar
                              const fileDir = filePathNormalized.substring(0, filePathNormalized.lastIndexOf('/'))
                              const analysisDir = analysisPath.substring(0, analysisPath.lastIndexOf('/'))
                              return fileDir.includes(analysisDir) || analysisDir.includes(fileDir)
                            }
                            return false
                          })
                          
                          // If no exact match, try matching by filename only
                          if (!fileAnalysis) {
                            fileAnalysis = analyses.find((a: any) => {
                              if (!a.file_path) return false
                              const analysisPath = normalizePath(a.file_path)
                              const analysisFileName = analysisPath.split('/').pop() || ''
                              return analysisFileName === fileName
                            })
                          }
                          
                          // Get issues for this file's analysis
                          const fileIssues = issues.filter((i: any) => {
                            if (!fileAnalysis) return false
                            // Match by analysis_id
                            if (i.analysis_id && i.analysis_id === fileAnalysis.id) return true
                            // Also check if issue has file_path info that matches
                            if (i.file_path) {
                              const issuePath = normalizePath(i.file_path)
                              return issuePath === filePathNormalized || issuePath.includes(fileName)
                            }
                            return false
                          })
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
                          
                          // Determine if file needs highlighting
                          const hasLowCoverage = fileCoverage === 0
                          const hasIssues = fileIssues.length > 0
                          const hasCriticalIssues = fileIssues.some((i: any) => i.severity === 'critical')
                          const hasHighIssues = fileIssues.some((i: any) => i.severity === 'high')
                          
                          // Apply filters
                          if (showLowCoverageOnly && !hasLowCoverage) {
                            return null
                          }
                          if (minIssuesFilter > 0 && fileIssues.length < minIssuesFilter) {
                            return null
                          }
                          
                          // Highlight styling based on issues and coverage
                          let highlightClass = ''
                          if (hasCriticalIssues) {
                            highlightClass = 'bg-red-500/10 border-l-4 border-red-500'
                          } else if (hasHighIssues) {
                            highlightClass = 'bg-orange-500/10 border-l-4 border-orange-500'
                          } else if (hasIssues && hasLowCoverage) {
                            highlightClass = 'bg-yellow-500/10 border-l-4 border-yellow-500'
                          } else if (hasIssues) {
                            highlightClass = 'bg-yellow-500/5 border-l-2 border-yellow-500/50'
                          } else if (hasLowCoverage) {
                            highlightClass = 'bg-blue-500/5 border-l-2 border-blue-500/50'
                          }
                          
                          return (
                            <button
                              key={file.path}
                              onClick={() => loadFileContent(file.relative_path)}
                              className={`w-full text-left p-2 rounded hover:bg-slate-600 transition-colors ${highlightClass}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                                  <span className="text-sm text-slate-300 truncate">{file.name}</span>
                                </div>
                                <div className="flex items-center space-x-3 flex-shrink-0">
                                  <div className="flex items-center space-x-1">
                                    <BarChart3 className={`h-3 w-3 ${
                                      fileCoverage === 0 ? 'text-red-400' : fileCoverage < 50 ? 'text-yellow-400' : 'text-green-400'
                                    }`} />
                                    <span className={`text-xs font-medium ${
                                      fileCoverage === 0 ? 'text-red-400' : fileCoverage < 50 ? 'text-yellow-400' : 'text-slate-400'
                                    }`}>
                                      {fileCoverage > 0 ? `${fileCoverage.toFixed(0)}%` : '0%'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <AlertTriangle className={`h-3 w-3 ${
                                      fileIssues.length === 0
                                        ? 'text-green-400'
                                        : fileIssues.some((i: any) => i.severity === 'critical')
                                        ? 'text-red-400'
                                        : fileIssues.some((i: any) => i.severity === 'high')
                                        ? 'text-orange-400'
                                        : 'text-yellow-400'
                                    }`} />
                                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
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
                    Overall Coverage: <span className={`font-semibold ${
                      totalCoverage < 50 ? 'text-red-400' :
                      totalCoverage < 80 ? 'text-orange-400' :
                      'text-green-400'
                    }`}>{totalCoverage.toFixed(1)}%</span>
                  </span>
                </div>
              </div>

              {/* Test Type Tabs */}
              <div className="border-b border-slate-700">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setTestCoverageTab('unit')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                      testCoverageTab === 'unit'
                        ? 'border-primary-500 text-primary-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Unit Test
                  </button>
                  <button
                    onClick={() => setTestCoverageTab('e2e')}
                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                      testCoverageTab === 'e2e'
                        ? 'border-primary-500 text-primary-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    E2E Test
                  </button>
                </div>
              </div>

              {/* Unit Test Tab */}
              {testCoverageTab === 'unit' && (
                <div className="space-y-6">
                  {/* Unit Test Statistics */}
                  {(() => {
                    const unitTests = tests.filter((t: any) => 
                      !t.test_type || t.test_type === 'unit' || t.test_type === 'Unit Test'
                    )
                    const unitTestFiles = testFiles.filter(f => {
                      const name = f.name.toLowerCase()
                      return name.includes('test') || name.includes('spec') || name.includes('unit')
                    })
                    const filesWithUnitTests = sourceFiles.filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = unitTestFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = unitTests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length > 0 || fileTests.length > 0
                    })
                    const unitCoverage = sourceFiles.length > 0 
                      ? (filesWithUnitTests.length / sourceFiles.length) * 100 
                      : 0
                    
                    // Count actual test methods/cases
                    let totalTestMethods = unitTests.reduce((sum: number, test: any) => {
                      const testCount = test.test_count || countTestMethods(test.test_code || '')
                      return sum + (testCount > 0 ? testCount : 0)
                    }, 0)
                    
                    // If no methods found but test files exist, count test files
                    if (totalTestMethods === 0 && unitTests.length > 0) {
                      totalTestMethods = unitTests.length
                    }
                    // Also count test files if they exist
                    if (totalTestMethods === 0 && unitTestFiles.length > 0) {
                      totalTestMethods = unitTestFiles.length
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <TestTube className="h-4 w-4 text-blue-400" />
                            <span className="text-sm text-slate-400">Unit Tests</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-400">
                            {totalTestMethods > 0 ? totalTestMethods : (unitTests.length > 0 ? unitTests.length : unitTestFiles.length)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {unitTests.length + unitTestFiles.length} test file{(unitTests.length + unitTestFiles.length) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <BarChart3 className={`h-4 w-4 ${
                              unitCoverage < 50 ? 'text-red-400' :
                              unitCoverage < 80 ? 'text-orange-400' :
                              'text-green-400'
                            }`} />
                            <span className="text-sm text-slate-400">Coverage</span>
                          </div>
                          <p className={`text-2xl font-bold ${
                            unitCoverage < 50 ? 'text-red-400' :
                            unitCoverage < 80 ? 'text-orange-400' :
                            'text-green-400'
                          }`}>{unitCoverage.toFixed(1)}%</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Files Covered</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {filesWithUnitTests.length} / {sourceFiles.length}
                          </p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Coverage View Tabs */}
                  <div className="border-b border-slate-700 mt-6">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setCoverageViewTab('covered')}
                        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                          coverageViewTab === 'covered'
                            ? 'border-primary-500 text-primary-400'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Covered Tests
                      </button>
                      <button
                        onClick={() => setCoverageViewTab('needs')}
                        className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                          coverageViewTab === 'needs'
                            ? 'border-primary-500 text-primary-400'
                            : 'border-transparent text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        Needs Coverage
                      </button>
                    </div>
                  </div>

                  {/* Covered Tests Tab */}
                  {coverageViewTab === 'covered' && (() => {
                    const unitTests = tests.filter((t: any) => 
                      !t.test_type || t.test_type === 'unit' || t.test_type === 'Unit Test'
                    )
                    const unitTestFiles = testFiles.filter(f => {
                      const name = f.name.toLowerCase()
                      return name.includes('test') || name.includes('spec') || name.includes('unit')
                    })

                    if (unitTests.length === 0 && unitTestFiles.length === 0) {
                      return (
                        <div className="text-center py-8 mt-4">
                          <TestTube className="h-12 w-12 text-slate-600 mx-auto mb-2" />
                          <p className="text-slate-400">No tests found</p>
                        </div>
                      )
                    }

                    return (
                      <div className="space-y-4 mt-4">
                        <h3 className="text-lg font-semibold text-white">Test Classes</h3>
                        <div className="space-y-2">
                          {/* Show generated test objects */}
                          {unitTests.map((test: any) => {
                            const testAnalysis = analyses.find((a: any) => a.id === test.analysis_id)
                            const testPath = testAnalysis?.file_path || 'Unknown'
                            return (
                              <div
                                key={test.id}
                                className="bg-slate-800/50 rounded-lg p-4 border border-slate-600"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <TestTube className="h-5 w-5 text-blue-400" />
                                    <div>
                                      <p className="text-sm font-semibold text-white">{testPath.split('/').pop()}</p>
                                      <p className="text-xs text-slate-400">{testPath}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span className="text-sm text-slate-300">
                                      Coverage: <span className="font-semibold">{test.coverage_percentage?.toFixed(1)}%</span>
                                    </span>
                                    <span className="text-sm text-slate-300">
                                      Tests: <span className="font-semibold">{test.test_count || countTestMethods(test.test_code || '')}</span>
                                    </span>
                                    <button
                                      onClick={() => setViewingTest(test)}
                                      className="text-xs text-primary-400 hover:text-primary-300 flex items-center space-x-1"
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>View</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {/* Show test files */}
                          {unitTestFiles.map((testFile: any) => (
                            <div
                              key={testFile.name}
                              className="bg-slate-800/50 rounded-lg p-4 border border-slate-600"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <FileText className="h-5 w-5 text-blue-400" />
                                  <div>
                                    <p className="text-sm font-semibold text-white">{testFile.name}</p>
                                    <p className="text-xs text-slate-400">{testFile.relative_path || testFile.name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span className="text-xs text-slate-400">Test File</span>
                                  <button
                                    onClick={() => handleViewTestFile(testFile)}
                                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center space-x-1 transition-colors"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>View Code</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Needs Coverage Tab */}
                  {coverageViewTab === 'needs' && (
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 mt-4">
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
                      {(() => {
                        const unitTests = tests.filter((t: any) => 
                          !t.test_type || t.test_type === 'unit' || t.test_type === 'Unit Test'
                        )
                        const unitTestFiles = testFiles.filter(f => {
                          const name = f.name.toLowerCase()
                          return name.includes('test') || name.includes('spec') || name.includes('unit')
                        })
                        return sourceFiles
                          .filter(f => {
                            const sourceName = f.name.toLowerCase()
                            const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            const matchingTestFiles = unitTestFiles.filter(testFile => {
                              const testName = testFile.name.toLowerCase()
                              const testBaseName = testName
                                .replace(/^test_/, '')
                                .replace(/_test\./, '.')
                                .replace(/\.test\./, '.')
                                .replace(/\.spec\./, '.')
                                .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                              return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                            })
                            const fileTests = unitTests.filter((t: any) => {
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
                                  onClick={() => {
                                    setSelectedTestType('unit')
                                    handleGenerateTest(file.relative_path, fileLanguage, undefined, 'unit')
                                  }}
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
                                      <span>Generate Unit Test</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )
                          })
                      })()}
                      {(() => {
                        const unitTests = tests.filter((t: any) => 
                          !t.test_type || t.test_type === 'unit' || t.test_type === 'Unit Test'
                        )
                        const unitTestFiles = testFiles.filter(f => {
                          const name = f.name.toLowerCase()
                          return name.includes('test') || name.includes('spec') || name.includes('unit')
                        })
                        const needsTests = sourceFiles.filter(f => {
                          const sourceName = f.name.toLowerCase()
                          const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                          const matchingTestFiles = unitTestFiles.filter(testFile => {
                            const testName = testFile.name.toLowerCase()
                            const testBaseName = testName
                              .replace(/^test_/, '')
                              .replace(/_test\./, '.')
                              .replace(/\.test\./, '.')
                              .replace(/\.spec\./, '.')
                              .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                          })
                          const fileTests = unitTests.filter((t: any) => {
                            const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                            if (!testAnalysis) return false
                            const testPath = testAnalysis.file_path?.toLowerCase() || ''
                            return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                          })
                          return matchingTestFiles.length === 0 && fileTests.length === 0
                        })
                        return needsTests.length === 0 && (
                          <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                            <p className="text-slate-400">All source files have unit test coverage!</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* E2E Test Tab */}
              {testCoverageTab === 'e2e' && (
                <div className="space-y-6">
                  {/* E2E Test Statistics */}
                  {(() => {
                    const e2eTests = tests.filter((t: any) => 
                      t.test_type === 'e2e' || t.test_type === 'E2E Test' || t.test_type === 'e2e'
                    )
                    const e2eTestFiles = testFiles.filter(f => {
                      const name = f.name.toLowerCase()
                      return name.includes('e2e') || name.includes('integration') || name.includes('end-to-end')
                    })
                    const filesWithE2ETests = sourceFiles.filter(f => {
                      const sourceName = f.name.toLowerCase()
                      const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                      const matchingTestFiles = e2eTestFiles.filter(testFile => {
                        const testName = testFile.name.toLowerCase()
                        const testBaseName = testName
                          .replace(/^test_/, '')
                          .replace(/_test\./, '.')
                          .replace(/\.test\./, '.')
                          .replace(/\.spec\./, '.')
                          .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                        return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                      })
                      const fileTests = e2eTests.filter((t: any) => {
                        const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                        if (!testAnalysis) return false
                        const testPath = testAnalysis.file_path?.toLowerCase() || ''
                        return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                      })
                      return matchingTestFiles.length > 0 || fileTests.length > 0
                    })
                    const e2eCoverage = sourceFiles.length > 0 
                      ? (filesWithE2ETests.length / sourceFiles.length) * 100 
                      : 0
                    
                    // Count actual test methods/cases for E2E
                    const totalE2ETestMethods = e2eTests.reduce((sum: number, test: any) => {
                      return sum + (test.test_count || countTestMethods(test.test_code || ''))
                    }, 0)

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <TestTube className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-slate-400">E2E Tests</span>
                            </div>
                            {(totalE2ETestMethods > 0 || e2eTests.length > 0 || e2eTestFiles.length > 0) && (
                              <button
                                onClick={() => {
                                  // Show first test in modal, or scroll to tests section
                                  if (e2eTests.length > 0) {
                                    setViewingTest(e2eTests[0])
                                  } else {
                                    // Scroll to tests section if it exists
                                    const element = document.getElementById('generated-e2e-tests')
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                    }
                                  }
                                }}
                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center space-x-1"
                              >
                                <Eye className="h-3 w-3" />
                                <span>View Tests</span>
                              </button>
                            )}
                          </div>
                          <p className="text-2xl font-bold text-purple-400">
                            {totalE2ETestMethods > 0 ? totalE2ETestMethods : (e2eTests.length > 0 ? e2eTests.length : e2eTestFiles.length)}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {e2eTests.length + e2eTestFiles.length} test file{(e2eTests.length + e2eTestFiles.length) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <BarChart3 className={`h-4 w-4 ${
                              e2eCoverage < 50 ? 'text-red-400' :
                              e2eCoverage < 80 ? 'text-orange-400' :
                              'text-green-400'
                            }`} />
                            <span className="text-sm text-slate-400">Coverage</span>
                          </div>
                          <p className={`text-2xl font-bold ${
                            e2eCoverage < 50 ? 'text-red-400' :
                            e2eCoverage < 80 ? 'text-orange-400' :
                            'text-green-400'
                          }`}>{e2eCoverage.toFixed(1)}%</p>
                        </div>
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Files Covered</span>
                          </div>
                          <p className="text-2xl font-bold text-white">
                            {filesWithE2ETests.length} / {sourceFiles.length}
                          </p>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Files Needing E2E Test Coverage */}
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
                      <h3 className="text-lg font-semibold text-white">Files Needing E2E Tests</h3>
                      <span className="text-sm text-slate-400">
                        {(() => {
                          const e2eTests = tests.filter((t: any) => 
                            t.test_type === 'e2e' || t.test_type === 'E2E Test'
                          )
                          const e2eTestFiles = testFiles.filter(f => {
                            const name = f.name.toLowerCase()
                            return name.includes('e2e') || name.includes('integration') || name.includes('end-to-end')
                          })
                          return sourceFiles.filter(f => {
                            const sourceName = f.name.toLowerCase()
                            const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            const matchingTestFiles = e2eTestFiles.filter(testFile => {
                              const testName = testFile.name.toLowerCase()
                              const testBaseName = testName
                                .replace(/^test_/, '')
                                .replace(/_test\./, '.')
                                .replace(/\.test\./, '.')
                                .replace(/\.spec\./, '.')
                                .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                              return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                            })
                            const fileTests = e2eTests.filter((t: any) => {
                              const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                              if (!testAnalysis) return false
                              const testPath = testAnalysis.file_path?.toLowerCase() || ''
                              return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                            })
                            return matchingTestFiles.length === 0 && fileTests.length === 0
                          }).length
                        })()} files
                      </span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(() => {
                        const e2eTests = tests.filter((t: any) => 
                          t.test_type === 'e2e' || t.test_type === 'E2E Test'
                        )
                        const e2eTestFiles = testFiles.filter(f => {
                          const name = f.name.toLowerCase()
                          return name.includes('e2e') || name.includes('integration') || name.includes('end-to-end')
                        })
                        return sourceFiles
                          .filter(f => {
                            const sourceName = f.name.toLowerCase()
                            const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            const matchingTestFiles = e2eTestFiles.filter(testFile => {
                              const testName = testFile.name.toLowerCase()
                              const testBaseName = testName
                                .replace(/^test_/, '')
                                .replace(/_test\./, '.')
                                .replace(/\.test\./, '.')
                                .replace(/\.spec\./, '.')
                                .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                              return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                            })
                            const fileTests = e2eTests.filter((t: any) => {
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
                                  onClick={() => {
                                    setSelectedTestType('e2e')
                                    handleGenerateTest(file.relative_path, fileLanguage, undefined, 'e2e')
                                  }}
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
                                      <span>Generate E2E Test</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )
                          })
                      })()}
                      {(() => {
                        const e2eTests = tests.filter((t: any) => 
                          t.test_type === 'e2e' || t.test_type === 'E2E Test'
                        )
                        const e2eTestFiles = testFiles.filter(f => {
                          const name = f.name.toLowerCase()
                          return name.includes('e2e') || name.includes('integration') || name.includes('end-to-end')
                        })
                        const needsTests = sourceFiles.filter(f => {
                          const sourceName = f.name.toLowerCase()
                          const sourceBaseName = sourceName.replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                          const matchingTestFiles = e2eTestFiles.filter(testFile => {
                            const testName = testFile.name.toLowerCase()
                            const testBaseName = testName
                              .replace(/^test_/, '')
                              .replace(/_test\./, '.')
                              .replace(/\.test\./, '.')
                              .replace(/\.spec\./, '.')
                              .replace(/\.(py|js|ts|jsx|tsx|java)$/, '')
                            return testBaseName === sourceBaseName || testName.includes(sourceBaseName)
                          })
                          const fileTests = e2eTests.filter((t: any) => {
                            const testAnalysis = analyses.find((a: any) => a.id === t.analysis_id)
                            if (!testAnalysis) return false
                            const testPath = testAnalysis.file_path?.toLowerCase() || ''
                            return testPath.includes(sourceName) || testPath.includes(sourceBaseName)
                          })
                          return matchingTestFiles.length === 0 && fileTests.length === 0
                        })
                        return needsTests.length === 0 && (
                          <div className="text-center py-8">
                            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-2" />
                            <p className="text-slate-400">All source files have E2E test coverage!</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Existing E2E Tests */}
                  {(() => {
                    const e2eTests = tests.filter((t: any) => 
                      t.test_type === 'e2e' || t.test_type === 'E2E Test'
                    )
                    return e2eTests.length > 0 && (
                      <div id="generated-e2e-tests" className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                        <h3 className="text-lg font-semibold text-white mb-4">Generated E2E Tests</h3>
                        <div className="space-y-4">
                          {e2eTests.map((test: any) => (
                            <div
                              key={test.id}
                              className="bg-slate-800/50 rounded-lg p-4 border border-slate-600"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <TestTube className="h-5 w-5 text-purple-400" />
                                  <span className="text-sm font-semibold">E2E Test</span>
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
                              <div className="flex items-center justify-between mt-2">
                                {test.test_code && (
                                  <details className="flex-1">
                                    <summary className="cursor-pointer text-sm text-primary-400 hover:text-primary-300">
                                      View Test Code
                                    </summary>
                                    <pre className="mt-2 p-3 bg-slate-900 rounded text-xs overflow-x-auto text-slate-300">
                                      {test.test_code}
                                    </pre>
                                  </details>
                                )}
                                <button
                                  onClick={() => setViewingTest(test)}
                                  className="ml-2 flex items-center space-x-1 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>View</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
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

              {/* Issue Type Filters */}
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-300">Filter by Issue Type</h3>
                  <button
                    onClick={async () => {
                      if (!id) {
                        console.error('No repository ID')
                        return
                      }
                      if (analyzing) {
                        console.log('Analysis already in progress')
                        return
                      }
                      try {
                        setAnalyzing(true)
                        console.log(`Starting analysis for repository ${id}...`)
                        setToast({
                          message: 'Starting repository analysis...',
                          type: 'info',
                          isVisible: true
                        })
                        
                        const requestData = {
                          generate_tests: true,
                          predict_regression: true,
                          max_files: 50,
                          ...(selectedModel && { ai_model: selectedModel }),
                          ...(selectedProvider && { ai_provider: selectedProvider })
                        }
                        console.log('Sending request to:', `/api/v1/review/repository/${id}`, requestData)
                        
                        const response = await apiClient.post(`/api/v1/review/repository/${id}`, requestData)
                        console.log('Repository analysis response:', response.data)
                        
                        const issuesFound = response.data?.analysis?.total_issues || 0
                        const issuesInResponse = response.data?.analysis?.issues || []
                        console.log(`Found ${issuesFound} issues in review response, ${issuesInResponse.length} in issues array`)
                        
                        setToast({
                          message: `Analysis complete! Found ${issuesFound} issues. Saving and refreshing...`,
                          type: 'success',
                          isVisible: true
                        })
                        
                        // Wait longer for backend to save all issues to database
                        await new Promise(resolve => setTimeout(resolve, 3000))
                        
                        // Reload details to get saved issues (this will also get issues from review_result)
                        await loadRepositoryDetails()
                        
                        // Check if issues were loaded (including from review_result)
                        const detailsResponse = await apiClient.get(`/api/v1/repositories/${id}/details`)
                        const loadedIssues = detailsResponse.data?.issues || []
                        console.log(`After reload: ${loadedIssues.length} issues available (from DB + review_result)`)
                        
                        // Note: Even if not all are saved to DB, they should be available from review_result
                        // So we only warn if significantly fewer are available
                        if (loadedIssues.length < issuesFound * 0.8) {
                          setToast({
                            message: `Note: ${issuesFound} issues found, ${loadedIssues.length} available. Some may still be saving.`,
                            type: 'info',
                            isVisible: true
                          })
                        } else if (loadedIssues.length >= issuesFound) {
                          setToast({
                            message: `✅ All ${loadedIssues.length} issues loaded successfully!`,
                            type: 'success',
                            isVisible: true
                          })
                        }
                      } catch (err: any) {
                        console.error('Analysis error:', err)
                        setToast({
                          message: err.response?.data?.detail || err.message || 'Failed to analyze repository',
                          type: 'error',
                          isVisible: true
                        })
                      } finally {
                        setAnalyzing(false)
                      }
                    }}
                    disabled={analyzing || !id}
                    className={`flex items-center space-x-2 px-4 py-2 text-white text-sm rounded transition-colors ${
                      analyzing || !id
                        ? 'bg-slate-600 cursor-not-allowed opacity-50'
                        : 'bg-primary-600 hover:bg-primary-700'
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>Analyze Repository</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['all', 'security', 'bug', 'performance', 'style', 'best_practice'].map((type) => {
                    const filterValue = type === 'all' ? null : type
                    const filteredCount = filterValue 
                      ? issues.filter((i: any) => {
                          const issueType = (i.issue_type || '').toLowerCase()
                          return issueType === type || (type === 'best_practice' && (issueType === 'best_practice' || issueType === 'code_improvements'))
                        }).length
                      : issues.length
                    
                    return (
                      <button
                        key={type}
                        onClick={() => setIssueTypeFilter(filterValue)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          issueTypeFilter?.toLowerCase() === type
                            ? type === 'security'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : type === 'bug'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                              : type === 'performance'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                              : type === 'style'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                              : type === 'best_practice'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                              : 'bg-primary-600/20 text-primary-400 border border-primary-500/50'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
                        }`}
                      >
                        {type === 'all' ? 'All Issues' : type === 'best_practice' ? 'Best Practice' : type.charAt(0).toUpperCase() + type.slice(1)}
                        <span className="ml-2 text-xs opacity-75">({filteredCount})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Issue Type Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { type: 'security', label: 'Security', color: 'red', icon: Shield },
                  { type: 'bug', label: 'Bugs', color: 'orange', icon: AlertTriangle },
                  { type: 'performance', label: 'Performance', color: 'yellow', icon: Zap },
                  { type: 'style', label: 'Style', color: 'blue', icon: Code },
                  { type: 'best_practice', label: 'Best Practice', color: 'purple', icon: Lightbulb }
                ].map(({ type, label, color, icon: Icon }) => {
                  const typeIssues = issues.filter((i: any) => {
                    const issueType = (i.issue_type || '').toLowerCase()
                    return issueType === type || (type === 'best_practice' && (issueType === 'best_practice' || issueType === 'code_improvements'))
                  })
                  const count = typeIssues.length
                  const criticalCount = typeIssues.filter((i: any) => i.severity === 'critical').length
                  
                  return (
                    <div
                      key={type}
                      onClick={() => setIssueTypeFilter(type === issueTypeFilter?.toLowerCase() ? null : type)}
                      className={`bg-slate-800/50 rounded-lg p-3 border cursor-pointer hover:bg-slate-800 transition-colors ${
                        issueTypeFilter?.toLowerCase() === type 
                          ? color === 'red' ? 'border-red-500/50' :
                            color === 'orange' ? 'border-orange-500/50' :
                            color === 'yellow' ? 'border-yellow-500/50' :
                            color === 'blue' ? 'border-blue-500/50' :
                            'border-purple-500/50'
                          : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <Icon className={
                          color === 'red' ? 'h-4 w-4 text-red-400' :
                          color === 'orange' ? 'h-4 w-4 text-orange-400' :
                          color === 'yellow' ? 'h-4 w-4 text-yellow-400' :
                          color === 'blue' ? 'h-4 w-4 text-blue-400' :
                          'h-4 w-4 text-purple-400'
                        } />
                        <span className="text-xs text-slate-400">{label}</span>
                      </div>
                      <p className={
                        color === 'red' ? 'text-2xl font-bold text-red-400' :
                        color === 'orange' ? 'text-2xl font-bold text-orange-400' :
                        color === 'yellow' ? 'text-2xl font-bold text-yellow-400' :
                        color === 'blue' ? 'text-2xl font-bold text-blue-400' :
                        'text-2xl font-bold text-purple-400'
                      }>{count}</p>
                      {criticalCount > 0 && (
                        <p className="text-xs text-red-400 mt-1">{criticalCount} critical</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Issues List */}
              {(() => {
                const filteredIssues = issueTypeFilter
                  ? issues.filter((i: any) => {
                      const issueType = (i.issue_type || '').toLowerCase().trim()
                      const filterType = issueTypeFilter.toLowerCase().trim()
                      
                      // Handle 'all' or null filter
                      if (!filterType || filterType === 'all') {
                        return true
                      }
                      
                      // Special handling for 'best_practice' - match both 'best_practice' and 'code_improvements'
                      if (filterType === 'best_practice' || filterType === 'best practice') {
                        const matches = issueType === 'best_practice' || 
                                       issueType === 'code_improvements' || 
                                       issueType === 'code improvements' ||
                                       issueType === 'bestpractice'
                        return matches
                      }
                      
                      // Direct match
                      if (issueType === filterType) {
                        return true
                      }
                      
                      // Handle case variations and underscores/spaces
                      const normalizedIssueType = issueType.replace(/[_\s]/g, '')
                      const normalizedFilterType = filterType.replace(/[_\s]/g, '')
                      if (normalizedIssueType === normalizedFilterType) {
                        return true
                      }
                      
                      return false
                    })
                  : issues
                
                return filteredIssues.length === 0 ? (
                <div className="bg-slate-700/50 rounded-lg p-8 border border-slate-600 text-center">
                  <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
                  <p className="text-slate-400">
                    {issueTypeFilter 
                      ? `No ${issueTypeFilter.toLowerCase().replace('_', ' ')} issues found`
                      : 'No issues found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((issue: any) => {
                    const issueTypeColor = issue.issue_type?.toLowerCase() === 'security' ? 'red' :
                      issue.issue_type?.toLowerCase() === 'bug' ? 'orange' :
                      issue.issue_type?.toLowerCase() === 'performance' ? 'yellow' :
                      issue.issue_type?.toLowerCase() === 'style' ? 'blue' :
                      issue.issue_type?.toLowerCase() === 'best_practice' ? 'purple' : 'slate'
                    
                    return (
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
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded capitalize bg-${issueTypeColor}-500/20 text-${issueTypeColor}-400 border border-${issueTypeColor}-500/50`}>
                              {issue.issue_type?.replace('_', ' ') || 'unknown'}
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
                    )
                  })}
                </div>
              )
              })()}
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Regression Predictions</h2>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-slate-400">
                    {predictions.length} predictions
                  </span>
                  <button
                    onClick={async () => {
                      if (!id) {
                        console.error('No repository ID')
                        return
                      }
                      if (analyzing) {
                        console.log('Analysis already in progress')
                        return
                      }
                      try {
                        setAnalyzing(true)
                        console.log(`Starting predictions review for repository ${id}...`)
                        setToast({
                          message: 'Generating predictions...',
                          type: 'info',
                          isVisible: true
                        })
                        
                        const requestData = {
                          generate_tests: false,
                          predict_regression: true,
                          trigger_actions: false,
                          max_files: 50,
                          ...(selectedModel && { ai_model: selectedModel }),
                          ...(selectedProvider && { ai_provider: selectedProvider })
                        }
                        console.log('Sending predictions review request to:', `/api/v1/review/repository/${id}`, requestData)
                        
                        const response = await apiClient.post(`/api/v1/review/repository/${id}`, requestData)
                        console.log('Predictions review response:', response.data)
                        
                        setToast({
                          message: 'Predictions generated successfully! Refreshing...',
                          type: 'success',
                          isVisible: true
                        })
                        
                        // Wait for backend to save prediction
                        await new Promise(resolve => setTimeout(resolve, 2000))
                        
                        // Reload details to get latest prediction
                        await loadRepositoryDetails()
                        
                        setToast({
                          message: 'Predictions updated!',
                          type: 'success',
                          isVisible: true
                        })
                      } catch (error: any) {
                        console.error('Failed to generate predictions:', error)
                        setToast({
                          message: `Failed to generate predictions: ${error.response?.data?.detail || error.message || 'Unknown error'}`,
                          type: 'error',
                          isVisible: true
                        })
                      } finally {
                        setAnalyzing(false)
                      }
                    }}
                    disabled={analyzing}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{analyzing ? 'Generating...' : 'Review Predictions'}</span>
                  </button>
                </div>
              </div>

              {predictions.length === 0 ? (
                <div className="bg-slate-700/50 rounded-lg p-8 border border-slate-600 text-center">
                  <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-4">No predictions yet</p>
                  <button
                    onClick={async () => {
                      if (!id) return
                      if (analyzing) return
                      try {
                        setAnalyzing(true)
                        setToast({
                          message: 'Generating predictions...',
                          type: 'info',
                          isVisible: true
                        })
                        
                        const requestData = {
                          generate_tests: false,
                          predict_regression: true,
                          trigger_actions: false,
                          max_files: 50,
                          ...(selectedModel && { ai_model: selectedModel }),
                          ...(selectedProvider && { ai_provider: selectedProvider })
                        }
                        
                        await apiClient.post(`/api/v1/review/repository/${id}`, requestData)
                        
                        await new Promise(resolve => setTimeout(resolve, 2000))
                        await loadRepositoryDetails()
                        
                        setToast({
                          message: 'Predictions generated!',
                          type: 'success',
                          isVisible: true
                        })
                      } catch (error: any) {
                        setToast({
                          message: `Failed: ${error.response?.data?.detail || error.message}`,
                          type: 'error',
                          isVisible: true
                        })
                      } finally {
                        setAnalyzing(false)
                      }
                    }}
                    disabled={analyzing}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {analyzing ? 'Generating...' : 'Generate Predictions'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Show only the latest prediction */}
                  {(() => {
                    // Sort predictions by created_at descending and get the latest
                    const sortedPredictions = [...predictions].sort((a: any, b: any) => {
                      const dateA = new Date(a.created_at).getTime()
                      const dateB = new Date(b.created_at).getTime()
                      return dateB - dateA
                    })
                    const latestPrediction = sortedPredictions[0]
                    
                    return (
                      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-600">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs px-2 py-1 bg-primary-600/20 text-primary-400 rounded">
                              Latest
                            </span>
                            <p className="text-xs text-slate-400">
                              {sortedPredictions.length > 1 && `+${sortedPredictions.length - 1} more`}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(latestPrediction.created_at).toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-300 mb-1">
                              {(() => {
                                if (!latestPrediction.file_path) return 'Repository-wide'
                                // Extract project name from path (last directory name)
                                const pathParts = latestPrediction.file_path.split(/[/\\]/)
                                return pathParts[pathParts.length - 1] || repository?.name || 'Repository'
                              })()}
                            </h3>
                            <p className="text-sm text-slate-400 capitalize">
                              {latestPrediction.prediction_type} Prediction
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-4xl font-bold mb-1 ${
                              latestPrediction.risk_score > 0.7
                                ? 'text-red-400'
                                : latestPrediction.risk_score > 0.4
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }`}>
                              {(latestPrediction.risk_score * 100).toFixed(1)}%
                            </div>
                            <p className="text-sm text-slate-400">Risk Score</p>
                            <p className={`text-xs mt-1 ${
                              latestPrediction.risk_score > 0.7
                                ? 'text-red-400'
                                : latestPrediction.risk_score > 0.4
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }`}>
                              {latestPrediction.risk_score > 0.7
                                ? 'Critical'
                                : latestPrediction.risk_score > 0.4
                                ? 'High'
                                : 'Low'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-slate-800/50 rounded-lg p-4">
                            <p className="text-xs text-slate-400 mb-1">Confidence</p>
                            <p className="text-2xl font-semibold text-slate-300">
                              {(latestPrediction.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-4">
                            <p className="text-xs text-slate-400 mb-1">Status</p>
                            <p className={`text-2xl font-semibold ${
                              latestPrediction.triggered ? 'text-yellow-400' : 'text-slate-400'
                            }`}>
                              {latestPrediction.triggered ? 'Triggered' : 'Pending'}
                            </p>
                          </div>
                        </div>
                        
                        {latestPrediction.predicted_issues && Array.isArray(latestPrediction.predicted_issues) && latestPrediction.predicted_issues.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-slate-600">
                            <p className="text-sm font-semibold text-slate-300 mb-3">Predicted Issues:</p>
                            <ul className="space-y-2">
                              {latestPrediction.predicted_issues.map((issue: string, idx: number) => (
                                <li key={idx} className="text-sm text-slate-300 flex items-start">
                                  <span className="text-primary-400 mr-2">•</span>
                                  <span>{issue}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  })()}
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

      {/* Test File Viewer Modal */}
      {viewingTestFile && (
        <FileViewerModal
          isOpen={true}
          fileName={viewingTestFile.name}
          fileContent={testFileContent}
          loading={loadingTestFileContent}
          onClose={() => {
            setViewingTestFile(null)
            setTestFileContent(null)
          }}
        />
      )}

      {/* Test Viewer Modal */}
      {viewingTest && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" 
          onClick={() => {
            console.log('Closing modal')
            setViewingTest(null)
          }}
          style={{ zIndex: 9999 }}
        >
          <div 
            className="bg-slate-800 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-slate-700" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Test Details</h3>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('Close button clicked')
                  setViewingTest(null)
                }}
                className="text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            {viewingTest.test_code || viewingTest.test_type || viewingTest.file_path ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Test Type</p>
                  <p className="text-white capitalize">{viewingTest.test_type || 'unit'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Coverage</p>
                  <p className={`text-white ${
                    (viewingTest.coverage_percentage || 0) < 50 ? 'text-red-400' :
                    (viewingTest.coverage_percentage || 0) < 80 ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {viewingTest.coverage_percentage?.toFixed(1) || 0}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Status</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    viewingTest.status === 'passed'
                      ? 'bg-green-500/20 text-green-400'
                      : viewingTest.status === 'failed'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {viewingTest.status || 'generated'}
                  </span>
                </div>
                {viewingTest.file_path && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">File Path</p>
                    <p className="text-white text-sm font-mono">{viewingTest.file_path}</p>
                  </div>
                )}
                {viewingTest.test_code ? (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Test Code</p>
                    <pre className="p-4 bg-slate-900 rounded text-sm overflow-x-auto text-slate-300 font-mono whitespace-pre-wrap">
                      {viewingTest.test_code}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-900/50 rounded border border-slate-700">
                    <p className="text-slate-400 text-sm">No test code available for this test.</p>
                    {viewingTest.file_path && (
                      <p className="text-slate-500 text-xs mt-2">File: {viewingTest.file_path}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center">
                <TestTube className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No test details available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
