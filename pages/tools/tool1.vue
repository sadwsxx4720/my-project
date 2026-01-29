<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Plus, Delete, VideoPause, VideoPlay, Search, Refresh, Download, Key } from '@element-plus/icons-vue'

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
  remaining_days?: string; // 剩餘天數
  rotation_state: string;
  cloud_type: 'AWS' | 'GCP' | string;
  user_account?: string; 
  source?: string;       // 來源
  old_key?: string | null; // 舊金鑰 ID
  children?: KeyData[]; // 用於樹狀結構的子節點
  isNested?: boolean;   // 標記是否成功被巢狀縮排 (用於控制箭頭顯示)
}

// --- State ---
const keyList = ref<KeyData[]>([]) 
const loading = ref(false)
const isUpdating = ref(false) 
const searchQuery = ref('') 
const cloudTypeFilter = ref('all') 
const currentUserProjectRole = ref<string>('') 
const updatingStateMap = ref<Record<string, boolean>>({}) // 控制啟用/停用 Loading
const creatingKeyMap = ref<Record<string, boolean>>({}) // 控制列表內新增金鑰 Loading

// First Create Modal 相關 State
const firstCreateDialogVisible = ref(false)
const isSubmittingFirstKey = ref(false)
const firstCreateForm = reactive({
  codename: '',
  cloud_type: '', // 使用者選擇
  account: '',    // username or service_account_email
  key_type: '',   // 使用者選擇 Parent/Child
})

// --- 【新增】Helper: 判斷金鑰是否為 Active (包含處理資料庫拼字錯誤 Acitve) ---
const isKeyActive = (state: string | null | undefined): boolean => {
  if (!state) return false;
  return state === 'Active' || state === 'Acitve';
}

// --- Computed: 表單驗證 (First Create) ---
const isFirstCreateFormValid = computed(() => {
  return (
    firstCreateForm.codename.trim() !== '' &&
    firstCreateForm.cloud_type !== '' &&
    firstCreateForm.account.trim() !== '' &&
    firstCreateForm.key_type !== '' 
  )
})

// --- Helper: 下載 Blob 檔案 ---
const downloadBlob = (data: Blob, defaultFilename: string, headers: any) => {
    const blob = new Blob([data], { type: 'application/json' });
    const downloadUrl = window.URL.createObjectURL(blob);
    
    let filename = defaultFilename;
    const contentDisposition = headers['content-disposition'];
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch && filenameMatch.length === 2) {
        filename = filenameMatch[1];
      }
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
}

// --- Helper: 解析 Blob 內容以產生動態檔名 ---
const getDynamicFilename = async (blob: Blob, defaultName: string) => {
  try {
    const text = await blob.text();
    const data = JSON.parse(text);
    let keyId = '';

    if (data.AccessKeyId) {
      keyId = data.AccessKeyId;
    } else if (data.private_key_id) {
      keyId = data.private_key_id;
    }

    if (keyId && keyId.length >= 4) {
      const suffix = keyId.slice(-5);
      const currentCodename = auth.currentSelectedCodename; 
      return `${currentCodename}_${suffix}.json`;
    }
  } catch (e) {
    console.warn('解析 Blob 以產生檔名時發生錯誤，將使用預設檔名', e);
  }
  return defaultName;
}

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

    const timestamp = new Date().getTime()
    const currentCodename = auth.currentSelectedCodename; 
    const headers = { Authorization: `Bearer ${savedToken}` }

    await Promise.allSettled([
      axios.post(`http://localhost:8000/cloud_platform/summary?t=${timestamp}`,
      { codename: currentCodename },
      { headers })
    ])
    
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

// 一般管理權限 (Admin 或 Superuser)
const canManageKeys = computed(() => {
  return auth.isSuperuser || currentUserProjectRole.value === 'admin';
})

// 專門給 Parent Key 的管理權限 (只有 Superuser 有)
const canManageParentKeys = computed(() => {
  return auth.isSuperuser; 
})

// 判斷是否為專案 Admin
const isProjectAdmin = computed(() => {
  return currentUserProjectRole.value === 'admin';
})

// 過濾邏輯 (平面資料)
const filteredData = computed(() => {
  const currentCode = auth.currentSelectedCodename;
  const allowedUserCodes = auth.availableCodename;

  if (!currentCode) return [];
  if (!Array.isArray(keyList.value)) return [];

  const query = searchQuery.value.toLowerCase().trim();
  const typeFilter = cloudTypeFilter.value;

  return keyList.value.filter(key => {
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

    if (typeFilter !== 'all' && key.cloud_type !== typeFilter) {
      return false;
    }

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
        safeStr(key.remaining_days),
        safeStr(key.source),
        safeStr(key.old_key),
        formatDate(key.key_create_time).toLowerCase(),
        formatDate(key.key_last_time_used).toLowerCase()
      ];
      return searchContent.some(text => text.includes(query));
    }

    return true;
  });
});

const treeData = computed(() => {
  const data = filteredData.value.map(item => ({ 
    ...item, 
    children: [] as KeyData[],
    isNested: false
  }));
  
  const dataMap: Record<string, any> = {};
  
  data.forEach(item => {
    dataMap[item.key_id] = item;
  });

  const tree: KeyData[] = [];

  data.forEach(item => {
    if (item.old_key && dataMap[item.old_key]) {
      item.isNested = true;
      dataMap[item.old_key].children.push(item);
    } else {
      item.isNested = false;
      tree.push(item);
    }
  });

  return tree;
});

// 狀態切換 (啟用/停用)
const handleToggleState = async (row: KeyData) => {
  if (updatingStateMap.value[row.key_id]) return;

  const currentState = row.key_state;
  const isCurrentlyActive = isKeyActive(currentState);
  const actionText = isCurrentlyActive ? '停用' : '啟用';
  const cloudType = row.cloud_type;

  try {
    updatingStateMap.value[row.key_id] = true;
    const token = localStorage.getItem('auth_token');

    let url = '';
    if (cloudType === 'AWS') {
      url = 'http://localhost:8000/cloud_platform/aws/iam/update';
    } else if (cloudType === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/update';
    } else {
      ElMessage.error('未知的雲平台類型');
      return;
    }

    const payload = {
      codename: row.codename,
      key_id: row.key_id,
      key_state: currentState 
    };

    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       ElMessage.success(`金鑰已${actionText}`);
       row.key_state = isCurrentlyActive ? 'Disabled' : 'Active';
       await fetchKeys(); 
    } else {
       // 後端 API 回傳 200 但帶有錯誤訊息時的處理
       const errMsg = res.data?.message || res.data?.detail || '';
       
       if (typeof errMsg === 'string' && errMsg.includes('Old Key does not exist in cloud platform')) {
          ElMessage.error('Old Key does not exist in cloud platform');
          await fetchKeys(); // 【修正】發生此特定錯誤時重新撈取資料
       } else {
          ElMessage.error(errMsg || `無法${actionText}金鑰`);
          await fetchKeys(); 
       }
    }
  } catch (e: any) {
    console.error(e);
    let errorDetail = '';
    if (e.response && e.response.data) {
        errorDetail = e.response.data.detail || e.response.data.message || '';
    }

    if (typeof errorDetail === 'string' && errorDetail.includes('Old Key does not exist in cloud platform')) {
        ElMessage.error('Old Key does not exist in cloud platform');
        await fetchKeys(); // 【修正】發生此特定錯誤時重新撈取資料
    } else {
        ElMessage.error(`操作失敗`);
    }
  } finally {
    updatingStateMap.value[row.key_id] = false;
  }
}

// Parent(Active) -> 新增 Parent
// Child(Active) -> 新增 Child
const handleRotateKey = async (row: KeyData) => {
  const targetKeyType = row.key_type; 
  const typeLabel = targetKeyType === 'Parent' ? 'Parent Key' : 'Child Key';

  try {
    await ElMessageBox.confirm(
      `確定要基於金鑰 ${row.key_id} 建立一把新的 ${typeLabel} 嗎？`,
      '新增金鑰確認',
      { confirmButtonText: '確定建立', cancelButtonText: '取消', type: 'info' }
    )

    creatingKeyMap.value[row.key_id] = true;
    const token = localStorage.getItem('auth_token');
    
    let url = '';
    if (row.cloud_type === 'AWS') {
      url = 'http://localhost:8000/cloud_platform/aws/iam/create';
    } else if (row.cloud_type === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/create';
    }

    const payload = {
      codename: row.codename,
      key_type: targetKeyType, 
      old_key_id: row.key_id
    };

    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob'
    });

    if (res.status === 200) {
       const filename = await getDynamicFilename(res.data, 'credentials.json');
       downloadBlob(res.data, filename, res.headers);
       ElMessage.success('金鑰新增成功，正在下載憑證檔案...');
       await fetchKeys();
    } else {
      ElMessage.error('新增失敗');
    }

  } catch (err: any) {
    if (err === 'cancel') return;
    console.error(err);
    if (err.response && err.response.data instanceof Blob) {
        const reader = new FileReader();
        // 【修正】改為 async 函式以便使用 await fetchKeys()
        reader.onload = async () => {
            try {
                const errorData = JSON.parse(reader.result as string);
                const errorMsg = errorData.detail || errorData.message || '';
                
                // 檢查特定錯誤：Access Key 已滿
                if (typeof errorMsg === 'string' && errorMsg.includes('User already has 2 access key')) {
                    ElMessage.error('目前已有兩把AWS Access key 無法新增母key');
                } 
                // 檢查特定錯誤：Old Key 不存在
                else if (typeof errorMsg === 'string' && errorMsg.includes('Old Key does not exist in cloud platform')) {
                    ElMessage.error('Old Key does not exist in cloud platform');
                    await fetchKeys(); // 【修正】發生此特定錯誤時重新撈取資料
                } 
                else {
                    ElMessage.error(errorMsg || '新增金鑰失敗');
                }
            } catch (e) {
                ElMessage.error('新增金鑰發生未預期的錯誤');
            }
        };
        reader.readAsText(err.response.data);
    } else {
        ElMessage.error('新增金鑰發生錯誤');
    }
  } finally {
    if (row && row.key_id) creatingKeyMap.value[row.key_id] = false;
  }
}

// 開啟 First Create Modal
const handleOpenFirstCreateDialog = () => {
  const currentCode = auth.currentSelectedCodename;
  if (!currentCode || currentCode === 'all') {
    ElMessage.warning('請先在右上角選擇一個特定的專案 (Codename) 才能進行首次新增金鑰');
    return;
  }

  firstCreateForm.codename = currentCode;
  firstCreateForm.cloud_type = ''; 
  firstCreateForm.account = '';
  
  if (isProjectAdmin.value) {
    firstCreateForm.key_type = 'Child';
  } else {
    firstCreateForm.key_type = '';   
  }
  
  firstCreateDialogVisible.value = true;
}

// 送出 First Create
const submitFirstCreateKey = async () => {
  if (!isFirstCreateFormValid.value) {
    ElMessage.warning('請填寫完整資訊');
    return;
  }

  isSubmittingFirstKey.value = true;
  const token = localStorage.getItem('auth_token');

  try {
    let url = '';
    if (firstCreateForm.cloud_type === 'AWS') {
      url = 'http://localhost:8000/cloud_platform/aws/iam/firstcreate';
    } else if (firstCreateForm.cloud_type === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/firstcreate';
    }

    const payload = {
      account: firstCreateForm.account,
      codename: firstCreateForm.codename,
      key_type: firstCreateForm.key_type
    };

    const res = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob' 
    });

    if (res.status === 200) {
      const filename = await getDynamicFilename(res.data, 'credentials.json');
      downloadBlob(res.data, filename, res.headers);
      
      ElMessage.success('金鑰首次新增成功，正在下載憑證檔案...');
      firstCreateDialogVisible.value = false;
      await fetchKeys();
    } else {
      ElMessage.error('新增失敗');
    }

  } catch (err: any) {
    console.error(err);
    if (err.response && err.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const errorData = JSON.parse(reader.result as string);
                const errorMsg = errorData.detail || errorData.message || '';
                if (typeof errorMsg === 'string' && errorMsg.includes('User already has 2 access key')) {
                    ElMessage.error('目前已有兩把AWS Access key 無法新增母key');
                } else {
                    ElMessage.error(errorMsg || '新增金鑰失敗');
                }
            } catch (e) {
                ElMessage.error('新增金鑰發生未預期的錯誤');
            }
        };
        reader.readAsText(err.response.data);
    } else {
        ElMessage.error('新增金鑰發生錯誤');
    }
  } finally {
    isSubmittingFirstKey.value = false;
  }
}

// 刪除金鑰
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
      payload = { codename: row.codename, key_id: row.key_id };
    } else if (row.cloud_type === 'GCP') {
      url = 'http://localhost:8000/cloud_platform/gcp/iam/delete';
      payload = { codename: row.codename, key_id: row.key_id };
    }

    const res = await axios.post(url, payload, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    
    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       ElMessage.success('刪除成功');
       await fetchKeys(); 
    } else {
       // 檢查 API 回傳錯誤 (200 OK 但有錯誤訊息)
       const errMsg = res.data?.message || res.data?.detail || '';
       if (typeof errMsg === 'string' && errMsg.includes('Old Key does not exist in cloud platform')) {
          ElMessage.error('Old Key does not exist in cloud platform');
          await fetchKeys(); // 【修正】發生此特定錯誤時重新撈取資料
       } else {
          ElMessage.error(errMsg || '刪除失敗');
       }
    }

  } catch (err: any) {
    if (err !== 'cancel') {
       console.error(err);
       // 檢查 HTTP 錯誤 (如 400/500)
       let errorDetail = '';
       if (err.response && err.response.data) {
           errorDetail = err.response.data.detail || err.response.data.message || '';
       }

       if (typeof errorDetail === 'string' && errorDetail.includes('Old Key does not exist in cloud platform')) {
           ElMessage.error('Old Key does not exist in cloud platform');
           await fetchKeys(); // 【修正】發生此特定錯誤時重新撈取資料
       } else {
           ElMessage.error(err.message || '刪除失敗');
       }
    }
  }
}

const formatDate = (dateString: string | null | undefined): string => {
    try { return dateString ? new Date(dateString).toLocaleString() : '-'; }
    catch (e) { return '-'; }
};

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
              type="primary" 
              :icon="Plus" 
              @click="handleOpenFirstCreateDialog"
              style="margin-right: 3px;"
              v-if="auth.isSuperuser"
            >
              新增金鑰
            </el-button>
            
            <el-button 
              type="success" 
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
          :data="treeData" 
          style="width: 100%" 
          border 
          stripe
          table-layout="auto"
          row-key="key_id" 
          default-expand-all
          :indent="0"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        >
          
          <el-table-column prop="cloud_type" label="雲平台" width="100" sortable align="center">
            <template #default="scope">
              <el-tag effect="light" :type="scope.row.cloud_type === 'AWS' ? 'warning' : undefined">
                {{ scope.row.cloud_type || '-' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="key_id" label="金鑰 ID" min-width="450">
            <template #default="scope">
               <span v-if="scope.row.isNested" style="color: #909399; margin-right: 5px; font-weight: bold; font-size: 16px;">
                 ↳
               </span>
               {{ scope.row.key_id }}
            </template>
          </el-table-column>
          
          <el-table-column prop="key_type" label="類型" width="100" align="center">
             <template #default="scope">
                 <el-tag :type="scope.row.key_type === 'Parent' ? 'warning' : undefined" effect="plain">
                   {{ scope.row.key_type || 'Unknown' }}
                 </el-tag>
             </template>
          </el-table-column>

          <el-table-column prop="codename" label="專案代號" width="120" align="center" sortable />
          
          <el-table-column prop="source" label="雲平台使用者帳號" width="120" sortable show-overflow-tooltip>
             <template #default="scope">
                 {{ scope.row.source || '-' }}
             </template>
          </el-table-column>
          
          <el-table-column prop="key_state" label="狀態" width="100" align="center">
             <template #default="scope">
                 <el-tag :type="isKeyActive(scope.row.key_state) ? 'success' : 'info'">
                   {{ scope.row.key_state }}
                 </el-tag>
             </template>
          </el-table-column>

          <el-table-column prop="rotation_state" label="輪替狀態" width="120" align="center" />

          <el-table-column prop="remaining_days" label="剩餘天數" width="100" sortable align="center">
            <template #default="scope">
              <span :style="{ color: (scope.row.remaining_days !== undefined && scope.row.remaining_days < 7) ? 'red' : 'inherit' }">
                {{ scope.row.remaining_days !== undefined ? scope.row.remaining_days + ' 天' : '-' }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="old_key" label="上一代金鑰" width="200" show-overflow-tooltip>
             <template #default="scope">
                 <span v-if="scope.row.old_key" style="font-family: monospace;">{{ scope.row.old_key }}</span>
                 <span v-else class="text-placeholder">-</span>
             </template>
          </el-table-column>

          <el-table-column prop="key_create_time" label="創建時間" width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.key_create_time) }}</template>
          </el-table-column>

          <el-table-column prop="key_last_time_used" label="最後使用時間" width="180" sortable>
             <template #default="scope">{{ formatDate(scope.row.key_last_time_used) }}</template>
          </el-table-column>
          
          <el-table-column prop="key_description" label="描述" min-width="200" show-overflow-tooltip />

          <el-table-column label="操作" width="220" align="center"> 
            <template #default="scope">
              <div class="action-buttons">
                
                <div v-if="canManageKeys" style="margin-right: 5px;">
                    <el-button
                      v-if="scope.row.key_state === 'Disabled' && (auth.isSuperuser || scope.row.key_type === 'Child')"
                      type="success"
                      size="small"
                      plain
                      :loading="updatingStateMap[scope.row.key_id]"
                      @click="handleToggleState(scope.row)"
                    >
                      啟用金鑰
                    </el-button>

                    <el-button
                      v-else-if="isKeyActive(scope.row.key_state) && (auth.isSuperuser || scope.row.key_type === 'Child')"
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
                  v-if="scope.row.key_type === 'Parent' && canManageParentKeys && isKeyActive(scope.row.key_state)"
                  size="small"
                  type="primary"
                  :loading="creatingKeyMap[scope.row.key_id]"
                  @click="handleRotateKey(scope.row)"
                >
                  新增金鑰
                </el-button>

                <el-button
                  v-if="scope.row.key_type === 'Child' && canManageKeys && isKeyActive(scope.row.key_state)"
                  size="small"
                  type="primary"
                  :loading="creatingKeyMap[scope.row.key_id]"
                  @click="handleRotateKey(scope.row)"
                >
                  新增金鑰
                </el-button>

                <el-button
                  v-if="canManageKeys && scope.row.key_state === 'Disabled' && scope.row.key_type === 'Child'"
                  size="small"
                  type="danger"
                  @click="handleDeleteKey(scope.row)"
                >
                  刪除金鑰
                </el-button>

                <el-button
                  v-if="canManageParentKeys && scope.row.key_state === 'Disabled' && scope.row.key_type === 'Parent' && scope.row.children && scope.row.children.length > 0"
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
      v-model="firstCreateDialogVisible"
      title="第一次新增金鑰"
      width="650px"
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form :model="firstCreateForm" label-position="top">
        
        <el-form-item label="專案代號">
           <el-input v-model="firstCreateForm.codename" disabled placeholder="請先選擇專案" />
        </el-form-item>

        <el-form-item label="雲平台類型" required>
          <el-select v-model="firstCreateForm.cloud_type" placeholder="請選擇雲平台" style="width: 100%">
            <el-option label="AWS" value="AWS" />
            <el-option label="GCP" value="GCP" />
          </el-select>
        </el-form-item>

        <el-form-item label="要新增的金鑰類型" required>
          <el-select 
            v-model="firstCreateForm.key_type" 
            placeholder="請選擇金鑰類型" 
            style="width: 100%"
            :disabled="isProjectAdmin"
          >
            <el-option label="Parent (母Key)" value="Parent" />
            <el-option label="Child (子Key)" value="Child" />
          </el-select>
        </el-form-item>

        <el-form-item 
          v-if="firstCreateForm.cloud_type === 'AWS'" 
          label="IAM Username (請輸入)" 
          required
        >
          <el-input v-model="firstCreateForm.account" placeholder="請輸入 AWS IAM Username" />
        </el-form-item>

        <el-form-item 
          v-if="firstCreateForm.cloud_type === 'GCP'" 
          label="Service Account Email (請輸入)" 
          required
        >
          <el-input v-model="firstCreateForm.account" placeholder="請輸入 GCP Service Account Email" />
        </el-form-item>
        
        <el-alert
            v-if="!firstCreateForm.cloud_type"
            title="請先選擇雲平台類型以輸入帳號資訊"
            type="info"
            :closable="false"
        />

      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="firstCreateDialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            :loading="isSubmittingFirstKey" 
            @click="submitFirstCreateKey"
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