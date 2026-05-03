import { supabase } from '@/integrations/supabase/client';

export async function getOrCreateConversation(currentUserId: string, otherUserId: string, requestId?: string | null) {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId) {
    throw new Error('Invalid conversation participants');
  }

  const [{ data: direct }, { data: reverse }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id')
      .eq('seller_id', currentUserId)
      .eq('buyer_id', otherUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('conversations')
      .select('id')
      .eq('seller_id', otherUserId)
      .eq('buyer_id', currentUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const existing = direct ?? reverse;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('conversations')
    .insert({ seller_id: currentUserId, buyer_id: otherUserId, request_id: requestId ?? null })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}