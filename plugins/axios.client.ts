import { defineNuxtPlugin } from '#app'
import axios from 'axios'
import { ElMessageBox } from 'element-plus'

export default defineNuxtPlugin((nuxtApp) => {
  // 防止重複彈窗的變數
  let isSessionExpiredShow = false;

  // 設定 Axios 全域回應攔截器
  axios.interceptors.response.use(
    (response) => {
      // 情況 A：後端回傳 200，但內容包含 code: 401
      if (response.data && response.data.code === 401) {
        handleSessionExpired();
        return Promise.reject(new Error('Session Expired'));
      }
      return response;
    },
    (error) => {
      // 情況 B：後端回傳 HTTP 401 狀態碼
      if (error.response && error.response.status === 401) {
        handleSessionExpired();
      }
      return Promise.reject(error);
    }
  );

  // 處理過期的函式
  function handleSessionExpired() {
    if (isSessionExpiredShow) return;
    isSessionExpiredShow = true;

    ElMessageBox.alert(
      '您的登入連線已逾時，為確保帳戶安全，請重新登入。',
      '連線逾時',
      {
        confirmButtonText: '確定',
        type: 'warning',
        showClose: false,
        closeOnClickModal: false,
        closeOnPressEscape: false,
        callback: () => {
          // 清除 Token
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          
          isSessionExpiredShow = false;

          // 強制導向回登入頁
          window.location.href = '/login';
        },
      }
    )
  }
})