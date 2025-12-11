<template>
  <div class="email-settings-page">
    <el-card class="email-card">
      <template #header>
        <div class="card-header">
          <h2>設定通知電子郵件</h2>
        </div>
      </template>

      <el-form 
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent
      >
        <el-form-item label="請輸入 Email" prop="email">
          <el-input 
            v-model="form.email" 
            placeholder="example@domain.com" 
            prefix-icon="Message"
            clearable
          />
        </el-form-item>

        <el-form-item label="請再次輸入 Email" prop="confirmEmail">
          <el-input 
            v-model="form.confirmEmail" 
            placeholder="請再次確認 Email" 
            prefix-icon="Message"
            clearable
          />
        </el-form-item>

        <div class="form-actions">
          <el-button @click="goBack">取消</el-button>
          <!-- 【修正】加入 :disabled 綁定，確保輸入一致才可點擊 -->
          <el-button 
            type="primary" 
            :loading="loading" 
            :disabled="!isFormValid"
            @click="handleSubmit"
          >
            確認送出
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Message } from '@element-plus/icons-vue'
// import axios from 'axios'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  email: '',
  confirmEmail: ''
})

// 【新增】計算屬性：檢查表單是否有效（兩次輸入相同且不為空）
const isFormValid = computed(() => {
  return (
    form.email.trim() !== '' && 
    form.confirmEmail.trim() !== '' && 
    form.email === form.confirmEmail
  )
})

// 自定義驗證規則：檢查兩次輸入是否一致
const validateConfirmEmail = (rule: any, value: string, callback: any) => {
  if (value === '') {
    callback(new Error('請再次輸入 Email'))
  } else if (value !== form.email) {
    callback(new Error('兩次輸入的 Email 不一致'))
  } else {
    callback()
  }
}

const rules = reactive<FormRules>({
  email: [
    { required: true, message: '請輸入 Email', trigger: 'blur' },
    { type: 'email', message: '請輸入正確的 Email 格式', trigger: 'blur' }
  ],
  confirmEmail: [
    { validator: validateConfirmEmail, trigger: 'blur' } // 或 trigger: ['blur', 'change'] 以更即時顯示錯誤
  ]
})

const goBack = () => {
  router.back()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        // 模擬 API 呼叫
        // const token = localStorage.getItem('auth_token')
        // await axios.post('http://localhost:8000/users/update_email', { email: form.email }, ...)
        
        await new Promise(resolve => setTimeout(resolve, 1000)) // 模擬延遲
        
        ElMessage.success(`Email 已更新為：${form.email}`)
        router.push('/settings') // 成功後返回設定頁
      } catch (error) {
        ElMessage.error('更新失敗，請稍後再試')
      } finally {
        loading.value = false
      }
    } else {
      return false
    }
  })
}
</script>

<style scoped>
.email-settings-page {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
  background-color: #f5f7fa;
}

.email-card {
  width: 100%;
  max-width: 500px;
  border-radius: 8px;
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
  text-align: center;
  color: #303133;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 30px;
}
</style>