import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export interface ScanResult {
  found: boolean;
  contract_distance_km: number | null;
  start_odo_km: number | null;
  start_date: string | null;
  end_date: string | null;
  operator: string | null;
  notes: string | null;
}

/** Edge Function 호출 → Claude 가 추출한 약정 정보 */
async function extract(fileBase64: string, mediaType: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('extract-contract', {
    body: { fileBase64, mediaType },
  });
  if (error) throw new Error(error.message ?? '서버 함수 호출 실패');
  if (data?.error) throw new Error(data.error);
  return data.result as ScanResult;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const s = String(reader.result);
      resolve(s.slice(s.indexOf(',') + 1)); // data:...;base64, 접두사 제거
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 파일 URI → base64 (웹/네이티브 모두) */
async function readBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    return blobToBase64(await resp.blob());
  }
  // 네이티브: legacy FileSystem (안정적인 base64 읽기)
  const FileSystem = await import('expo-file-system/legacy');
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}

export async function scanFromCamera(): Promise<ScanResult | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('카메라 권한이 필요합니다.');
  const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
  if (res.canceled) return null;
  const a = res.assets[0];
  return extract(a.base64!, a.mimeType ?? 'image/jpeg');
}

export async function scanFromLibrary(): Promise<ScanResult | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    base64: true,
    quality: 0.5,
    mediaTypes: ['images'],
  });
  if (res.canceled) return null;
  const a = res.assets[0];
  return extract(a.base64!, a.mimeType ?? 'image/jpeg');
}

export async function scanFromPdf(): Promise<ScanResult | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const a = res.assets[0];
  const b64 = await readBase64(a.uri);
  return extract(b64, 'application/pdf');
}
