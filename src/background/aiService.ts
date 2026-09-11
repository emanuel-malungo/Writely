import { AIProvider, ToneType } from '../shared/types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const TONE_PROMPT_MAP: Record<ToneType, string> = {
  professional: 'comunicação formal, executiva e altamente profissional.',
  natural: 'comunicação humana, fluida, clara e natural.',
  friendly: 'comunicação cordial, próxima, acolhedora e amigável.',
  persuasive: 'comunicação persuasiva e focada em engajamento.',
  empathetic: 'comunicação empática e atenciosa.',
  concise: 'comunicação ultraconcisa e direta ao ponto.',
};

function buildSystemPrompt(tone: ToneType, customInstruction?: string): string {
  const toneStyle = TONE_PROMPT_MAP[tone] || TONE_PROMPT_MAP.professional;
  return `Você é um assistente de comunicação inteligente.

Sua tarefa é melhorar a mensagem fornecida pelo usuário, aplicando o estilo de ${toneStyle}.

REGRAS RÍGIDAS E INVIOLÁVEIS:
1. Corrija erros gramaticais e ortográficos.
2. Torne a mensagem clara e bem estruturada.
3. Mantenha um tom natural e alinhado com o estilo solicitado.
4. NUNCA invente informações.
5. NUNCA altere nem remova nomes, valores monetários (ex: 50.000 Kz, R$ 100), datas, horários, quantidades, códigos, referências ou links.
6. NUNCA explique o que foi alterado. Não inclua intros como "Aqui está a mensagem:" ou aspas ao redor.
7. Retorne SOMENTE a mensagem final pronta para envio.
${customInstruction ? `Instrução extra: ${customInstruction}` : ''}`;
}

async function callGroq(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  promptText: string;
}): Promise<string> {
  const { apiKey, model, systemPrompt, promptText } = params;

  console.log('[Writely AI Groq] Enviando requisição para:', GROQ_API_URL);
  console.log('[Writely AI Groq] Modelo:', model);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Mensagem para melhorar:\n${promptText}` },
      ],
      model: model || 'openai/gpt-oss-20b',
      temperature: 0.4,
      max_completion_tokens: 1024,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  console.log('[Writely AI Groq] Response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Writely AI Groq] Erro:', errorBody);
    if (response.status === 403) throw new Error(`Acesso bloqueado pela API Groq (403). ${errorBody}`);
    if (response.status === 401) throw new Error('Chave de API Groq inválida (401).');
    if (response.status === 429) throw new Error('Limite de requisições Groq excedido (429). Aguarde.');
    throw new Error(`Erro Groq (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const output = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!output) throw new Error('Groq retornou resposta vazia.');

  console.log('[Writely AI Groq] Texto gerado:', output.substring(0, 80) + '...');
  return output;
}

async function callGemini(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  promptText: string;
}): Promise<string> {
  const { apiKey, model, systemPrompt, promptText } = params;

  console.log('[Writely AI Gemini] Enviando requisição para:', GEMINI_API_URL);
  console.log('[Writely AI Gemini] Modelo:', model);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim(),
    },
    body: JSON.stringify({
      model: model || 'gemini-3.6-flash',
      system_instruction: systemPrompt,
      input: `Mensagem para melhorar:\n${promptText}`,
      generation_config: {
        temperature: 0.4,
        thinking_level: 'low',
      },
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);
  console.log('[Writely AI Gemini] Response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Writely AI Gemini] Erro:', errorBody);
    if (response.status === 403) throw new Error(`Acesso bloqueado pela API Gemini (403). ${errorBody}`);
    if (response.status === 400) throw new Error(`Requisição inválida para Gemini (400). ${errorBody}`);
    if (response.status === 401) throw new Error('Chave de API Gemini inválida (401).');
    if (response.status === 429) throw new Error('Limite de requisições Gemini excedido (429). Aguarde.');
    throw new Error(`Erro Gemini (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  console.log('[Writely AI Gemini] Response data:', JSON.stringify(data).substring(0, 300));

  // Parse Gemini Interactions API response
  let output = '';
  if (data?.output_text) {
    output = data.output_text.trim();
  } else if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
    output = data.candidates[0].content.parts[0].text.trim();
  } else if (data?.steps && Array.isArray(data.steps)) {
    for (let i = data.steps.length - 1; i >= 0; i--) {
      const step = data.steps[i];
      if (step?.content && Array.isArray(step.content)) {
        for (const block of step.content) {
          if (block?.type === 'text' && block?.text) {
            output = block.text.trim();
            break;
          }
        }
        if (output) break;
      }
    }
  }

  if (!output) throw new Error('Gemini retornou resposta vazia.');

  console.log('[Writely AI Gemini] Texto gerado:', output.substring(0, 80) + '...');
  return output;
}

export async function generateAICompletion(params: {
  provider: AIProvider;
  apiKey: string;
  model: string;
  tone: ToneType;
  promptText: string;
  contextMessage?: string;
  customInstruction?: string;
}): Promise<string> {
  const { provider, apiKey, model, tone, promptText, customInstruction } = params;

  console.log(`[Writely AI] === INICIO (Provider: ${provider.toUpperCase()}) ===`);
  console.log('[Writely AI] Texto recebido:', promptText);
  console.log('[Writely AI] Tom:', tone);

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`Chave de API do ${provider === 'gemini' ? 'Gemini' : 'Groq'} não configurada. Configure no Popup da extensão.`);
  }

  if (!promptText || promptText.trim() === '') {
    throw new Error('O texto da mensagem está vazio.');
  }

  const systemPrompt = buildSystemPrompt(tone, customInstruction);

  try {
    let result: string;
    if (provider === 'gemini') {
      result = await callGemini({ apiKey, model, systemPrompt, promptText });
    } else {
      result = await callGroq({ apiKey, model, systemPrompt, promptText });
    }
    console.log(`[Writely AI] === FIM (${provider.toUpperCase()} SUCESSO) ===`);
    return result;
  } catch (error: any) {
    console.error(`[Writely AI] === ERRO (${provider.toUpperCase()}) ===`);
    console.error('[Writely AI] Error:', error?.message);
    if (error?.name === 'AbortError') {
      throw new Error('Tempo limite excedido (15s). Tente novamente.');
    }
    throw error;
  }
}
