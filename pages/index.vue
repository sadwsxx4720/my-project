<script setup lang="ts">
import { Monitor, Tools, Setting, Key, User } from '@element-plus/icons-vue'

const router = useRouter()

definePageMeta({
  layout: 'default'
})
</script>

<template>
  <div class="home-page">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>金鑰管理平台</span>
            </div>
          </template>
          <div class="welcome-content">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-card shadow="hover" class="feature-card">
                  <template #header>
                    <h3>快速開始</h3>
                  </template>
                  <ul class="quick-start-list">
                    <li>
                      <el-link type="primary" @click="router.push('/dashboard')">
                        <el-icon><Monitor /></el-icon>
                        查看儀表板
                      </el-link>
                    </li>
                    <li>
                      <el-link type="primary" @click="router.push('/tools/tool1')">
                        <el-icon><Key /></el-icon>
                        金鑰管理
                      </el-link>
                    </li>
                    <li>
                      <el-link type="primary" @click="router.push('/settings')">
                        <el-icon><User /></el-icon>
                        帳號管理
                      </el-link>
                    </li>
                    <li>
                      <el-link type="primary" @click="router.push('/settings')">
                        <el-icon><Setting /></el-icon>
                        系統設定
                      </el-link>
                    </li>
                  </ul>
                </el-card>
              </el-col>
              <el-col :span="12">
                <el-card shadow="hover" class="feature-card">
                  <template #header>
                    <h3>最近更新</h3>
                  </template>
                  <ul class="updates-list">
                    <li>
                      <span class="update-date">2025/03/20</span>
                      新增功能：工具三
                    </li>
                    <li>
                      <span class="update-date">2025/03/15</span>
                      優化系統效能
                    </li>
                    <li>
                      <span class="update-date">2025/03/10</span>
                      修復已知問題
                    </li>
                  </ul>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.home-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.welcome-content {
  margin-top: 20px;
}

.feature-card {
  height: 100%;
}

.quick-start-list,
.updates-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-start-list li,
.updates-list li {
  margin-bottom: 15px;
}

.update-date {
  color: #909399;
  margin-right: 10px;
  font-size: 0.9em;
}
</style> 