<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  layout: 'default'
})

// 模擬金鑰資料
const search = ref('')
const keys = ref([
  { id: 'k1', name: 'API Key 1', status: '有效', expire: '2025-12-01' },
  { id: 'k2', name: 'API Key 2', status: '即將到期', expire: '2025-10-15' },
  { id: 'k3', name: 'API Key 3', status: '已停用', expire: '2024-05-01' }
])

// 篩選
const filteredKeys = computed(() => {
  return keys.value.filter(k =>
    k.name.toLowerCase().includes(search.value.toLowerCase())
  )
})

// 查看金鑰
const handleViewDetail = (row: any) => {
  navigateTo(`/tools/tool2?id=${row.id}`)
}
</script>

<template>
  <div class="keys-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>金鑰列表</span>
          <el-input v-model="search" placeholder="搜尋金鑰..." size="small" style="width: 200px" />
        </div>
      </template>

      <el-table :data="filteredKeys" style="width: 100%">
        <el-table-column prop="id" label="金鑰 ID" width="120" />
        <el-table-column prop="name" label="名稱" />
        <el-table-column prop="status" label="狀態" />
        <el-table-column prop="expire" label="到期日" />
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" type="primary" @click="handleViewDetail(scope.row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.keys-page {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
