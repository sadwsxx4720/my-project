import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios'; 
import { ElMessage } from 'element-plus'; 

// 定義 User 接口
interface User {
  username: string;
  role?: string; 
  email?: string;
  codename?: string[]; // 這裡保留名稱 codename 方便前端統一使用字串陣列
}

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  const selectedCodename = ref<string | null>(null);
  const router = useRouter();

  // --- Getters ---
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const availableCodename = computed((): string[] => user.value?.codename || []);
  const currentSelectedCodename = computed((): string | null => selectedCodename.value);
  const currentUsername = computed(() => user.value?.username);
  
  // Getter: 判斷是否為 Admin
  const isAdmin = computed((): boolean => user.value?.role === 'admin');
  
  // Getter: 判斷是否為 Superuser
  const isSuperuser = computed((): boolean => user.value?.role === 'superuser');

  // --- Actions ---

  // 設置 Token
  function setToken(newToken: string | null) {
    token.value = newToken;
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      localStorage.removeItem('auth_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  // 設置 User
  function setUser(newUser: User | null) {
    user.value = newUser;
    if (newUser) {
      localStorage.setItem('auth_user', JSON.stringify({
          username: newUser.username,
          role: newUser.role,
          codenames: newUser.codename || []
      }));
    } else {
      localStorage.removeItem('auth_user');
    }
  }

   // 設置選中的 Codename
   function setSelectedCodename(code: string | null) {
    selectedCodename.value = code;
    console.log('Selected codename changed to:', selectedCodename.value);
  }

  // Action：獲取當前使用者詳細資訊
  // 增加 shouldLogoutOnError 參數，控制失敗時是否自動登出
  async function fetchCurrentUserDetails(usernameToFetch: string, shouldLogoutOnError: boolean = true): Promise<boolean> {
      const currentToken = token.value;
      if (!currentToken) {
          console.warn("fetchCurrentUserDetails: No token available.");
          if (shouldLogoutOnError) await logout();
          return false;
      }
      if (!usernameToFetch) {
          console.error("fetchCurrentUserDetails: Username is required.");
          if (shouldLogoutOnError) await logout();
          return false;
      }

      try {
          console.log(`Fetching user details for: ${usernameToFetch}`);
          // 顯式傳遞 Header 以確保 token 正確
          const res = await axios.post(
              'http://localhost:8000/users/get_one',
              { username: usernameToFetch },
              { headers: { Authorization: `Bearer ${currentToken}` } }
          );

           console.log("Response from /users/get_one:", JSON.parse(JSON.stringify(res.data)));

          // 同時支援 code 200 或 0
          if (res.data && (res.data.code === 200 || res.data.code === 0) && res.data.data) {
              const userData = res.data.data;
              
              // 從 projects array 解析出 codename array
              // 資料庫格式: projects: [{codename: "p1"}, {codename: "p2"}]
              let userCodenames: string[] = [];
              if (Array.isArray(userData.projects)) {
                  userCodenames = userData.projects.map((p: any) => p.codename);
              } else if (Array.isArray(userData.codename)) {
                  // 相容舊格式
                  userCodenames = userData.codename;
              }

              setUser({
                  username: userData.username,
                  role: userData.role,
                  email: userData.email,
                  codename: userCodenames,
              });
              
              if (userCodenames.length > 0) {
                  // 如果目前沒有選中，或選中的不在列表中，則預設選第一個
                  if (!selectedCodename.value || !userCodenames.includes(selectedCodename.value)) {
                      setSelectedCodename(userCodenames[0]);
                  }
                  console.log(`Codenames found: ${userCodenames.join(', ')}`);
              } else {
                  setSelectedCodename(null);
                  // 【修正】這裡完全移除 ElMessage 提示，避免登入時 Superuser 或無專案使用者看到不必要的警告
              }

              return true;
          } else {
              throw new Error(res.data?.message || '無法獲取使用者詳細資訊');
          }
      } catch (error: any) {
          console.error('Fetch Current User Details Error:', error.response?.data || error.message || error);
          if (shouldLogoutOnError) {
             ElMessage.error('無法獲取使用者詳細資訊，請重新登入');
             await logout();
          }
          return false;
      }
  }

  // 登入 Action
  async function login(username: string, password: string) {
    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'password');
      formData.append('username', username);
      formData.append('password', password);
      formData.append('scope', ''); formData.append('client_id', ''); formData.append('client_secret', '');

      const res = await fetch('http://localhost:8000/jwt/token', {
        method: 'POST',
        headers: { accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      const data = await res.json();
      
      if (!res.ok || !data || !data.access_token) {
        throw new Error(data.detail || '登入失敗：未取得 access_token 或帳密錯誤');
      }

      console.log('Login token received, fetching details...');

      // 2. 設置 Token
      setToken(String(data.access_token));
      setUser({ username: username }); 

      // 3. 調用 fetchCurrentUserDetails 
      // 這裡傳入 false，失敗時不要自動 redirect 到 login，而是拋出錯誤讓 Login 頁面顯示
      const fetchSuccess = await fetchCurrentUserDetails(username, false);

      if (!fetchSuccess) {
          // 如果獲取詳情失敗，手動回滾狀態，但不跳轉，讓前端顯示錯誤訊息
          setToken(null); setUser(null);
          throw new Error("登入驗證成功，但無法獲取使用者詳細資料(Role/Projects)。請聯繫管理員。");
      }

      // 5. 跳轉到首頁 (成功流程)
      console.log('Login success, redirecting to home');
      router.push('/');
      ElMessage.success('登入成功');

    } catch (err: any) {
      console.error('登入流程錯誤:', err);
      // 確保狀態清除
      setToken(null); setUser(null); setSelectedCodename(null); 
      throw err; // 拋出錯誤供 Login.vue 顯示
    }
  }

  // 登出 Action
  async function logout() {
    const currentUsername = user.value?.username;
    
    if (currentUsername) {
      try {
        // 嘗試通知後端登出，但不阻擋前端登出流程
        await axios.get('http://localhost:8000/jwt/logout', {
          params: { username: currentUsername }
        });
      } catch (apiErr: any) {
        console.warn('Backend logout failed:', apiErr);
      }
    }

    setToken(null); setUser(null); setSelectedCodename(null);
    console.log('User logged out.');
    router.push('/login');
  }

  // 初始化 Store
  async function initializeAuth() {
    console.log("Initializing Auth Store...");
    const savedToken = localStorage.getItem('auth_token');
    const savedUserString = localStorage.getItem('auth_user');

    if (savedToken) {
      setToken(savedToken);
      let usernameFromStorage: string | null = null;

      if (savedUserString) {
          try {
              const savedUser = JSON.parse(savedUserString);
              if (savedUser && savedUser.username) {
                  setUser(savedUser);
                  usernameFromStorage = savedUser.username;
              } else { setUser(null); }
          } catch (e) { setUser(null); }
      }

      if (usernameFromStorage) {
          // 初始化時若失敗則登出 (shouldLogoutOnError = true)
          await fetchCurrentUserDetails(usernameFromStorage, true);
      } else {
          await logout();
      }

    } else {
        setToken(null); setUser(null); setSelectedCodename(null);
    }
  }

  return {
    token,
    user,
    selectedCodename,
    isAuthenticated,
    availableCodename,
    currentSelectedCodename,
    isAdmin,
    isSuperuser,
    currentUsername,
    login,
    logout,
    initializeAuth,
    fetchCurrentUserDetails,
    setSelectedCodename,
  };
});