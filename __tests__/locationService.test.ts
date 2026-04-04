/**
 * locationService.ts 單元測試
 * 測試距離計算、站牌載入和附近站牌搜尋功能
 */

// Mock expo-location before imports
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

import * as Location from 'expo-location';
import {
  haversineMeters,
  haversineKilometers,
  formatDistance,
  loadAllStops,
  calculateNearbyStops,
  requestLocationPermission,
  getCurrentLocation,
} from '../components/locationService';

const mockLocation = Location as jest.Mocked<typeof Location>;

// ======= haversineMeters =======

describe('haversineMeters', () => {
  it('同一點距離應為 0', () => {
    expect(haversineMeters(25.0, 121.5, 25.0, 121.5)).toBeCloseTo(0, 1);
  });

  it('台北車站到師大約 2.5 公里', () => {
    // 台北車站: 25.0478, 121.5170
    // 師大:     25.0260, 121.5290
    const dist = haversineMeters(25.0478, 121.5170, 25.0260, 121.5290);
    expect(dist).toBeGreaterThan(2000);
    expect(dist).toBeLessThan(3500);
  });

  it('距離應為正數', () => {
    const dist = haversineMeters(25.0, 121.5, 25.1, 121.6);
    expect(dist).toBeGreaterThan(0);
  });

  it('距離計算應對稱（A→B = B→A）', () => {
    const d1 = haversineMeters(25.0, 121.5, 25.1, 121.6);
    const d2 = haversineMeters(25.1, 121.6, 25.0, 121.5);
    expect(d1).toBeCloseTo(d2, 1);
  });
});

// ======= haversineKilometers =======

describe('haversineKilometers', () => {
  it('應回傳公尺版本除以 1000', () => {
    const meters = haversineMeters(25.0, 121.5, 25.1, 121.6);
    const km = haversineKilometers(25.0, 121.5, 25.1, 121.6);
    expect(km).toBeCloseTo(meters / 1000, 5);
  });

  it('短距離應小於 1 公里', () => {
    // 約 100 公尺
    const km = haversineKilometers(25.0478, 121.5170, 25.0479, 121.5172);
    expect(km).toBeLessThan(1);
  });
});

// ======= formatDistance =======

describe('formatDistance', () => {
  it('小於 1000m 時顯示公尺', () => {
    expect(formatDistance(500)).toBe('500m');
    expect(formatDistance(999)).toBe('999m');
  });

  it('大於等於 1000m 時顯示公里', () => {
    expect(formatDistance(1000)).toBe('1.0km');
    expect(formatDistance(1500)).toBe('1.5km');
    expect(formatDistance(2300)).toBe('2.3km');
  });

  it('公里格式保留一位小數', () => {
    expect(formatDistance(10000)).toBe('10.0km');
  });

  it('公尺值會四捨五入', () => {
    expect(formatDistance(150.6)).toBe('151m');
  });
});

// ======= loadAllStops =======

describe('loadAllStops', () => {
  it('應回傳陣列', () => {
    const stops = loadAllStops();
    expect(Array.isArray(stops)).toBe(true);
  });

  it('每筆資料應包含必要欄位', () => {
    const stops = loadAllStops();
    stops.forEach(stop => {
      expect(stop).toHaveProperty('name');
      expect(stop).toHaveProperty('sid');
      expect(typeof stop.lat).toBe('number');
      expect(typeof stop.lon).toBe('number');
    });
  });

  it('不應包含 NaN 座標', () => {
    const stops = loadAllStops();
    stops.forEach(stop => {
      expect(Number.isNaN(stop.lat)).toBe(false);
      expect(Number.isNaN(stop.lon)).toBe(false);
    });
  });

  it('mock 資料中應有已知站牌', () => {
    const stops = loadAllStops();
    const names = stops.map(s => s.name);
    expect(names).toContain('台北車站');
    expect(names).toContain('師大');
  });
});

// ======= calculateNearbyStops =======

describe('calculateNearbyStops', () => {
  const tpMainStation = { lat: 25.0478, lon: 121.5170 };

  it('在台北車站附近應找到鄰近站牌', () => {
    const stops = calculateNearbyStops(tpMainStation, 800);
    expect(stops.length).toBeGreaterThan(0);
  });

  it('距離應按升序排列', () => {
    const stops = calculateNearbyStops(tpMainStation, 5000);
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].distance).toBeGreaterThanOrEqual(stops[i - 1].distance);
    }
  });

  it('所有結果應在指定半徑內', () => {
    const radius = 500;
    const stops = calculateNearbyStops(tpMainStation, radius);
    stops.forEach(stop => {
      expect(stop.distance).toBeLessThanOrEqual(radius);
    });
  });

  it('maxResults 應限制回傳數量', () => {
    const stops = calculateNearbyStops(tpMainStation, 99999, 2);
    expect(stops.length).toBeLessThanOrEqual(2);
  });

  it('相同站名只保留最近的一筆（去重）', () => {
    const stops = calculateNearbyStops(tpMainStation, 99999);
    const names = stops.map(s => s.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });

  it('半徑太小時可能回傳空陣列', () => {
    const remoteLocation = { lat: 1.0, lon: 1.0 };
    const stops = calculateNearbyStops(remoteLocation, 100);
    expect(stops).toEqual([]);
  });

  it('distance 欄位應為正數', () => {
    const stops = calculateNearbyStops(tpMainStation, 5000);
    stops.forEach(stop => {
      expect(stop.distance).toBeGreaterThanOrEqual(0);
    });
  });
});

// ======= requestLocationPermission =======

describe('requestLocationPermission', () => {
  it('權限授予時應回傳 granted: true', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    const result = await requestLocationPermission();
    expect(result.granted).toBe(true);
    expect(result.status).toBe('granted');
  });

  it('權限被拒時應回傳 granted: false', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    const result = await requestLocationPermission();
    expect(result.granted).toBe(false);
    expect(result.status).toBe('denied');
  });

  it('發生例外時應回傳 granted: false', async () => {
    (mockLocation.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(
      new Error('permission error')
    );
    const result = await requestLocationPermission();
    expect(result.granted).toBe(false);
    expect(result.status).toBe('error');
  });
});

// ======= getCurrentLocation =======

describe('getCurrentLocation', () => {
  it('成功時應回傳 lat/lon', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockResolvedValueOnce({
      coords: { latitude: 25.0478, longitude: 121.5170 },
    });
    const loc = await getCurrentLocation();
    expect(loc).not.toBeNull();
    expect(loc!.lat).toBeCloseTo(25.0478);
    expect(loc!.lon).toBeCloseTo(121.5170);
  });

  it('失敗時應回傳 null', async () => {
    (mockLocation.getCurrentPositionAsync as jest.Mock).mockRejectedValueOnce(
      new Error('GPS error')
    );
    const loc = await getCurrentLocation();
    expect(loc).toBeNull();
  });
});
