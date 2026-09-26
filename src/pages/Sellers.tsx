import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, Trash2, Edit, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Seller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export default function Sellers() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  useEffect(() => {
    checkAuth();
    loadSellers();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadSellers = async () => {
    try {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error("Erro ao carregar vendedores:", error);
      toast.error("Erro ao carregar vendedores");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingSeller) {
        const { error } = await supabase
          .from("sellers")
          .update({
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
          })
          .eq("id", editingSeller.id);

        if (error) throw error;
        toast.success("Vendedor atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("sellers")
          .insert([{
            name: formData.name,
            email: formData.email,
            phone: formData.phone || null,
            user_id: user.id,
          }]);

        if (error) throw error;
        toast.success("Vendedor cadastrado com sucesso!");
      }

      setFormData({ name: "", email: "", phone: "" });
      setEditingSeller(null);
      setIsDialogOpen(false);
      loadSellers();
    } catch (error) {
      console.error("Erro ao salvar vendedor:", error);
      toast.error("Erro ao salvar vendedor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este vendedor?")) return;

    try {
      const { error } = await supabase
        .from("sellers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Vendedor excluído com sucesso!");
      loadSellers();
    } catch (error) {
      console.error("Erro ao excluir vendedor:", error);
      toast.error("Erro ao excluir vendedor");
    }
  };

  const toggleActive = async (seller: Seller) => {
    try {
      const { error } = await supabase
        .from("sellers")
        .update({ active: !seller.active })
        .eq("id", seller.id);

      if (error) throw error;
      toast.success(`Vendedor ${!seller.active ? "ativado" : "desativado"} com sucesso!`);
      loadSellers();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      email: seller.email,
      phone: seller.phone || "",
    });
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingSeller(null);
    setFormData({ name: "", email: "", phone: "" });
    setIsDialogOpen(true);
  };

  const filteredSellers = sellers.filter(seller =>
    seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendedores</h1>
            <p className="text-muted-foreground mt-1">Gerencie sua equipe de vendas</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog} className="gap-2 ">
                <UserPlus className="h-4 w-4" />
                Novo Vendedor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSeller ? "Editar Vendedor" : "Novo Vendedor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Digite o nome do vendedor"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="vendedor@exemplo.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1 ">
                    {editingSeller ? "Atualizar" : "Cadastrar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar vendedor por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredSellers.length === 0 ? (
          <Card className="border-border/50 shadow-medium">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchTerm ? "Nenhum vendedor encontrado com esse termo" : "Nenhum vendedor cadastrado ainda"}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSellers.map((seller) => (
              <Card key={seller.id} className="hover:shadow-lg transition-all duration-300 border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{seller.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{seller.email}</p>
                      {seller.phone && (
                        <p className="text-sm text-muted-foreground">{seller.phone}</p>
                      )}
                    </div>
                    <Badge variant={seller.active ? "default" : "secondary"}>
                      {seller.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Switch
                        checked={seller.active}
                        onCheckedChange={() => toggleActive(seller)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(seller)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(seller.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Cadastrado em: {new Date(seller.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
