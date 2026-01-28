import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useEquipment, calculateWearPercentage, getStatusColorClasses, getStatusLabel } from '@/hooks/useEquipment';
import { useData } from '@/hooks/useData';
import { useToast } from '@/hooks/use-toast';
import { Equipment as EquipmentType } from '@/types/health';
import { Loader2, Plus, Footprints, CalendarIcon, AlertTriangle, Trash2, Archive, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Equipment() {
  const { toast } = useToast();
  const { equipment, isLoading, saveEquipment, deleteEquipment, retireEquipment } = useEquipment();
  const { workouts } = useData();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formStartDate, setFormStartDate] = useState<Date>(new Date());
  const [formMaxKm, setFormMaxKm] = useState(600);
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setFormName('');
    setFormBrand('');
    setFormStartDate(new Date());
    setFormMaxKm(600);
    setIsEditing(false);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEdit = (eq: EquipmentType) => {
    setFormName(eq.name);
    setFormBrand(eq.brand || '');
    const [year, month, day] = eq.startDate.split('-').map(Number);
    setFormStartDate(new Date(year, month - 1, day));
    setFormMaxKm(eq.maxKm);
    setIsEditing(true);
    setSelectedEquipment(eq);
    setIsAddDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do tênis',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    const success = await saveEquipment({
      id: isEditing ? selectedEquipment?.id : undefined,
      name: formName.trim(),
      brand: formBrand.trim() || undefined,
      startDate: format(formStartDate, 'yyyy-MM-dd'),
      maxKm: formMaxKm,
      activeForSelection: true,
    });
    setIsSaving(false);

    if (success) {
      toast({
        title: isEditing ? 'Tênis atualizado!' : 'Tênis adicionado!',
        description: formName,
      });
      setIsAddDialogOpen(false);
      resetForm();
    } else {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o tênis.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenDetail = (eq: EquipmentType) => {
    setSelectedEquipment(eq);
    setIsDetailSheetOpen(true);
  };

  const handleRetire = async (eq: EquipmentType) => {
    const success = await retireEquipment(eq.id);
    if (success) {
      toast({ title: 'Tênis aposentado', description: eq.name });
      setIsDetailSheetOpen(false);
    } else {
      toast({ title: 'Erro ao aposentar', variant: 'destructive' });
    }
  };

  const handleDelete = async (eq: EquipmentType) => {
    const success = await deleteEquipment(eq.id);
    if (success) {
      toast({ title: 'Tênis removido', description: eq.name });
      setIsDetailSheetOpen(false);
    } else {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  // Get workouts for selected equipment
  const getEquipmentWorkouts = (equipmentId: string) => {
    return workouts
      .filter(w => w.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  };

  if (isLoading) {
    return (
      <PageContainer title="Equipamentos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer 
      title="Equipamentos" 
      subtitle="Gerencie seus tênis de corrida"
    >
      {/* Add Button */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button onClick={handleOpenAddDialog} className="w-full mb-4">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Tênis
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Tênis' : 'Novo Tênis'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Nike Pegasus 40"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca (opcional)</Label>
              <Input
                id="brand"
                placeholder="Ex: Nike"
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de início de uso</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formStartDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formStartDate}
                    onSelect={(date) => date && setFormStartDate(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxKm">Km máximo recomendado</Label>
              <Input
                id="maxKm"
                type="number"
                min={100}
                max={2000}
                value={formMaxKm}
                onChange={(e) => setFormMaxKm(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Vida útil típica: 500-800 km</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isEditing ? 'Salvar Alterações' : 'Adicionar Tênis'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equipment List */}
      {equipment.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Footprints className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum tênis cadastrado</p>
          <p className="text-sm">Adicione seu primeiro tênis de corrida</p>
        </div>
      ) : (
        <div className="space-y-3">
          {equipment.map((eq) => {
            const wearPct = calculateWearPercentage(eq.totalKm, eq.maxKm);
            const colors = getStatusColorClasses(eq.status);
            
            return (
              <button
                key={eq.id}
                onClick={() => handleOpenDetail(eq)}
                className={`w-full text-left p-4 rounded-xl border transition-all hover:shadow-md ${colors.border} ${colors.bg}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Footprints className={`w-5 h-5 ${colors.text}`} />
                    <div>
                      <p className="font-semibold">{eq.name}</p>
                      {eq.brand && <p className="text-sm text-muted-foreground">{eq.brand}</p>}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {getStatusLabel(eq.status)}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Quilometragem</span>
                    <span className="font-medium">
                      {eq.totalKm.toFixed(1)} / {eq.maxKm} km
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(wearPct, 100)} 
                    className={`h-2 ${eq.status === 'retired' ? '[&>div]:bg-red-500' : eq.status === 'attention' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`}
                  />
                  <p className={`text-xs ${colors.text}`}>
                    {wearPct.toFixed(0)}% de uso
                  </p>
                </div>

                {eq.status === 'attention' && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-yellow-500">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Considere substituir em breve</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent>
          {selectedEquipment && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Footprints className="w-5 h-5 text-primary" />
                  {selectedEquipment.name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Basic Info */}
                <div className="space-y-2">
                  {selectedEquipment.brand && (
                    <p className="text-muted-foreground">Marca: {selectedEquipment.brand}</p>
                  )}
                  <p className="text-muted-foreground">
                    Em uso desde: {format(new Date(selectedEquipment.startDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-muted-foreground">
                    Status: <span className={getStatusColorClasses(selectedEquipment.status).text}>
                      {getStatusLabel(selectedEquipment.status)}
                    </span>
                  </p>
                </div>

                {/* Wear Progress */}
                <div className="p-4 rounded-xl bg-secondary space-y-3">
                  <p className="font-semibold">Desgaste</p>
                  <div className="flex items-center justify-between text-lg">
                    <span>{selectedEquipment.totalKm.toFixed(1)} km</span>
                    <span className="text-muted-foreground">/ {selectedEquipment.maxKm} km</span>
                  </div>
                  <Progress 
                    value={Math.min(calculateWearPercentage(selectedEquipment.totalKm, selectedEquipment.maxKm), 100)} 
                    className={`h-3 ${
                      selectedEquipment.status === 'retired' 
                        ? '[&>div]:bg-red-500' 
                        : selectedEquipment.status === 'attention' 
                          ? '[&>div]:bg-yellow-500' 
                          : '[&>div]:bg-green-500'
                    }`}
                  />
                  <p className={`text-sm ${getStatusColorClasses(selectedEquipment.status).text}`}>
                    {calculateWearPercentage(selectedEquipment.totalKm, selectedEquipment.maxKm).toFixed(0)}% da vida útil
                  </p>
                </div>

                {/* Recent Workouts */}
                <div className="space-y-3">
                  <p className="font-semibold">Últimos Treinos</p>
                  {getEquipmentWorkouts(selectedEquipment.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum treino registrado</p>
                  ) : (
                    <div className="space-y-2">
                      {getEquipmentWorkouts(selectedEquipment.id).map((w) => (
                        <div key={w.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm">
                          <span>{format(new Date(w.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span className="text-muted-foreground">{w.distanceKm?.toFixed(1) || 0} km</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsDetailSheetOpen(false);
                      handleOpenEdit(selectedEquipment);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  
                  {selectedEquipment.status !== 'retired' && (
                    <Button
                      variant="outline"
                      className="w-full text-yellow-500 hover:text-yellow-600"
                      onClick={() => handleRetire(selectedEquipment)}
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Aposentar
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => handleDelete(selectedEquipment)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}
