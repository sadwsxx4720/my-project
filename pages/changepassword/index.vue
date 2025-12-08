<template>
  <div class="change-password-container">
    <el-card class="password-card">
      <template #header>
        <div class="card-header">
          <h2>更新密碼</h2>
        </div>
      </template>

      <!-- 判斷狀態：若未登入顯示提示，避免自動跳轉造成迴圈 -->
      <div v-if="!auth.isAuthenticated" class="unauth-message">
        <el-result
          icon="warning"
          title="尚未登入"
          sub-title="請先登入後再進行密碼變更操作"
        >
          <template #extra>
            <el-button type="primary" @click="goToLogin">前往登入頁</el-button>
          </template>
        </el-result>
      </div>

      <!-- 若已登入則顯示表單 -->
      <el-form 
        v-else
        ref="formRef"
        :model="form"
        label-position="top"
        class="password-form"
        @submit.prevent
      >
        <!-- 顯示當前帳號 (唯讀) -->
        <el-form-item label="當前登入帳號">
          <el-input v-model="currentUsername" disabled prefix-icon="User" />
        </el-form-item>

        <!-- 新密碼 -->
        <el-form-item label="請輸入新密碼" required>
          <el-input 
            v-model="form.newPassword" 
            type="password" 
            placeholder="請輸入新密碼" 
            show-password
            prefix-icon="Lock"
          />
        </el-form-item>

        <!-- 確認新密碼 -->
        <el-form-item label="請再次輸入密碼" required :error="passwordError">
          <el-input 
            v-model="form.confirmPassword" 
            type="password" 
            placeholder="請再次輸入密碼" 
            show-password
            prefix-icon="Lock"
          />
        </el-form-item>

        <!-- 按鈕區 -->
        <div class="form-actions">
          <el-button 
            type="primary" 
            class="submit-btn" 
            :disabled="!isFormValid" 
            :loading="loading"
            @click="handleSubmit"
          >
            確認更新
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';

const router = useRouter();
const auth = useAuthStore();

// --- State ---
const loading = ref(false);
const form = reactive({
  newPassword: '',
  confirmPassword: ''
});

// --- Computed Properties ---

// 獲取當前登入的使用者名稱
const currentUsername = computed(() => auth.user?.username || '');

// 驗證密碼是否不一致 (確認密碼欄位有值才顯示錯誤)
const passwordError = computed(() => {
  if (form.confirmPassword && form.newPassword !== form.confirmPassword) {
    return '兩次輸入的密碼不相同';
  }
  return '';
});

// 判斷按鈕是否可點選 (必須兩個都有值且相同)
const isFormValid = computed(() => {
  return (
    form.newPassword.length > 0 &&
    form.confirmPassword.length > 0 &&
    form.newPassword === form.confirmPassword
  );
});

// --- Methods ---

const goToLogin = () => {
  router.push('/login');
};

const handleSubmit = async () => {
  if (!isFormValid.value) return;
  if (!currentUsername.value) {
    ElMessage.error('無法獲取使用者資訊，請重新登入');
    return;
  }

  loading.value = true;

  try {
    const token = localStorage.getItem('auth_token');
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const payload = {
      username: currentUsername.value,
      password: form.newPassword
    };

    console.log('正在更新密碼...', payload);

    const res = await axios.post('http://localhost:8000/users/updatePWD', payload, config);

    if (res.status === 200 || res.status === 201) {
      ElMessage.success('密碼更新成功！請重新登入。');
      // 清空表單
      form.newPassword = '';
      form.confirmPassword = '';
      
      // 更新成功後，重新登入
      await auth.logout(); 
      router.push('/login'); 
    } else {
      ElMessage.error('密碼更新失敗，請稍後再試');
    }

  } catch (error: any) {
    console.error('更新密碼錯誤:', error);
    const msg = error.response?.data?.message || error.message || '更新發生錯誤';
    ElMessage.error(msg);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.change-password-container {
  display: flex;
  justify-content: center;
  align-items: center; /* 垂直置中 */
  height: 100%; /* 填滿父層高度 */
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.password-card {
  width: 100%;
  /* 移除固定的 min-height，讓內容撐開，或者根據需求調整 */
  max-width: 550px; /* 稍微加寬一點 */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header h2 {
  margin: 0;
  font-size: 22px;
  text-align: center;
  color: #303133;
  padding: 10px 0;
}

.password-form {
  padding: 30px 40px; /* 增加內部邊距 */
}

.unauth-message {
  padding: 40px 20px;
  text-align: center;
}

.form-actions {
  display: flex;
  justify-content: center;
  margin-top: 60px; /* 增加按鈕與上方欄位的距離 */
}

.submit-btn {
  width: 100%;
  height: 50px;
  padding: 12px;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 1px;
}

/* --- 修改 Element Plus 樣式以增加間距 --- */

/* 1. 增加每個表單項目 (Label + Input) 之間的垂直間距 */
:deep(.el-form-item) {
  margin-bottom: 30px; /* 從預設值(約20px)增加到 40px */
}

/* 2. 增加 Label 與 Input 之間的距離 */
:deep(.el-form-item__label) {
  font-weight: 500;
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 10px; /* 讓標題與輸入框分開一點 */
}

/* 3. 調整輸入框的高度與內距，讓它看起來更舒適 */
:deep(.el-input__wrapper) {
  padding: 10px 15px;
}
</style>