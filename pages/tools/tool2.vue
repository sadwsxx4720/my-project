<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()

// 從 query 抓取 id
const keyId = route.query.id as string

// 模擬的金鑰清單（要和 tool1 一致）
const keys = [
  { id: 'k1', name: 'API Key 1', status: '有效', expire: '2025-12-01', createdAt: '2024-10-01', description: '這是第一個金鑰，用於服務 A' },
  { id: 'k2', name: 'API Key 2', status: '即將到期', expire: '2025-10-15', createdAt: '2024-09-01', description: '這是第二個金鑰，用於服務 B' },
  { id: 'k3', name: 'API Key 3', status: '已停用', expire: '2024-05-01', createdAt: '2023-12-01', description: '這是第三個金鑰，已停用' }
]

// 找出對應的金鑰資料
const keyDetail = ref(keys.find(k => k.id === keyId))

const handleDisable = () => {
  ElMessage.success(`金鑰 ${keyId} 已停用`)
}

const handleDelete = () => {
  ElMessage.success(`金鑰 ${keyId} 已刪除`)
}
</script>

<template>
  <div class="key-detail-page">
    <el-card>
      <template #header>
        <span>金鑰詳細資訊</span>
      </template>

      <div v-if="keyDetail">
        <el-descriptions border :column="1">
          <el-descriptions-item label="ID">{{ keyDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="名稱">{{ keyDetail.name }}</el-descriptions-item>
          <el-descriptions-item label="狀態">{{ keyDetail.status }}</el-descriptions-item>
          <el-descriptions-item label="到期日">{{ keyDetail.expire }}</el-descriptions-item>
          <el-descriptions-item label="建立時間">{{ keyDetail.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ keyDetail.description }}</el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 20px">
          <el-button type="warning" @click="handleDisable">停用</el-button>
          <el-button type="danger" @click="handleDelete">刪除</el-button>
          <el-button @click="router.push('/tools/tool1')">返回列表</el-button>
        </div>
      </div>

      <div v-else>
        <p>找不到金鑰 (ID: {{ keyId }})</p>
        <el-button @click="router.push('/tools/tool1')">返回列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.key-detail-page {
  padding: 20px;
}
</style>
