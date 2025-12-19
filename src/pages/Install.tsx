import { useState, useEffect } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, CheckCircle2, Share, PlusSquare } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <PageContainer title="Instalar App">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">App Instalado!</h2>
                <p className="text-muted-foreground mt-2">
                  O SaúdeTracker já está instalado no seu dispositivo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Instalar App">
      <div className="space-y-6">
        {/* Hero */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-2xl bg-primary/20 p-4">
                <Smartphone className="h-12 w-12 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Instale o SaúdeTracker
                </h2>
                <p className="text-muted-foreground mt-2">
                  Acesse rapidamente direto da tela inicial do seu celular
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Benefícios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Acesso rápido pela tela inicial</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Funciona em tela cheia</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Carregamento mais rápido</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">Funciona offline</span>
            </div>
          </CardContent>
        </Card>

        {/* Install Instructions */}
        {deferredPrompt ? (
          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download className="mr-2 h-5 w-5" />
            Instalar Agora
          </Button>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como instalar no iPhone</CardTitle>
              <CardDescription>Siga os passos abaixo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Toque no botão</span>
                  <Share className="h-5 w-5 text-primary" />
                  <span className="text-sm text-foreground">Compartilhar</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground">Role e toque em</span>
                  <PlusSquare className="h-5 w-5 text-primary" />
                  <span className="text-sm text-foreground">"Adicionar à Tela de Início"</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <span className="text-sm text-foreground">Toque em "Adicionar"</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como instalar no Android</CardTitle>
              <CardDescription>Siga os passos abaixo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <span className="text-sm text-foreground">Toque no menu do navegador (⋮)</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <span className="text-sm text-foreground">Toque em "Adicionar à tela inicial"</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <span className="text-sm text-foreground">Confirme tocando em "Adicionar"</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
