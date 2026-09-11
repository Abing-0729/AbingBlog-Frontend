import type { PostSummary, ProjectSummary } from '../types/content'

export const mockPosts: PostSummary[] = [
  { slug: 'readable-blog-system', date: '2026.09.06', title: '把个人博客做成一个可阅读的系统', tag: 'DESIGN' },
  { slug: 'async-systems-from-queues', date: '2026.08.21', title: '从消息队列开始理解异步系统', tag: 'ENGINEERING' },
  { slug: 'vue-component-boundaries', date: '2026.08.03', title: '我的 Vue 组件边界准则', tag: 'FRONTEND' },
  { slug: 'docker-compose-foundation', date: '2026.07.16', title: 'Docker Compose: 本地开发的基础设施', tag: 'DEVOPS' },
]

export const mockProjects: ProjectSummary[] = [
  { slug: 'abingblog', name: 'ABINGBLOG', detail: 'A full-stack blog system with a terminal-first interface.', stack: 'GO · VUE · MYSQL' },
  { slug: 'queue-lab', name: 'QUEUE LAB', detail: 'Visual notes and experiments around message-driven services.', stack: 'GO · REDIS · RABBITMQ' },
  { slug: 'tiny-state', name: 'TINY STATE', detail: 'A minimal state machine for deliberate UI transitions.', stack: 'TYPESCRIPT' },
]
