import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card, ScreenHeader } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { isSupabaseConfigured } from '../../lib/env';
import { notify } from '../../lib/notify';
import { supabase } from '../../lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 6) {
      notify('입력 확인', '이메일과 6자 이상 비밀번호를 입력하세요.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        notify(
          '가입 완료',
          '이메일 인증이 켜져 있다면 메일함을 확인하세요. 인증 후 로그인됩니다.',
        );
      }
    } catch (e: any) {
      notify('오류', e?.message ?? '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View className="mt-10">
        <Text className="text-4xl">🚗⚡</Text>
        <ScreenHeader
          title="EV 차고"
          subtitle="부부·가족이 함께 보는 전기차 살림 관리"
        />
      </View>

      {!isSupabaseConfigured && (
        <Card className="mb-4 border-amber bg-amber/10">
          <Text className="text-sm font-semibold text-ink">⚠️ Supabase 미설정</Text>
          <Text className="mt-1 text-xs text-muted">
            .env 에 EXPO_PUBLIC_SUPABASE_URL / ANON_KEY 를 채우면 로그인이 활성화됩니다.
            지금은 화면 미리보기만 가능합니다.
          </Text>
        </Card>
      )}

      <Card>
        <TextField
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          editable={isSupabaseConfigured}
        />
        <TextField
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="6자 이상"
          editable={isSupabaseConfigured}
        />
        <Button
          label={mode === 'signIn' ? '로그인' : '가입하기'}
          onPress={submit}
          loading={loading}
          disabled={!isSupabaseConfigured}
        />
        <View className="mt-3">
          <Button
            variant="ghost"
            label={
              mode === 'signIn'
                ? '계정이 없나요? 가입하기'
                : '이미 계정이 있나요? 로그인'
            }
            onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
          />
        </View>
      </Card>
    </Screen>
  );
}
