<template>
  <div class="keys-detail-container">
    
    <div class="page-header">
      <div class="left-section">
        <el-button link @click="goBack" class="back-btn">
          <el-icon :size="20"><Back /></el-icon>
          <span class="back-text">返回專案列表</span>
        </el-button>
        <div class="divider"></div>
        <div class="title-wrapper">
          <h2 class="page-title">母 Key 詳細資料</h2>
          <span class="subtitle" v-if="projectCodename">
            專案代號：{{ projectCodename }} <span v-if="projectName">({{ projectName }})</span>
          </span>
        </div>
      </div>

      <div class="right-section">
        <el-button type="primary" @click="openBindKeyModal">
          <el-icon class="el-icon--left"><Plus /></el-icon> 
          新增綁定母 Key
        </el-button>
        <el-button :icon="Refresh" circle @click="loadKeyDetails" :loading="loading" />
      </div>
    </div>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table :data="enrichedKeys" style="width: 100%" border stripe>
        
        <el-table-column prop="key_id" label="Key ID" min-width="250" sortable />
        
        <el-table-column prop="cloud_type" label="雲平台" width="120" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.cloud_type" effect="light">{{ scope.row.cloud_type }}</el-tag>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="key_description" label="描述" min-width="200" show-overflow-tooltip>
          <template #default="scope">
             {{ scope.row.key_description || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="key_state" label="狀態" width="120" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.key_state === 'Active'" type="success" effect="dark">Active</el-tag>
            <el-tag v-else-if="scope.row.key_state === 'Disabled'" type="danger" effect="dark">Disabled</el-tag>
            <el-tag v-else type="info">{{ scope.row.key_state || 'Unknown' }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" align="center">
          <template #default="scope">
            <el-button
              v-if="scope.row.key_state === 'Active'"
              type="danger"
              size="small"
              plain
              :loading="updatingStateId === scope.row.key_id"
              @click="handleToggleState(scope.row)"
            >
              停用
            </el-button>
            <el-button
              v-else
              type="success"
              size="small"
              plain
              :loading="updatingStateId === scope.row.key_id"
              @click="handleToggleState(scope.row)"
            >
              啟用
            </el-button>
          </template>
        </el-table-column>

      </el-table>

      <el-empty v-if="enrichedKeys.length === 0 && !loading" description="此專案尚未綁定任何母 Key" />
    </el-card>

    <el-dialog
      v-model="bindKeyVisible"
      title="新增綁定母 Key"
      width="650px" 
      append-to-body
      destroy-on-close
    >
      <div class="bind-modal-body">
        <el-alert title="請選擇平台並輸入對應的憑證資訊" type="info" :closable="false" class="mb-4" />

        <el-form label-position="top" class="bind-form">
          <el-form-item label="雲端平台 (Cloud Platform)" required>
            <el-select v-model="bindForm.platform" placeholder="請選擇平台" size="large" style="width: 100%">
              <el-option label="Amazon Web Services (AWS)" value="AWS" />
              <el-option label="Google Cloud Platform (GCP)" value="GCP" />
            </el-select>
          </el-form-item>

          <div v-if="bindForm.platform === 'AWS'" class="platform-section">
            <el-form-item label="AWS Access Key ID" required>
              <el-input v-model="bindForm.keyId" size="large" />
            </el-form-item>
            <el-form-item label="AWS Secret Access Key" required>
              <el-input v-model="bindForm.secretKey" type="password" show-password size="large" />
            </el-form-item>
          </div>

          <div v-else-if="bindForm.platform === 'GCP'" class="platform-section">
            <el-form-item label="GCP Service Account Key ID" required>
              <el-input v-model="bindForm.keyId" placeholder="請輸入 GCP Key ID" size="large" />
            </el-form-item>
            <el-form-item label="GCP Secret Key (JSON File)" required>
               <el-upload
                  ref="uploadRef"
                  class="upload-area"
                  drag
                  action="#"
                  :auto-upload="false"
                  :limit="1"
                  :on-change="handleGcpFileChange"
                  :on-exceed="handleGcpExceed"
                  :file-list="fileList"
                  accept=".json"
                >
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                  <div class="el-upload__text">拖曳或點擊上傳 JSON</div>
                </el-upload>
            </el-form-item>
          </div>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer-actions">
          <el-button @click="bindKeyVisible = false" size="large">取消</el-button>
          <el-button type="primary" :loading="submittingBindKey" @click="submitBindKey" :disabled="isSubmitDisabled" size="large">
            確定綁定
          </el-button>
        </div>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Back, Plus, Refresh, UploadFilled } from '@element-plus/icons-vue';
import { ElMessage, type UploadInstance, type UploadProps, type UploadUserFile } from 'element-plus';
import axios from 'axios';

// --- Setup ---
const route = useRoute();
const router = useRouter();

// --- State ---
const projectCodename = ref('');
const projectName = ref('');
const loading = ref(false);
const rawMainKeys = ref<{key_id: string, key_info: string}[]>([]); 
const enrichedKeys = ref<any[]>([]); 
const updatingStateId = ref<string | null>(null);

// Bind Key Modal State
const bindKeyVisible = ref(false);
const submittingBindKey = ref(false);
const bindForm = reactive({ platform: 'AWS', keyId: '', secretKey: '', jsonContent: '' });
const uploadRef = ref<UploadInstance>();
const fileList = ref<UploadUserFile[]>([]);

// --- Lifecycle ---
onMounted(async () => {
  projectCodename.value = route.query.codename as string || '';
  projectName.value = route.query.projectname as string || '';

  if (!projectCodename.value) {
    ElMessage.error('無效的專案代號，將返回列表');
    router.push('/project'); 
    return;
  }

  await loadKeyDetails();
});

const goBack = () => {
  router.push('/project'); 
};

// --- Core Logic: Load & Enrich Data ---
const loadKeyDetails = async () => {
  loading.value = true;
  enrichedKeys.value = [];
  try {
    const token = localStorage.getItem('auth_token');
    
    // 1. 打 /projects/get_one (POST) 取得專案內的 Key ID 列表
    const projRes = await axios.post('http://localhost:8000/projects/get_one', 
      { codename: projectCodename.value }, 
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    let targetProject = null;
    if (projRes.data && (projRes.data.code === 0 || projRes.data.code === 200) && projRes.data.data) {
       targetProject = projRes.data.data;
    }

    if (!targetProject) {
      ElMessage.error('找不到該專案資訊或獲取失敗');
      return;
    }

    rawMainKeys.value = Array.isArray(targetProject.mainkeys) ? targetProject.mainkeys : [];

    // 2. 遍歷每個 ID，分別打 /keys/get_one (POST) 取得詳細資訊
    const detailsPromises = rawMainKeys.value.map(async (key) => {
      try {
        const detailRes = await axios.post('http://localhost:8000/keys/get_one', // 注意這裡是 keys 複數
          { key_id: key.key_id }, 
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (detailRes.data && (detailRes.data.code === 0 || detailRes.data.code === 200)) {
          return {
            ...key, 
            ...detailRes.data.data 
          };
        } else {
          return { ...key, key_state: 'Unknown', key_description: '無法取得詳情' };
        }
      } catch (e) {
        console.error(`Failed to fetch detail for ${key.key_id}`, e);
        return { ...key, key_state: 'Error', key_description: 'API Error' };
      }
    });

    enrichedKeys.value = await Promise.all(detailsPromises);

  } catch (err) {
    console.error(err);
    ElMessage.error('資料載入失敗');
  } finally {
    loading.value = false;
  }
};

// --- Core Logic: Update State (修正後) ---
const handleToggleState = async (row: any) => {
  if (updatingStateId.value) return;

  const currentState = row.key_state; // 取得「目前狀態」
  
  // 計算預期的目標狀態 (僅用於 API 成功後的 UI 更新)
  const targetState = currentState === 'Active' ? 'Disabled' : 'Active';
  const actionText = currentState === 'Active' ? '停用' : '啟用';

  try {
    updatingStateId.value = row.key_id;
    const token = localStorage.getItem('auth_token');

    // 格式：{ "key_id": "string", "key_state": "string" }
    const res = await axios.post('http://localhost:8000/keys/update_state', 
      {
        key_id: row.key_id,
        key_state: currentState // <--- 這裡是傳送目前狀態
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       ElMessage.success(`已${actionText}金鑰`);
       // API 成功後，更新前端顯示為目標狀態
       row.key_state = targetState;
    } else {
       ElMessage.error(res.data?.message || `無法${actionText}`);
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('操作失敗');
  } finally {
    updatingStateId.value = null;
  }
};

// --- Add Bind Key Logic ---
const openBindKeyModal = () => {
  fileList.value = [];
  bindForm.platform = 'AWS';
  bindForm.keyId = '';
  bindForm.secretKey = '';
  bindForm.jsonContent = '';
  bindKeyVisible.value = true;
};

const handleGcpFileChange: UploadProps['onChange'] = (uploadFile, uploadFiles) => {
  if (uploadFiles.length > 1) uploadFiles.shift();
  const rawFile = uploadFile.raw;
  if (!rawFile) return;
  if (rawFile.type !== 'application/json' && !rawFile.name.endsWith('.json')) {
    ElMessage.error('請上傳 .json 格式'); return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const result = e.target?.result;
      if (typeof result === 'string') {
        const jsonObj = JSON.parse(result);
        bindForm.jsonContent = JSON.stringify(jsonObj);
      }
    } catch (err) { bindForm.jsonContent = ''; }
  };
  reader.readAsText(rawFile);
};

const handleGcpExceed: UploadProps['onExceed'] = (files) => {
  uploadRef.value!.clearFiles();
  uploadRef.value!.handleStart(files[0] as UploadUserFile);
};

const isSubmitDisabled = computed(() => {
  if (!bindForm.keyId) return true;
  return bindForm.platform === 'AWS' ? !bindForm.secretKey : !bindForm.jsonContent;
});

// 【修改】submitBindKey 函式：新增 summary API 呼叫
const submitBindKey = async () => {
  submittingBindKey.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    
    // 1. 準備新的 Key
    let finalKeyInfo = bindForm.platform === 'AWS' ? bindForm.secretKey : bindForm.jsonContent;
    const newKey = { key_id: bindForm.keyId, key_info: finalKeyInfo };
    
    // 2. 為了 append，我們需要將現有的 keys 加上新的 key
    const updatedMainKeys = [...rawMainKeys.value, newKey];

    const payload = {
      codename: projectCodename.value,
      mainkeys: updatedMainKeys
    };

    const res = await axios.post('http://localhost:8000/projects/update_mainkey', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
       
       // --- [新增] 同步呼叫 Summary API ---
       try {
         await axios.post('http://localhost:8000/cloud_platform/summary', 
           { codename: projectCodename.value }, 
           { headers: { Authorization: `Bearer ${token}` } }
         );
       } catch (summaryErr) {
         console.error('更新 Cloud Platform Summary 失敗', summaryErr);
         // 這裡選擇不阻擋流程，僅紀錄錯誤，因為綁定本身已經成功
       }
       // -----------------------------------

       ElMessage.success('綁定成功');
       bindKeyVisible.value = false;
       await loadKeyDetails(); // 重新載入列表
    } else {
       ElMessage.error(res.data?.message || '綁定失敗');
    }
  } catch (err) {
    console.error(err);
    ElMessage.error('API Error');
  } finally {
    submittingBindKey.value = false;
  }
};

</script>

<style scoped>
.keys-detail-container { padding: 20px; background-color: #f5f7fa; min-height: 100vh; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background-color: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.left-section, .right-section { display: flex; align-items: center; gap: 15px; }
.back-btn { font-size: 16px; padding-left: 0; color: #606266; }
.back-btn:hover { color: #409eff; }
.back-text { margin-left: 5px; font-weight: 500; }
.divider { width: 1px; height: 20px; background-color: #dcdfe6; margin: 0 15px; }
.title-wrapper { display: flex; flex-direction: column; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #303133; }
.subtitle { font-size: 13px; color: #909399; margin-top: 4px; }
.table-card { border-radius: 8px; border: none; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05); }
.text-gray { color: #ccc; }
.mb-4 { margin-bottom: 16px; }

/* Upload Styles */
.upload-area { width: 100%; }
.upload-area :deep(.el-upload-dragger) { width: 100%; height: 160px; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 2px dashed #dcdfe6; }
.upload-area :deep(.el-upload-dragger:hover) { border-color: #409eff; }
.bind-form .el-form-item { margin-bottom: 24px; }
.dialog-footer-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 10px; }
</style>