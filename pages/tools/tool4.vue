<script setup lang="ts">
import { ref } from 'vue'
// *** 移除 axios ***
// import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'

definePageMeta({
  layout: 'default'
})

const router = useRouter()

// --- State Management ---
const step = ref(1) // 1: Input Old Key ID, 2: Display New/Old, 3: Actions Complete
const loading = ref(false) // General loading for initial steps
const disableLoading = ref(false) // Loading for disable button
const deleteLoading = ref(false) // Loading for delete button

const oldKeyIdInput = ref('') // Input for the key ID to be rotated
const oldKeyDetail = ref<any>(null) // Details of the old key
const newKeyDetail = ref<any>(null) // Details of the newly generated key

// --- Workflow Functions (Frontend Simulation) ---

// Step 1: Simulate Load Old Key Details & Generate New Key
const loadAndGenerate = async () => {
  if (!oldKeyIdInput.value.trim()) {
    ElMessage.warning('請輸入要輪替的舊金鑰 ID')
    return
  }

  loading.value = true
  oldKeyDetail.value = null // Clear previous details
  newKeyDetail.value = null // Clear previous details
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  try {
    // *** 模擬成功找到舊金鑰 ***
    oldKeyDetail.value = {
        key_id: oldKeyIdInput.value.trim(),
        key_state: 'Active', // Assume it's active initially
        key_description: '舊金鑰描述範例',
        key_create_time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(), // ~100 days old
        codename: ['OLD-CODE']
    }

    // *** 模擬成功產生新金鑰 ***
    newKeyDetail.value = {
        key_id: `NEWKEY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        key_state: 'Active',
        key_description: `輪替自 ${oldKeyDetail.value.key_id}`,
        key_create_time: new Date().toISOString(),
        codename: ['NEW-CODE']
        // Secret key value is NOT stored or displayed in frontend
    }

    ElMessage.success('新金鑰已成功產製')
    step.value = 2 // Move to the next step

  } catch (err: any) {
    // Although unlikely in simulation, keep basic error handling
    console.error("Error during simulated key rotation step 1:", err)
    ElMessage.error('載入或產製金鑰時發生錯誤')
    oldKeyDetail.value = null // Reset on error
  } finally {
    loading.value = false
  }
}

// Step 2 Action: Simulate Disable the Old Key
const handleDisableOldKey = async () => {
  if (!oldKeyDetail.value) return

  try {
    await ElMessageBox.confirm(
      `確定要停用舊金鑰 ID "${oldKeyDetail.value.key_id}" 嗎？`,
      '確認停用',
      {
        confirmButtonText: '確定停用',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    disableLoading.value = true

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800))

    // *** 模擬成功 ***
    ElMessage.success('舊金鑰已成功停用')
    // Update local state to reflect the change immediately
    oldKeyDetail.value.key_state = 'disabled' // Or 'Inactive'

  } catch (err: any) {
    if (err !== 'cancel') {
      console.error("Error simulating disable old key:", err)
      ElMessage.error('停用時發生錯誤')
    }
  } finally {
    disableLoading.value = false
  }
}

// Step 2 Action: Simulate Delete the Old Key
const handleDeleteOldKey = async () => {
  if (!oldKeyDetail.value) return

  try {
    await ElMessageBox.confirm(
      `確定要永久刪除舊金鑰 ID "${oldKeyDetail.value.key_id}" 嗎？`,
      '確認刪除',
      {
        confirmButtonText: '確定刪除',
        cancelButtonText: '取消',
        type: 'danger',
      }
    )

    deleteLoading.value = true
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // *** 模擬成功 ***
    ElMessage.success('舊金鑰已成功刪除')
    step.value = 3 // Move to completion step

  } catch (err: any) {
    if (err !== 'cancel') {
      console.error("Error simulating delete old key:", err)
      ElMessage.error('刪除時發生錯誤')
    }
  } finally {
    deleteLoading.value = false
  }
}

// Reset the process to start over
const resetProcess = () => {
  step.value = 1
  oldKeyIdInput.value = ''
  oldKeyDetail.value = null
  newKeyDetail.value = null
}

</script>

<template>
  <div class="key-rotation-page">
    <el-card>
      <template #header>
        <span>金鑰輪替與更換</span>
      </template>

      <div v-if="step === 1">
        <el-form label-position="top">
          <el-form-item label="請輸入要輪替的舊金鑰 ID">
            <el-input 
              v-model="oldKeyIdInput" 
              placeholder="輸入舊金鑰的 ID" 
              clearable 
            />
          </el-form-item>
          <el-form-item>
            <el-button 
              type="primary" 
              @click="loadAndGenerate" 
              :loading="loading"
            >
              載入金鑰並產製新金鑰
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div v-else-if="step === 2 && oldKeyDetail && newKeyDetail">
        <el-alert 
            title="新金鑰已產製" 
            type="success" 
            description="請妥善保存新金鑰資訊，並更新您的應用程式。確認無誤後，您可以停用或刪除舊金鑰。"
            show-icon 
            :closable="false"
            style="margin-bottom: 20px;"
        />
        
        <el-row :gutter="20">
          <el-col :span="12">
            <h3>新金鑰資訊</h3>
            <el-descriptions border :column="1" class="description-block">
              <el-descriptions-item label="新金鑰 ID">{{ newKeyDetail.key_id }}</el-descriptions-item>
              <el-descriptions-item label="狀態">{{ newKeyDetail.key_state }}</el-descriptions-item>
              <el-descriptions-item label="描述">{{ newKeyDetail.key_description || 'N/A' }}</el-descriptions-item>
              <el-descriptions-item label="建立時間">
                 {{ newKeyDetail.key_create_time ? new Date(newKeyDetail.key_create_time).toLocaleString() : 'N/A' }}
              </el-descriptions-item>
               <el-descriptions-item label="代號 (Codename)">
                 <span v-if="newKeyDetail.codename && newKeyDetail.codename.length > 0">
                    {{ newKeyDetail.codename.join(', ') }}
                 </span>
                 <span v-else>N/A</span>
              </el-descriptions-item>
            </el-descriptions>
          </el-col>

          <el-col :span="12">
            <h3>舊金鑰資訊 (待處理)</h3>
            <el-descriptions border :column="1" class="description-block">
              <el-descriptions-item label="舊金鑰 ID">{{ oldKeyDetail.key_id }}</el-descriptions-item>
              <el-descriptions-item label="目前狀態">
                 <el-tag :type="oldKeyDetail.key_state === 'Active' ? 'success' : 'info'">
                   {{ oldKeyDetail.key_state }}
                 </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="描述">{{ oldKeyDetail.key_description || 'N/A' }}</el-descriptions-item>
               <el-descriptions-item label="建立時間">
                 {{ oldKeyDetail.key_create_time ? new Date(oldKeyDetail.key_create_time).toLocaleString() : 'N/A' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-col>
        </el-row>

        <div class="action-buttons">
           <el-button 
             type="warning" 
             @click="handleDisableOldKey" 
             :loading="disableLoading"
             :disabled="oldKeyDetail.key_state !== 'Active'" 
           >
             停用舊金鑰
           </el-button>
           <el-button 
             type="danger" 
             @click="handleDeleteOldKey" 
             :loading="deleteLoading"
             :disabled="oldKeyDetail.key_state === 'deleted'" >
             刪除舊金鑰
           </el-button>
           <el-button @click="resetProcess">取消 / 輪替其他金鑰</el-button>
        </div>
      </div>

      <div v-else-if="step === 3">
          <el-result
            icon="success"
            title="舊金鑰已刪除 (模擬)"
            sub-title="金鑰輪替流程已完成。"
          >
            <template #extra>
              <el-button type="primary" @click="resetProcess">輪替其他金鑰</el-button>
              <el-button @click="router.push('/tools/tool1')">返回金鑰列表</el-button>
            </template>
          </el-result>
       </div>

      <el-skeleton v-else-if="loading" :rows="6" animated />
      
      <div v-else>
         <p>無法載入金鑰資訊，請重試。</p>
         <el-button @click="resetProcess">重試</el-button>
      </div>

    </el-card>
  </div>
</template>

<style scoped>
.key-rotation-page {
  padding: 20px;
}
.description-block {
    margin-bottom: 20px;
}
.action-buttons {
    margin-top: 30px;
    text-align: center;
}
.action-buttons .el-button {
    margin: 0 10px;
}
</style>