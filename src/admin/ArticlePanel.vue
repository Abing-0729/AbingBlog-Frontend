<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { adminApi, AdminApiError, isAuthError } from '../services/admin'
import type { Article, Category, Status, Tag } from '../types/admin'

const emit = defineEmits<{ authExpired: [] }>()

const PAGE_SIZE = 50

const articles = ref<Article[]>([])
const page = ref(1)
const total = ref(0)
const statusFilter = ref<Status | 'all'>('all')
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  title: '', content: '', summary: '', cover: '',
  category_id: 0, tag_ids: [] as number[], status: 'draft' as Status,
})
const confirmDelete = ref<Article | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10).replaceAll('-', '.') : '—'
}

async function load() {
  error.value = ''
  loading.value = true
  try {
    const data = await adminApi.listArticles(page.value, PAGE_SIZE, statusFilter.value === 'all' ? undefined : statusFilter.value)
    articles.value = data.list
    total.value = data.total
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch(statusFilter, () => { page.value = 1; load() })

function openCreate() {
  formOpen.value = true
  editingId.value = null
  form.value = { title: '', content: '', summary: '', cover: '', category_id: 0, tag_ids: [], status: 'draft' }
  error.value = ''
}

async function openEdit(article: Article) {
  error.value = ''
  try {
    // 列表项不含 content，编辑前取全量
    const full = await adminApi.getArticle(article.id)
    formOpen.value = true
    editingId.value = article.id
    form.value = {
      title: full.title, content: full.content ?? '', summary: full.summary, cover: full.cover,
      category_id: full.category?.id ?? 0, tag_ids: full.tags.map((tag) => tag.id), status: full.status,
    }
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '加载文章失败'
  }
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

async function save() {
  if (!form.value.title.trim() || saving.value) return
  saving.value = true
  error.value = ''
  const input = {
    title: form.value.title.trim(), content: form.value.content,
    summary: form.value.summary.trim(), cover: form.value.cover.trim(),
    category_id: form.value.category_id, tag_ids: form.value.tag_ids, status: form.value.status,
  }
  try {
    if (editingId.value === null) await adminApi.createArticle(input)
    else await adminApi.updateArticle(editingId.value, input)
    closeForm()
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    // 1006 标题空 / 1007 状态非法 / 1004 分类不存在等，直接展示 message
    error.value = e instanceof AdminApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function toggleStatus(article: Article) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await adminApi.updateArticleStatus(article.id, article.status === 'published' ? 'draft' : 'published')
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '操作失败'
  } finally {
    saving.value = false
  }
}

async function remove() {
  const target = confirmDelete.value
  if (!target || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await adminApi.deleteArticle(target.id)
    confirmDelete.value = null
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '删除失败'
    confirmDelete.value = null
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  // 表单用：分类/标签列表（失败不阻塞文章列表）
  try {
    const [categoryList, tagList] = await Promise.all([adminApi.listCategories(), adminApi.listTags()])
    categories.value = categoryList
    tags.value = tagList
  } catch (e) {
    if (isAuthError(e)) emit('authExpired')
  }
})
</script>

<template>
  <section class="admin-panel">
    <div class="view-title"><p class="eyebrow">后台 / 文章</p><h2>文章</h2><span>共 {{ total }} 篇</span></div>

    <div class="admin-panel-head">
      <div class="filter-seg" role="group" aria-label="状态筛选">
        <button v-for="option in (['all', 'draft', 'published'] as const)" :key="option" :class="{ active: statusFilter === option }" type="button" @click="statusFilter = option">{{ option === 'all' ? '全部' : option === 'draft' ? '草稿' : '已发布' }}</button>
      </div>
      <button class="new-btn" type="button" @click="openCreate">+ 新建文章</button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-empty">加载中…</p>
    <p v-else-if="!articles.length" class="admin-empty">暂无文章</p>

    <form v-if="formOpen" class="admin-form" @submit.prevent="save">
      <h3>{{ editingId === null ? '新建文章' : '编辑文章' }}</h3>
      <label>标题<input v-model="form.title" required placeholder="文章标题" /></label>
      <label>正文（Markdown）<textarea v-model="form.content" placeholder="# 标题&#10;&#10;Markdown 正文…"></textarea></label>
      <label>摘要<textarea v-model="form.summary" class="short" placeholder="一段话摘要"></textarea></label>
      <div class="admin-form-grid">
        <label>封面链接<input v-model="form.cover" placeholder="https://…（可选）" /></label>
        <label>分类<select v-model.number="form.category_id"><option :value="0">— 未分类 —</option><option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label>
        <div class="full">
          <span class="eyebrow">标签</span>
          <div class="tag-checks" style="margin-top: 7px;">
            <label v-for="tag in tags" :key="tag.id"><input v-model="form.tag_ids" type="checkbox" :value="tag.id" />{{ tag.name }}</label>
            <span v-if="!tags.length" class="admin-empty">暂无标签</span>
          </div>
        </div>
        <div class="full">
          <span class="eyebrow">状态</span>
          <div class="status-choice" style="margin-top: 7px;">
            <label><input v-model="form.status" type="radio" value="draft" />草稿</label>
            <label><input v-model="form.status" type="radio" value="published" />已发布</label>
          </div>
        </div>
      </div>
      <div class="admin-form-actions">
        <button class="admin-submit" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="cancel-btn" type="button" @click="closeForm">取消</button>
      </div>
    </form>

    <div v-for="article in articles" :key="article.id">
      <div class="admin-row">
        <div class="admin-row-title">
          <h3>{{ article.title }}</h3>
          <p>#{{ article.id }} · {{ formatDate(article.published_at) }} · {{ article.category?.name ?? '未分类' }}{{ article.tags.length ? ' · ' + article.tags.map((tag) => tag.name).join('、') : '' }} · {{ article.view_count }} 次浏览</p>
        </div>
        <div class="admin-row-meta">
          <span :class="['status-badge', article.status]">{{ article.status === 'published' ? '已发布' : '草稿' }}</span>
          <div class="admin-actions">
            <button type="button" :disabled="saving" @click="toggleStatus(article)">{{ article.status === 'published' ? '撤回' : '发布' }}</button>
            <button type="button" @click="openEdit(article)">编辑</button>
            <button class="danger" type="button" @click="confirmDelete = article">删除</button>
          </div>
        </div>
      </div>
      <div v-if="confirmDelete?.id === article.id" class="confirm-bar" role="alert"><span>确定删除文章 <b>「{{ article.title }}」</b>？</span><button type="button" :disabled="saving" @click="remove">确认删除</button><button class="keep" type="button" @click="confirmDelete = null">取消</button></div>
    </div>

    <div v-if="totalPages > 1" class="page-controls">
      <button type="button" :disabled="page <= 1" @click="page -= 1; load()">← 上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button type="button" :disabled="page >= totalPages" @click="page += 1; load()">下一页 →</button>
    </div>
  </section>
</template>
