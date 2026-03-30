import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useMessages } from '@/hooks/useMessages';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Página de chat usada tanto pelo coach (/coach/athlete/:id/chat)
 * quanto pelo atleta (/messages/:coachId).
 * O parâmetro `id` é sempre o parceiro da conversa.
 */
export default function ChatPage() {
  const { id: partnerId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [partnerName, setPartnerName] = useState('');
  const [isCoach, setIsCoach] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Determine role to build correct coach/athlete IDs for the thread
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsCoach((data as any)?.role === 'coach'));
  }, [user]);

  useEffect(() => {
    if (!partnerId) return;
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('user_id', partnerId)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as any;
        setPartnerName(p?.display_name ?? p?.email ?? 'Usuário');
      });
  }, [partnerId]);

  const coachId = isCoach ? user?.id ?? '' : partnerId ?? '';
  const athleteId = isCoach ? partnerId ?? '' : user?.id ?? '';

  const { messages, isLoading, sendMessage, markRead } = useMessages(coachId, athleteId);

  useEffect(() => {
    if (!isLoading) markRead();
  }, [isLoading, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const err = await sendMessage(text);
    setSending(false);
    if (err) { toast.error(err); return; }
    setText('');
  };

  const backPath = isCoach ? `/coach/athlete/${partnerId}` : '/messages';

  if (isCoach === null || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer title={partnerName || 'Chat'} subtitle={isCoach ? 'Atleta' : 'Coach'}>
      <div className="flex flex-col pb-32">
        <Button variant="ghost" size="sm" className="self-start mb-4" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        {/* Messages */}
        <div className="space-y-3 min-h-[50vh]">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              Nenhuma mensagem ainda. Diga olá!
            </p>
          )}
          {messages.map((msg) => {
            const mine = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[78%] rounded-2xl px-4 py-2.5 space-y-1',
                    mine
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm',
                  )}
                >
                  <p className="text-sm leading-snug">{msg.content}</p>
                  <p className={cn('text-[10px]', mine ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground')}>
                    {format(new Date(msg.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                    {mine && msg.read_at && ' · lida'}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input fixo no rodapé */}
      <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-3">
        <div className="flex gap-2 max-w-lg mx-auto">
          <Input
            placeholder="Digite uma mensagem..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={sending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
