// 계약서(사진/PDF)에서 렌트·리스 약정 정보를 추출하는 Edge Function.
// Claude 의 비전·PDF 이해를 사용. API 키는 서버 시크릿(ANTHROPIC_API_KEY)으로만 보관.
//
// 배포:  supabase functions deploy extract-contract
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// 호출(앱): supabase.functions.invoke('extract-contract', { body: { fileBase64, mediaType } })

import Anthropic from 'npm:@anthropic-ai/sdk@^0.68.0';
import { corsHeaders } from '../_shared/cors.ts';

type ExtractResult = {
  found: boolean;
  contract_distance_km: number | null;
  start_odo_km: number | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  operator: string | null;
  notes: string | null;
};

// 추출 결과를 강제하기 위한 도구 정의 (tool_choice 로 호출 강제)
const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_contract',
  description: '계약서에서 읽어낸 렌트/리스 약정 정보를 기록한다. 값을 찾지 못하면 null.',
  input_schema: {
    type: 'object',
    properties: {
      found: {
        type: 'boolean',
        description: '렌트/리스 약정 계약서로 보이고 약정 관련 값을 하나라도 찾았으면 true',
      },
      contract_distance_km: {
        type: ['integer', 'null'],
        description: '약정/허용 주행거리 한도(km). 예: 50000. 연간 한도면 계약 기간으로 환산하지 말고 표기된 총 한도를 우선.',
      },
      start_odo_km: {
        type: ['integer', 'null'],
        description: '계약 시작(인수) 시점의 주행거리(km). 없으면 null.',
      },
      start_date: {
        type: ['string', 'null'],
        description: '계약 시작일. 반드시 YYYY-MM-DD 형식.',
      },
      end_date: {
        type: ['string', 'null'],
        description: '계약 만료일. 반드시 YYYY-MM-DD 형식.',
      },
      operator: {
        type: ['string', 'null'],
        description: '렌트사/리스사 이름. 없으면 null.',
      },
      notes: {
        type: ['string', 'null'],
        description: '초과 km당 요금 등 참고 메모(있으면). 위약금 총액을 단정하지 말 것.',
      },
    },
    required: [
      'found',
      'contract_distance_km',
      'start_odo_km',
      'start_date',
      'end_date',
      'operator',
      'notes',
    ],
    additionalProperties: false,
  },
};

const SYSTEM = `당신은 한국 자동차 렌트/리스 계약서에서 약정거리 관리를 위한 핵심 값만 추출하는 도우미입니다.
- 표기된 값을 그대로 읽어 record_contract 도구로 기록하세요. 추측하지 말고, 불확실하면 null.
- 날짜는 반드시 YYYY-MM-DD로 정규화하세요(예: 2025년 1월 5일 → 2025-01-05).
- 약정 한도는 "총 약정거리/허용주행거리"를 우선합니다. 연 한도만 있으면 그대로 두고 notes에 "연 한도" 표기.
- 위약금 총액은 단정하지 마세요(초과 km당 단가 정도만 notes에).`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았습니다.' }, 500);
    }

    const { fileBase64, mediaType } = await req.json().catch(() => ({}));
    if (!fileBase64 || !mediaType) {
      return json({ error: 'fileBase64 와 mediaType 이 필요합니다.' }, 400);
    }

    const isPdf = mediaType === 'application/pdf';
    const isImage = typeof mediaType === 'string' && mediaType.startsWith('image/');
    if (!isPdf && !isImage) {
      return json({ error: '이미지 또는 PDF만 지원합니다.' }, 400);
    }

    const filePart = isPdf
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: fileBase64 },
        }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: mediaType, data: fileBase64 },
        };

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      tools: [RECORD_TOOL],
      tool_choice: { type: 'tool', name: 'record_contract' },
      messages: [
        {
          role: 'user',
          content: [
            filePart as Anthropic.ContentBlockParam,
            { type: 'text', text: '이 계약서에서 약정 정보를 추출해 record_contract 로 기록해 주세요.' },
          ],
        },
      ],
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (!toolUse) {
      return json({ error: '추출 결과를 받지 못했습니다.' }, 502);
    }

    const result = toolUse.input as ExtractResult;
    return json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류';
    return json({ error: msg }, 500);
  }
});
