# 台北公車即時資訊 App 🚌

這是一個基於 [Expo](https://expo.dev) 開發的跨平台公車查詢應用，支援 iOS、Android 和 Web (PWA)。

## 功能特色

- 🚏 **即時到站資訊**：查詢台北市公車站牌的即時到站時間
- 🗺️ **路線規劃**：兩站式路線規劃，支援多路線比較
- ⭐ **常用路線**：儲存常用路線，快速存取
- 📱 **PWA 支援**：可安裝到手機主畫面，支援離線瀏覽
- 🔄 **自動更新**：每 30 秒自動刷新公車資訊

## 安裝與啟動

1. 安裝依賴套件

   ```bash
   npm install
   ```

2. 啟動開發伺服器

   ```bash
   npx expo start
   ```

3. 建置 Web 版本（PWA）

   ```bash
   npm run build:web
   ```

   建置完成後，檔案會輸出到 `dist/` 目錄。

## 部署到 GitHub Pages

專案已新增 `.github/workflows/github-pages-deploy.yml`，推送到 `map-integration`、`main` 或 `master` 時會自動部署到 GitHub Pages。

### 一次性設定

1. 到 GitHub repository 的 **Settings → Pages**
2. 在 **Source** 選擇 **GitHub Actions**

### 本地建置 GitHub Pages 版本

```bash
EXPO_PUBLIC_BASE_PATH=/expo-Bus-Route-App npm run build:web:pages
```

部署後網址會是：

```text
https://github-world192.github.io/expo-Bus-Route-App/
```

這個建置會自動處理 GitHub Pages 需要的 repo base path、`.nojekyll`，以及 `/route`、`/search` 這類頁面的靜態路由目錄。

## PWA 功能

### 安裝到裝置

**iOS Safari:**
1. 開啟網站
2. 點擊底部的「分享」按鈕 (⎋)
3. 選擇「加入主畫面」
4. 點擊「新增」

**Android Chrome:**
1. 開啟網站
2. 瀏覽器會自動顯示「安裝」橫幅
3. 點擊「安裝」按鈕
4. 或點擊選單 → 「新增至主畫面」

### 離線功能

應用程式使用 Service Worker 快取靜態資源，可在離線狀態下瀏覽基本介面。

## 專案結構

```
app/                      # 頁面目錄（file-based routing）
  ├── index.tsx          # 主頁 - 站牌查詢
  ├── route.tsx          # 路線規劃頁面
  ├── search.tsx         # 站牌搜尋
  ├── map.tsx            # 地圖頁面（Web）
  └── map.native.tsx     # 地圖頁面（Native）
components/              # 元件目錄
  ├── busPlanner.ts      # 公車資料服務
  ├── InstallPWA.tsx     # PWA 安裝提示
  └── ServiceWorkerRegister.tsx  # Service Worker 註冊
public/                  # 靜態資源
  ├── service-worker.js  # Service Worker 腳本
  └── manifest.json      # PWA Manifest
databases/               # 資料檔案
  ├── stops.json         # 站牌資料
  └── stop_id_map.json   # 站牌 ID 對照表
```

## 技術棧

- **框架**: Expo 54 + React Native
- **路由**: expo-router (file-based routing)
- **狀態管理**: React Hooks + AsyncStorage
- **地圖**: react-native-maps
- **PWA**: Service Worker + Web App Manifest
- **部署**: Vercel

## 開發說明

### 新增站牌資料

站牌資料儲存在 `databases/stops.json`，格式如下：

```json
{
  "站牌名稱": {
    "stopId": "站牌ID",
    "lat": 25.0,
    "lng": 121.5
  }
}
```

### API 說明

公車資料透過 `BusPlannerService` 從台北市公車動態資訊系統抓取，詳見 `components/busPlanner.ts`。

### 推送通知功能

應用程式支援 Web Push Notifications，可在公車即將到站時發送提醒。

**平台支援：**
- ✅ **Android Chrome 42+**：完整支援
- ✅ **iOS Safari 16.4+**：支援推送通知
- ✅ **macOS Safari 16+**：支援推送通知
- ✅ **Edge, Firefox**：完整支援

**使用方式：**

```typescript
import usePushNotification from '../hooks/usePushNotification';

const { 
  isSupported, 
  permission, 
  requestPermission, 
  showLocalNotification 
} = usePushNotification();

// 請求通知權限
const granted = await requestPermission();

// 發送本地通知
if (granted) {
  showLocalNotification('公車即將到站', {
    body: '307路公車 3分鐘後到達',
    icon: '/assets/icon.png',
  });
}
```

**iOS 注意事項：**
- 必須將網站加入主畫面（安裝 PWA）後才能使用推送通知
- 需要用戶明確授權通知權限
- 支援後台推送（透過 Service Worker）

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
