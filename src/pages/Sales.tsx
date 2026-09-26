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
import { Plus, ShoppingCart, Trash2, AlertCircle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

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
  const [installments, setInstallments] = useState("1");
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [finalAmountInput, setFinalAmountInput] = useState("");

  const originalTotal = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
  const finalTotal = isEditingPrice && finalAmountInput !== "" ? parseFloat(finalAmountInput) || 0 : originalTotal;
  const discountAmount = originalTotal - finalTotal;

  const paidAmountNum = parseFloat(paidAmount) || 0;
  const remainingAmount = paymentType === "partial" ? Math.max(0, finalTotal - paidAmountNum) : 0;

  const showInstallments = paymentMethod === "credit";
  const showPaymentType = paymentMethod === "cash" || paymentMethod === "pix";
  const showPartialFields = showPaymentType && paymentType === "partial";

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  // Sync paidAmount to full amount when switching to full
  useEffect(() => {
    if (paymentType === "full") {
      setPaidAmount(finalTotal > 0 ? finalTotal.toFixed(2) : "");
    }
  }, [paymentType, finalTotal]);

  // Reset payment-specific fields when method changes
  useEffect(() => {
    setPaymentType("full");
    setInstallments("1");
    setPaidAmount(finalTotal > 0 ? finalTotal.toFixed(2) : "");
  }, [paymentMethod]);

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

  const validatePayment = (): boolean => {
    if (!sellerId) {
      toast.error("Selecione um vendedor para continuar.");
      return false;
    }
    if (saleItems.length === 0) {
      toast.error("Adicione pelo menos um item à venda.");
      return false;
    }
    if (showPartialFields) {
      if (!paidAmount || paidAmountNum <= 0) {
        toast.error("Informe o valor pago.");
        return false;
      }
      if (paidAmountNum > finalTotal) {
        toast.error("O valor pago não pode ser maior que o total final da venda.");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePayment()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const totalAmount = finalTotal;
      const effectivePaid = showPartialFields ? paidAmountNum : totalAmount;
      const isPartial = showPartialFields && paidAmountNum < totalAmount;
      const paymentStatus = isPartial ? "partial" : "paid";

      const selectedSeller = sellers.find((s) => s.id === sellerId);
      const sellerName = selectedSeller?.name || "";

      // Build payment_method string — include installments for credit
      let finalPaymentMethod = paymentMethod;
      if (paymentMethod === "credit" && parseInt(installments) > 1) {
        finalPaymentMethod = `credit_${installments}x`;
      }

      // Insert sale
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert([{
          user_id: user.id,
          client_id: clientId || null,
          seller_name: sellerName,
          total_amount: totalAmount,
          original_amount: originalTotal,
          discount_amount: discountAmount,
          notes: notes || null,
          payment_method: finalPaymentMethod,
          payment_status: paymentStatus,
          paid_amount: effectivePaid,
          installments: paymentMethod === "credit" ? parseInt(installments) : null,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
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

      // Se houve ajuste manual de preço, registrar na auditoria
      if (isEditingPrice && discountAmount !== 0) {
        await supabase.from("sale_price_adjustments").insert([{
          sale_id: sale.id,
          user_id: user.id,
          user_name: user.user_metadata?.name || user.email || "Usuário",
          original_amount: originalTotal,
          final_amount: finalTotal,
          difference: -discountAmount, // se original=1200, final=1100, difference=-100
        }]);
      }

      // Register initial payment in sale_payments
      const today = new Date().toISOString().split("T")[0];
      const { error: paymentError } = await supabase.from("sale_payments").insert([{
        sale_id: sale.id,
        user_id: user.id,
        amount: effectivePaid,
        payment_method: paymentMethod,
        payment_date: today,
        notes: isPartial ? "Pagamento inicial (parcial)" : "Pagamento total",
      }]);
      if (paymentError) throw paymentError;

      // Register in financial_transactions (only effectively received amount)
      const paymentLabel: Record<string, string> = {
        cash: "Dinheiro",
        debit: "Débito",
        credit: "Crédito",
        pix: "PIX",
      };
      await supabase.from("financial_transactions").insert([{
        user_id: user.id,
        type: "income",
        category: "Venda",
        amount: effectivePaid,
        description: `Venda - ${sellerName}${paymentMethod === "credit" ? ` (${installments}x no crédito)` : ""} - ${paymentLabel[paymentMethod] || paymentMethod}${isPartial ? " [Pagamento parcial]" : ""}`,
        date: today,
      }]);

      // Update product stock
      for (const item of saleItems) {
        const product = products.find((p) => p.id === item.product_id);
        await supabase
          .from("products")
          .update({ stock: product.stock - item.quantity })
          .eq("id", item.product_id);
      }

      // Update client total spent (only effectively paid amount)
      if (clientId) {
        const client = clients.find((c) => c.id === clientId);
        await supabase
          .from("clients")
          .update({ total_spent: Number(client.total_spent || 0) + effectivePaid })
          .eq("id", clientId);
      }

      // Auto-criar pedido vinculado à venda
      try {
        let orderOpticalData = {};
        if (clientId) {
          const clientData = clients.find((c) => c.id === clientId);
          if (clientData) {
            orderOpticalData = {
              dnp_od: clientData.dnp_od,
              dnp_oe: clientData.dnp_oe,
              pupillary_height_od: clientData.pupillary_height_od,
              pupillary_height_oe: clientData.pupillary_height_oe,
              lens_type: clientData.lens_type,
            };
          }
        }

        const { data: createdOrder, error: orderErr } = await supabase
          .from("orders")
          .insert([{
            user_id: user.id,
            sale_id: sale.id,
            client_id: clientId || null,
            seller_name: sellerName,
            status: "sale_created",
            notes: notes || null,
            original_amount: originalTotal,
            final_amount: finalTotal,
            ...orderOpticalData,
          }])
          .select("id")
          .single();

        if (!orderErr && createdOrder) {
          await supabase.from("order_status_history").insert([{
            order_id: createdOrder.id,
            user_id: user.id,
            status: "sale_created",
            changed_by: sellerName,
            notes: "Pedido criado automaticamente na finalização da venda",
          }]);
        }
      } catch {
        // Pedido não-crítico; a venda já foi salva com sucesso
      }

      if (isPartial) {
        toast.success(
          `Venda registrada! Pago: R$ ${effectivePaid.toFixed(2)} | Pendente: R$ ${(totalAmount - effectivePaid).toFixed(2)}`
        );
      } else {
        toast.success("Venda registrada com sucesso!");
      }

      setSaleItems([]);
      setClientId("");
      setSellerId("");
      setPaymentMethod("cash");
      setPaymentType("full");
      setPaidAmount("");
      setInstallments("1");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
          {/* Informações da Venda */}
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
                  <Select value={sellerId} onValueChange={setSellerId}>
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

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações da Venda</Label>
                <Textarea
                  placeholder="Ex: Cliente solicitou entrega até sexta-feira."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Forma de Pagamento */}
              <div className="space-y-4">
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

                {/* Parcelas — apenas para Crédito */}
                {showInstallments && (
                  <div className="space-y-2">
                    <Label>Quantidade de Parcelas*</Label>
                    <Select value={installments} onValueChange={setInstallments}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x {n > 1 && total > 0 ? `— R$ ${(total / n).toFixed(2)}/parcela` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {finalTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency(finalTotal)} em {installments}x de {formatCurrency(finalTotal / parseInt(installments))}
                      </p>
                    )}
                  </div>
                )}

                {/* Tipo de pagamento — apenas para Dinheiro e PIX */}
                {showPaymentType && (
                  <div className="space-y-3">
                    <Label>Tipo de Pagamento</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentType"
                          value="full"
                          checked={paymentType === "full"}
                          onChange={() => setPaymentType("full")}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">Pagamento total</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentType"
                          value="partial"
                          checked={paymentType === "partial"}
                          onChange={() => {
                            setPaymentType("partial");
                            setPaidAmount("");
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm font-medium">Pagamento parcial</span>
                      </label>
                    </div>

                    {/* Campos de pagamento parcial */}
                    {showPartialFields && (
                      <div className="grid md:grid-cols-3 gap-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="valor-total">Valor da Venda</Label>
                          <div className="relative">
                            <Input
                              id="valor-total"
                              value={finalTotal > 0 ? formatCurrency(finalTotal) : "R$ 0,00"}
                              readOnly
                              className="bg-muted/50 font-bold"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="valor-pago">Valor Pago Agora*</Label>
                          <Input
                            id="valor-pago"
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={finalTotal}
                            value={paidAmount}
                            onChange={(e) => setPaidAmount(e.target.value)}
                            placeholder="0,00"
                            className="font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor Restante</Label>
                          <div
                            className={`flex items-center h-10 px-3 rounded-md border font-bold text-sm ${
                              remainingAmount > 0
                                ? "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                                : "border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
                            }`}
                          >
                            {formatCurrency(remainingAmount)}
                          </div>
                        </div>
                        {paidAmountNum > 0 && remainingAmount > 0 && (
                          <div className="md:col-span-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            Esta venda será marcada como <strong>Pagamento parcial</strong>. O restante poderá ser registrado em Pagamentos Pendentes.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Adicionar Produtos */}
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
                          {product.name} — {formatCurrency(Number(product.price))} (Est: {product.stock})
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
                          {item.quantity}x {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold">{formatCurrency(item.subtotal)}</p>
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

                  {/* Resumo do pagamento */}
                  <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-lg">Valor Original Calculado</p>
                      <p className="font-bold text-lg text-muted-foreground line-through decoration-muted-foreground/50">{formatCurrency(originalTotal)}</p>
                    </div>

                    {isEditingPrice ? (
                      <div className="flex items-center gap-2 justify-end bg-background p-2 rounded-md border border-border">
                        <Label>Valor final da venda:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="w-32 font-bold"
                          value={finalAmountInput}
                          onChange={(e) => setFinalAmountInput(e.target.value)}
                          placeholder={originalTotal.toFixed(2)}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => { setIsEditingPrice(false); setFinalAmountInput(""); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => { setIsEditingPrice(true); setFinalAmountInput(originalTotal.toFixed(2)); }}>
                          <Pencil className="w-3 h-3 mr-1" />
                          Alterar valor
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-primary/20 pt-4">
                      <p className="font-bold text-xl">Valor Final da Venda</p>
                      <div className="text-right">
                        <p className="font-bold text-3xl text-primary">{formatCurrency(finalTotal)}</p>
                        {discountAmount > 0 && (
                          <p className="text-xs font-semibold text-green-600">Desconto: {formatCurrency(discountAmount)}</p>
                        )}
                        {discountAmount < 0 && (
                          <p className="text-xs font-semibold text-amber-600">Acréscimo: {formatCurrency(-discountAmount)}</p>
                        )}
                      </div>
                    </div>
                    {showPartialFields && paidAmountNum > 0 && (
                      <>
                        <div className="flex items-center justify-between text-sm border-t pt-2">
                          <span className="text-muted-foreground">Pago agora</span>
                          <span className="font-semibold text-green-600">{formatCurrency(paidAmountNum)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Restante</span>
                          <span className="font-semibold text-amber-600">{formatCurrency(remainingAmount)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Pagamento parcial
                          </Badge>
                        </div>
                      </>
                    )}
                    {showInstallments && parseInt(installments) > 1 && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">Parcelamento</span>
                        <span className="font-semibold">
                          {installments}x de {formatCurrency(finalTotal / parseInt(installments))}
                        </span>
                      </div>
                    )}
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
            {loading ? "Registrando..." : "Finalizar Venda"}
          </Button>
        </form>
      </div>
    </Layout>
  );
}