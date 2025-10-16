<template>
  <div class="settings-page">
    <el-tabs type="border-card">
      <el-tab-pane>
        <template #label>
          <el-icon><User /></el-icon>
          <span>個人資料</span>
        </template>
        <el-form :model="userForm" label-width="120px">
          <el-form-item label="使用者名稱">
            <el-input v-model="userForm.username" placeholder="請輸入使用者名稱" />
          </el-form-item>
          <el-form-item label="電子郵件">
            <el-input v-model="userForm.email" placeholder="請輸入電子郵件" />
          </el-form-item>
          <el-form-item label="顯示名稱">
            <el-input v-model="userForm.displayName" placeholder="請輸入顯示名稱" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveUserSettings">儲存變更</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane>
        <template #label>
          <el-icon><Bell /></el-icon>
          <span>通知設定</span>
        </template>
        <el-form :model="notificationForm" label-width="120px">
          <el-form-item label="電子郵件通知">
            <el-switch v-model="notificationForm.emailEnabled" />
          </el-form-item>
          <el-form-item label="系統通知">
            <el-switch v-model="notificationForm.systemEnabled" />
          </el-form-item>
          <el-form-item label="通知頻率">
            <el-select v-model="notificationForm.frequency" placeholder="請選擇通知頻率">
              <el-option label="即時" value="instant" />
              <el-option label="每日摘要" value="daily" />
              <el-option label="每週摘要" value="weekly" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveNotificationSettings">儲存變更</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane>
        <template #label>
          <el-icon><Setting /></el-icon>
          <span>系統設定</span>
        </template>
        <el-form :model="systemForm" label-width="120px">
          <el-form-item label="語言">
            <el-select v-model="systemForm.language" placeholder="請選擇語言">
              <el-option label="繁體中文" value="zh-TW" />
              <el-option label="English" value="en" />
              <el-option label="日本語" value="ja" />
            </el-select>
          </el-form-item>
          <el-form-item label="主題">
            <el-select v-model="systemForm.theme" placeholder="請選擇主題">
              <el-option label="淺色" value="light" />
              <el-option label="深色" value="dark" />
              <el-option label="跟隨系統" value="auto" />
            </el-select>
          </el-form-item>
          <el-form-item label="自動登出時間">
            <el-select v-model="systemForm.autoLogout" placeholder="請選擇自動登出時間">
              <el-option label="15 分鐘" value="15" />
              <el-option label="30 分鐘" value="30" />
              <el-option label="1 小時" value="60" />
              <el-option label="永不" value="never" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSystemSettings">儲存變更</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane>
        <template #label>
          <el-icon><Lock /></el-icon>
          <span>安全設定</span>
        </template>
        <el-form :model="securityForm" label-width="120px">
          <el-form-item label="變更密碼">
            <el-input v-model="securityForm.currentPassword" type="password" placeholder="目前密碼" />
            <div style="margin: 10px 0;"></div>
            <el-input v-model="securityForm.newPassword" type="password" placeholder="新密碼" />
            <div style="margin: 10px 0;"></div>
            <el-input v-model="securityForm.confirmPassword" type="password" placeholder="確認新密碼" />
          </el-form-item>
          <el-form-item label="雙重認證">
            <el-switch v-model="securityForm.twoFactorEnabled" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="saveSecuritySettings">儲存變更</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { User, Bell, Setting, Lock } from '@element-plus/icons-vue'

definePageMeta({
  layout: 'default'
})

// 個人資料表單
const userForm = ref({
  username: '',
  email: '',
  displayName: ''
})

// 通知設定表單
const notificationForm = ref({
  emailEnabled: true,
  systemEnabled: true,
  frequency: 'instant'
})

// 系統設定表單
const systemForm = ref({
  language: 'zh-TW',
  theme: 'light',
  autoLogout: '30'
})

// 安全設定表單
const securityForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  twoFactorEnabled: false
})

// 儲存設定的方法
const saveUserSettings = () => {
  ElMessage.success('個人資料已更新')
}

const saveNotificationSettings = () => {
  ElMessage.success('通知設定已更新')
}

const saveSystemSettings = () => {
  ElMessage.success('系統設定已更新')
}

const saveSecuritySettings = () => {
  if (securityForm.value.newPassword !== securityForm.value.confirmPassword) {
    ElMessage.error('新密碼與確認密碼不符')
    return
  }
  ElMessage.success('安全設定已更新')
}
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.el-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.el-tabs :deep(.el-tabs__item) {
  display: flex;
  align-items: center;
  gap: 5px;
}

.el-tabs :deep(.el-tabs__item .el-icon) {
  margin-right: 5px;
}

.el-form-item {
  margin-bottom: 22px;
}

.el-select {
  width: 100%;
}
</style> 