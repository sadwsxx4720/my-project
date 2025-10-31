<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

definePageMeta({
  layout: 'default' // 使用與 log.vue 相同的佈局
});

const route = useRoute();
const router = useRouter();
const logDetail = ref<any>(null); // 儲存解析後的 log 物件
const loading = ref(true); // 初始載入狀態

// Helper function to format date or return 'N/A'
const formatDate = (dateString: string | null | undefined): string => {
    try { return dateString ? new Date(dateString).toLocaleString() : 'N/A'; } 
    catch (e) { return 'Invalid Date'; }
};

// 格式化執行結果
const formatResult = (result: boolean | undefined): string => {
    if (result === true) return '成功';
    if (result === false) return '失敗';
    return 'N/A';
};
const formatResultType = (result: boolean | undefined): ('success' | 'danger' | 'info') => {
    if (result === true) return 'success';
    if (result === false) return 'danger';
    return 'info';
};

onMounted(() => {
  const logDataString = route.query.data as string | undefined;
  
  if (!logDataString) {
    ElMessage.warning('缺少日誌資料');
    router.replace('/log'); // 導回列表頁
    return;
  }
  
  try {
    // 解析從 query 傳來的 JSON 字串
    const parsedData = JSON.parse(logDataString);
    logDetail.value = parsedData;
  } catch (e) {
    console.error("無法解析日誌資料:", e);
    ElMessage.error('無法讀取日誌詳細資訊');
    router.replace('/log');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="log-detail-page" style="padding: 20px;">
    <el-card>
      <template #header>
        <span>日誌詳細資訊</span>
      </template>

      <el-skeleton v-if="loading" :rows="5" animated />

      <div v-else-if="logDetail">
        <el-descriptions border :column="1">
          <el-descriptions-item label="使用者帳號">{{ logDetail.username || 'N/A' }}</el-descriptions-item>
          <el-descriptions-item label="操作行為">{{ logDetail.action || 'N/A' }}</el-descriptions-item>
          <el-descriptions-item label="執行時間">{{ formatDate(logDetail.execution_time) }}</el-descriptions-item>
          <el-descriptions-item label="執行結果">
            <el-tag :type="formatResultType(logDetail.execution_result)">
              {{ formatResult(logDetail.execution_result) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="詳細資訊 (Detail)">
             <pre class="detail-pre">{{ logDetail.detail || 'N/A' }}</pre>
          </el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 20px;">
          <el-button @click="router.push('/log')">返回日誌列表</el-button> 
        </div>
      </div>

      <div v-else>
        <p>無法載入日誌詳細資訊</p>
        <el-button @click="router.push('/log')">返回日誌列表</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
/* .log-detail-page {
  padding: 20px;
} */ /* Padding 已移至 template */

/* 仿照您在 log.vue 中為 dialog 內的 pre 設計的樣式 */
.detail-pre {
    background-color: #f8f8f8;
    padding: 10px 15px;
    border-radius: 4px;
    max-height: 400px;
    overflow-y: auto;
    white-space: pre-wrap; /* 自動換行 */
    word-wrap: break-word; /* 斷詞 */
    margin: 0; /* 移除 pre 的預設 margin */
    font-family: Menlo, Monaco, 'Courier New', monospace; /* 使用等寬字體 */
    font-size: 0.9em;
}
</style>