<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Plus, Delete, VideoPause, VideoPlay, Search, Refresh, Download } from '@element-plus/icons-vue' // 加入 Download icon

definePageMeta({
  layout: 'default'
})

const router = useRouter()
const auth = useAuthStore()

// --- 資料介面定義 ---
interface KeyData {
  key_id: string;
  key_type: 'Parent' | 'Child';
  key_create_time: string;
  key_last_time_used: string;
  key_state: string; // 'Active' | 'Disabled'
  key_description: string;
  codename: string;
  rotation_state: string;
  cloud_type: 'AWS' | 'GCP' | string;
  user_account?: string; 
}

// --- State ---
const keyList = ref<KeyData[]>([]) 
const loading = ref(false)
const isUpdating = ref(false) 
const searchQuery = ref('') 
const cloudTypeFilter = ref('all') 
const currentUserProjectRole = ref<string>('') 
const updatingStateMap = ref<Record<string, boolean>>({}) 

// 新增金鑰 Modal 相關 State
const addKeyDialogVisible = ref(false)
const isSubmittingKey = ref(false)
const addKeyForm = reactive({
  codename: '',
  cloud_type: '', 
  account: '',    // username or service_account_email
  key_type: '',   // 預設為空，讓使用者選擇
})

// --- Computed: 表單驗證 ---
const isFormValid = computed(() => {
  return (
    addKeyForm.codename.trim() !== '' &&
    addKeyForm.cloud_type !== '' &&
    addKeyForm.account.trim() !== '' &&
    addKeyForm.key_type !== '' 
  )
})

// --- API Functions ---

const fetchKeys = async () => {
  try {
    loading.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
    }
    
    // 加上時間戳記防止快取
    const res = await axios.get(`http://localhost:8000/keys/get_all?t=${new Date().getTime()}`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })

    if (res.data && (res.data.code === 0 || res.data.code === 200) && Array.isArray(res.data.data)) {
      keyList.value = res.data.data
    } else {
      keyList.value = [];
    }
  } catch (err) {
    console.error("無法取得金鑰資料:", err)
    ElMessage.error('無法取得金鑰資料')
    keyList.value = [];
  } finally {
    loading.value = false
  }
}

// 更新資料功能
const handleUpdateData = async () => {
  try {
    isUpdating.value = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('尚未登入')
      return
    }

    const headers = { Authorization: `Bearer ${savedToken}` }
    const timestamp = new Date().getTime()

    // 同時呼叫 AWS Summary, GCP Summary
    await Promise.allSettled([
      axios.get(`http://localhost:8000/cloud_platform/summary?t=${timestamp}`, { headers })
    ])
    
    // 重新獲取金鑰列表
    await fetchKeys()
    
    ElMessage.success('資料更新完成')

  } catch (err) {
    console.error("更新資料發生錯誤:", err)
    ElMessage.error('更新資料失敗')
  } finally {
    isUpdating.value = false
  }
}

const fetchCurrentUserProjectRole = async () => {
  const currentCodename = auth.currentSelectedCodename;
  const currentUsername = auth.user?.username;

  if (!currentCodename || currentCodename === 'all' || !currentUsername) {
    currentUserProjectRole.value = '';
    return;
  }

  try {
    const savedToken = localStorage.getItem('auth_token');
    const res = await axios.post('http://localhost:8000/projects/get_one', 
      { codename: currentCodename },
      { headers: { Authorization: `Bearer ${savedToken}` } }
    );

    if (res.data && (res.data.code === 0 || res.data.code === 200) && res.data.data) {
      const projectInfo = res.data.data.projectinfo || [];
      const member = projectInfo.find((m: any) => m.username === currentUsername);
      currentUserProjectRole.value = member ? member.projectrole : '';
    } else {
      currentUserProjectRole.value = '';
    }
  } catch (err) {
    console.error("無法獲取專案權限:", err);
    currentUserProjectRole.value = '';
  }
}

// --- Computed Properties ---

const canManageKeys = computed(() => {
  return auth.isSuperuser || currentUserProjectRole.value === 'admin';
})

// 過濾邏輯
const filteredData = computed(() => {
  const currentCode = auth.currentSelectedCodename;
  const allowedUserCodes = auth.availableCodename;

  if (!currentCode) return [];
  if (!Array.isArray(keyList.value)) return [];

  const query = searchQuery.value.toLowerCase().trim();
  const typeFilter = cloudTypeFilter.value;

  return keyList.value.filter(key => {
    // 1. 專案代號篩選
    const keyCodename = key.codename || '';
    let codenameMatch = false;

    if (currentCode === 'all') {
         if (!Array.isArray(allowedUserCodes) || allowedUserCodes.length === 0) {
             return false;
         }
         codenameMatch = allowedUserCodes.includes(keyCodename);
    } else {
        codenameMatch = keyCodename === currentCode;
    }
    
    if (!codenameMatch) return false;

    // 2. 雲平台篩選
    if (typeFilter !== 'all' && key.cloud_type !== typeFilter) {
      return false;
    }

    // 3. 全欄位搜尋
    if (query) {
      const safeStr = (val: any) => (val || '').toString().toLowerCase();
      const searchContent = [
        safeStr(key.key_id),
        safeStr(key.key_description),
        safeStr(key.user_account),
        safeStr(key.codename),
        safeStr(key.cloud_type),
        safeStr(key.key_type),
        safeStr(key.key_state),
        safeStr(key.rotation_state),
        formatDate(key.key_create_time).toLowerCase(),
        formatDate(key.key_last_time_used).toLowerCase()
      ];
      return searchContent.some(text => text.includes(query));
    }

    return true;
  });
});

// --- Methods ---

// 1. 狀態切換 (Active <-> Disabled)
const handleToggleState = async (row: KeyData) => {
  if (updatingStateMap.value[row.key_id]) return;

  const currentState = row.key_state;
  const actionText = currentState === 'Active' ? '停用' : '啟用';

  try {
    updatingStateMap.value[row.key_id] = true;
    const token = localStorage.getItem('auth_token');

    console.log(`正在${actionText}金鑰 ${row.key_id}... 傳送當前狀態: ${currentState}`);

    const res = await axios.post('http://localhost:8000/keys/update_state', 
      {
        key_id: row.key_id,
        key_state: currentState 
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       ElMessage.success(`金鑰已${actionText}`);
       row.key_state = currentState === 'Active' ? 'Disabled' : 'Active';
       await fetchKeys(); 
    } else {
       ElMessage.error(res.data?.message || `無法${actionText}金鑰`);
       await fetchKeys(); 
    }
  } catch (e) {
    console.error(e);
    ElMessage.error(`操作失敗`);
  } finally {
    updatingStateMap.value[row.key_id] = false;
  }
}

// 開啟新增金鑰 Modal
const handleOpenAddKeyDialog = (row: KeyData) => {
  addKeyForm.codename = row.codename;
  addKeyForm.cloud_type = row.cloud_type;
  addKeyForm.account = '';
  addKeyForm.key_type = 'Child'; 
  addKeyDialogVisible.value = true;
}

// 【修改】送出新增金鑰並處理檔案下載
const submitAddKey = async () => {
  if (!isFormValid.value) {
    ElMessage.warning('請填寫完整資訊');
    return;
  }

  isSubmittingKey.value = true;
  const token = localStorage.getItem('auth_token');

  try {
    let url = '';
    let payload = {};

    if (addKeyForm.cloud_type === 'AWS') {
      url = 'http://localhost:8000/cloud_platform/aws/iam/create';
      payload = {
        username: addKeyForm.account, 
        codename: addKeyForm.codename,
        key_type: addKeyForm.key_type
      };
    } else if (addKeyForm.cloud_type === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/create';
      payload = {
        service_account_email: addKeyForm.account,
        codename: addKeyForm.codename,
        key_type: addKeyForm.key_type
      };
    }

    // 【修改】重點：設定 responseType 為 blob 以接收檔案流
    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob' 
    });

    // 判斷回應狀態，若為 200 則代表成功且回傳了檔案
    if (res.status === 200) {
      // 1. 建立 Blob 物件
      const blob = new Blob([res.data], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      
      // 2. 嘗試從 Header 取得檔名 (如果有 Content-Disposition)
      let filename = 'credentials.json';
      const contentDisposition = res.headers['content-disposition'];
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }

      // 3. 建立虛擬連結並觸發下載
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // 4. 清理
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      ElMessage.success('金鑰新增成功，正在下載憑證檔案...');
      addKeyDialogVisible.value = false;
      await fetchKeys();
    } else {
      // 如果 status 不是 200，嘗試讀取 blob 內容顯示錯誤 (雖然通常 axios 會 catch error)
      ElMessage.error('新增失敗');
    }

  } catch (err: any) {
    console.error(err);
    // 【修改】錯誤處理：因為 responseType 是 blob，錯誤訊息也在 blob 裡，需要轉回文字
    if (err.response && err.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const errorData = JSON.parse(reader.result as string);
                ElMessage.error(errorData.detail || errorData.message || '新增金鑰失敗');
            } catch (e) {
                ElMessage.error('新增金鑰發生未預期的錯誤');
            }
        };
        reader.readAsText(err.response.data);
    } else {
        ElMessage.error('新增金鑰發生錯誤');
    }
  } finally {
    isSubmittingKey.value = false;
  }
}

const handleDeleteKey = async (row: KeyData) => {
  try {
    await ElMessageBox.confirm(
      `確定要刪除金鑰 ${row.key_id} 嗎？此操作無法復原。`,
      '刪除確認',
      { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' }
    )
    
    const token = localStorage.getItem('auth_token');
    let url = '';
    let payload = {};

    if (row.cloud_type === 'AWS') {
      url = 'http://localhost:8000/cloud_platform/aws/iam/delete';
      payload = {
        username: row.user_account,
        codename: row.codename,
        access_key_id: row.key_id 
      };
    } else if (row.cloud_type === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/delete';
      payload = {
        username: row.user_account,
        codename: row.codename,
        key_id: row.key_id
      };
    }

    const res = await axios.post(url, payload, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       ElMessage.success('刪除成功');
       await fetchKeys(); 
    } else {
       ElMessage.error(res.data?.message || '刪除失敗');
    }

  } catch (err: any) {
    if (err !== 'cancel') {
       console.error(err);
       ElMessage.error(err.message || '刪除失敗');
    }
  }
}

const formatDate = (dateString: string | null | undefined): string => {
    try { return dateString ? new Date(dateString).toLocaleString() : '-'; }
    catch (e) { return '-'; }
};

// --- Lifecycle & Watchers ---
onMounted(async () => {
  await fetchKeys();
  await fetchCurrentUserProjectRole();
});

watch(() => auth.currentSelectedCodename, async () => {
    await fetchCurrentUserProjectRole();
});

</script>

<template>
  <div class="key-list-page" style="padding: 20px;">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">金鑰列表</span>
          </div>
          
          <div class="filter-controls-header"> 
            
            <el-select 
              v-model="cloudTypeFilter" 
              placeholder="雲平台" 
              style="width: 120px; margin-right: 10px;"
            >
              <el-option label="全部平台" value="all" />
              <el-option label="AWS" value="AWS" />
              <el-option label="GCP" value="GCP" />
            </el-select>

            <el-input 
              v-model="searchQuery"
              placeholder="搜尋所有資訊 (ID, 代號, 描述...)" 
              size="default" 
              style="width: 300px; margin-right: 10px;" 
              clearable
              prefix-icon="Search"
            /> 
            
            <el-button 
              type="success" 
              :icon="Refresh" 
              :loading="isUpdating"
              @click="handleUpdateData"
              style="margin-left: 10px;"
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
          
          <el-table-column prop="cloud_type" label="雲平台" width="100" sortable align="center">
            <template #default="scope">
              <el-tag effect="light" :type="scope.row.cloud_type === 'AWS' ? 'warning' : ''">
                {{ scope.row.cloud_type || '-' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="key_id" label="金鑰 ID" min-width="450" />
          
          <el-table-column prop="key_type" label="類型" width="100" align="center">
             <template #default="scope">
                 <el-tag :type="scope.row.key_type === 'Parent' ? 'warning' : ''" effect="plain">
                   {{ scope.row.key_type || 'Unknown' }}
                 </el-tag>
             </template>
          </el-table-column>

          <el-table-column prop="codename" label="專案代號" width="120" sortable />
          
          <el-table-column prop="key_state" label="狀態" width="100" align="center">
             <template #default="scope">
                 <el-tag :type="scope.row.key_state === 'Active' ? 'success' : 'info'">
                   {{ scope.row.key_state }}
                 </el-tag>
             </template>
          </el-table-column>

          <el-table-column prop="rotation_state" label="輪替狀態" width="120" align="center" />

          <el-table-column prop="key_create_time" label="創建時間" width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.key_create_time) }}</template>
          </el-table-column>

          <el-table-column prop="key_last_time_used" label="最後使用時間" width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.key_last_time_used) }}</template>
          </el-table-column>
          
          <el-table-column prop="key_description" label="描述" min-width="200" show-overflow-tooltip />

          <el-table-column label="操作" width="200" align="center"> 
            <template #default="scope">
              <div class="action-buttons">
                
                <div v-if="canManageKeys" style="margin-right: 5px;">
                    <el-button
                      v-if="scope.row.key_state === 'Disabled'"
                      type="success"
                      size="small"
                      plain
                      :loading="updatingStateMap[scope.row.key_id]"
                      @click="handleToggleState(scope.row)"
                    >
                      啟用金鑰
                    </el-button>

                    <el-button
                      v-else-if="scope.row.key_state === 'Active'"
                      type="warning"
                      size="small"
                      plain
                      :loading="updatingStateMap[scope.row.key_id]"
                      @click="handleToggleState(scope.row)"
                    >
                      停用金鑰
                    </el-button>
                </div>
                <span v-else style="margin-right: 5px; color: #ccc;">-</span>

                <el-button
                  v-if="scope.row.key_type === 'Parent' && canManageKeys && scope.row.key_state === 'Active'"
                  size="small"
                  type="success"
                  @click="handleOpenAddKeyDialog(scope.row)"
                >
                  新增金鑰
                </el-button>

                <el-button
                  v-if="scope.row.key_type === 'Child' && scope.row.key_state === 'Disabled' && canManageKeys"
                  size="small"
                  type="danger"
                  @click="handleDeleteKey(scope.row)"
                >
                  刪除金鑰
                </el-button>
              </div>
            </template>
          </el-table-column>

        </el-table>
      </div>
    </el-card>

    <el-dialog
      v-model="addKeyDialogVisible"
      title="新增金鑰"
      width="650px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form :model="addKeyForm" label-position="top">
        
        <el-form-item label="專案代號">
           <el-input v-model="addKeyForm.codename" disabled />
        </el-form-item>

        <el-form-item label="雲平台類型">
           <el-input v-model="addKeyForm.cloud_type" disabled />
        </el-form-item>

        <el-form-item label="要新增的金鑰類型" required>
          <el-select v-model="addKeyForm.key_type" placeholder="請選擇金鑰類型" style="width: 100%">
            <el-option label="Parent (母Key)" value="Parent" />
            <el-option label="Child (子Key)" value="Child" />
          </el-select>
        </el-form-item>

        <el-form-item 
          v-if="addKeyForm.cloud_type === 'AWS'" 
          label="IAM Username (請輸入)" 
          required
        >
          <el-input v-model="addKeyForm.account" placeholder="請輸入 AWS IAM Username" />
        </el-form-item>

        <el-form-item 
          v-if="addKeyForm.cloud_type === 'GCP'" 
          label="Service Account Email (請輸入)" 
          required
        >
          <el-input v-model="addKeyForm.account" placeholder="請輸入 GCP Service Account Email" />
        </el-form-item>

      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addKeyDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="isSubmittingKey" 
            @click="submitAddKey"
            :icon="Download"
          >
            確定新增並下載憑證
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

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.filter-controls-header {
    display: flex;
    align-items: center;
}

/* 讓表格容器可以橫向滾動 */
.table-container { 
  width: 100%; 
  overflow-x: auto; 
}

/* 確保按鈕排列整齊 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 5px;
}

/* 確保表格內容不換行，保持整齊 */
.el-table .cell {
    white-space: nowrap;
}

.text-placeholder {
    color: #909399;
    font-weight: bold;
}
</style>