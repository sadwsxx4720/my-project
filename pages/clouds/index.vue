<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import axios from 'axios'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Refresh, Plus } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- 資料介面定義 ---
interface CloudProject {
  codename: string;
}

interface CloudKey {
  key_id: string;
}

interface CloudService {
  cloud_type: string;
  cloud_account_id: string;
  user_account: string;
  user_create_time: string | null;
  user_permission: string[];
  user_MFA_enabled: boolean | null;
  user_change_password_previous_time: string | null;
  user_change_password_next_time: string | null;
  projects: CloudProject[];
  keys: CloudKey[];
}

// --- State ---
const cloudServices = ref<CloudService[]>([]) 
const loading = ref(false)
const isUpdating = ref(false) 
const selectedCloudType = ref('all') 
const searchQuery = ref('') 

// --- 新增雲平台彈窗相關 State ---
const dialogVisible = ref(false)
const ruleFormRef = ref<FormInstance>()
const addForm = reactive({
  cloud_type: 'AWS',
  other_type_name: '', // 儲存「其他」平台的名稱
  account_name: '',
  access_key: '',
  secret_key: '',
  description: '',
  project_codename: ''
})

// 表單驗證規則
const rules = reactive<FormRules>({
  cloud_type: [{ required: true, message: '請選擇雲平台類型', trigger: 'change' }],
  other_type_name: [{ required: true, message: '請輸入平台名稱', trigger: 'blur' }],
  account_name: [{ required: true, message: '請輸入帳號名稱', trigger: 'blur' }],
  access_key: [{ required: true, message: '請輸入 Access Key 或憑證內容', trigger: 'blur' }],
  secret_key: [{ required: true, message: '請輸入 Secret Key', trigger: 'blur' }],
  project_codename: [{ required: true, message: '請選擇所屬專案', trigger: 'change' }]
})

// --- API Functions ---

const fetchCloudServices = async () => {
  try {
    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
    }

    const res = await axios.get('http://localhost:8000/clouds/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data && res.data.code === 200 && Array.isArray(res.data.data)) {
      cloudServices.value = res.data.data
    } else {
      console.error('回傳格式不正確:', res.data)
      cloudServices.value = [];
    }
  } catch (err) {
    console.error("無法取得雲服務資料:", err)
    ElMessage.error('無法取得雲服務資料')
    cloudServices.value = [];
  } finally {
    loading.value = false
  }
}

const handleUpdateData = async () => {
  try {
    isUpdating.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
    }

    // 1. 取得目前的 Codename
    const currentCodename = auth.currentSelectedCodename || '';

    const headers = { Authorization: `Bearer ${savedToken}` }
    const timestamp = new Date().getTime()

    // 2. 改用 POST 方法呼叫 summary，並傳遞 { codename: string }
    await Promise.allSettled([
      axios.post(
        `http://localhost:8000/cloud_platform/summary?t=${timestamp}`, 
        { codename: currentCodename }, // Body
        { headers } // Config
      )
    ])
    
    ElMessage.success('已完成資料更新')
    await fetchCloudServices()

  } catch (err) {
    console.error("更新資料發生錯誤:", err)
    ElMessage.error('更新資料失敗')
  } finally {
    isUpdating.value = false
  }
}

// 點擊新增雲平台按鈕
const handleAddCloudPlatform = () => {
  dialogVisible.value = true
}

// 提交新增表單
const submitForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate((valid) => {
    if (valid) {
      console.log('提交的新增資料:', addForm)
      ElMessage.success(`新增 ${addForm.cloud_type === 'Other' ? addForm.other_type_name : addForm.cloud_type} 成功（模擬）`)
      dialogVisible.value = false
      formEl.resetFields()
    } else {
      console.log('驗證失敗')
    }
  })
}

// --- Computed Properties ---

const availableCloudTypes = computed(() => {
    const types = new Set(cloudServices.value.map(service => service.cloud_type).filter(Boolean));
    return ['all', ...Array.from(types)];
});

const filteredData = computed(() => {
  const currentCode = auth.currentSelectedCodename;
  const allowedUserCodes = auth.availableCodename;

  if (!currentCode) return [];
  if (!Array.isArray(cloudServices.value)) return [];

  const query = searchQuery.value.toLowerCase();

  return cloudServices.value.filter(service => {
    // 取得該雲平台服務關聯的所有專案代號
    const serviceCodenames = service.projects ? service.projects.map(p => p.codename) : [];
    
    let codenameMatch = false;
    
    if (currentCode === 'all') {
         // 【修正】如果是 Superuser，直接視為匹配 (可以看到所有資料)
         if (auth.isSuperuser) {
             codenameMatch = true;
         } else {
             // 一般使用者：檢查是否有任何一個關聯專案在該使用者的允許清單中
             if (!Array.isArray(allowedUserCodes) || allowedUserCodes.length === 0) {
                 return false;
             }
             codenameMatch = serviceCodenames.some(code => allowedUserCodes.includes(code));
         }
    } else {
        // 單一專案篩選：檢查該服務是否包含當前選擇的專案
        codenameMatch = serviceCodenames.includes(currentCode);
    }
    
    if (!codenameMatch) return false;

    if (selectedCloudType.value !== 'all' && service.cloud_type !== selectedCloudType.value) {
        return false;
    }

    if (query) {
        const inCloudId = service.cloud_account_id?.toLowerCase().includes(query);
        const inUserAccount = service.user_account?.toLowerCase().includes(query);
        const inKeys = service.keys?.some(k => k.key_id.toLowerCase().includes(query));
        
        if (!inCloudId && !inUserAccount && !inKeys) return false;
    }

    return true;
  });
});

// --- Methods ---

const handleViewDetail = (row: CloudService) => {
  const keyIdsArray = row.keys ? row.keys.map(k => k.key_id) : [];
  if (keyIdsArray.length > 0) {
    const keyIdsString = keyIdsArray.join(',');
    router.push({ path: '/tools/tool2', query: { ids: keyIdsString } });
  } else {
    ElMessage.warning('此服務項目沒有關聯的金鑰可供查看');
  }
};

const formatDate = (dateString: string | null | undefined): string => {
    try { return dateString ? new Date(dateString).toLocaleString() : 'N/A'; }
    catch (e) { return 'Invalid Date'; }
};

onMounted(async () => {
  await fetchCloudServices();
});
</script>

<template>
  <div class="cloud-service-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>雲平台列表</span>
          <div class="filter-controls-header"> 
            <el-select
              v-model="selectedCloudType"
              placeholder="選擇平台類型"
              size="small"
              style="width: 150px; margin-right: 10px;"
              clearable
            >
              <el-option
                v-for="type in availableCloudTypes"
                :key="type"
                :label="type === 'all' ? '全部雲平台' : type"
                :value="type"
              />
            </el-select>

            <el-input 
              v-model="searchQuery"
              placeholder="搜尋平台ID、帳號或金鑰..." 
              size="small" 
              style="width: 250px; margin-right: 10px;" 
              clearable
            /> 

            <el-button 
              type="primary" 
              size="small" 
              :icon="Plus"
              style="margin-right: 10px;"
              @click="handleAddCloudPlatform"
            >
              新增雲平台
            </el-button>
            
            <el-button 
              type="success" 
              size="small" 
              :icon="Refresh" 
              :loading="isUpdating"
              @click="handleUpdateData"
            >
              更新資料
            </el-button>
          </div>
        </div>
      </template>

      <div class="table-container">
        <el-table 
          v-loading="loading" 
          :data="filteredData" 
          style="width: 100%" 
          border 
          stripe
          table-layout="auto"
        >
          <el-table-column prop="cloud_type" label="雲平台類型" min-width="120" sortable />
          <el-table-column prop="cloud_account_id" label="雲平台ID" width="200" show-overflow-tooltip />
          
          <el-table-column label="專案代號" width="150" show-overflow-tooltip>
             <template #default="scope">
                 {{ scope.row.projects?.map((p: any) => p.codename).join(', ') || 'N/A' }}
             </template>
          </el-table-column>

          <el-table-column prop="user_account" label="平台使用者帳號" min-width="200" show-overflow-tooltip />
          
          <el-table-column prop="user_create_time" label="帳號創建時間" min-width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.user_create_time) }}</template>
          </el-table-column>
          
          <el-table-column label="帳號權限" min-width="200" show-overflow-tooltip>
             <template #default="scope">{{ (scope.row.user_permission || []).join(', ') }}</template>
          </el-table-column>
          
          <el-table-column prop="user_MFA_enabled" label="MFA啟用" min-width="100" align="center">
             <template #default="scope">
                 <el-tag v-if="scope.row.user_MFA_enabled === true" type="success">是</el-tag>
                 <el-tag v-else-if="scope.row.user_MFA_enabled === false" type="danger">否</el-tag>
                 <span v-else class="text-gray-400">-</span>
             </template>
          </el-table-column>
          
           <el-table-column prop="user_change_password_previous_time" label="前次密碼變更" min-width="180">
              <template #default="scope">{{ formatDate(scope.row.user_change_password_previous_time) }}</template>
           </el-table-column>
           
          <el-table-column label="金鑰ID" min-width="350">
             <template #default="scope">
                <div v-if="scope.row.keys && scope.row.keys.length > 0">
                    <div v-for="(key, index) in scope.row.keys" :key="index" class="key-id-item">
                        <el-tag size="small" type="info">{{ key.key_id }}</el-tag>
                    </div>
                </div>
                <span v-else class="text-gray-400">無金鑰</span>
             </template>
          </el-table-column>

          <el-table-column label="操作" width="140" align="center" fixed="right"> 
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="handleViewDetail(scope.row)"
                :disabled="!scope.row.keys || scope.row.keys.length === 0"
              >
                查看金鑰詳細資訊
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      title="新增雲平台帳號"
      width="550px"
      destroy-on-close
    >
      <el-form
        ref="ruleFormRef"
        :model="addForm"
        :rules="rules"
        label-width="100px"
        label-position="top"
      >
        <el-form-item label="雲平台類型" prop="cloud_type">
          <el-radio-group v-model="addForm.cloud_type">
            <el-radio-button label="AWS" />
            <el-radio-button label="GCP" />
            <el-radio-button label="Azure" />
            <el-radio-button label="Other">其他</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item v-if="addForm.cloud_type === 'Other'" label="自定義平台名稱" prop="other_type_name">
          <el-input v-model="addForm.other_type_name" placeholder="輸入平台名稱，例如：Alibaba Cloud, DigitalOcean..." />
        </el-form-item>

        <el-form-item label="帳號顯示名稱" prop="account_name">
          <el-input v-model="addForm.account_name" placeholder="例如：開發環境主帳號" />
        </el-form-item>

        <el-form-item label="所屬專案" prop="project_codename">
          <el-select v-model="addForm.project_codename" placeholder="選擇關聯專案" style="width: 100%">
            <el-option 
              v-for="code in auth.availableCodename" 
              :key="code" 
              :label="code" 
              :value="code" 
            />
          </el-select>
        </el-form-item>

        <div v-if="addForm.cloud_type === 'AWS'">
          <el-form-item label="Access Key ID" prop="access_key">
            <el-input v-model="addForm.access_key" placeholder="AKIA..." />
          </el-form-item>
          <el-form-item label="Secret Access Key" prop="secret_key">
            <el-input v-model="addForm.secret_key" type="password" show-password placeholder="輸入金鑰內容" />
          </el-form-item>
        </div>

        <div v-if="addForm.cloud_type === 'GCP'">
          <el-form-item label="Service Account JSON" prop="access_key">
            <el-input
              v-model="addForm.access_key"
              type="textarea"
              :rows="5"
              placeholder="請貼上 GCP Service Account JSON 內容"
            />
          </el-form-item>
        </div>

        <div v-if="addForm.cloud_type === 'Azure' || addForm.cloud_type === 'Other'">
          <el-form-item label="連線憑證/金鑰內容" prop="access_key">
            <el-input
              v-model="addForm.access_key"
              type="textarea"
              :rows="5"
              placeholder="請輸入該平台的 API Key、Token 或 Connection String"
            />
          </el-form-item>
        </div>

        <el-form-item label="備註" prop="description">
          <el-input v-model="addForm.description" type="textarea" placeholder="可選填相關說明" />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm(ruleFormRef)">
            確定新增
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.filter-controls-header {
    display: flex;
    align-items: center;
}

/* 修改 4: 確保容器可以橫向滾動 */
.table-container { 
    width: 100%; 
    overflow-x: auto; 
}

.key-id-item {
  margin-bottom: 4px;
}
.key-id-item:last-child {
  margin-bottom: 0;
}
.text-gray-400 {
    color: #9ca3af;
}
.el-table .cell {
    white-space: nowrap;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>