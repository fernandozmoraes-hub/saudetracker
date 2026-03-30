import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Loader2, MessageCircle } from 'lucide-react';
import { useConversations } from '@/hooks/useMessages';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MessagesPage() {
  const navigate = useNavigate();
  const { isCoach } = useUserRole();
  const { conversations, isLoading } = useConversations();

  const getChatPath = (partnerId: string) =>
    isCoach ? `/coach/athlete/${partnerId}/chat` : `/messages/${partnerId}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer title="Mensagens" subtitle="Conversas com seu coach">
      <div className="space-y-3 pb-20">
        {conversations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Nenhuma conversa ainda.</p>
              <p className="text-sm text-muted-foreground">
                {isCoach
                  ? 'Inicie uma conversa acessando o perfil de um atleta.'
                  : 'Seu coach pode te enviar uma mensagem em breve.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          conversations.map((conv) => (
            <Card
              key={conv.partnerId}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(getChatPath(conv.partnerId))}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {(conv.partnerName[0] ?? '?').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground truncate">{conv.partnerName}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(conv.lastMessage.created_at), "d MMM", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {conv.lastMessage.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conv.unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 px-1.5 text-xs">{conv.unreadCount}</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
