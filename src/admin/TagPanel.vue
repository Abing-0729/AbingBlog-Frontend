<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { adminApi, AdminApiError, isAuthError } from '../services/admin'
import type { Tag } from '../types/admin'

const emit = defineEmits<{ authExpired: [] }>()

const tags = ref<Tag[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

// 表单态：formOpen 控制显隐；editingId 为 null = 新建，有 id = 编辑
const formOpen = ref(false)
const editingId = ref<number | null>(null)
const editingName = ref('')
const confirmDelete = ref<Tag | null>(null)

async function load() {
  error.value = ''
  try {
    tags.value = await adminApi.listTags()
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
  error.value = ''
}

function openEdit(tag: Tag) {
  formOpen.value = true
  editingId.value = tag.id
  editingName.value = tag.name
  error.value = ''
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
  editingName.value = ''
}

async function save() {
  if (!editingName.value.trim() || saving.value) return
  saving.value = true
  error.value = ''
  try {
    if (editingId.value === null) await adminApi.createTag({ name: editingName.value.trim() })
    else await adminApi.updateTag(editingId.value, { name: editingName.value.trim() })
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
    await adminApi.deleteTag(target.id)
    confirmDelete.value = null
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '删除失败'
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-panel">
    <div class="view-title"><p class="eyebrow">后台 / 标签</p><h2>标签</h2><span>共 {{ tags.length }} 个</span></div>

    <div class="admin-panel-head">
      <span>管理标签</span>
      <button class="new-btn" type="button" @click="openCreate">+ 新建标签</button>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-empty">加载中…</p>
    <p v-else-if="!tags.length" class="admin-empty">暂无标签</p>

    <form v-if="formOpen" class="admin-form" @submit.prevent="save">
      <h3>{{ editingId === null ? '新建标签' : '编辑标签' }}</h3>
      <label>名称<input v-model="editingName" required placeholder="标签名称" /></label>
      <div class="admin-form-actions">
        <button class="admin-submit" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="cancel-btn" type="button" @click="closeForm">取消</button>
      </div>
    </form>

    <div v-for="tag in tags" :key="tag.id">
      <div class="admin-row">
        <div class="admin-row-title"><h3>{{ tag.name }}</h3></div>
        <div class="admin-row-meta"><span>{{ tag.article_count }} 篇文章</span><div class="admin-actions"><button type="button" @click="openEdit(tag)">编辑</button><button class="danger" type="button" @click="confirmDelete = tag">删除</button></div></div>
      </div>
      <div v-if="confirmDelete?.id === tag.id" class="confirm-bar" role="alert"><span>确定删除标签 <b>「{{ tag.name }}」</b>？关联会被一并移除。</span><button type="button" :disabled="saving" @click="remove">确认删除</button><button class="keep" type="button" @click="confirmDelete = null">取消</button></div>
    </div>
  </section>
</template>
