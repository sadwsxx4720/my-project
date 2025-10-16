# RD3 Cloud Tool

## 前端框架
Nuxt 3

## 套件
- **前端框架**: Nuxt 3
- **UI 框架**: Element Plus
- **包管理器**: pnpm
- **開發語言**: TypeScript

## 快速開始

### 環境要求
- Node.js 20.10.0 (建議使用 nvm 進行 Node.js 版本管理)
  ```bash
  # 使用 nvm 安裝指定版本
  nvm install 20.10.0
  
  # 切換到指定版本
  nvm use 20.10.0
  ```

### 安裝步驟
1. 安裝pnpm：
```bash
npm install -g pnpm
```

2. 安裝依賴：
```bash
pnpm install
```

3. 啟動開發服務器：
```bash
pnpm dev
```

4. 建置生產版本：
```bash
pnpm build
```

## 開發指南

### 新增頁面
1. 在 `pages` 目錄下創建新的 `.vue` 文件
2. Nuxt 會自動生成對應的路由

### 使用 Element Plus 元件
```vue
<template>
  <el-button type="primary">按鈕</el-button>
</template>

<script setup lang="ts">
// 元件會自動導入，無需手動 import
</script>
```
