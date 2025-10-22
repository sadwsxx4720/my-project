<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const loading = ref(false)
const form = ref({
  username: '',
  password: '',
  role: '',
  email: '',
  codenameStr: '' 
})

// Role 驗證 (必填)
const allowedRoles = ['admin', 'normal', 'read']
const isRoleValid = computed(() => {
  return allowedRoles.includes(form.value.role.trim())
})

// Email 驗證 (可選填，但填寫時必須正確)
const isEmailValid = computed(() => {
  const email = form.value.email.trim()
  if (email === '') {
    return true // 允許為空
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
})

// 按鈕禁用邏輯 (Username/Password 必填, Role/Email 需有效)
const isCreateDisabled = computed(() => {
  return !form.value.username.trim() || 
         !form.value.password || 
         !isRoleValid.value || 
         !isEmailValid.value
})

const handleSubmit = async () => {
  if (isCreateDisabled.value) {
    ElMessage.warning('請檢查表單欄位是否填寫正確')
    return
  }

  try {
    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      return
    }
    
    const codenames = form.value.codenameStr
      .split(',')
      .map(c => c.trim()) 
      .filter(c => c.length > 0)

    const payload = {
      username: form.value.username.trim(),
      password: form.value.password,
      role: form.value.role.trim(), 
      email: form.value.email.trim() || "",
      codename: codenames.length > 0 ? codenames : [] 
    }

    const res = await axios.post('http://localhost:8000/users', payload, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data && res.data.code === 200) {
      ElMessage.success('使用者建立成功')
      router.push('/account') 
    } else {
      ElMessage.error(res.data.message || '建立失敗')
    }
  } catch (err: any) {
    console.error(err)
    ElMessage.error(err.response?.data?.message || '建立時發生錯誤')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="account-create-page">
    <el-card>
      <template #header>
        <span>新增使用者</span>
      </template>
      
      <el-form 
        :model="form" 
        label-width="150px" 
        @submit.prevent="handleSubmit"
        class="form-container"
      >
        <el-form-item 
          label="使用者名稱" 
          required
          :validate-status="form.username.trim() ? '' : 'error'"
          error="使用者名稱為必填"
        >
          <el-input v-model="form.username" />
        </el-form-item>
        
        <el-form-item 
          label="密碼" 
          required
          :validate-status="form.password ? '' : 'error'"
          error="密碼為必填"
        >
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        
        <el-form-item 
          label="權限 (Role)" 
          required
          :validate-status="isRoleValid ? '' : 'error'"
          :error="isRoleValid ? '' : '權限必須是 admin, normal 或 read'"
        >
          <el-input 
            v-model="form.role" 
            placeholder="請輸入 'admin' or 'normal' or 'read'"
          />
        </el-form-item>
        
        <el-form-item 
          label="Email"
          :validate-status="isEmailValid ? '' : 'error'"
          :error="isEmailValid ? '' : '請輸入正確的 Email 格式'"
        >
          <el-input v-model="form.email" type="email" />
        </el-form-item>
        
        <el-form-item label="代號 (Codename)">
          <el-input v-model="form.codenameStr" placeholder="請用逗號 (,) 分隔" />
        </el-form-item>
        
        <el-form-item class="button-form-item">
          <el-button 
            type="primary" 
            @click="handleSubmit" 
            :loading="loading"
            :disabled="isCreateDisabled"
          >
            確認新增
          </el-button>
          <el-button @click="router.push('/account')">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.account-create-page {
  padding: 20px;
}
.form-container {
  max-width: 800px;
  margin: 0 auto;
}

/* *** 修正 2：按鈕置中 style *** */
/* :deep() 穿透 scoped 樣式
  .el-form-item__content 是 el-form-item 內部的 flex 容器
  我們將其 margin-left 設為 0，使其忽略 label-width 的 150px
  然後將其 justify-content 設為 center
*/
.button-form-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
  justify-content: center;
}
</style>