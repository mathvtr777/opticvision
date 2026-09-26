import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Users, Search, Pencil, Trash2, FileUp } from "lucide-react";

const emptyForm = {
  nome: "",
  email: "",
  telefone: "",
  observacoes: "",
  dnp_od: "",
  dnp_oe: "",
  pupillary_height_od: "",
  pupillary_height_oe: "",
  lens_type: "",
};

const emptyReceita = {
  od_esferico: "",
  od_cilindrico: "",
  od_eixo: "",
  od_adicao: "",
  oe_esferico: "",
  oe_cilindrico: "",
  oe_eixo: "",
  oe_adicao: "",
  medico: "",
  data_receita: "",
  observacoes: "",
};

export default function Clients() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [addReceita, setAddReceita] = useState(false);
  const [receita, setReceita] = useState({ ...emptyReceita });
  const [receitaFile, setReceitaFile] = useState<File | null>(null);

  useEffect(() => {
    checkAuth();
    loadClients();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar clientes: " + error.message);
    } else {
      setClients(data || []);
    }
  };

  const resetAll = () => {
    setFormData({ ...emptyForm });
    setReceita({ ...emptyReceita });
    setReceitaFile(null);
    setAddReceita(false);
    setEditingId(null);
  };

  const uploadReceitaFile = async (userId: string) => {
    if (!receitaFile) return null;
    const ext = receitaFile.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("receitas")
      .upload(path, receitaFile);
    if (error) throw error;
    const { data } = supabase.storage.from("receitas").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const payload = {
        name: formData.nome,
        email: formData.email || null,
        phone: formData.telefone || null,
        notes: formData.observacoes || null,
        dnp_od: formData.dnp_od ? parseFloat(formData.dnp_od.replace(',', '.')) : null,
        dnp_oe: formData.dnp_oe ? parseFloat(formData.dnp_oe.replace(',', '.')) : null,
        pupillary_height_od: formData.pupillary_height_od ? parseFloat(formData.pupillary_height_od.replace(',', '.')) : null,
        pupillary_height_oe: formData.pupillary_height_oe ? parseFloat(formData.pupillary_height_oe.replace(',', '.')) : null,
        lens_type: formData.lens_type || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { data: inserted, error } = await supabase
          .from("clients")
          .insert([{ ...payload, user_id: user.id }])
          .select()
          .single();
        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");

        if (addReceita && inserted) {
          let arquivoUrl: string | null = null;
          try {
            arquivoUrl = await uploadReceitaFile(user.id);
          } catch (upErr: any) {
            toast.error("Cliente salvo, mas houve erro ao enviar o arquivo da receita: " + (upErr.message || ""));
          }

          const observacoesReceita = [
            receita.observacoes,
            arquivoUrl ? `Arquivo: ${arquivoUrl}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          const { error: recErr } = await supabase.from("receitas").insert([
            {
              user_id: user.id,
              cliente_id: inserted.id,
              od_esferico: receita.od_esferico || null,
              od_cilindrico: receita.od_cilindrico || null,
              od_eixo: receita.od_eixo || null,
              od_adicao: receita.od_adicao || null,
              oe_esferico: receita.oe_esferico || null,
              oe_cilindrico: receita.oe_cilindrico || null,
              oe_eixo: receita.oe_eixo || null,
              oe_adicao: receita.oe_adicao || null,
              medico: receita.medico || null,
              data_receita: receita.data_receita || null,
              observacoes: observacoesReceita || null,
            },
          ]);
          if (recErr) {
            toast.error("Cliente salvo, mas houve erro ao salvar a receita: " + recErr.message);
          } else {
            toast.success("Receita registrada!");
          }
        }
      }

      resetAll();
      setShowForm(false);
      loadClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client: any) => {
    setFormData({
      nome: client.name || client.nome || "",
      email: client.email || "",
      telefone: client.phone || client.telefone || "",
      observacoes: client.notes || client.observacoes || "",
      dnp_od: client.dnp_od ? String(client.dnp_od) : "",
      dnp_oe: client.dnp_oe ? String(client.dnp_oe) : "",
      pupillary_height_od: client.pupillary_height_od ? String(client.pupillary_height_od) : "",
      pupillary_height_oe: client.pupillary_height_oe ? String(client.pupillary_height_oe) : "",
      lens_type: client.lens_type || "",
    });
    setReceita({ ...emptyReceita });
    setReceitaFile(null);
    setAddReceita(false);
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este cliente?")) return;

    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cliente excluído com sucesso!");
      loadClients();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir cliente");
    }
  };

  const filteredClients = clients.filter((client) =>
    (client.name || client.nome || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Clientes
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie seus clientes</p>
          </div>
          <Button
            onClick={() => {
              resetAll();
              setShowForm(!showForm);
            }}
            className=""
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {showForm && (
          <Card className="border-border/50 shadow-medium">
            <CardHeader>
              <CardTitle>{editingId ? "Editar Cliente" : "Novo Cliente"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome*</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-4 rounded-lg border border-border/50 p-4 bg-muted/10">
                  <h3 className="font-semibold text-sm">DADOS ÓPTICOS</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase">DNP</Label>
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">OD (mm)</Label>
                          <Input
                            placeholder="Ex: 31"
                            value={formData.dnp_od}
                            onChange={(e) => setFormData({ ...formData, dnp_od: e.target.value })}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">OE (mm)</Label>
                          <Input
                            placeholder="Ex: 32"
                            value={formData.dnp_oe}
                            onChange={(e) => setFormData({ ...formData, dnp_oe: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase">Altura Pupilar</Label>
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">OD (mm)</Label>
                          <Input
                            placeholder="Ex: 18"
                            value={formData.pupillary_height_od}
                            onChange={(e) => setFormData({ ...formData, pupillary_height_od: e.target.value })}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs">OE (mm)</Label>
                          <Input
                            placeholder="Ex: 19"
                            value={formData.pupillary_height_oe}
                            onChange={(e) => setFormData({ ...formData, pupillary_height_oe: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">Tipo de Lente</Label>
                    <Input
                      placeholder="Ex: Multifocal, Monofocal, Blue Control..."
                      value={formData.lens_type}
                      onChange={(e) => setFormData({ ...formData, lens_type: e.target.value })}
                    />
                  </div>
                </div>

                {!editingId && (
                  <div className="space-y-4 rounded-lg border border-border/50 p-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="addReceita"
                        type="checkbox"
                        checked={addReceita}
                        onChange={(e) => setAddReceita(e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                      <Label htmlFor="addReceita" className="cursor-pointer">
                        Registrar grau e medidas da receita
                      </Label>
                    </div>

                    {addReceita && (
                      <div className="space-y-4">
                        <div>
                          <p className="font-semibold text-sm mb-2">Olho Direito (OD)</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="od_esferico">Esférico</Label>
                              <Input
                                id="od_esferico"
                                value={receita.od_esferico}
                                onChange={(e) => setReceita({ ...receita, od_esferico: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="od_cilindrico">Cilíndrico</Label>
                              <Input
                                id="od_cilindrico"
                                value={receita.od_cilindrico}
                                onChange={(e) => setReceita({ ...receita, od_cilindrico: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="od_eixo">Eixo</Label>
                              <Input
                                id="od_eixo"
                                value={receita.od_eixo}
                                onChange={(e) => setReceita({ ...receita, od_eixo: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="od_adicao">Adição</Label>
                              <Input
                                id="od_adicao"
                                value={receita.od_adicao}
                                onChange={(e) => setReceita({ ...receita, od_adicao: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold text-sm mb-2">Olho Esquerdo (OE)</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="oe_esferico">Esférico</Label>
                              <Input
                                id="oe_esferico"
                                value={receita.oe_esferico}
                                onChange={(e) => setReceita({ ...receita, oe_esferico: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="oe_cilindrico">Cilíndrico</Label>
                              <Input
                                id="oe_cilindrico"
                                value={receita.oe_cilindrico}
                                onChange={(e) => setReceita({ ...receita, oe_cilindrico: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="oe_eixo">Eixo</Label>
                              <Input
                                id="oe_eixo"
                                value={receita.oe_eixo}
                                onChange={(e) => setReceita({ ...receita, oe_eixo: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="oe_adicao">Adição</Label>
                              <Input
                                id="oe_adicao"
                                value={receita.oe_adicao}
                                onChange={(e) => setReceita({ ...receita, oe_adicao: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="medico">Médico</Label>
                            <Input
                              id="medico"
                              value={receita.medico}
                              onChange={(e) => setReceita({ ...receita, medico: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="data_receita">Data da receita</Label>
                            <Input
                              id="data_receita"
                              type="date"
                              value={receita.data_receita}
                              onChange={(e) => setReceita({ ...receita, data_receita: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="receita_obs">Observações da receita</Label>
                          <Textarea
                            id="receita_obs"
                            value={receita.observacoes}
                            onChange={(e) => setReceita({ ...receita, observacoes: e.target.value })}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="receita_file" className="flex items-center gap-2">
                            <FileUp className="w-4 h-4" />
                            Foto ou PDF da receita
                          </Label>
                          <Input
                            id="receita_file"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setReceitaFile(e.target.files?.[0] || null)}
                          />
                          {receitaFile && (
                            <p className="text-xs text-muted-foreground">
                              Selecionado: {receitaFile.name}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={loading}
                    className=""
                  >
                    {editingId ? "Atualizar" : "Cadastrar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetAll();
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 shadow-medium">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredClients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum cliente encontrado
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{client.name || client.nome}</h3>
                      {(client.phone || client.telefone) && (
                        <p className="text-sm text-muted-foreground">{client.phone || client.telefone}</p>
                      )}
                      {client.email && (
                        <p className="text-xs text-muted-foreground mt-1">{client.email}</p>
                      )}
                      {client.notes && (
                        <div className="mt-2 text-sm bg-muted/50 p-2 rounded border-l-2 border-primary/50 text-slate-700">
                          <span className="font-semibold text-xs uppercase text-slate-500 block mb-1">Observações:</span>
                          {client.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(client)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(client.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
