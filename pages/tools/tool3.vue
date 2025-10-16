<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: 'default'
})

const oldKey = ref('OLD-KEY-123456')
const newKey = ref('')
const notification = ref('email')

const handleRotate = () => {
  newKey.value = 'NEW-KEY-' + Math.random().toString(36).slice(2, 10).toUpperCase()
  ElMessage.success('已成功產生新金鑰')
}
</script>

<template>
  <div class="key-rotation-page">
    <el-card>
      <template #header>
        <span>金鑰輪替</span>
      </template>

      <el-form label-width="120px">
        <el-form-item label="舊金鑰">
          <el-input v-model="oldKey" readonly />
        </el-form-item>
        <el-form-item label="新金鑰">
          <el-input v-model="newKey" placeholder="尚未產生" readonly />
        </el-form-item>
        <el-form-item label="通知方式">
          <el-select v-model="notification" placeholder="選擇通知方式">
            <el-option label="E-mail" value="email" />
            <el-option label="Telegram" value="telegram" />
            <el-option label="M365 Teams" value="teams" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleRotate">執行輪替</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.key-rotation-page {
  padding: 20px;
}
</style>
