import { siteConfig } from '../config/site'
import type {
  Article,
  ArticleInput,
  Category,
  CategoryInput,
  Paginated,
  Project,
  ProjectInput,
  Status,
  Tag,
  TagInput,
} from '../types/admin'

// 后端统一响应信封；成功 code===0，失败 data 为 null（DELETE 成功时 data 也是 null）。
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T | null
}

export class AdminApiError extends Error {
  status: number
  code: number

  constructor(message: string, status: number, code: number) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
  }
}

// 后端鉴权失败统一是 HTTP 401 + code 1001（登录失败同码）。
export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 1001)
}

const TOKEN_KEY = 'abing_access_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('abing_access_token_expires_at')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${siteConfig.apiBaseUrl}${path}`, { ...init, headers })
  let payload: ApiEnvelope<T>
  try {
    payload = await response.json() as ApiEnvelope<T>
  } catch {
    throw new AdminApiError(`API request failed: ${response.status}`, response.status, -1)
  }
  if (!response.ok || payload.code !== 0) {
    throw new AdminApiError(payload.message || `API request failed: ${response.status}`, response.status, payload.code)
  }
  return payload.data as T
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) }
}

export const adminApi = {
  // 文章
  listArticles(page = 1, pageSize = 50, status?: Status): Promise<Paginated<Article>> {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (status) query.set('status', status)
    return request(`/admin/articles?${query}`)
  },
  getArticle(id: number): Promise<Article> {
    return request(`/admin/articles/${id}`)
  },
  createArticle(input: ArticleInput): Promise<Article> {
    return request('/admin/articles', jsonBody(input))
  },
  updateArticle(id: number, input: ArticleInput): Promise<Article> {
    return request(`/admin/articles/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  deleteArticle(id: number): Promise<void> {
    return request(`/admin/articles/${id}`, { method: 'DELETE' })
  },
  updateArticleStatus(id: number, status: Status): Promise<Article> {
    return request(`/admin/articles/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) })
  },

  // 分类（列表是裸数组，不分页；后端没有 admin GET，走公共路由）
  listCategories(): Promise<Category[]> {
    return request('/categories')
  },
  createCategory(input: CategoryInput): Promise<Category> {
    return request('/admin/categories', jsonBody(input))
  },
  updateCategory(id: number, input: CategoryInput): Promise<Category> {
    return request(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  deleteCategory(id: number): Promise<void> {
    return request(`/admin/categories/${id}`, { method: 'DELETE' })
  },

  // 标签（列表是裸数组，不分页；后端没有 admin GET，走公共路由）
  listTags(): Promise<Tag[]> {
    return request('/tags')
  },
  createTag(input: TagInput): Promise<Tag> {
    return request('/admin/tags', jsonBody(input))
  },
  updateTag(id: number, input: TagInput): Promise<Tag> {
    return request(`/admin/tags/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  deleteTag(id: number): Promise<void> {
    return request(`/admin/tags/${id}`, { method: 'DELETE' })
  },

  // 项目
  listProjects(page = 1, pageSize = 50, status?: Status): Promise<Paginated<Project>> {
    const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (status) query.set('status', status)
    return request(`/admin/projects?${query}`)
  },
  createProject(input: ProjectInput): Promise<Project> {
    return request('/admin/projects', jsonBody(input))
  },
  updateProject(id: number, input: ProjectInput): Promise<Project> {
    return request(`/admin/projects/${id}`, { method: 'PUT', body: JSON.stringify(input) })
  },
  deleteProject(id: number): Promise<void> {
    return request(`/admin/projects/${id}`, { method: 'DELETE' })
  },
}
