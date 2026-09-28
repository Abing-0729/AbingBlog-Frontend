<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { adminApi, AdminApiError, isAuthError } from '../services/admin'
import type { FriendLink, FriendStatus } from '../types/content'

const emit = defineEmits<{ authExpired: [] }>()

const links = ref<FriendLink[]>([])
const statusFilter = ref<FriendStatus | 'all'>('all')
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const formOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
  name: '', avatar: '', url: '', description: '', sort: 0, status: 0 as FriendStatus,
})
const confirmDelete = ref<FriendLink | null>(null)

// 状态文案与徽章类名（friend-status-0/1/2 与前台一致）
const STATUS_TEXT: Record<FriendStatus, string> = { 0: '待审核', 1: '已上架', 2: '已驳回' }

// 待审核数（角标提示）
const pendingCount = computed(() => links.value.filter((link) => link.status === 0).length)

async function load() {
  error.value = ''
  loading.value = true
  try {
    links.value = await adminApi.listFriendLinks(
      statusFilter.value === 'all' ? undefined : statusFilter.value,
    )
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

watch(statusFilter, load)

function openEdit(link: FriendLink) {
  formOpen.value = true
  editingId.value = link.id
  form.value = {
    name: link.name, avatar: link.avatar, url: link.url,
    description: link.description, sort: link.sort, status: link.status,
  }
  error.value = ''
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

async function save() {
  if (!form.value.name.trim() || !form.value.url.trim() || saving.value) return
  saving.value = true
  error.value = ''
  const input = {
    name: form.value.name.trim(), avatar: form.value.avatar.trim(), url: form.value.url.trim(),
    description: form.value.description.trim(), sort: form.value.sort, status: form.value.status,
  }
  try {
    if (editingId.value === null) throw new Error('友链由访客提交，后台仅审核与编辑')
    await adminApi.updateFriendLink(editingId.value, input)
    closeForm()
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

// 审核动作：PUT 全量字段 + 目标 status（0 待审核 → 1 上架 / 2 驳回）
async function review(link: FriendLink, status: FriendStatus) {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await adminApi.updateFriendLink(link.id, {
      name: link.name, avatar: link.avatar, url: link.url,
      description: link.description, sort: link.sort, status,
    })
    await load()
  } catch (e) {
    if (isAuthError(e)) return emit('authExpired')
    error.value = e instanceof AdminApiError ? e.message : '审核操作失败'
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
    await adminApi.deleteFriendLink(target.id)
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

onMounted(load)
</script>

<template>
  <section class="admin-panel">
    <div class="view-title"><p class="eyebrow">后台 / 友链</p><h2>友链审核</h2><span>共 {{ links.length }} 条{{ pendingCount ? ` · 待审 ${pendingCount}` : '' }}</span></div>

    <div class="admin-panel-head">
      <div class="filter-seg" role="group" aria-label="状态筛选">
        <button v-for="option in (['all', 0, 1, 2] as const)" :key="option" :class="{ active: statusFilter === option }" type="button" @click="statusFilter = option">{{ option === 'all' ? '全部' : STATUS_TEXT[option] }}</button>
      </div>
    </div>

    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <p v-else-if="loading" class="admin-empty">加载中…</p>
    <p v-else-if="!links.length" class="admin-empty">暂无友链提交</p>

    <form v-if="formOpen" class="admin-form" @submit.prevent="save">
      <h3>编辑友链</h3>
      <div class="admin-form-grid">
        <label>站点名称<input v-model="form.name" required maxlength="64" /></label>
        <label>站点地址<input v-model="form.url" required maxlength="500" type="url" /></label>
        <label>头像地址<input v-model="form.avatar" maxlength="500" type="url" placeholder="可选" /></label>
        <label>排序<input v-model.number="form.sort" type="number" min="0" step="1" /></label>
        <label class="full">一句话简介<input v-model="form.description" maxlength="255" placeholder="可选" /></label>
        <div class="full">
          <span class="eyebrow">审核状态</span>
          <div class="status-choice" style="margin-top: 7px;">
            <label><input v-model="form.status" type="radio" :value="0" />待审核</label>
            <label><input v-model="form.status" type="radio" :value="1" />已上架</label>
            <label><input v-model="form.status" type="radio" :value="2" />已驳回</label>
          </div>
        </div>
      </div>
      <div class="admin-form-actions">
        <button class="admin-submit" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="cancel-btn" type="button" @click="closeForm">取消</button>
      </div>
    </form>

    <div v-for="link in links" :key="link.id">
      <div class="admin-row">
        <div class="admin-row-title">
          <h3>{{ link.name }}</h3>
          <p>{{ link.url }} · 排序 {{ link.sort }} · 提交于 {{ link.created_at.slice(0, 10) }}</p>
        </div>
        <div class="admin-row-meta">
          <span :class="['friend-status', `friend-status-${link.status}`]">{{ STATUS_TEXT[link.status] }}</span>
          <a v-if="link.url" :href="link.url" target="_blank" rel="noopener noreferrer">访问 ↗</a>
          <div class="admin-actions">
            <button v-if="link.status !== 1" type="button" :disabled="saving" @click="review(link, 1)">通过上架</button>
            <button v-if="link.status !== 2" class="danger" type="button" :disabled="saving" @click="review(link, 2)">驳回</button>
            <button type="button" @click="openEdit(link)">编辑</button>
            <button class="danger" type="button" @click="confirmDelete = link">删除</button>
          </div>
        </div>
      </div>
      <div v-if="confirmDelete?.id === link.id" class="confirm-bar" role="alert"><span>确定删除友链 <b>「{{ link.name }}」</b>？</span><button type="button" :disabled="saving" @click="remove">确认删除</button><button class="keep" type="button" @click="confirmDelete = null">取消</button></div>
    </div>
  </section>
</template>
