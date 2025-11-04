<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
// 讀取 'ids' 參數並拆分
const keyIdsString = route.query.ids as string | undefined
const keyIds = keyIdsString ? keyIdsString.split(',').map(id => id.trim()).filter(id => id) : [] // 確保去空

// 使用陣列儲存多個金鑰詳細資料
const keyDetails = ref<any[]>([])
const loading = ref(false)

// 使用 Map 追蹤每個刪除按鈕的 loading 狀態
//const deleting = ref<Record<string, boolean>>({})

// 驗證是否有 keyIds
if (keyIds.length === 0) {
  ElMessage.warning('缺少金鑰 ID，請從列表頁進入')
  router.replace('/tools/tool1')
}

// 獲取多個金鑰的詳細資料
const fetchKeyDetails = async () => {
  if (keyIds.length === 0) return

  loading.value = true
  keyDetails.value = [] // 清空舊資料
  const savedToken = localStorage.getItem('auth_token')
  if (!savedToken) {
      ElMessage.error('尚未登入，請先登入')
      router.push('/login')
      return
  }

  // 為每個 keyId 創建一個 API 請求 Promise
  const fetchPromises = keyIds.map(id =>
    axios.post('http://localhost:8000/keys/get_one',
      { key_id: id },
      { headers: { Authorization: `Bearer ${savedToken}` } }
    )
  );

  try {
    const results = await Promise.allSettled(fetchPromises);
    const fetchedDetails: any[] = [];
    let hasError = false;

    results.forEach((result, index) => {
      const currentKeyId = keyIds[index];
      if (result.status === 'fulfilled' && result.value.data?.code === 200 && result.value.data?.data) {
        fetchedDetails.push(result.value.data.data);
      } else {
        hasError = true;
        let errorMsg = `無法獲取金鑰 ${currentKeyId} 的詳細資料`;
        if (result.status === 'rejected') {
            console.error(`獲取金鑰 ${currentKeyId} 出錯 (rejected):`, result.reason);
             errorMsg = result.reason?.response?.data?.message || errorMsg;
        } else if (result.value.data?.code !== 200) {
            console.error(`獲取金鑰 ${currentKeyId} 業務失敗:`, result.value.data);
             errorMsg = result.value.data?.message || errorMsg;
        } else {
             console.error(`獲取金鑰 ${currentKeyId} 資料格式錯誤:`, result.value.data);
             errorMsg = `金鑰 ${currentKeyId} 資料格式錯誤`;
        }
        ElMessage.warning(errorMsg);
      }
    });

    // 按照原始 keyIds 的順序排序獲取的結果 (可選)
    keyDetails.value = keyIds.map(id => fetchedDetails.find(detail => detail.key_id === id)).filter(Boolean);

    if (keyDetails.value.length === 0 && hasError) {
        ElMessage.warning('無法獲取任何指定的金鑰資訊');
    }

  } catch (err) {
      console.error("處理金鑰詳細資料請求時發生意外錯誤:", err);
      ElMessage.error('獲取金鑰詳細資料時發生未知錯誤');
  } finally {
    loading.value = false
  }
}
/*
// 停用按鈕 (接受 keyId)
const handleDisable = (keyId: string) => {
  ElMessage.success(`金鑰 ${keyId} 已停用（僅前端示意）`)
  // 實際 API 呼叫...
}

// 刪除邏輯 (接受 keyId)
const handleDelete = async (keyIdToDelete: string) => {
  if (!keyIdToDelete) return

  try {
    await ElMessageBox.confirm(
      `確定要刪除金鑰 ID "${keyIdToDelete}" 嗎？此操作無法復原。`,
      '警告',
      { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' }
    )

    deleting.value[keyIdToDelete] = true
    const savedToken = localStorage.getItem('auth_token')
    if (!savedToken) {
      ElMessage.error('登入憑證已過期，請重新登入')
      deleting.value[keyIdToDelete] = false
      return
    }

    const payload = { key_id: keyIdToDelete }
    const res = await axios.delete('http://localhost:8000/keys/delete', {
      headers: { Authorization: `Bearer ${savedToken}` },
      data: payload
    })

    if (res.data && res.data.code === 200) {
      ElMessage.success(`金鑰 ${keyIdToDelete} 刪除成功`)
      // 從列表中移除
      keyDetails.value = keyDetails.value.filter(key => key.key_id !== keyIdToDelete);
      if (keyDetails.value.length === 0) {
          router.push('/tools/tool1'); // 如果都刪完了，返回列表
      }
    } else {
      ElMessage.error(res.data.message || '刪除失敗')
    }

  } catch (err: any) {
    if (err !== 'cancel') {
      console.error(`刪除金鑰 ${keyIdToDelete} 時發生錯誤:`, err);
      let errorMessage = '刪除時發生錯誤';
      if (err.response) { errorMessage = err.response.data?.message || `請求失敗: ${err.response.status}`; }
      else if (err.request) { errorMessage = '無法連接伺服器'; }
      else { errorMessage = `請求設定錯誤: ${err.message}`; }
      ElMessage.error(errorMessage);
    }
  } finally {
    deleting.value[keyIdToDelete] = false
  }
} */

// Helper function to format date or return 'N/A'
const formatDate = (dateString: string | null | undefined) => {
    try {
        return dateString ? new Date(dateString).toLocaleString() : 'N/A';
    } catch (e) {
        console.warn(`Invalid date format for: ${dateString}`);
        return 'Invalid Date';
    }
}

onMounted(fetchKeyDetails)
</script>

<template>
  <div class="key-detail-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <span>金鑰詳細資訊</span>
      </template>

      <el-skeleton v-if="loading" :rows="keyIds.length * 6" animated />

      <div v-else-if="keyDetails.length > 0">
        <div v-for="(key, index) in keyDetails" :key="key.key_id || index" class="key-block">
            <h4>金鑰 {{ index + 1 }} / ID: {{ key.key_id }}</h4>
            <el-descriptions border :column="1">
              <el-descriptions-item label="狀態">{{ key.key_state || 'N/A' }}</el-descriptions-item>
              <el-descriptions-item label="輪替狀態">{{ key.rotation_state || 'N/A' }}</el-descriptions-item>
              <el-descriptions-item label="建立時間">{{ formatDate(key.key_create_time) }}</el-descriptions-item>
              <el-descriptions-item label="最後使用時間">{{ formatDate(key.key_last_time_used) || '尚未使用' }}</el-descriptions-item>
              <el-descriptions-item label="描述">{{ key.key_description || 'N/A' }}</el-descriptions-item>
              <el-descriptions-item label="代號 (codename)">
                 <span v-if="key.codename && key.codename.length > 0">{{ key.codename.join(', ') }}</span>
                 <span v-else>N/A</span>
              </el-descriptions-item>
            </el-descriptions>
            <el-divider v-if="index < keyDetails.length - 1" />
        </div>

         <div style="margin-top: 20px; text-align: center;">
            <el-button @click="router.push('/tools/tool1')">返回列表</el-button>
         </div>

      </div>

      <div v-else>
        <p>找不到指定的金鑰資訊或獲取失敗</p>
        <el-button @click="router.push('/tools/tool1')">返回列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* .key-detail-page {
  padding: 20px;
} */ /* Padding 已移至 template */
.key-block h4 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #303133;
    font-size: 1.1em;
}
.el-descriptions {
    margin-bottom: 15px;
}
.el-divider {
    margin: 30px 0;
}
</style>