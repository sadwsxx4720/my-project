<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2 class="login-title">登入系統</h2>
      </template>

      <el-form :model="formData" label-position="top">
        <el-form-item label="帳號">
          <el-input v-model="formData.username" placeholder="請輸入帳號" />
        </el-form-item>

        <el-form-item label="密碼">
          <el-input v-model="formData.password" type="password" placeholder="請輸入密碼" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleLogin" block>登入</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const auth = useAuthStore()

const formData = ref({
  username: '',
  password: ''
})

// 🔹 使用 auth layout（無 sidebar / header）
definePageMeta({
  layout: 'auth'
})

/**
 * 登入邏輯：
 * - 向後端 API 發送帳密
 * - 成功後儲存 token 並導向 dashboard
 * - 失敗則顯示錯誤訊息
 */

const handleLogin = async () => {
  if (!formData.value.username || !formData.value.password) {
    ElMessage.warning('請輸入帳號與密碼')
    return
  }

  try {
    await auth.login(formData.value.username, formData.value.password)

    ElMessage.success('登入成功')
    router.push('/dashboard')  // 導向主頁
  } catch (err: any) {
    console.error('Login error:', err)
    ElMessage.error(err?.message || '登入失敗，請檢查帳號或密碼')
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-title {
  margin: 0;
  text-align: center;
  color: #303133;
}
</style>
