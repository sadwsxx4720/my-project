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
      // 【修正】同時判斷 code 為 0 或 200 皆視為成功
      if (result.status === 'fulfilled' && (result.value.data?.code === 0 || result.value.data?.code === 200) && result.value.data?.data) {
        fetchedDetails.push(result.value.data.data);
      } else {
        hasError = true;
        let errorMsg = `無法獲取金鑰 ${currentKeyId} 的詳細資料`;
        if (result.status === 'rejected') {
            console.error(`獲取金鑰 ${currentKeyId} 出錯 (rejected):`, result.reason);
             errorMsg = result.reason?.response?.data?.message || errorMsg;
        } else if (result.status === 'fulfilled') {
            // 雖然請求成功但業務邏輯失敗 (code 不對)
            console.error(`獲取金鑰 ${currentKeyId} 業務失敗:`, result.value.data);
             errorMsg = result.value.data?.message || errorMsg;
        } else {
             console.error(`獲取金鑰 ${currentKeyId} 資料格式錯誤:`, result);
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
              <el-descriptions-item label="狀態">
                <el-tag :type="key.key_state === 'Active' ? 'success' : 'info'">{{ key.key_state || 'N/A' }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="輪替狀態">{{ key.rotation_state || 'N/A' }}</el-descriptions-item>
              <el-descriptions-item label="建立時間">{{ formatDate(key.key_create_time) }}</el-descriptions-item>
              <el-descriptions-item label="最後使用時間">{{ formatDate(key.key_last_time_used) }}</el-descriptions-item>
              <el-descriptions-item label="描述">{{ key.key_description || 'N/A' }}</el-descriptions-item>
              
              <!-- codename 為字串，直接顯示 -->
              <el-descriptions-item label="代號 (codename)">
                 <span>{{ key.codename || 'N/A' }}</span>
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