import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Message {
  id: string;
  coach_id: string;
  athlete_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  lastMessage: Message;
  unreadCount: number;
}

/** Hook para um thread específico entre coach e atleta */
export function useMessages(coachId: string, athleteId: string) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user || !coachId || !athleteId) { setIsLoading(false); return; }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: true });

    if (!error) setMessages((data as Message[]) || []);
    setIsLoading(false);
  }, [user, coachId, athleteId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!coachId || !athleteId) return;

    const channel = supabase
      .channel(`messages-${coachId}-${athleteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `coach_id=eq.${coachId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.athlete_id === athleteId) {
          setMessages((prev) => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [coachId, athleteId]);

  const sendMessage = async (content: string): Promise<string | null> => {
    if (!user || !content.trim()) return 'Mensagem vazia.';

    const { error } = await supabase.from('messages').insert({
      coach_id: coachId,
      athlete_id: athleteId,
      sender_id: user.id,
      content: content.trim(),
    } as any);

    if (error) { console.error(error); return 'Erro ao enviar mensagem.'; }
    return null;
  };

  const markRead = async () => {
    if (!user) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() } as any)
      .eq('coach_id', coachId)
      .eq('athlete_id', athleteId)
      .neq('sender_id', user.id)
      .is('read_at', null);
  };

  return { messages, isLoading, sendMessage, markRead, refresh: fetchMessages };
}

/** Hook para listar todas as conversas do usuário (coach ou atleta) */
export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }

    const fetch = async () => {
      // Fetch all messages where user is participant
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`coach_id.eq.${user.id},athlete_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error || !data) { setIsLoading(false); return; }

      const msgs = data as Message[];

      // Get unique thread keys
      const threadMap = new Map<string, Message[]>();
      for (const msg of msgs) {
        const key = `${msg.coach_id}|${msg.athlete_id}`;
        if (!threadMap.has(key)) threadMap.set(key, []);
        threadMap.get(key)!.push(msg);
      }

      // Get partner IDs
      const partnerIds = Array.from(threadMap.keys()).map((key) => {
        const [cId, aId] = key.split('|');
        return cId === user.id ? aId : cId;
      });

      if (partnerIds.length === 0) { setConversations([]); setIsLoading(false); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', partnerIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const convs: Conversation[] = [];
      let totalUnread = 0;

      for (const [key, threadMsgs] of threadMap.entries()) {
        const [cId, aId] = key.split('|');
        const partnerId = cId === user.id ? aId : cId;
        const profile = profileMap.get(partnerId) as any;
        const unread = threadMsgs.filter((m) => m.sender_id !== user.id && !m.read_at).length;
        totalUnread += unread;
        convs.push({
          partnerId,
          partnerName: profile?.display_name ?? profile?.email ?? 'Usuário',
          partnerEmail: profile?.email ?? '',
          lastMessage: threadMsgs[0],
          unreadCount: unread,
        });
      }

      setConversations(convs);
      setUnreadTotal(totalUnread);
      setIsLoading(false);
    };

    fetch();
  }, [user]);

  return { conversations, unreadTotal, isLoading };
}
