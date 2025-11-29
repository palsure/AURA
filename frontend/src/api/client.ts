import axios from 'axios'

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface AnalyzeRequest {
  code: string
  language?: string
  file_path?: string
}

export interface AnalyzeResponse {
  analysis_id: number
  quality_score: number
  total_issues: number
  issues: Issue[]
  issues_by_type: Record<string, number>
  issues_by_severity: Record<string, number>
}

export interface Issue {
  issue_type: string
  severity: string
  line_number: number
  message: string
  suggestion: string
  code_snippet?: string
}

export interface DashboardStats {
  total_analyses: number
  total_issues: number
  fixed_issues: number
  open_issues: number
  average_quality_score: number
  issues_by_type: Record<string, number>
  issues_by_severity: Record<string, number>
  recent_analyses: number
  total_repositories: number
}

export const analyzeCode = async (request: AnalyzeRequest): Promise<AnalyzeResponse> => {
  const response = await apiClient.post<AnalyzeResponse>('/api/v1/analyze/', request)
  return response.data
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await apiClient.get<DashboardStats>('/api/v1/dashboard/stats')
  return response.data
}

export const getQualityTrends = async (days: number = 30) => {
  const response = await apiClient.get(`/api/v1/dashboard/trends?days=${days}`)
  return response.data
}

export const getIssues = async (params?: {
  analysis_id?: number
  severity?: string
  issue_type?: string
  fixed?: boolean
}) => {
  const response = await apiClient.get('/api/v1/issues/', { params })
  return response.data
}

export const markIssueFixed = async (issueId: number) => {
  const response = await apiClient.patch(`/api/v1/issues/${issueId}/fix`)
  return response.data
}

export const getRepositories = async () => {
  const response = await apiClient.get('/api/v1/repositories/')
  return response.data
}

export const createRepository = async (name: string, path: string, language?: string) => {
  const response = await apiClient.post('/api/v1/repositories/', {
    name,
    path,
    language,
  })
  return response.data
}

export const deleteRepository = async (repoId: number) => {
  const response = await apiClient.delete(`/api/v1/repositories/${repoId}`)
  return response.data
}

export const listRepositoryFiles = async (repoId: number, extension?: string) => {
  const response = await apiClient.get(`/api/v1/repositories/${repoId}/files`, {
    params: { extension }
  })
  return response.data
}

export const getFileContent = async (repoId: number, filePath: string) => {
  const response = await apiClient.get(`/api/v1/repositories/${repoId}/file-content`, {
    params: { file_path: filePath }
  })
  return response.data
}

export const refreshRepositoryFiles = async (repoId: number) => {
  const response = await apiClient.post(`/api/v1/repositories/${repoId}/refresh`)
  return response.data
}

// AURA-specific endpoints
export const unifiedReview = async (data: {
  code: string
  language?: string
  file_path?: string
  repository_id?: number
  generate_tests?: boolean
  predict_regression?: boolean
  trigger_actions?: boolean
  ai_model?: string
  ai_provider?: string
}) => {
  const response = await apiClient.post('/api/v1/review/', data)
  return response.data
}

export const generateTests = async (data: {
  code: string
  language?: string
  test_type?: string
  function_name?: string
  ai_model?: string
  ai_provider?: string
  repository_id?: number
  file_path?: string
}) => {
  const response = await apiClient.post('/api/v1/tests/generate', data)
  return response.data
}

export const predictRegression = async (data: {
  code: string
  file_path: string
  repository_id?: number
  change_history?: any[]
  previous_issues?: any[]
  test_coverage?: number
}) => {
  const response = await apiClient.post('/api/v1/predict/regression', data)
  return response.data
}

export const getActions = async () => {
  const response = await apiClient.get('/api/v1/actions/')
  return response.data
}

// GitHub Integration
export const connectGitHubRepository = async (data: {
  github_url: string
  name?: string
  language?: string
  github_token?: string
}) => {
  const response = await apiClient.post('/api/v1/github/connect', data)
  return response.data
}

export const validateGitHubUrl = async (github_url: string, github_token?: string) => {
  const response = await apiClient.post('/api/v1/github/validate', null, {
    params: { github_url, github_token: github_token || '' }
  })
  return response.data
}

export const listGitHubRepositoryFiles = async (repository_id: number, extension?: string) => {
  const response = await apiClient.get(`/api/v1/github/${repository_id}/files`, {
    params: { extension }
  })
  return response.data
}

export const fetchFileContent = async (data: {
  repository_id: number
  file_path: string
  branch?: string
}) => {
  const response = await apiClient.post('/api/v1/github/fetch-file', data)
  return response.data
}

// AI Model Selection
export interface ModelInfo {
  id: string
  name: string
  provider: string
  description: string
  capabilities: string[]
  context_window: string
  speed: string
  quality: string
}

export const getAvailableModels = async (): Promise<ModelInfo[]> => {
  const response = await apiClient.get<ModelInfo[]>('/api/v1/models/available')
  return response.data
}

export const getCurrentModel = async () => {
  const response = await apiClient.get('/api/v1/models/current')
  return response.data
}

export interface AIStatus {
  openai_available: boolean
  anthropic_available: boolean
  openai_model: string
  anthropic_model: string
  preferred_provider: string
}

export const getAIStatus = async (): Promise<AIStatus> => {
  const response = await apiClient.get<AIStatus>('/api/v1/models/current')
  return response.data
}

export const selectModel = async (data: {
  provider: string
  model: string
  use_for?: string
}) => {
  const response = await apiClient.post('/api/v1/models/select', data)
  return response.data
}

