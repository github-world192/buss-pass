/**
 * favoriteRoutes.ts 單元測試
 * 測試 FavoriteRoutesService 的 CRUD、排序和統計功能
 */

// Mock AsyncStorage
const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStore[key];
    return Promise.resolve();
  }),
}));

import { FavoriteRoutesService } from '../components/favoriteRoutes';

// 每個測試前重置 AsyncStorage 和 singleton
beforeEach(() => {
  // 清空 mock store
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  // 重置 singleton（讓 cache 清空）
  (FavoriteRoutesService as any).instance = undefined;
  jest.clearAllMocks();
});

function getService(): FavoriteRoutesService {
  return FavoriteRoutesService.getInstance();
}

// ======= Singleton =======

describe('FavoriteRoutesService.getInstance', () => {
  it('應回傳相同實例（Singleton）', () => {
    const a = FavoriteRoutesService.getInstance();
    const b = FavoriteRoutesService.getInstance();
    expect(a).toBe(b);
  });
});

// ======= 初始預設資料 =======

describe('初始預設路線', () => {
  it('第一次讀取應包含預設路線「師大分部→師大」', async () => {
    const svc = getService();
    const routes = await svc.getAllRoutes();
    expect(routes.length).toBeGreaterThanOrEqual(1);
    const hasDefault = routes.some(r => r.fromStop === '師大分部' && r.toStop === '師大');
    expect(hasDefault).toBe(true);
  });
});

// ======= addRoute =======

describe('addRoute', () => {
  it('應成功新增路線', async () => {
    const svc = getService();
    const result = await svc.addRoute('台北車站', '師大');
    expect(result.success).toBe(true);
    expect(result.route?.fromStop).toBe('台北車站');
    expect(result.route?.toStop).toBe('師大');
  });

  it('重複新增相同路線應回傳 success: false', async () => {
    const svc = getService();
    await svc.addRoute('台北車站', '師大');
    const second = await svc.addRoute('台北車站', '師大');
    expect(second.success).toBe(false);
    expect(second.message).toContain('已在常用清單');
  });

  it('新增路線時可傳入 displayName', async () => {
    const svc = getService();
    const result = await svc.addRoute('台北車站', '師大', '上班路線');
    expect(result.route?.displayName).toBe('上班路線');
  });

  it('超過上限（10條）時應回傳 success: false', async () => {
    const svc = getService();
    // 已有1條預設路線，再加9條湊滿10條
    for (let i = 1; i <= 9; i++) {
      await svc.addRoute(`起點${i}`, `終點${i}`);
    }
    const overflow = await svc.addRoute('第十一個起點', '第十一個終點');
    expect(overflow.success).toBe(false);
    expect(overflow.message).toContain('已達上限');
  });

  it('新增後路線數應增加', async () => {
    const svc = getService();
    const before = (await svc.getAllRoutes()).length;
    await svc.addRoute('新起點', '新終點');
    const after = (await svc.getAllRoutes()).length;
    expect(after).toBe(before + 1);
  });
});

// ======= isFavorite =======

describe('isFavorite', () => {
  it('存在的路線應回傳 true', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    expect(await svc.isFavorite('A站', 'B站')).toBe(true);
  });

  it('不存在的路線應回傳 false', async () => {
    const svc = getService();
    expect(await svc.isFavorite('X站', 'Z站')).toBe(false);
  });
});

// ======= getRoute =======

describe('getRoute', () => {
  it('應取得特定路線', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站', '我的路線');
    const route = await svc.getRoute('A站', 'B站');
    expect(route).not.toBeNull();
    expect(route?.displayName).toBe('我的路線');
  });

  it('不存在的路線應回傳 null', async () => {
    const svc = getService();
    const route = await svc.getRoute('不存在', '的站');
    expect(route).toBeNull();
  });
});

// ======= removeRoute =======

describe('removeRoute', () => {
  it('應成功移除路線', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const result = await svc.removeRoute('A站', 'B站');
    expect(result.success).toBe(true);
    expect(await svc.isFavorite('A站', 'B站')).toBe(false);
  });

  it('移除不存在的路線應回傳 success: false', async () => {
    const svc = getService();
    const result = await svc.removeRoute('不存在', '的站');
    expect(result.success).toBe(false);
    expect(result.message).toBe('路線不存在');
  });

  it('移除後路線數應減少', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const before = (await svc.getAllRoutes()).length;
    await svc.removeRoute('A站', 'B站');
    const after = (await svc.getAllRoutes()).length;
    expect(after).toBe(before - 1);
  });
});

// ======= updateRoute =======

describe('updateRoute', () => {
  it('應成功更新 displayName', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const result = await svc.updateRoute('A站', 'B站', { displayName: '新名稱' });
    expect(result.success).toBe(true);
    const route = await svc.getRoute('A站', 'B站');
    expect(route?.displayName).toBe('新名稱');
  });

  it('應成功更新 pinned 狀態', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    await svc.updateRoute('A站', 'B站', { pinned: true });
    const route = await svc.getRoute('A站', 'B站');
    expect(route?.pinned).toBe(true);
  });

  it('更新不存在的路線應回傳 success: false', async () => {
    const svc = getService();
    const result = await svc.updateRoute('X站', 'Z站', { displayName: '測試' });
    expect(result.success).toBe(false);
    expect(result.message).toBe('路線不存在');
  });
});

// ======= recordUsage =======

describe('recordUsage', () => {
  it('應增加使用次數', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const before = (await svc.getRoute('A站', 'B站'))!.useCount;
    await svc.recordUsage('A站', 'B站');
    const after = (await svc.getRoute('A站', 'B站'))!.useCount;
    expect(after).toBe(before + 1);
  });

  it('應更新 lastUsed 時間戳', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const timeBefore = Date.now();
    await svc.recordUsage('A站', 'B站');
    const route = await svc.getRoute('A站', 'B站');
    expect(route?.lastUsed).toBeGreaterThanOrEqual(timeBefore);
  });

  it('對不存在的路線呼叫不應拋出例外', async () => {
    const svc = getService();
    await expect(svc.recordUsage('不存在', '的站')).resolves.not.toThrow();
  });
});

// ======= getAllRoutes 排序 =======

describe('getAllRoutes 排序規則', () => {
  it('置頂路線應排在最前面', async () => {
    const svc = getService();
    await svc.addRoute('普通站1', '普通站2');
    await svc.addRoute('置頂起點', '置頂終點');
    await svc.updateRoute('置頂起點', '置頂終點', { pinned: true });
    const routes = await svc.getAllRoutes();
    expect(routes[0].pinned).toBe(true);
  });

  it('使用次數多的應排在前面（非置頂範圍內）', async () => {
    const svc = getService();
    await svc.addRoute('常用起點', '常用終點');
    await svc.addRoute('不常用起點', '不常用終點');
    await svc.recordUsage('常用起點', '常用終點');
    await svc.recordUsage('常用起點', '常用終點');
    const routes = await svc.getAllRoutes();
    const unpinnedRoutes = routes.filter(r => !r.pinned);
    const highUseIdx = unpinnedRoutes.findIndex(r => r.fromStop === '常用起點');
    const lowUseIdx = unpinnedRoutes.findIndex(r => r.fromStop === '不常用起點');
    expect(highUseIdx).toBeLessThan(lowUseIdx);
  });

  it('sorted: false 時應回傳原始順序', async () => {
    const svc = getService();
    const unsorted = await svc.getAllRoutes(false);
    expect(Array.isArray(unsorted)).toBe(true);
  });
});

// ======= clearAll =======

describe('clearAll', () => {
  it('應清空所有路線', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const result = await svc.clearAll();
    expect(result.success).toBe(true);
    const routes = await svc.getAllRoutes();
    expect(routes).toHaveLength(0);
  });
});

// ======= getStats =======

describe('getStats', () => {
  it('應回傳正確統計資訊', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    await svc.addRoute('C站', 'D站');
    await svc.updateRoute('A站', 'B站', { pinned: true });
    const stats = await svc.getStats();
    expect(typeof stats.totalRoutes).toBe('number');
    expect(typeof stats.pinnedRoutes).toBe('number');
    expect(typeof stats.totalUsageCount).toBe('number');
    expect(stats.totalRoutes).toBeGreaterThanOrEqual(2);
    expect(stats.pinnedRoutes).toBeGreaterThanOrEqual(1);
  });
});

// ======= cachedRouteNames =======

describe('updateRouteCacheNames / getCachedRouteNames', () => {
  it('應儲存並取得快取路線名稱', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    await svc.updateRouteCacheNames('A站', 'B站', ['藍1', '藍2', '棕3']);
    const names = await svc.getCachedRouteNames('A站', 'B站');
    expect(names).toEqual(['藍1', '藍2', '棕3']);
  });

  it('無快取時應回傳 null', async () => {
    const svc = getService();
    await svc.addRoute('A站', 'B站');
    const names = await svc.getCachedRouteNames('A站', 'B站');
    expect(names).toBeNull();
  });

  it('路線不存在時 updateRouteCacheNames 應回傳 false', async () => {
    const svc = getService();
    const result = await svc.updateRouteCacheNames('X站', 'Z站', ['路線1']);
    expect(result).toBe(false);
  });
});
