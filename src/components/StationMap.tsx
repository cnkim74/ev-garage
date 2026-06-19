import React, { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';

import { ENV } from '../lib/env';
import type { Station } from '../lib/queries';
import { colors } from '../lib/theme';

declare global {
  interface Window {
    kakao: any;
  }
}

// 카카오맵 JS SDK 1회 로드
function loadKakao(key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao);
      return;
    }
    const ready = () => window.kakao.maps.load(() => resolve(window.kakao));
    const existing = document.getElementById('kakao-sdk') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', ready);
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.id = 'kakao-sdk';
    s.async = true;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    s.onload = ready;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function statusColor(s: Station): string {
  return s.available > 0 ? colors.leaf : s.total > 0 ? colors.amber : colors.muted;
}

/**
 * 충전소 지도. 웹은 카카오맵 JS SDK 로 핀 표시(사용가능=초록/혼잡=노랑/만차·고장=회색),
 * 핀 탭 → onSelect. 네이티브는 추후(WebView) — 현재는 안내만.
 */
export function StationMap({
  stations,
  center,
  onSelect,
}: {
  stations: Station[];
  center: { lat: number; lng: number };
  onSelect: (s: Station) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{ kakao?: any; map?: any; overlays: any[] }>({ overlays: [] });

  useEffect(() => {
    if (Platform.OS !== 'web' || !ENV.kakaoMapKey) return;
    let cancelled = false;
    loadKakao(ENV.kakaoMapKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 6,
        });
        stateRef.current.kakao = kakao;
        stateRef.current.map = map;
        drawMarkers();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, center.lat, center.lng]);

  function drawMarkers() {
    const { kakao, map } = stateRef.current;
    if (!kakao || !map) return;
    stateRef.current.overlays.forEach((o) => o.setMap(null));
    stateRef.current.overlays = [];

    map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));

    stations.forEach((s) => {
      if (s.lat == null || s.lng == null) return;
      const el = document.createElement('div');
      el.textContent = String(s.available);
      el.style.cssText = [
        'min-width:22px',
        'height:22px',
        'padding:0 4px',
        'border-radius:11px',
        `background:${statusColor(s)}`,
        'color:#fff',
        'font-size:12px',
        'font-weight:700',
        'line-height:22px',
        'text-align:center',
        'border:2px solid #fff',
        'box-shadow:0 1px 4px rgba(0,0,0,0.3)',
        'cursor:pointer',
      ].join(';');
      el.addEventListener('click', () => onSelect(s));
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(s.lat, s.lng),
        content: el,
        yAnchor: 0.5,
        clickable: true,
      });
      ov.setMap(map);
      stateRef.current.overlays.push(ov);
    });
  }

  if (Platform.OS !== 'web') {
    return (
      <View className="mb-3 items-center justify-center rounded-card border border-sand bg-white/60 py-10">
        <Text className="text-center text-sm text-muted">
          지도는 현재 웹에서 표시됩니다.{'\n'}리스트로 보거나, 폰에서는 네이티브 지도(추후)로 제공돼요.
        </Text>
      </View>
    );
  }
  if (!ENV.kakaoMapKey) {
    return (
      <View className="mb-3 rounded-card border border-sand bg-white/60 p-4">
        <Text className="text-sm text-muted">
          카카오맵 키(EXPO_PUBLIC_KAKAO_MAP_KEY)를 .env 에 넣고 서버를 재시작하면 지도가 표시됩니다.
        </Text>
      </View>
    );
  }
  return React.createElement('div', {
    ref: containerRef,
    style: {
      width: '100%',
      height: 380,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 12,
      border: `1px solid ${colors.sand}`,
    },
  });
}
