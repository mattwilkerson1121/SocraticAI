/**
 * Resolve OpenAI credentials: prefer per-user key, fall back to server env.
 */
import { supabaseAdmin } from '../config/supabase';

export type OpenAICredentials = {
  apiKey: string;
  modelName: string;
  source: 'user' | 'env';
};

export async function resolveOpenAICredentials(
  userId: string
): Promise<OpenAICredentials | null> {
  const { data: apiKeys } = await supabaseAdmin
    .from('user_api_keys')
    .select('encrypted_key, model_name')
    .eq('user_id', userId)
    .eq('provider', 'openai')
    .eq('is_active', true)
    .limit(1);

  if (apiKeys && apiKeys.length > 0 && apiKeys[0].encrypted_key) {
    return {
      apiKey: apiKeys[0].encrypted_key,
      modelName: apiKeys[0].model_name || process.env.OPENAI_MODEL || 'gpt-4o',
      source: 'user',
    };
  }

  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) {
    return {
      apiKey: envKey,
      modelName: process.env.OPENAI_MODEL || 'gpt-4o',
      source: 'env',
    };
  }

  return null;
}
