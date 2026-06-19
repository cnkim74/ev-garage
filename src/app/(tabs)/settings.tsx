import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/auth';

export default function Settings() {
  const { profile, signOut } = useAuth();
  const familyId = profile?.family_id ?? null;

  const { data: family } = useQuery({
    queryKey: ['family', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('families')
        .select('name, invite_code')
        .eq('id', familyId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Screen>
      <ScreenHeader title="설정" />

      <Card className="mb-4">
        <Text className="text-sm font-semibold text-ink">가족</Text>
        <Text className="mt-1 text-lg font-bold text-ink">{family?.name ?? '—'}</Text>
        <View className="mt-3 rounded-card bg-cream px-4 py-3">
          <Text className="text-xs text-muted">초대코드 (가족 합류 시 공유)</Text>
          <Text className="mt-0.5 text-2xl font-bold tracking-widest text-terracotta">
            {family?.invite_code ?? '······'}
          </Text>
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="text-sm font-semibold text-ink">표시 이름</Text>
        <Text className="mt-1 text-base text-ink">{profile?.display_name ?? '—'}</Text>
      </Card>

      <Card className="mb-4">
        <Text className="text-sm text-muted">
          차량 추가·편집, 알림 설정은 다음 단계에서 추가됩니다.
        </Text>
      </Card>

      <Button variant="outline" label="로그아웃" onPress={signOut} />
    </Screen>
  );
}
