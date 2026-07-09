import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import type { BusInfo } from '../components/busPlanner';
import { BusPlannerService } from '../components/busPlanner';
import { favoriteRoutesService } from '../components/favoriteRoutes';
import stopMapRaw from '../databases/stop_id_map.json';

interface StopMap {
  by_name: Record<string, string[]>;
}

const stopData = stopMapRaw as StopMap;

export default function RouteScreen() {
  const router = useRouter();
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();
  const plannerRef = useRef(new BusPlannerService());
  
  // 站牌選擇狀態
  const [fromStop, setFromStop] = useState<string>('');
  const [toStop, setToStop] = useState<string>('');
  const [fromStopDisplay, setFromStopDisplay] = useState<string>('');
  const [toStopDisplay, setToStopDisplay] = useState<string>('');
  
  // 搜尋狀態
  const [searchMode, setSearchMode] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  
  // 路線結果狀態
  const [routeInfo, setRouteInfo] = useState<BusInfo[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isPlanning, setIsPlanning] = useState<boolean>(false); // 防止重複規劃
  
  // 自動更新狀態
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  const updateIntervalRef = useRef<any>(null);
  
  // 更新冷卻時間（毫秒）
  const UPDATE_COOLDOWN = 3000; // 3 秒
  
  // 常用路線狀態
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  
  const debounceRef = useRef<any>(null);
  const allStops = Object.keys(stopData.by_name);

  // 初始化 BusPlannerService 並處理 URL 參數
  useEffect(() => {
    (async () => {
      try {
        await plannerRef.current.initialize();
        console.log('BusPlannerService 初始化完成');
        
        // 如果有傳入起點和終點參數，自動填入並搜尋
        if (from && to) {
          const fromStr = Array.isArray(from) ? from[0] : from;
          const toStr = Array.isArray(to) ? to[0] : to;
          
          setFromStop(fromStr);
          setFromStopDisplay(fromStr);
          setToStop(toStr);
          setToStopDisplay(toStr);
          
          // 延遲一下確保狀態更新完成
          setTimeout(async () => {
            setIsPlanning(true);
            setLoading(true);
            setHasSearched(true);
            
            try {
              console.log('自動規劃路線:', fromStr, '→', toStr);
              const routes = await plannerRef.current.plan(fromStr, toStr);
              console.log('找到路線數量:', routes.length);
              
              setRouteInfo(routes);
              setSelectedRouteIndex(0);
            } catch (error) {
              console.error('自動路線規劃錯誤:', error);
              setRouteInfo([]);
            } finally {
              setLoading(false);
              setIsPlanning(false);
            }
          }, 100);
        }
      } catch (error) {
        console.error('路線規劃初始化錯誤:', error);
      }
    })();
  }, [from, to]);

  // 搜尋建議
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        setSearchSuggestions([]);
        return;
      }
      setSearchSuggestions(
        allStops.filter(s => s.toLowerCase().includes(q)).slice(0, 20)
      );
    }, 250);
  }, [searchQuery]);

  // 規劃路線
  const planRoute = async () => {
    if (!fromStop || !toStop || isPlanning) {
      return;
    }

    setIsPlanning(true);
    setLoading(true);
    setHasSearched(true);
    
    try {
      console.log('規劃路線:', fromStop, '→', toStop);
      const routes = await plannerRef.current.plan(fromStop, toStop);
      console.log('找到路線數量:', routes.length);
      
      setRouteInfo(routes);
      setSelectedRouteIndex(0);
      
      if (routes.length === 0) {
        console.log('未找到路線');
      }
    } catch (error) {
      console.error('路線規劃錯誤:', error);
      setRouteInfo([]);
    } finally {
      setLoading(false);
      setIsPlanning(false);
    }
  };

  // 更新路線動態資訊
  const updateRouteInfo = async () => {
    if (!fromStop || !toStop || routeInfo.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;
    
    // 如果距離上次更新少於冷卻時間，則忽略（自動更新除外）
    if (isUpdating || (timeSinceLastUpdate < UPDATE_COOLDOWN && lastUpdateTime !== 0)) {
      console.log(`請稍候 ${Math.ceil((UPDATE_COOLDOWN - timeSinceLastUpdate) / 1000)} 秒後再更新`);
      return;
    }
    
    try {
      setLastUpdateTime(now);
      setIsUpdating(true);
      console.log('更新路線動態...');
      
      const routes = await plannerRef.current.plan(fromStop, toStop);
      if (routes.length > 0) {
        setRouteInfo(routes);
        console.log('路線動態更新完成，找到', routes.length, '條路線');
      }
    } catch (error) {
      console.error('路線動態更新錯誤:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 自動更新路線資訊（每30秒）
  useEffect(() => {
    if (hasSearched && routeInfo.length > 0 && fromStop && toStop) {
      console.log('啟動路線自動更新（每30秒）');
      // 清除舊的定時器
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      // 立即更新一次
      updateRouteInfo();
      // 設定新的定時器
      updateIntervalRef.current = setInterval(updateRouteInfo, 30000);
    } else {
      if (updateIntervalRef.current) {
        console.log('停止路線自動更新');
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [hasSearched, routeInfo.length, fromStop, toStop]);

  // 檢查常用路線狀態
  useEffect(() => {
    if (hasSearched && fromStop && toStop) {
      checkFavoriteStatus();
    }
  }, [hasSearched, fromStop, toStop]);

  // 當頁面獲得焦點時重新檢查常用狀態（例如從首頁返回）
  useFocusEffect(
    React.useCallback(() => {
      if (hasSearched && fromStop && toStop) {
        checkFavoriteStatus();
      }
    }, [hasSearched, fromStop, toStop])
  );

  // 選擇站牌
  const selectStop = (stopName: string) => {
    if (searchMode === 'from') {
      setFromStop(stopName);
      setFromStopDisplay(stopName);
    } else if (searchMode === 'to') {
      setToStop(stopName);
      setToStopDisplay(stopName);
    }
    setSearchMode(null);
    setSearchQuery('');
    setSearchSuggestions([]);
    Keyboard.dismiss();
  };

  // 交換起點終點
  const swapStops = () => {
    const tempStop = fromStop;
    const tempDisplay = fromStopDisplay;
    
    // 如果兩個站牌都有填寫，記錄交換後的值
    const willSwap = toStop && tempStop;
    const newFromStop = toStop;
    const newToStop = tempStop;
    
    setFromStop(newFromStop);
    setFromStopDisplay(toStopDisplay);
    setToStop(newToStop);
    setToStopDisplay(tempDisplay);
    
    // 如果兩個站牌都有填寫，使用交換後的值立即重新規劃
    if (willSwap && !isPlanning) {
      // 使用 React 的批次更新後執行
      setTimeout(async () => {
        if (!newFromStop || !newToStop || isPlanning) return;
        
        setIsPlanning(true);
        setLoading(true);
        setHasSearched(true);
        
        try {
          console.log('交換後規劃路線:', newFromStop, '→', newToStop);
          const routes = await plannerRef.current.plan(newFromStop, newToStop);
          console.log('找到路線數量:', routes.length);
          
          setRouteInfo(routes);
          setSelectedRouteIndex(0);
        } catch (error) {
          console.error('交換後路線規劃錯誤:', error);
          setRouteInfo([]);
        } finally {
          setLoading(false);
          setIsPlanning(false);
        }
      }, 200);
    }
  };

  // 清除搜尋結果
  const clearSearch = () => {
    setFromStop('');
    setToStop('');
    setFromStopDisplay('');
    setToStopDisplay('');
    setRouteInfo([]);
    setHasSearched(false);
    setSelectedRouteIndex(0);
    setIsFavorite(false);
  };

  // 檢查是否已加入常用
  const checkFavoriteStatus = async () => {
    if (fromStop && toStop) {
      const isFav = await favoriteRoutesService.isFavorite(fromStop, toStop);
      setIsFavorite(isFav);
    }
  };

  // 切換常用路線
  const toggleFavorite = async () => {
    if (!fromStop || !toStop) return;

    if (isFavorite) {
      // 移除常用
      const result = await favoriteRoutesService.removeRoute(fromStop, toStop);
      if (result.success) {
        setIsFavorite(false);
        console.log('已移除常用路線');
      }
    } else {
      // 加入常用
      const result = await favoriteRoutesService.addRoute(fromStop, toStop);
      if (result.success) {
        setIsFavorite(true);
        console.log('已加入常用路線');
        
        // 立即預載公車路線資訊以加快未來存取速度
        try {
          console.log('預載公車路線資訊...');
          const plans = await plannerRef.current.plan(fromStop, toStop);
          if (plans.length > 0) {
            const routeNames = [...new Set(plans.map(bus => bus.routeName))];
            await favoriteRoutesService.updateRouteCacheNames(fromStop, toStop, routeNames);
            console.log('已預載路線快取:', routeNames.length, '條路線');
          }
        } catch (error) {
          console.error('預載路線快取失敗:', error);
          // 不影響加入常用路線的流程，只是預載失敗
        }
      } else {
        console.log('加入失敗:', result.message);
      }
    }
  };

  // 返回
  const back = () => {
    if (router.canGoBack()) {
      setTimeout(() => router.back(), 100);
    } else {
      setTimeout(() => router.push('/'), 100);
    }
  };

  // 渲染搜尋模態
  const renderSearchModal = () => (
    <Modal
      visible={searchMode !== null}
      animationType="slide"
      onRequestClose={() => {
        setSearchMode(null);
        setSearchQuery('');
        setSearchSuggestions([]);
      }}
    >
      <View style={styles.searchModalContainer}>
        <View style={styles.searchModalHeader}>
          <Text style={styles.searchModalTitle}>
            {searchMode === 'from' ? '選擇起點' : '選擇終點'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setSearchMode(null);
              setSearchQuery('');
              setSearchSuggestions([]);
            }}
          >
            <Text style={styles.searchModalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchInputContainer}>
          <TextInput
            placeholder="搜尋站牌"
            placeholderTextColor="#bbb"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={true}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={searchSuggestions}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.searchSuggestionItem}
              onPress={() => selectStop(item)}
            >
              <Text style={styles.searchSuggestionText}>{item}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>沒有找到站牌</Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );

  // 渲染路線卡片
  const renderRouteCard = ({ item, index }: { item: BusInfo; index: number }) => {
    const isSelected = index === selectedRouteIndex;
    
    return (
      <TouchableOpacity
        style={[
          styles.routeCard,
          isSelected && styles.routeCardSelected
        ]}
        onPress={() => {
          // 如果已經選中，再次點擊則取消選中（收合）
          if (isSelected) {
            setSelectedRouteIndex(-1);
          } else {
            setSelectedRouteIndex(index);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.routeCardHeader}>
          <View style={styles.routeCardTitleRow}>
            <Text style={styles.routeCardNumber}>{item.routeName}</Text>
            <Text style={styles.routeCardDirection}>{item.directionText}</Text>
          </View>
          {isSelected && (
            <Text style={styles.routeCardCheck}>✓</Text>
          )}
        </View>
        
        <View style={styles.routeCardInfo}>
          <Text style={styles.routeCardTime}>⏱ {item.arrivalTimeText}</Text>
          <Text style={styles.routeCardStops}>🚏 途經{item.stopCount}站 · 約{item.estimatedDuration}分鐘</Text>
        </View>

        {isSelected && (
          <View style={styles.routeCardDetail}>
            <View style={styles.routePathContainer}>
              <Text style={styles.routePathTitle}>途經站牌：</Text>
              <View style={styles.routePathList}>
                {item.pathStops.map((stop, stopIndex) => (
                  <View key={`${stop.sid}-${stopIndex}`} style={styles.routePathItem}>
                    <View style={[
                      styles.routePathDot,
                      stopIndex === 0 && styles.routePathDotStart,
                      stopIndex === item.pathStops.length - 1 && styles.routePathDotEnd
                    ]} />
                    <Text style={[
                      styles.routePathStopName,
                      (stopIndex === 0 || stopIndex === item.pathStops.length - 1) && styles.routePathStopNameBold
                    ]}>
                      {stop.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* 頂部導航 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>路線規劃</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 站牌選擇區域 (1/4) */}
      <View style={styles.stopsContainer}>
        <View style={styles.stopInputWrapper}>
          <View style={styles.stopIconContainer}>
            <View style={styles.stopIconStart} />
          </View>
          <TouchableOpacity
            style={styles.stopInput}
            onPress={() => {
              setSearchMode('from');
              setSearchQuery('');
            }}
          >
            <Text style={[styles.stopInputText, !fromStopDisplay && styles.stopInputPlaceholder]}>
              {fromStopDisplay || '選擇起點站牌'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.swapButton}
          onPress={swapStops}
          disabled={!fromStop || !toStop}
        >
          <Text style={styles.swapButtonText}>⇅</Text>
        </TouchableOpacity>

        <View style={styles.stopInputWrapper}>
          <View style={styles.stopIconContainer}>
            <View style={styles.stopIconEnd} />
          </View>
          <TouchableOpacity
            style={styles.stopInput}
            onPress={() => {
              setSearchMode('to');
              setSearchQuery('');
            }}
          >
            <Text style={[styles.stopInputText, !toStopDisplay && styles.stopInputPlaceholder]}>
              {toStopDisplay || '選擇終點站牌'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.planButton, (!fromStop || !toStop || isPlanning) && styles.planButtonDisabled]}
            onPress={planRoute}
            disabled={!fromStop || !toStop || loading || isPlanning}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.planButtonText}>🔍 搜尋路線</Text>
            )}
          </TouchableOpacity>

          {hasSearched && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearSearch}
            >
              <Text style={styles.clearButtonText}>清除</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 路線結果區域 (3/4) */}
      <View style={styles.resultsContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6F73F8" />
            <Text style={styles.loadingText}>正在搜尋路線...</Text>
          </View>
        ) : hasSearched ? (
          routeInfo.length > 0 ? (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>
                  找到 {routeInfo.length} 條路線
                </Text>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/map', params: { from: fromStop, to: toStop } })}
                    style={styles.refreshButton}
                  >
                    <Text style={styles.refreshButtonText}>🗺 地圖</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleFavorite}
                    style={styles.favoriteButton}
                  >
                    <Text style={styles.favoriteIcon}>
                      {isFavorite ? '⭐' : '☆'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={updateRouteInfo}
                    style={styles.refreshButton}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#6F73F8" />
                    ) : (
                      <Text style={styles.refreshButtonText}>↻ 更新</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              
              <FlatList
                data={routeInfo}
                keyExtractor={(item, index) => `route-${index}`}
                renderItem={renderRouteCard}
                contentContainerStyle={styles.routeList}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🚌</Text>
              <Text style={styles.emptyText}>未找到路線</Text>
              <Text style={styles.emptyHint}>請嘗試其他站牌組合</Text>
            </View>
          )
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🗺</Text>
            <Text style={styles.emptyText}>請選擇起點和終點</Text>
            <Text style={styles.emptyHint}>開始規劃您的公車路線</Text>
          </View>
        )}
      </View>

      {renderSearchModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6F73F8',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 60,
  },
  stopsContainer: {
    flex: 1.5,
    backgroundColor: '#fff',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    ...(Platform.OS === 'web' && {
      position: 'relative',
      zIndex: 10,
    }),
  },
  stopInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stopIconContainer: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIconStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  stopIconEnd: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FF6B6B',
  },
  stopInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  stopInputText: {
    fontSize: 13,
    color: '#333',
  },
  stopInputPlaceholder: {
    color: '#999',
  },
  swapButton: {
    alignSelf: 'center',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  swapButtonText: {
    fontSize: 18,
    color: '#6F73F8',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    ...(Platform.OS === 'web' && {
      position: 'relative',
      zIndex: 1,
    }),
  },
  planButton: {
    flex: 1,
    backgroundColor: '#6F73F8',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    }),
  },
  planButtonDisabled: {
    backgroundColor: '#ccc',
  },
  planButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  clearButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      userSelect: 'none',
    }),
  },
  clearButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 4,
    ...(Platform.OS === 'web' && {
      position: 'relative',
      zIndex: 1,
    }),
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  favoriteIcon: {
    fontSize: 20,
    color: '#FFD700',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#6F73F8',
    fontWeight: '600',
  },
  routeList: {
    padding: 16,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  routeCardSelected: {
    borderColor: '#6F73F8',
    backgroundColor: '#f8f8ff',
  },
  routeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeCardNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  routeCardDirection: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  routeCardCheck: {
    fontSize: 24,
    color: '#6F73F8',
    fontWeight: '700',
  },
  routeCardInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  routeCardTime: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  routeCardStops: {
    fontSize: 13,
    color: '#666',
  },
  routeCardDuration: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  routeCardDetail: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  routePathContainer: {
    gap: 8,
  },
  routePathTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  routePathList: {
    gap: 8,
  },
  routePathItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routePathDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  routePathDotStart: {
    backgroundColor: '#4CAF50',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routePathDotEnd: {
    backgroundColor: '#FF6B6B',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  routePathStopName: {
    fontSize: 12,
    color: '#666',
  },
  routePathStopNameBold: {
    fontWeight: '600',
    color: '#333',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // 搜尋模態樣式
  searchModalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  searchModalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  searchInputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
  },
  searchSuggestionItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchSuggestionText: {
    fontSize: 16,
    color: '#333',
  },
});
