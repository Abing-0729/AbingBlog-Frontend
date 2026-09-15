export type Status = 'draft' | 'published'

export interface Paginated<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface Category {
  id: number
  name: string
  slug: string
  sort: number
  article_count: number
}

export interface CategoryInput {
  name: string
  slug: string
  sort: number
}

export interface Tag {
  id: number
  name: string
  article_count: number
}

export interface TagInput {
  name: string
}

export interface Article {
  id: number
  title: string
  summary: string
  cover: string
  content?: string
  category: { id: number; name: string; slug: string } | null
  tags: { id: number; name: string }[]
  status: Status
  view_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface ArticleInput {
  title: string
  content: string
  summary: string
  cover: string
  category_id: number
  tag_ids: number[]
  status: Status
}

export interface Project {
  id: number
  slug: string
  name: string
  detail: string
  stack: string
  github_url: string
  demo_url: string
  sort: number
  status: Status
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  slug: string
  name: string
  detail: string
  stack: string
  github_url: string
  demo_url: string
  sort: number
  status: Status
}
