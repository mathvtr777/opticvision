import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export default function Sales() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadData = async () => {
    const { data: productsData } = await supabase
      .from("products")
      .select("*")
      .order("name");
    
    const { data: clientsData } = await supabase
      .from("clients")
      .select("*")
      .order("name");

    const { data: sellersData } = await supabase
      .from("sellers")
      .select("*")
      .eq("active", true)
      .order("name");

    setProducts(productsData || []);
    setClients(clientsData || []);
    setSellers(sellersData || []);
  };

  const addItem = () => {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    if (product.stock < quantity) {
      toast.error("Estoque insuficiente!");
      return;
    }

    const existingItem = saleItems.find((item) => item.product_id === selectedProduct);
    if (existingItem) {
      setSaleItems(
        saleItems.map((item) =>
          item.product_id === selectedProduct
            ? {
                ...item,
                quantity: item.quantity + quantity,
                subtotal: (item.quantity + quantity) * item.unit_price,
              }
            : item
        )
      );
    } else {
      setSaleItems([
        ...saleItems,
        {
          product_id: product.id,
          product_name: product.name,
          quantity,
          unit_price: Number(product.price),
          subtotal: quantity * Number(product.price),
        },
      ]);
    }

    setSelectedProduct("");
    setQuantity(1);
  };

  const removeItem = (productId: string) => {
    setSaleItems(saleItems.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saleItems.length === 0) {
      toast.error("Adicione pelo menos um item à venda");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const totalAmount = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      const selectedSeller = sellers.find(s => s.id === sellerId);
      const sellerName = selectedSeller?.name || "";

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          user_id: user.id,
          client_id: clientId || null,
          seller_name: sellerName,
          total_amount: totalAmount,
          payment_method: paymentMethod,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      const { error: itemsError } = await supabase.from("sale_items").insert(
        saleItems.map((item) => ({
          sale_id: sale.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        }))
      );

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of saleItems) {
        const product = products.find((p) => p.id === item.product_id);
        await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", item.product_id);
      }

      // Update client total spent
      if (clientId) {
        const client = clients.find((c) => c.id === clientId);
        await supabase
          .from("clients")
          .update({ total_spent: Number(client.total_spent) + totalAmount })
          .eq("id", clientId);
      }

      toast.success("Venda registrada com sucesso!");
      setSaleItems([]);
      setClientId("");
      setSellerId("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  };

  const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-primary" />
            Nova Venda
          </h1>
          <p className="text-muted-foreground mt-1">Registre uma nova venda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-border/50 shadow-medium">
            <CardHeader>
              <CardTitle>Informações da Venda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente (Opcional)</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vendedor*</Label>
                  <Select value={sellerId} onValueChange={setSellerId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map((seller) => (
                        <SelectItem key={seller.id} value={seller.id}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento*</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-medium">
            <CardHeader>
              <CardTitle>Adicionar Produtos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-[1fr_120px_auto] gap-3">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - R$ {Number(product.price).toFixed(2)} (Est: {product.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button
                    type="button"
                    onClick={addItem}
                    disabled={!selectedProduct}
                    className="bg-gradient-kiwi hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {saleItems.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  {saleItems.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity}x R$ {item.unit_price.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">R$ {item.subtotal.toFixed(2)}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.product_id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border-2 border-primary/20">
                    <p className="font-bold text-lg">Total</p>
                    <p className="font-bold text-2xl text-primary">R$ {total.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={loading || saleItems.length === 0}
            className="w-full h-12 bg-gradient-kiwi hover:opacity-90 text-lg"
          >
            Finalizar Venda
          </Button>
        </form>
      </div>
    </Layout>
  );
}