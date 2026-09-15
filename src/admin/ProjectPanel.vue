<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { adminApi, AdminApiError, isAuthError } from '../services/admin'
import type { Project, Status } from '../types/admin'

const emit = defineEmits<{ authExpired: [] }>()

const PAGE_SIZE = 50

const projects = ref<Project[]>([])
const page = ref(1)
const total = ref(0)
const statusFilter = ref<Status | 'all'>('all')
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  slug: '', name: '', detail: '', stack: '',
  github_url: '', demo_url: '', sort: 0, status: 'draft' as Status,
})
const confirmDelete = ref<Project | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

async function load() {
  error.value = ''
  loading.value = true
  try {
    const data = await adminApi.listProjects(page.value, PAGE_SIZE, statusFilter.value === 'all' ? undefined : statusFilter.value)
    projects.value = data.list
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
  form.value = { slug: '', name: '', detail: '', stack: '', github_url: '', demo_url: '', sort: 0, status: 'draft' }
  error.value = ''
}

function openEdit(project: Project) {
  formOpen.value = true
  editingId.value = project.id
  form.value = {
    slug: project.slug, name: project.name, detail: project.detail, stack: project.stack,
    github_url: project.github_url, demo_url: project.demo_url, sort: project.sort, status: project.status,
  }
  error.value = ''
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

async function save() {
  if (!form.value.slug.trim() || !form.value.name.trim() || saving.value) return
  saving.value = true
  error.value = ''
  const input = {
    slug: form.value.slug.trim(), name: form.value.name.trim(),
    detail: form.value.detail.trim(), stack: form.value.stack.trim(),
    github_url: form.value.github_url.trim(), demo_url: form.value.demo_url.trim(),
    sort: form.value.sort, status: form.value.status,
  }
  try {
    if (editingId.value === null) await adminApi.createProject(input)
    else await adminApi.updateProject(editingId.value, input)
    closeForm()
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    // 1011 slug 空 / 1012 slug 已存在 / 1010 不存在（HTTP 400）都直接展示 message
    error.value = e instanceof AdminApiError ? e.message : '保存失败'
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
    await adminApi.deleteProject(target.id)
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

// 项目没有独立 status 接口，发布/撤回走全量更新
async function toggleStatus(project: Project) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await adminApi.updateProject(project.id, {
      slug: project.slug, name: project.name, detail: project.detail, stack: project.stack,
      github_url: project.github_url, demo_url: project.demo_url, sort: project.sort,
      status: project.status === 'published' ? 'draft' : 'published',
    })
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '操作失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-panel">
    <div class="view-title"><p class="eyebrow">后台 / 项目</p><h2>项目</h2><span>共 {{ total }} 个</span></div>

    <div class="admin-panel-head">
      <div class="filter-seg" role="group" aria-label="状态筛选">
        <button v-for="option in (['all', 'draft', 'published'] as const)" :key="option" :class="{ active: statusFilter === option }" type="button" @click="statusFilter = option">{{ option === 'all' ? '全部' : option === 'draft' ? '草稿' : '已发布' }}</button>
      </div>
      <button class="new-btn" type="button" @click="openCreate">+ 新建项目</button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-empty">加载中…</p>
    <p v-else-if="!projects.length" class="admin-empty">暂无项目</p>

    <form v-if="formOpen" class="admin-form" @submit.prevent="save">
      <h3>{{ editingId === null ? '新建项目' : '编辑项目' }}</h3>
      <div class="admin-form-grid">
        <label>名称<input v-model="form.name" required placeholder="项目名称" /></label>
        <label>别名（slug）<input v-model="form.slug" required placeholder="URL 别名" /></label>
        <label class="full">简介<textarea v-model="form.detail" class="short" placeholder="一句话描述"></textarea></label>
        <label>技术栈<input v-model="form.stack" placeholder="GO · VUE · MYSQL" /></label>
        <label>排序<input v-model.number="form.sort" type="number" min="0" step="1" /></label>
        <label>GitHub 链接<input v-model="form.github_url" placeholder="https://github.com/..." /></label>
        <label>演示链接<input v-model="form.demo_url" placeholder="https://demo..." /></label>
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

    <div v-for="project in projects" :key="project.id">
      <div class="admin-row">
        <div class="admin-row-title">
          <h3>{{ project.name }}</h3>
          <p>/{{ project.slug }} · {{ project.stack || '未填技术栈' }} · 排序 {{ project.sort }}</p>
        </div>
        <div class="admin-row-meta">
          <span :class="['status-badge', project.status]">{{ project.status === 'published' ? '已发布' : '草稿' }}</span>
          <span v-if="project.github_url">GitHub ↗</span>
          <span v-if="project.demo_url">演示 ↗</span>
          <div class="admin-actions">
            <button type="button" :disabled="saving" @click="toggleStatus(project)">{{ project.status === 'published' ? '撤回' : '发布' }}</button>
            <button type="button" @click="openEdit(project)">编辑</button>
            <button class="danger" type="button" @click="confirmDelete = project">删除</button>
          </div>
        </div>
      </div>
      <div v-if="confirmDelete?.id === project.id" class="confirm-bar" role="alert"><span>确定删除项目 <b>「{{ project.name }}」</b>？</span><button type="button" :disabled="saving" @click="remove">确认删除</button><button class="keep" type="button" @click="confirmDelete = null">取消</button></div>
    </div>

    <div v-if="totalPages > 1" class="page-controls">
      <button type="button" :disabled="page <= 1" @click="page -= 1; load()">← 上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button type="button" :disabled="page >= totalPages" @click="page += 1; load()">下一页 →</button>
    </div>
  </section>
</template>
