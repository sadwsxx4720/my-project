<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage } from 'element-plus'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
// *** 注意：這裡仍然需要 originalUsername 來查詢 API ***
const originalUsername = route.query.username as string | undefined
// userDetail 用於暫存 API 回傳的原始資料
const userDetail = ref<any>(null) 
const loading = ref(false) // 頁面載入狀態
const updateLoading = ref(false) // 提交按鈕狀態

const editForm = ref({
  username: '',
  password: '', 
  role: '',
  email: '',
  codenameStr: ''
})

// (保留) Username 驗證邏輯
const usernameTouched = ref(false)

// Role 驗證 (必填)
const allowedRoles = ['admin', 'normal', 'read']
const isRoleValid = computed(() => {
  return allowedRoles.includes(editForm.value.role.trim())
})

// Email 驗證 (可選填，但填寫時必須正確)
const isEmailValid = computed(() => {
  const email = editForm.value.email.trim()
  if (email === '') {
    return true // 允許為空
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
})

// Username 驗證 (僅檢查是否為空)
const isUsernameValid = computed(() => {
  return editForm.value.username.trim() !== ''
})

// 按鈕禁用邏जिक (Username 必填, Role/Email 需有效)
const isUpdateDisabled = computed(() => {
  return !isUsernameValid.value || 
         !isRoleValid.value || 
         !isEmailValid.value
})

if (!originalUsername) {
  ElMessage.warning('請從帳號列表頁或詳細資料頁進入')
  router.replace('/account')
}

// *** 新增：將 userDetail 資料填入 editForm ***
const populateEditForm = () => {
    if (!userDetail.value) return
    editForm.value = {
        username: userDetail.value.username,
        password: '', // 密碼留空
        role: userDetail.value.role || '', // 確保有預設值
        email: userDetail.value.email || '', // 確保有預設值
        codenameStr: (userDetail.value.codename || []).join(', ')
    }
    usernameTouched.value = false // 重置 touched 狀態
}

const fetchUserDetail = async () => {
  if (!originalUsername) return

  try {
    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
        ElMessage.error('尚未登入，請先登入')
        router.push('/login')
        return
    }

    const res = await axios.get('http://localhost:8000/users/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data.code === 200 && Array.isArray(res.data.data)) {
      const list = res.data.data
      userDetail.value = list.find((u: any) => u.username === originalUsername)
      if (!userDetail.value) {
        ElMessage.warning(`找不到使用者：${originalUsername}`)
        router.replace('/account')
      } else {
        // *** 修改：取得資料後填入表單 ***
        populateEditForm() 
      }
    } else {
      ElMessage.warning('使用者資料格式不正確')
      router.replace('/account')
    }
  } catch (err) {
    console.error(err)
    ElMessage.error('無法取得使用者詳細資料')
    router.replace('/account')
  } finally {
    loading.value = false
  }
}

// (保留) 提交更新
const handleUpdate = async () => {
  usernameTouched.value = true
  
  if (isUpdateDisabled.value) {
     ElMessage.warning('請檢查表單欄位是否填寫正確')
     return
  }

  try {
    updateLoading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('登入憑證已過期，請重新登入')
      updateLoading.value = false
      return
    }

    const codenames = editForm.value.codenameStr
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    // (保留) 永遠傳送 password: "" 
    const payload: any = {
      username: editForm.value.username.trim(),
      password: editForm.value.password || "", 
      role: editForm.value.role.trim(), 
      email: editForm.value.email.trim() || "", 
      codename: codenames.length > 0 ? codenames : []
    }
    
    // (保留) 確認使用 POST
    const res = await axios.post('http://localhost:8000/users/update', payload, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data && res.data.code === 200) {
      ElMessage.success('使用者資料更新成功')
      router.push('/account') // 跳回列表
    } else {
      ElMessage.error(res.data.message || '更新失敗')
    }
  } catch (err: any) {
    console.error(err)
    if (err.response && err.response.status === 422) {
       ElMessage.error(`資料驗證失敗: ${err.response.data.message || '請檢查輸入'}`)
    } else {
       ElMessage.error(err.response?.data?.message || '更新時發生錯誤')
    }
  } finally {
    updateLoading.value = false
  }
}

// *** 修改：取消按鈕導回詳細頁 ***
const handleCancel = () => {
    // 導回 account1 並帶上 username
    router.push({ path: '/account/account1', query: { username: originalUsername } })
}


onMounted(fetchUserDetail)
</script>

<template>
  <div class="account-edit-page">
    <el-card>
      <template #header>
        <span>編輯使用者資料</span>
      </template>

      <el-skeleton v-if="loading" :rows="5" animated />

      <div v-else-if="userDetail"> 
        <el-form 
          :model="editForm" 
          label-width="150px" 
          @submit.prevent="handleUpdate"
          class="form-container"
        >
          
          <el-form-item 
            label="使用者名稱"
            required
            :validate-status="isUsernameValid || !usernameTouched ? '' : 'error'"
            :error="isUsernameValid || !usernameTouched ? '' : '使用者名稱為必填'"
          >
            <el-input v-model="editForm.username" @blur="usernameTouched = true" />
          </el-form-item>
          
          <el-form-item label="新密碼">
            <el-input v-model="editForm.password" type="password" show-password placeholder="留空表示不變更密碼" />
          </el-form-item>
          
          <el-form-item 
            label="權限 (Role)"
            required
            :validate-status="isRoleValid ? '' : 'error'"
            :error="isRoleValid ? '' : '權限必須是 admin, normal 或 read'"
          >
            <el-input v-model="editForm.role" placeholder="請輸入 'admin' or 'normal' or 'read'" />
          </el-form-item>
          
          <el-form-item 
            label="Email"
            :validate-status="isEmailValid ? '' : 'error'"
            :error="isEmailValid ? '' : '請輸入正確的 Email 格式'"
          >
            <el-input v-model="editForm.email" type="email" />
          </el-form-item>
          
          <el-form-item label="代號 (Codename)">
            <el-input v-model="editForm.codenameStr" placeholder="請用逗號 (,) 分隔" />
          </el-form-item>
          
          <el-form-item class="button-form-item">
            <el-button 
              type="primary" 
              @click="handleUpdate" 
              :loading="updateLoading"
              :disabled="isUpdateDisabled"
            >
              確認變更
            </el-button>
            <el-button @click="handleCancel">取消</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div v-else>
        <p>找不到使用者 (Username: {{ originalUsername }})</p>
        <el-button @click="router.push('/account')">返回列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.account-edit-page {
  padding: 20px;
}
/* (保留) 限制表單寬度並置中 */
.form-container {
  max-width: 800px;
  margin: 0 auto;
}

/* (保留) 編輯模式的按鈕置中 */
.button-form-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
  justify-content: center;
}
</style>