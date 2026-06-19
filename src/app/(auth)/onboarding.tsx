import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/auth';
import type { OwnershipType } from '../../types/database';

type Step = 'family' | 'vehicle';
type FamilyMode = 'create' | 'join';

const OWNERSHIP: { key: OwnershipType; label: string }[] = [
  { key: 'own', label: '자가' },
  { key: 'rent', label: '렌트' },
  { key: 'lease', label: '리스' },
];

function SegButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-card border px-3 py-3 ${
        active ? 'border-terracotta bg-terracotta/10' : 'border-sand bg-transparent'
      }`}>
      <Text className={`text-sm font-semibold ${active ? 'text-terracotta' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Onboarding() {
  const { refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState<Step>('family');
  const [loading, setLoading] = useState(false);

  // family step
  const [familyMode, setFamilyMode] = useState<FamilyMode>('create');
  const [displayName, setDisplayName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [familyId, setFamilyId] = useState<string | null>(null);

  // vehicle step
  const [nickname, setNickname] = useState('');
  const [model, setModel] = useState('');
  const [ownership, setOwnership] = useState<OwnershipType>('own');
  const [odo, setOdo] = useState('');
  const [plate, setPlate] = useState('');

  async function submitFamily() {
    setLoading(true);
    try {
      if (familyMode === 'create') {
        const { data, error } = await supabase.rpc('create_family', {
          p_name: familyName,
          p_display_name: displayName || null,
        });
        if (error) throw error;
        setFamilyId(data.id);
      } else {
        const { data, error } = await supabase.rpc('join_family', {
          p_code: inviteCode,
          p_display_name: displayName || null,
        });
        if (error) throw error;
        setFamilyId(data.id);
      }
      setStep('vehicle');
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function submitVehicle() {
    if (!familyId) return;
    if (!nickname.trim()) {
      Alert.alert('입력 확인', '차량 별명을 입력하세요. (예: EV6)');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('vehicles').insert({
        family_id: familyId,
        nickname: nickname.trim(),
        model: model.trim() || null,
        ownership_type: ownership,
        current_odo_km: parseInt(odo, 10) || 0,
        plate: plate.trim() || null,
      });
      if (error) throw error;
      // 이제 프로필을 갱신하면 hasFamily=true → 탭으로 자동 이동
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('오류', e?.message ?? '차량 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'family') {
    return (
      <Screen>
        <ScreenHeader title="가족 만들기" subtitle="부부·가족이 같은 차량·기록을 함께 봅니다" />

        <View className="mb-4 flex-row gap-2">
          <SegButton
            active={familyMode === 'create'}
            label="새로 만들기"
            onPress={() => setFamilyMode('create')}
          />
          <SegButton
            active={familyMode === 'join'}
            label="초대코드로 합류"
            onPress={() => setFamilyMode('join')}
          />
        </View>

        <Card>
          <TextField
            label="내 표시 이름"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="예: 찬연"
          />
          {familyMode === 'create' ? (
            <TextField
              label="가족 이름"
              value={familyName}
              onChangeText={setFamilyName}
              placeholder="예: 김씨네"
              hint="합류용 초대코드는 자동 생성됩니다."
            />
          ) : (
            <TextField
              label="초대코드"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="예: 7KQ4PR"
            />
          )}
          <Button
            label={familyMode === 'create' ? '가족 만들고 계속' : '합류하고 계속'}
            onPress={submitFamily}
            loading={loading}
          />
        </Card>

        <View className="mt-4">
          <Button variant="ghost" label="로그아웃" onPress={signOut} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="차량 등록" subtitle="첫 차량 1대를 등록하면 시작할 수 있어요" />
      <Card>
        <TextField
          label="별명"
          value={nickname}
          onChangeText={setNickname}
          placeholder="예: EV6"
        />
        <TextField
          label="모델 (선택)"
          value={model}
          onChangeText={setModel}
          placeholder="예: 기아 EV6 롱레인지"
        />

        <Text className="mb-1.5 text-sm font-medium text-ink">소유 형태</Text>
        <View className="mb-4 flex-row gap-2">
          {OWNERSHIP.map((o) => (
            <SegButton
              key={o.key}
              active={ownership === o.key}
              label={o.label}
              onPress={() => setOwnership(o.key)}
            />
          ))}
        </View>

        <TextField
          label="현재 주행거리 (km)"
          value={odo}
          onChangeText={setOdo}
          keyboardType="number-pad"
          placeholder="예: 12000"
        />
        <TextField
          label="차량 번호 (선택)"
          value={plate}
          onChangeText={setPlate}
          placeholder="예: 12가 3456"
        />

        {ownership !== 'own' && (
          <Text className="mb-3 text-xs text-muted">
            약정거리 정보는 등록 후 '약정' 탭에서 입력할 수 있어요.
          </Text>
        )}

        <Button label="시작하기" onPress={submitVehicle} loading={loading} />
      </Card>
    </Screen>
  );
}
