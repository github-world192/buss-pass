/**
 * busPlanner.ts 單元測試
 * 測試 BusPlannerService 的資料庫查詢、距離計算和初始化功能
 */

// Mock fetch globally
global.fetch = jest.fn();

import { BusPlannerService } from '../components/busPlanner';

// ======= Helper =======

async function getInitializedService(): Promise<BusPlannerService> {
  const svc = new BusPlannerService();
  await svc.initialize();
  return svc;
}

// ======= initialize =======

describe('BusPlannerService.initialize', () => {
  it('初始化後 getAllStopNames 應回傳陣列', async () => {
    const svc = await getInitializedService();
    const names = svc.getAllStopNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
  });

  it('初始化後應包含 mock 資料中的站名', async () => {
    const svc = await getInitializedService();
    const names = svc.getAllStopNames();
    expect(names).toContain('台北車站');
    expect(names).toContain('師大');
    expect(names).toContain('師大分部');
  });
});

// ======= getSidsByName =======

describe('getSidsByName', () => {
  it('應回傳對應站名的 SID 陣列', async () => {
    const svc = await getInitializedService();
    const sids = svc.getSidsByName('台北車站');
    expect(Array.isArray(sids)).toBe(true);
    expect(sids).toContain('S001');
    expect(sids).toContain('S002');
  });

  it('不存在的站名應回傳空陣列', async () => {
    const svc = await getInitializedService();
    const sids = svc.getSidsByName('不存在的站');
    expect(sids).toEqual([]);
  });
});

// ======= getGeoBySid =======

describe('getGeoBySid', () => {
  it('有座標的 SID 應回傳 lat/lon', async () => {
    const svc = await getInitializedService();
    const geo = svc.getGeoBySid('S001');
    expect(geo).not.toBeUndefined();
    expect(geo!.lat).toBeCloseTo(25.0478, 2);
    expect(geo!.lon).toBeCloseTo(121.5170, 2);
  });

  it('無座標的 SID 應回傳 undefined', async () => {
    const svc = await getInitializedService();
    const geo = svc.getGeoBySid('S006');
    expect(geo).toBeUndefined();
  });

  it('不存在的 SID 應回傳 undefined', async () => {
    const svc = await getInitializedService();
    const geo = svc.getGeoBySid('NONEXISTENT');
    expect(geo).toBeUndefined();
  });
});

// ======= getRepresentativeSids =======

describe('getRepresentativeSids', () => {
  it('相同 SLID 的 SID 只保留一個代表', async () => {
    // S001 和 S002 都是 SL01，應只回傳一個
    const svc = await getInitializedService();
    const reps = svc.getRepresentativeSids('台北車站');
    expect(reps.length).toBe(1);
  });

  it('沒有 SLID 的站應直接加入', async () => {
    // 信義路口 S005 沒有 slid
    const svc = await getInitializedService();
    const reps = svc.getRepresentativeSids('信義路口');
    expect(reps.length).toBe(1);
    expect(reps[0]).toBe('S005');
  });

  it('不存在的站名應回傳空陣列', async () => {
    const svc = await getInitializedService();
    const reps = svc.getRepresentativeSids('不存在的站');
    expect(reps).toEqual([]);
  });
});

// ======= getAllStopNames =======

describe('getAllStopNames', () => {
  it('回傳的名稱應是字串陣列', async () => {
    const svc = await getInitializedService();
    const names = svc.getAllStopNames();
    names.forEach(name => expect(typeof name).toBe('string'));
  });

  it('不應包含重複的站名', async () => {
    const svc = await getInitializedService();
    const names = svc.getAllStopNames();
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});

// ======= findNearestStop =======

describe('findNearestStop', () => {
  it('應找到離指定座標最近的站', async () => {
    const svc = await getInitializedService();
    // 靠近台北車站座標
    const nearest = svc.findNearestStop(25.0478, 121.5170);
    expect(nearest).toBe('台北車站');
  });

  it('靠近師大的座標應找到師大相關站', async () => {
    const svc = await getInitializedService();
    const nearest = svc.findNearestStop(25.0260, 121.5290);
    // 師大或師大分部（兩者都很近）
    expect(['師大', '師大分部']).toContain(nearest);
  });

  it('應回傳字串或 null', async () => {
    const svc = await getInitializedService();
    const result = svc.findNearestStop(25.0478, 121.5170);
    expect(result === null || typeof result === 'string').toBe(true);
  });
});

// ======= fetchBusesAtSid（網路請求 mock）=======

describe('fetchBusesAtSid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetch 失敗時應回傳空陣列', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    const svc = await getInitializedService();
    const buses = await svc.fetchBusesAtSid('S001');
    expect(buses).toEqual([]);
  });

  it('fetch 拋出例外時應回傳空陣列', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('network error'));
    const svc = await getInitializedService();
    const buses = await svc.fetchBusesAtSid('S001');
    expect(buses).toEqual([]);
  });

  it('回傳無效 HTML 時應回傳空陣列', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => '<html><body>無資料</body></html>',
    });
    const svc = await getInitializedService();
    const buses = await svc.fetchBusesAtSid('S001');
    expect(buses).toEqual([]);
  });

  it('含有效路線資料時應解析公車資訊', async () => {
    const fakeHtml = `
      <html><body>
        <table>
          <tr>
            <td><a href="route.jsp?rid=100">路線1</a></td>
            <td></td>
            <td>往南港</td>
            <td id="tte1"></td>
          </tr>
        </table>
      </body></html>
    `;
    const fakeJson = {
      Stop: [
        { n1: 'x,1,x,x,x,x,x,120,x' },
      ],
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, text: async () => fakeHtml })
      .mockResolvedValueOnce({ ok: true, json: async () => fakeJson });

    const svc = await getInitializedService();
    const buses = await svc.fetchBusesAtSid('S001');
    // 解析到一條路線
    expect(buses.length).toBe(1);
    expect(buses[0].route).toBe('路線1');
    expect(buses[0].rid).toBe('100');
    expect(buses[0].direction).toBe('往南港');
  });

  it('解析到的公車應按 rawTime 升序排列', async () => {
    const fakeHtml = `
      <html><body>
        <table>
          <tr><td><a href="route.jsp?rid=1">路線A</a></td><td></td><td>往南</td><td id="tte1"></td></tr>
          <tr><td><a href="route.jsp?rid=2">路線B</a></td><td></td><td>往北</td><td id="tte2"></td></tr>
        </table>
      </body></html>
    `;
    const fakeJson = {
      Stop: [
        { n1: 'x,1,x,x,x,x,x,300,x' }, // 5 分
        { n1: 'x,2,x,x,x,x,x,60,x' },  // 1 分（較早）
      ],
    };

    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, text: async () => fakeHtml })
      .mockResolvedValueOnce({ ok: true, json: async () => fakeJson });

    const svc = await getInitializedService();
    const buses = await svc.fetchBusesAtSid('S001');
    expect(buses.length).toBe(2);
    expect(buses[0].rawTime).toBeLessThanOrEqual(buses[1].rawTime);
  });
});

// ======= plan（整合邏輯，網路 mock）=======

describe('plan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('起點或終點不存在時應回傳空陣列', async () => {
    const svc = await getInitializedService();
    const result = await svc.plan('不存在A', '不存在B');
    expect(result).toEqual([]);
  });

  it('fetch 回傳空時應回傳空陣列', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    const svc = await getInitializedService();
    const result = await svc.plan('台北車站', '師大');
    expect(result).toEqual([]);
  });
});

// ======= getStopArrivals =======

describe('getStopArrivals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('不存在的站名應回傳空陣列', async () => {
    const svc = await getInitializedService();
    const result = await svc.getStopArrivals('不存在的站');
    expect(result).toEqual([]);
  });

  it('fetch 失敗時應回傳空陣列', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false });
    const svc = await getInitializedService();
    const result = await svc.getStopArrivals('台北車站');
    expect(result).toEqual([]);
  });

  it('回傳值應包含相容性欄位', async () => {
    const fakeHtml = `
      <html><body>
        <table>
          <tr><td><a href="route.jsp?rid=10">棕3</a></td><td></td><td>往捷運</td><td id="tte1"></td></tr>
        </table>
      </body></html>
    `;
    const fakeJson = { Stop: [{ n1: 'x,1,x,x,x,x,x,0,x' }] };
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, text: async () => fakeHtml })
      .mockResolvedValueOnce({ ok: true, json: async () => fakeJson });

    const svc = await getInitializedService();
    const arrivals = await svc.getStopArrivals('台北車站');
    expect(arrivals.length).toBe(1);
    const item = arrivals[0];
    expect(item).toHaveProperty('route');
    expect(item).toHaveProperty('route_name');
    expect(item).toHaveProperty('arrivalTimeText');
    expect(item).toHaveProperty('rawTime');
    expect(item).toHaveProperty('direction');
  });
});
