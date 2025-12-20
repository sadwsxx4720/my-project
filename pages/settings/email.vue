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
        class="email-form"
        @submit.prevent
      >
        <el-form-item label="請輸入 Email" prop="email">
          <el-input 
            v-model="form.email" 
            placeholder="example@domain.com" 
            :prefix-icon="MessageIcon"
            clearable
          />
        </el-form-item>

        <el-form-item label="請再次輸入 Email" prop="confirmEmail">
          <el-input 
            v-model="form.confirmEmail" 
            placeholder="請再次確認 Email" 
            :prefix-icon="MessageIcon"
            clearable
          />
        </el-form-item>

        <div class="form-actions">
          <el-button class="action-btn" @click="goBack">取消</el-button>
          <!-- 按鈕綁定 disabled，需通過格式與一致性驗證 -->
          <el-button 
            type="primary" 
            class="action-btn"
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
import { Message as MessageIcon } from '@element-plus/icons-vue' // 改名避免混淆
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()
const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  email: '',
  confirmEmail: ''
})

// 計算屬性：檢查表單是否有效
// 條件：1. 不為空 2. 格式正確 3. 兩次輸入相同
const isFormValid = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return (
    form.email.trim() !== '' && 
    form.confirmEmail.trim() !== '' && 
    emailRegex.test(form.email) && // 檢查格式
    form.email === form.confirmEmail // 檢查一致性
  )
})

// 自定義驗證規則：顯示在 UI 上的錯誤提示
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
    { type: 'email', message: '請輸入正確的 Email 格式', trigger: ['blur', 'change'] }
  ],
  confirmEmail: [
    { validator: validateConfirmEmail, trigger: ['blur', 'change'] }
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
        const token = localStorage.getItem('auth_token')
        const currentCodename = auth.currentSelectedCodename

        if (!currentCodename || currentCodename === 'all') {
             ElMessage.warning('無法確認當前專案，請回到設定頁重新選擇')
             return
        }

        // 1. 先獲取該專案目前的接收者列表
        const res = await axios.post('http://localhost:8000/projects/get_one', 
          { codename: currentCodename },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        
        let existingReceivers = []
        if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
             existingReceivers = res.data.data.mailreceivers || []
        }

        // 2. 檢查是否重複
        if (existingReceivers.some((r: any) => r.email === form.email)) {
            ElMessage.warning('此 Email 已在通知名單中')
            loading.value = false
            return
        }

        // 3. 加入新 Email
        const newReceiverList = [...existingReceivers, { email: form.email }]

        // 4. 呼叫 API 更新
        await axios.post('http://localhost:8000/projects/update_mailreceiver', {
           codename: currentCodename,
           mailreceivers: newReceiverList
        }, { headers: { Authorization: `Bearer ${token}` } })
        
        ElMessage.success(`成功新增通知信箱：${form.email}`)
        router.push('/settings') // 成功後返回設定頁
      } catch (error) {
        console.error(error)
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
  box-sizing: border-box;
}

.email-card {
  width: 100%;
  max-width: 600px; /* 增加寬度 */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header h2 {
  margin: 0;
  font-size: 22px;
  text-align: center;
  color: #303133;
  padding: 10px 0;
}

.email-form {
  padding: 30px 40px; /* 增加內部邊距 */
}

.form-actions {
  display: flex;
  justify-content: center; /* 按鈕置中 */
  gap: 20px;
  margin-top: 40px; /* 增加與上方間距 */
}

.action-btn {
  min-width: 120px;
  padding: 12px 20px;
  font-size: 16px;
}

/* 調整 Element Plus 輸入框樣式 */
:deep(.el-form-item) {
  margin-bottom: 30px; 
}

:deep(.el-form-item__label) {
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 10px;
}

:deep(.el-input__wrapper) {
  padding: 10px 15px;
}
</style>