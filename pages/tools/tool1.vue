<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth' // *** 引入 Auth Store ***

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore() // *** 獲取 Auth Store 實例 ***

const cloudServices = ref<any[]>([]) // 儲存從 /clouds/get_all 獲取的數據
const loading = ref(false) // 控制表格 loading 狀態

// *** 新增：Cloud Type 篩選狀態 ***
const selectedCloudType = ref('all') // 預設 'all'

// *** (保持不變) 獲取雲服務資料 ***
const fetchCloudServices = async () => {
  try {
    loading.value = true // Fetch 開始時設置 loading
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
      ElMessage.warning('雲服務資料格式不正確')
      cloudServices.value = [];
    }
  } catch (err) {
    console.error("無法取得雲服務資料:", err) // 添加錯誤詳情
    ElMessage.error('無法取得雲服務資料')
    cloudServices.value = [];
  } finally {
    loading.value = false // Fetch 結束時取消 loading
  }
}

// *** 新增：自動獲取可用的 Cloud Types ***
const availableCloudTypes = computed(() => {
    // 從 cloudServices.value 中提取所有唯一的 cloud_type
    // 過濾掉 null 或 undefined 的值，並去重
    const types = new Set(cloudServices.value.map(service => service.cloud_type).filter(Boolean));
    return ['all', ...Array.from(types)]; // 返回包含 'all' 的陣列
});

// *** 修改：過濾邏輯 - 增加 Cloud Type 篩選 ***
const filteredData = computed(() => {
  // 1. 從 Store 獲取全局 Codename 篩選
  const currentCode = auth.currentSelectedCodename; // 讀取 getter
  const allowedUserCodes = auth.availableCodename; // 讀取 getter

  if (!currentCode) {
      console.warn("FilteredData: currentSelectedCodename from store is null/undefined.");
      return [];
  }
   if (!Array.isArray(cloudServices.value)) {
       console.warn("FilteredData: cloudServices.value is not an array.");
       return [];
   }
   
  // 2. 獲取本地 Cloud Type 篩選
  const currentCloudType = selectedCloudType.value;

  console.log(`Filtering tool1 data for codename: "${currentCode}", cloud_type: "${currentCloudType}"`); // Debug Log

  return cloudServices.value.filter(service => {
    // *** 步驟 A：Codename 篩選 (與之前相同) ***
    const serviceCodes = Array.isArray(service?.codename) ? service.codename : [];
    let codenameMatch = false;
    if (currentCode === 'all') {
         if (!Array.isArray(allowedUserCodes) || allowedUserCodes.length === 0) {
             // console.log("Filtering 'all' but user has no allowed codes."); // Debug Log
             return false; // 無權限用戶看不到任何 'all' 數據
         }
         codenameMatch = serviceCodes.some((code: string) => allowedUserCodes.includes(code));
    } else {
        codenameMatch = serviceCodes.includes(currentCode);
    }
    
    // 如果 Codename 不匹配，直接過濾掉
    if (!codenameMatch) {
        return false;
    }

    // *** 步驟 B：Cloud Type 篩選 (基於已通過 Codename 篩選的數據) ***
    if (currentCloudType === 'all') {
        return true; // 如果 Cloud Type 選 'all'，則通過
    } else {
        return service.cloud_type === currentCloudType; // 否則，必須嚴格匹配
    }
  });
});


// *** (保持不變) 點擊查看詳細，傳遞所有關聯的 key_id ***
const handleViewDetail = (row: any) => {
  const keyIdsArray = row.key_id || [];
  if (keyIdsArray.length > 0) {
    const keyIdsString = keyIdsArray.join(',');
    router.push({ path: '/tools/tool2', query: { ids: keyIdsString } });
  } else {
    ElMessage.warning('此服務項目沒有關聯的金鑰可供查看');
  }
};

// *** (保持不變) Helper function to format date ***
const formatDate = (dateString: string | null | undefined): string => {
    try { return dateString ? new Date(dateString).toLocaleString() : 'N/A'; }
    catch (e) { console.warn(`Invalid date format for: ${dateString}`); return 'Invalid Date'; }
};

// *** (保持不變) onMounted ***
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
            <el-select
              v-model="selectedCloudType"
              placeholder="選擇平台類型"
              size="small"
              style="width: 300px; margin-right: 10px;"
              clearable
              @clear="selectedCloudType = 'all'" 
            >
              <el-option
                v-for="type in availableCloudTypes"
                :key="type"
                :label="type === 'all' ? '全部雲平台' : type"
                :value="type"
              />
            </el-select>
            <el-input placeholder="搜尋..." size="small" style="width: 300px;" /> 
          </div>
        </div>
      </template>

      <div class="table-container">
        <el-table v-loading="loading" :data="filteredData" style="width: 100%" border stripe>
          <el-table-column prop="cloud_type" label="雲平台類型" width="120" />
          <el-table-column prop="cloud_account_id" label="雲平台ID" width="280" show-overflow-tooltip />
          <el-table-column prop="codename" label="專案代號" width="180" show-overflow-tooltip>
             <template #default="scope">{{ (scope.row.codename || []).join(', ') }}</template>
          </el-table-column>
          <el-table-column prop="user_account" label="平台使用者帳號" width="250" show-overflow-tooltip />
          <el-table-column prop="user_create_time" label="帳號創建時間" width="200">
             <template #default="scope">{{ formatDate(scope.row.user_create_time) }}</template>
          </el-table-column>
          <el-table-column prop="user_permission" label="帳號權限" width="250" show-overflow-tooltip>
             <template #default="scope">{{ (scope.row.user_permission || []).join(', ') }}</template>
          </el-table-column>
          <el-table-column prop="user_MFA_enabled" label="MFA啟用" width="100" align="center">
             <template #default="scope">
                 <el-tag v-if="scope.row.user_MFA_enabled === true" type="success">是</el-tag>
                 <el-tag v-else-if="scope.row.user_MFA_enabled === false" type="danger">否</el-tag>
                 <span v-else>N/A</span>
             </template>
          </el-table-column>
           <el-table-column prop="user_change_password_previous_time" label="前次密碼變更" width="200">
              <template #default="scope">{{ formatDate(scope.row.user_change_password_previous_time) }}</template>
           </el-table-column>
           <el-table-column prop="user_change_password_next_time" label="下次密碼變更" width="200">
              <template #default="scope">{{ formatDate(scope.row.user_change_password_next_time) }}</template>
           </el-table-column>
          <el-table-column prop="key_id" label="金鑰ID" width="400">
             <template #default="scope">
                <div v-if="scope.row.key_id?.length > 0">
                    <div v-for="(id, index) in scope.row.key_id" :key="index" class="key-id-item">
                        <span>{{ id }}</span>
                    </div>
                </div>
                <span v-else>N/A</span>
             </template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center"> 
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="handleViewDetail(scope.row)"
                :disabled="!scope.row.key_id || scope.row.key_id.length === 0"
              >
                查看金鑰
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* .cloud-service-page { padding: 20px; } */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
/* *** 新增：篩選器容器樣式 *** */
.filter-controls-header {
    display: flex;
    align-items: center;
}
.table-container { width: 100%; overflow-x: auto; }
.el-table { min-width: 2300px; } /* Adjusted min-width */
.key-id-item { margin-bottom: 4px; }
.key-id-item:last-child { margin-bottom: 0; }
.el-table .cell, .el-table th div {
    white-space: nowrap;
}
</style>