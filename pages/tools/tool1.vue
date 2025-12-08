<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- 資料介面定義 (根據 clouds/get_all 格式) ---
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
const cloudServices = ref<CloudService[]>([]) // 儲存 API 回傳的資料
const loading = ref(false)
const selectedCloudType = ref('all') // 雲平台篩選
const searchQuery = ref('') // 關鍵字搜尋

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

    // 【修正】打 clouds/get_all API
    const res = await axios.get('http://localhost:8000/clouds/get_all', {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    // 【修正】根據提供的 JSON，code 為 200
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

// --- Computed Properties ---

// 自動獲取可用的 Cloud Types (AWS, GCP...)
const availableCloudTypes = computed(() => {
    const types = new Set(cloudServices.value.map(service => service.cloud_type).filter(Boolean));
    return ['all', ...Array.from(types)];
});

// 過濾邏輯
const filteredData = computed(() => {
  const currentCode = auth.currentSelectedCodename;
  const allowedUserCodes = auth.availableCodename;

  if (!currentCode) return [];
  if (!Array.isArray(cloudServices.value)) return [];

  const query = searchQuery.value.toLowerCase();

  return cloudServices.value.filter(service => {
    // 1. 專案代號篩選 (Codename Filter)
    // 資料結構是 service.projects: [{codename: 'A'}, {codename: 'B'}]
    const serviceCodenames = service.projects ? service.projects.map(p => p.codename) : [];
    
    let codenameMatch = false;
    if (currentCode === 'all') {
         // 顯示使用者有權限的所有專案 (交集檢查)
         if (!Array.isArray(allowedUserCodes) || allowedUserCodes.length === 0) {
             return false;
         }
         codenameMatch = serviceCodenames.some(code => allowedUserCodes.includes(code));
    } else {
        // 顯示特定專案
        codenameMatch = serviceCodenames.includes(currentCode);
    }
    
    if (!codenameMatch) return false;

    // 2. 雲平台類型篩選 (Cloud Type Filter)
    if (selectedCloudType.value !== 'all' && service.cloud_type !== selectedCloudType.value) {
        return false;
    }

    // 3. 關鍵字搜尋 (Search Query)
    // 搜尋範圍：Cloud ID, User Account, Key ID
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

// 點擊查看詳細 (跳轉並帶入 key_ids)
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

// --- Lifecycle ---
onMounted(async () => {
  await fetchCloudServices();
});
</script>

<template>
  <div class="cloud-service-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>金鑰列表</span>
          <div class="filter-controls-header"> 
            <!-- 雲平台篩選 -->
            <el-select
              v-model="selectedCloudType"
              placeholder="選擇平台類型"
              size="small"
              style="width: 200px; margin-right: 10px;"
              clearable
            >
              <el-option
                v-for="type in availableCloudTypes"
                :key="type"
                :label="type === 'all' ? '全部雲平台' : type"
                :value="type"
              />
            </el-select>

            <!-- 搜尋框 -->
            <el-input 
              v-model="searchQuery"
              placeholder="搜尋平台ID、帳號或金鑰..." 
              size="small" 
              style="width: 300px;" 
              clearable
            /> 
          </div>
        </div>
      </template>

      <div class="table-container">
        <el-table v-loading="loading" :data="filteredData" style="width: 100%" border stripe>
          
          <el-table-column prop="cloud_type" label="雲平台類型" width="120" sortable />
          <el-table-column prop="cloud_account_id" label="雲平台ID" width="200" show-overflow-tooltip />
          
          <!-- 專案代號 (Array Display) -->
          <el-table-column label="專案代號" width="150" show-overflow-tooltip>
             <template #default="scope">
                 {{ scope.row.projects?.map((p: any) => p.codename).join(', ') || 'N/A' }}
             </template>
          </el-table-column>

          <el-table-column prop="user_account" label="平台使用者帳號" width="200" show-overflow-tooltip />
          
          <el-table-column prop="user_create_time" label="帳號創建時間" width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.user_create_time) }}</template>
          </el-table-column>
          
          <el-table-column label="帳號權限" width="200" show-overflow-tooltip>
             <template #default="scope">{{ (scope.row.user_permission || []).join(', ') }}</template>
          </el-table-column>
          
          <el-table-column prop="user_MFA_enabled" label="MFA啟用" width="100" align="center">
             <template #default="scope">
                 <el-tag v-if="scope.row.user_MFA_enabled === true" type="success">是</el-tag>
                 <el-tag v-else-if="scope.row.user_MFA_enabled === false" type="danger">否</el-tag>
                 <span v-else class="text-gray-400">-</span>
             </template>
          </el-table-column>
          
           <el-table-column prop="user_change_password_previous_time" label="前次密碼變更" width="180">
              <template #default="scope">{{ formatDate(scope.row.user_change_password_previous_time) }}</template>
           </el-table-column>
           
           <!-- 金鑰 ID (Nested Array Display) -->
          <el-table-column label="金鑰ID" width="350">
             <template #default="scope">
                <div v-if="scope.row.keys && scope.row.keys.length > 0">
                    <div v-for="(key, index) in scope.row.keys" :key="index" class="key-id-item">
                        <el-tag size="small" type="info">{{ key.key_id }}</el-tag>
                    </div>
                </div>
                <span v-else class="text-gray-400">無金鑰</span>
             </template>
          </el-table-column>

          <el-table-column label="操作" width="120" align="center" fixed="right"> 
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="handleViewDetail(scope.row)"
                :disabled="!scope.row.keys || scope.row.keys.length === 0"
              >
                查看詳情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
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
.table-container { width: 100%; }

.key-id-item {
  margin-bottom: 4px;
}
.key-id-item:last-child {
  margin-bottom: 0;
}
.text-gray-400 {
    color: #9ca3af;
}
/* 確保表格內容不換行，保持整齊 */
.el-table .cell {
    white-space: nowrap;
}
</style>