<template>
  <div class="project-members-container">
    
    <div v-if="!currentProjectCode || currentProjectCode === 'all'" class="empty-state">
      <el-empty description="請先由上方選擇一個特定專案以管理人員" />
    </div>

    <div v-else class="content-wrapper">
      
      <div class="page-header">
        <div class="header-left">
          <h2 class="page-title">專案人員列表</h2>
          <span class="project-badge">
            目前專案：{{ currentProjectName }} ({{ currentProjectCode }})
          </span>
          <el-tag :type="currentUserProjectRole === 'admin' ? 'danger' : 'info'" class="role-badge">
            您的權限：{{ currentUserProjectRole ? currentUserProjectRole.toUpperCase() : '無權限/未知' }}
          </el-tag>
        </div>

        <div class="header-right">
          <el-select v-model="filterRole" placeholder="篩選角色" style="width: 150px; margin-right: 10px;">
            <el-option label="顯示全部" value="all" />
            <el-option label="Admin" value="admin" />
            <el-option label="Viewer" value="viewer" />
          </el-select>

          <el-button 
            v-if="currentUserProjectRole === 'admin'" 
            type="primary" 
            @click="openAddMemberModal"
          >
            <el-icon class="el-icon--left"><Plus /></el-icon>
            新增權限 (Viewer)
          </el-button>
        </div>
      </div>

      <el-card shadow="never" class="table-card" v-loading="loading">
        <el-table :data="filteredMembers" style="width: 100%" stripe border>
          <el-table-column prop="username" label="使用者名稱" sortable />
          
          <el-table-column label="使用權限" align="center" sortable prop="projectrole">
            <template #default="scope">
              <el-tag :type="scope.row.projectrole === 'admin' ? 'danger' : 'info'">
                {{ scope.row.projectrole.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column 
            v-if="currentUserProjectRole === 'admin'" 
            label="操作" 
            width="200" 
            align="center"
          >
            <template #default="scope">
              <el-button 
                v-if="scope.row.username !== auth.user?.username"
                size="small" 
                type="danger" 
                plain
                :loading="processingUser === scope.row.username"
                @click="removeMember(scope.row)"
              >
                移除
              </el-button>
              <span v-else class="text-gray-400 text-xs">無法移除自己</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-dialog
      v-model="addMemberVisible"
      title="新增權限"
      width="600px"
      destroy-on-close
      append-to-body
    >
      <div class="modal-content">
        
        <div class="mb-4 role-controls">
          <div class="left-group">
            <div class="role-display">
              <span class="label">指派權限：</span>
              <el-tag type="info">Viewer</el-tag>
            </div>
            
            <el-tag 
              type="warning" 
              effect="plain" 
              class="ml-3"
            >
              已勾選: {{ selectedUsers.length }} 人
            </el-tag>
          </div>
          
          <div class="search-box">
             <el-input
                v-model="searchMemberQuery"
                placeholder="搜尋使用者名稱..."
                prefix-icon="Search"
                size="small"
                clearable
                style="width: 200px;"
             />
          </div>
        </div>

        <el-table 
          :data="filteredUsersNotInProject" 
          @selection-change="handleSelectionChange"
          height="300"
          border
          v-loading="loadingUsers"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column prop="username" label="使用者名稱 (User ID)" />
          <el-table-column prop="email" label="Email" />
        </el-table>
      </div>

      <template #footer>
        <el-button @click="addMemberVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :loading="submitting" 
          @click="confirmAddMembers"
          :disabled="selectedUsers.length === 0"
        >
          確定新增 ({{ selectedUsers.length }})
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Delete, Search } from '@element-plus/icons-vue'; 

// --- Type Definitions ---
interface ProjectInfo {
  username: string;
  projectrole: string;
}

interface Project {
  projectid: string;
  projectname: string;
  codename: string;
  projectinfo: ProjectInfo[];
}

interface ApiUser {
  username: string;
  role: string;
  email: string;
  password?: string;
  projects?: { codename: string }[];
}

// --- State ---
const auth = useAuthStore();
const currentProjectCode = computed(() => auth.currentSelectedCodename);
const currentProjectName = ref('');

const projectMembers = ref<ProjectInfo[]>([]);
const allSystemUsers = ref<ApiUser[]>([]);

const loading = ref(false);
const loadingUsers = ref(false);
const processingUser = ref<string | null>(null);
const submitting = ref(false);

const filterRole = ref('all'); // all, admin, viewer

// Modal State
const addMemberVisible = ref(false);
const newMemberRole = ref('viewer'); // 固定為 viewer
const selectedUsers = ref<ApiUser[]>([]);
const searchMemberQuery = ref(''); 

// --- Computed ---

const currentUserProjectRole = computed(() => {
  const currentUsername = auth.user?.username;
  if (!currentUsername || !projectMembers.value || projectMembers.value.length === 0) {
    return null;
  }
  const myInfo = projectMembers.value.find(m => m.username === currentUsername);
  return myInfo ? myInfo.projectrole : null;
});

const filteredMembers = computed(() => {
  if (filterRole.value === 'all') return projectMembers.value;
  return projectMembers.value.filter(m => m.projectrole === filterRole.value);
});

// 尚未加入專案的使用者 (原始清單)
const usersNotInProject = computed(() => {
  const currentMemberNames = projectMembers.value.map(m => m.username);
  return allSystemUsers.value.filter(u => !currentMemberNames.includes(u.username));
});

// 過濾後的未加入專案使用者 (加入搜尋邏輯)
const filteredUsersNotInProject = computed(() => {
  let users = usersNotInProject.value;
  if (searchMemberQuery.value) {
    const q = searchMemberQuery.value.toLowerCase();
    users = users.filter(u => u.username.toLowerCase().includes(q));
  }
  return users;
});

// --- Methods ---

const resetData = () => {
  projectMembers.value = [];
  currentProjectName.value = '';
};

// 1. 獲取專案資料
const fetchProjectData = async (code: string) => {
  loading.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    const username = auth.user?.username;

    if (!username) {
        console.warn("fetchProjectData: 無法獲取使用者名稱");
        loading.value = false;
        return;
    }
    
    const res = await axios.post(
      'http://localhost:8000/projects/get_by_username',
      { username: username }, 
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
      const allProjects = res.data.data as Project[];
      const targetProject = allProjects.find(p => p.codename === code);

      if (targetProject) {
        currentProjectName.value = targetProject.projectname;
        projectMembers.value = targetProject.projectinfo;
      } else {
        ElMessage.warning('無法在您的專案列表中找到此專案資料');
        resetData();
      }
    } else {
        ElMessage.error(res.data?.message || '獲取專案資料失敗');
        resetData();
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('獲取專案資料發生錯誤');
    resetData();
  } finally {
    loading.value = false;
  }
};

// 2. 獲取系統所有使用者
const fetchAllUsers = async () => {
  loadingUsers.value = true;
  try {
    const token = localStorage.getItem('auth_token');
    const res = await axios.get('http://localhost:8000/users/get_all', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.data && (res.data.code === 0 || res.data.code === 200)) {
      allSystemUsers.value = res.data.data;
    }
  } catch (error) {
    ElMessage.error('獲取使用者列表失敗');
  } finally {
    loadingUsers.value = false;
  }
};

// --- API Helpers ---

const updateProjectApi = async (newProjectInfo: ProjectInfo[]) => {
  const token = localStorage.getItem('auth_token');
  return axios.post('http://localhost:8000/projects/update', {
    codename: currentProjectCode.value,
    projectinfo: newProjectInfo
  }, { headers: { Authorization: `Bearer ${token}` } });
};

// --- CRUD Actions ---

const openAddMemberModal = async () => {
  addMemberVisible.value = true;
  selectedUsers.value = [];
  searchMemberQuery.value = ''; 
  if (allSystemUsers.value.length === 0) {
    await fetchAllUsers();
  }
};

const handleSelectionChange = (val: ApiUser[]) => {
  selectedUsers.value = val;
};

// 確認新增成員
const confirmAddMembers = async () => {
  if (!currentProjectCode.value) return;
  submitting.value = true;

  try {
    // 1. 準備乾淨的現有成員資料
    const existingMembers = projectMembers.value.map(m => ({
      username: m.username,
      projectrole: m.projectrole
    }));

    // 2. 準備乾淨的新成員資料 (強制 Viewer)
    const newMembers = selectedUsers.value.map(u => ({
      username: u.username,
      projectrole: 'viewer' 
    }));

    // 3. 合併列表
    const updatedProjectInfo = [...existingMembers, ...newMembers];
    
    // 4. 呼叫 projects/update API
    await updateProjectApi(updatedProjectInfo);

    ElMessage.success('新增成員成功');
    addMemberVisible.value = false;
    
    // 5. 重新抓取資料以更新畫面
    await fetchProjectData(currentProjectCode.value);
    await fetchAllUsers();

  } catch (error) {
    console.error(error);
    ElMessage.error('新增成員失敗');
  } finally {
    submitting.value = false;
  }
};

// 移除成員
const removeMember = async (member: ProjectInfo) => {
  ElMessageBox.confirm(
    `確定要將 ${member.username} 移出此專案嗎？`,
    '警告',
    { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    if (!currentProjectCode.value) return;
    processingUser.value = member.username;

    try {
      // 1. 過濾出移除後的成員列表
      const updatedProjectInfo = projectMembers.value
        .filter(m => m.username !== member.username)
        .map(m => ({
          username: m.username,
          projectrole: m.projectrole
        }));

      // 2. 呼叫 projects/update API
      await updateProjectApi(updatedProjectInfo);

      ElMessage.success('移除成員成功');
      
      // 3. 即時刷新資料
      await fetchProjectData(currentProjectCode.value);
      await fetchAllUsers(); 

    } catch (error) {
      console.error(error);
      ElMessage.error('移除成員失敗');
    } finally {
      processingUser.value = null;
    }
  });
};

// --- Watchers ---

watch(currentProjectCode, async (newCode) => {
  if (newCode && newCode !== 'all') {
    await fetchProjectData(newCode);
  } else {
    resetData();
  }
}, { immediate: true });

</script>

<style scoped>
.project-members-container {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

.empty-state {
  display: flex;
  justify-content: center;
  padding-top: 100px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background-color: white;
  padding: 15px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.project-badge {
  font-size: 14px;
  color: #606266;
  background: #f0f2f5;
  padding: 4px 8px;
  border-radius: 4px;
}

.table-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
}

/* 按鈕容器 (Flex 置中) */
.action-buttons {
  display: flex; 
  justify-content: center; 
  gap: 10px;
}

.modal-content {
  padding: 10px;
}

.role-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.left-group {
  display: flex;
  align-items: center;
}

.role-display {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #606266;
}

.role-display .label {
  font-weight: 500;
  margin-right: 8px;
}

.mb-4 {
  margin-bottom: 20px;
}
.ml-3 {
  margin-left: 12px;
}
</style>