<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi, AdminApiError, isAuthError } from '../services/admin'
import type { Category } from '../types/admin'

const emit = defineEmits<{ authExpired: [] }>()

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const editingName = ref('')
const editingSlug = ref('')
const editingSort = ref(0)
const confirmDelete = ref<Category | null>(null)

async function load() {
  error.value = ''
  try {
    categories.value = await adminApi.listCategories()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formOpen.value = true
  editingId.value = null
  editingName.value = ''
  editingSlug.value = ''
  editingSort.value = 0
  error.value = ''
}

function openEdit(category: Category) {
  formOpen.value = true
  editingId.value = category.id
  editingName.value = category.name
  editingSlug.value = category.slug
  editingSort.value = category.sort
  error.value = ''
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

async function save() {
  if (!editingName.value.trim() || saving.value) return
  saving.value = true
  error.value = ''
  const input = {
    name: editingName.value.trim(),
    slug: editingSlug.value.trim(),
    sort: editingSort.value,
  }
  try {
    if (editingId.value === null) await adminApi.createCategory(input)
    else await adminApi.updateCategory(editingId.value, input)
    closeForm()
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
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
    await adminApi.deleteCategory(target.id)
    confirmDelete.value = null
    await load()
  } catch (e) {
    // 1003（分类下存在文章）等业务拒绝会带后端 message，直接展示
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '删除失败'
    confirmDelete.value = null
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-panel">
    <div class="view-title"><p class="eyebrow">后台 / 分类</p><h2>分类</h2><span>共 {{ categories.length }} 个</span></div>

    <div class="admin-panel-head">
      <span>管理分类</span>
      <button class="new-btn" type="button" @click="openCreate">+ 新建分类</button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-empty">加载中…</p>
    <p v-else-if="!categories.length" class="admin-empty">暂无分类</p>

    <form v-if="formOpen" class="admin-form" @submit.prevent="save">
      <h3>{{ editingId === null ? '新建分类' : '编辑分类' }}</h3>
      <div class="admin-form-grid">
        <label>名称<input v-model="editingName" required placeholder="分类名称" /></label>
        <label>排序<input v-model.number="editingSort" type="number" min="0" step="1" /></label>
        <label class="full">别名（slug）<input v-model="editingSlug" placeholder="URL 别名（可选）" /></label>
      </div>
      <div class="admin-form-actions">
        <button class="admin-submit" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="cancel-btn" type="button" @click="closeForm">取消</button>
      </div>
    </form>

    <div v-for="category in categories" :key="category.id">
      <div class="admin-row">
        <div class="admin-row-title"><h3>{{ category.name }}</h3><p>/{{ category.slug }} · 排序 {{ category.sort }}</p></div>
        <div class="admin-row-meta"><span>{{ category.article_count }} 篇文章</span><div class="admin-actions"><button type="button" @click="openEdit(category)">编辑</button><button class="danger" type="button" @click="confirmDelete = category">删除</button></div></div>
      </div>
      <div v-if="confirmDelete?.id === category.id" class="confirm-bar" role="alert"><span>确定删除分类 <b>「{{ category.name }}」</b>？</span><button type="button" :disabled="saving" @click="remove">确认删除</button><button class="keep" type="button" @click="confirmDelete = null">取消</button></div>
    </div>
  </section>
</template>
