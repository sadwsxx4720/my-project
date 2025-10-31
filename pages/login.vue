<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2 class="login-title">登入系統</h2>
      </template>

      <el-form :model="formData" label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="帳號">
          <el-input
            v-model="formData.username"
            placeholder="請輸入帳號"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item label="密碼">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="請輸入密碼"
            :prefix-icon="Lock"
            show-password
            clearable
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            @click="handleLogin"
            :loading="loading"
            style="width: 100%;"
          >
            登入
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
// *** 修改：引入 ElMessageBox ***
import { ElMessage, ElMessageBox } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';

const router = useRouter();
const auth = useAuthStore();

const formData = reactive({
  username: '',
  password: ''
});

const loading = ref(false);
// 移除 errorMessage ref

definePageMeta({
  layout: 'auth' // 假設您有 auth 佈局
});

const handleLogin = async () => {
  if (!formData.username || !formData.password) {
    ElMessage.warning('請輸入帳號與密碼');
    return;
  }

  loading.value = true;
  // errorMessage.value = ''; // 移除

  try {
    // 呼叫 auth store 中的 login action
    await auth.login(formData.username, formData.password);

    // 登入成功後的跳轉由 auth.ts 中的 login 函數處理
    
  } catch (err: any) {
    console.error('Login page caught error:', err);
    
    // *** 修改：使用 ElMessageBox.alert 顯示錯誤 ***
    await ElMessageBox.alert(
      err.message || '請檢查您的帳號或密碼', // 彈出框內容 (來自 auth.ts 拋出的錯誤)
      '登入失敗', // 彈出框標題
      {
        confirmButtonText: '確定', // 按鈕文字
        type: 'error', // 錯誤圖標
        draggable: true, // (可選) 允許拖動
        autofocus: true, // (可選) 自動對焦 "確定" 按鈕
      }
    );
    
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-title {
  margin: 0;
  text-align: center;
  color: #303133;
}

.el-form-item {
  margin-bottom: 25px;
}

.el-button {
  width: 100%;
}
</style>