import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios'; // 引入 axios 用於 /users/get_one
import { ElMessage } from 'element-plus'; // 引入 ElMessage
// import { jwtDecode } from 'jwt-decode'; // (可選) 如果需要從 JWT 解析 username

// 定義 User 接口，包含必要信息
interface User {
  username: string;
  role?: string; // 添加 role
  email?: string;
  codename?: string[]; // 添加 codename
  // 可以根據 API 返回添加更多字段
}

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const token = ref<string | null>(null);
  const user = ref<User | null>(null); // 使用 User 接口
  // *** 修改：全局選中的 Codename，預設為 null ***
  const selectedCodename = ref<string | null>(null); // 預設為 null
  const router = useRouter(); // 在 setup 函數頂層獲取 router

  // --- Getters ---
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  // *** Getter：獲取用戶 Codename ***
  const availableCodename = computed((): string[] => user.value?.codename || []); // 您的原始 getter (名稱為單數)
  // *** Getter：獲取當前選中的 Codename ***
  const currentSelectedCodename = computed((): string | null => selectedCodename.value); // 返回值可能為 null
  // *** Getter：判斷是否為 Admin ***
  const isAdmin = computed((): boolean => user.value?.role === 'admin');
  // *** Getter：方便獲取用戶名 ***
  const currentUsername = computed(() => user.value?.username);

  // --- Actions ---

  // 設置 Token (內部使用)
  function setToken(newToken: string | null) {
    token.value = newToken;
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      // *** 同步設置 axios header ***
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      localStorage.removeItem('auth_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }

  // 設置 User (內部使用)
  function setUser(newUser: User | null) {
    user.value = newUser;
    if (newUser) {
      // *** 存儲包含 role 和 codenames 的 User Info ***
      localStorage.setItem('auth_user', JSON.stringify({ // 使用 'auth_user'
          username: newUser.username,
          role: newUser.role,
          codenames: newUser.codename || []
      }));
    } else {
      localStorage.removeItem('auth_user'); // 使用 'auth_user'
    }
  }

   // *** 設置選中的 Codename ***
   function setSelectedCodename(code: string | null) { // 允許設置為 null
    selectedCodename.value = code;
    console.log('Selected codename changed to:', selectedCodename.value);
  }

  // *** Action：獲取當前使用者詳細資訊 ***
  async function fetchCurrentUserDetails(usernameToFetch: string): Promise<boolean> {
      const currentToken = token.value; // 從 state 獲取 token
      if (!currentToken) {
          console.warn("fetchCurrentUserDetails: No token available.");
          await logout(); // 登出清理
          return false;
      }
      if (!usernameToFetch) {
          console.error("fetchCurrentUserDetails: Username is required.");
           await logout(); // 觸發登出清理
          return false;
      }

      try {
          console.log(`Fetching user details for: ${usernameToFetch}`);
          const res = await axios.post<{ code: number; message: string; data: User }>(
              'http://localhost:8000/users/get_one',
              { username: usernameToFetch },
              // axios 默認會帶 token header
          );

           console.log("Response from /users/get_one:", JSON.parse(JSON.stringify(res.data)));


          if (res.data && res.data.code === 200 && res.data.data) {
              const userData = res.data.data;
              console.log("User data received:", userData);
              const userCodenames = Array.isArray(userData.codename) ? userData.codename : [];

              // **更新 User state 為包含 role 和 codenames 的完整資訊**
              setUser({
                  username: userData.username,
                  role: userData.role,
                  email: userData.email,
                  codename: userCodenames, // 使用 API 返回的 codename (單數)
              });
              
              // *** 關鍵修改：設定 selectedCodename 為第一個 ***
              if (userCodenames.length > 0) {
                  setSelectedCodename(userCodenames[0]); // 預設為第一個
                  console.log(`Default codename set to: ${userCodenames[0]}`);
              } else {
                  setSelectedCodename(null); // 如果沒有 codename，則設為 null
                  ElMessage.info('目前帳號沒有分配任何專案代號');
              }

              console.log("User details fetched and stored:", user.value);
              return true; // 成功
          } else {
              throw new Error(res.data?.message || '無法獲取使用者詳細資訊');
          }
      } catch (error: any) {
          console.error('Fetch Current User Details Error:', error.response?.data || error.message || error);
          ElMessage.error('無法獲取使用者詳細資訊，請稍後重試或聯繫管理員');
          await logout();
          return false; // 返回 false 表示失敗
      }
  }

  // *** 登入 Action ***
  async function login(username: string, password: string) {
    try {
      // 1. 呼叫登入 API (保留原始 fetch)
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
      console.log('login response:', data);

      if (!res.ok || !data || !data.access_token) {
        throw new Error(data.detail || '登入失敗：未取得 access_token 或帳密錯誤');
      }

      // 2. 設置 Token
      setToken(String(data.access_token));
      setUser({ username: username }); // 暫存基礎 user

      // 3. 調用 fetchCurrentUserDetails (此函數現在會自動設定 selectedCodename)
      const fetchSuccess = await fetchCurrentUserDetails(username);

      if (!fetchSuccess) {
          setToken(null); setUser(null); // 回滾
          throw new Error("登入成功但無法獲取使用者詳細資訊，請聯繫管理員。");
      }

      // 4. *** 移除 setSelectedCodename('all') ***

      // 5. 跳轉到首頁
      router.push('/');
      ElMessage.success('登入成功');

    } catch (err: any) { // 添加 : any 類型
      console.error('登入錯誤:', err);
      setToken(null); setUser(null); setSelectedCodename(null); // 清理
      throw err; // 向上拋出，讓頁面顯示錯誤
    }
  }

  // *** 登出 Action ***
  async function logout() {
    const currentUsername = user.value?.username;
    const currentToken = token.value;

    if (currentUsername && currentToken) {
      try {
        await axios.get('http://localhost:8000/jwt/logout', {
          params: { username: currentUsername }
        });
        console.log('Backend logout successful.');
      } catch (apiErr: any) {
        console.error('呼叫登出 API 時發生錯誤:', apiErr.response?.data || apiErr.message || apiErr);
      }
    }

    setToken(null); setUser(null); setSelectedCodename(null); // *** 修改：重置為 null ***
    console.log('使用者已登出，狀態已清除');
    router.push('/login'); // 跳轉
  }

  // *** 初始化 Store (替換 loadToken) ***
  async function initializeAuth() {
    console.log("Initializing Auth Store...");
    const savedToken = localStorage.getItem('auth_token');
    const savedUserString = localStorage.getItem('auth_user'); // 使用 'auth_user'

    if (savedToken) {
      setToken(savedToken);
      let usernameFromStorage: string | null = null;

      if (savedUserString) {
          try {
              const savedUser = JSON.parse(savedUserString);
              if (savedUser && savedUser.username) {
                  setUser(savedUser);
                  usernameFromStorage = savedUser.username;
                  console.log("Restored user from localStorage:", user.value);
              } else { setUser(null); }
          } catch (e) { console.warn("Failed to parse saved user from localStorage."); setUser(null); }
      }

      if (usernameFromStorage) {
          // *** fetchCurrentUserDetails 會自動設定 selectedCodename ***
          const fetchSuccess = await fetchCurrentUserDetails(usernameFromStorage);
          // *** 移除 setSelectedCodename('all') ***
          // if (fetchSuccess) {
          //     setSelectedCodename('all'); // 成功後重置
          // }
      } else {
          console.warn("No username found in localStorage although token exists, logging out.");
          await logout();
      }

    } else {
        console.log("No token found in localStorage.");
        setToken(null); setUser(null); setSelectedCodename(null); // *** 修改：重置為 null ***
    }
  }

  // --- 返回 Store 成員 ---
  return {
    token,
    user,
    selectedCodename,    // State
    isAuthenticated,
    availableCodename, // Getter (保持您原始的名稱)
    currentSelectedCodename, // Getter
    isAdmin,            // Getter
    currentUsername,    // Getter
    login,
    logout,
    initializeAuth,    // Action (替換了 loadToken)
    fetchCurrentUserDetails, // Action
    setSelectedCodename, // Action
  };
});