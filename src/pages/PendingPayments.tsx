import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Clock, DollarSign, CreditCard, CheckCircle2, History, Search } from "lucide-react";

interface SalePayment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
}

interface PendingSale {
  id: string;
  total_amount: number;
  paid_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  seller_name: string;
  client_id: string | null;
  clients: { name: string } | null;
  sale_payments: SalePayment[];
}

const paymentMethodLabel: Record<string, string> = {
  cash: "Dinheiro",
  debit: "Débito",
  credit: "Crédito",
  pix: "PIX",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Fix timezone: DATE fields from Supabase come as "YYYY-MM-DD" strings.
// Adding T12:00:00 avoids off-by-one day due to UTC conversion.
const formatDate = (dateStr: string) => {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR");
};

export default function PendingPayments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<PendingSale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [registeringPayment, setRegisteringPayment] = useState(false);

  useEffect(() => {
    checkAuth();
    loadPendingSales();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadPendingSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select(`
        id, total_amount, paid_amount, payment_method, payment_status, created_at, seller_name, client_id,
        clients (name),
        sale_payments (id, amount, payment_method, payment_date, notes)
      `)
      .eq("payment_status", "partial")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pagamentos pendentes");
    } else {
      setPendingSales((data as any) || []);
    }
    setLoading(false);
  };

  const openRegisterDialog = (sale: PendingSale) => {
    setSelectedSale(sale);
    const remaining = sale.total_amount - sale.paid_amount;
    setPaymentAmount(remaining.toFixed(2));
    setPaymentMethod("cash");
    setDialogOpen(true);
  };

  const openHistoryDialog = (sale: PendingSale) => {
    setSelectedSale(sale);
    setHistoryDialogOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!selectedSale) return;

    const amount = parseFloat(paymentAmount);
    const remaining = selectedSale.total_amount - selectedSale.paid_amount;

    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (amount > remaining) {
      toast.error(`O valor não pode ser maior que o saldo pendente (${formatCurrency(remaining)}).`);
      return;
    }

    setRegisteringPayment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const newPaidAmount = selectedSale.paid_amount + amount;
      const newStatus = newPaidAmount >= selectedSale.total_amount ? "paid" : "partial";
      const today = new Date().toISOString().split("T")[0];

      // 1. Register in sale_payments
      const { error: paymentError } = await supabase.from("sale_payments").insert([{
        sale_id: selectedSale.id,
        user_id: user.id,
        amount,
        payment_method: paymentMethod,
        payment_date: today,
        notes: newStatus === "paid" ? "Pagamento final — venda quitada" : "Pagamento parcial adicional",
      }]);
      if (paymentError) throw paymentError;

      // 2. Update sale paid_amount and status
      const { error: saleError } = await supabase
        .from("sales")
        .update({
          paid_amount: newPaidAmount,
          payment_status: newStatus,
        })
        .eq("id", selectedSale.id);
      if (saleError) throw saleError;

      // 3. Register in financial_transactions
      await supabase.from("financial_transactions").insert([{
        user_id: user.id,
        type: "income",
        category: "Venda",
        amount,
        description: `Recebimento de venda - ${selectedSale.seller_name} - ${paymentMethodLabel[paymentMethod] || paymentMethod}${newStatus === "paid" ? " [Venda quitada]" : " [Pagamento parcial]"}`,
        date: today,
      }]);

      // 4. Update client total_spent
      if (selectedSale.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("total_spent")
          .eq("id", selectedSale.client_id)
          .single();
        if (client) {
          await supabase
            .from("clients")
            .update({ total_spent: Number(client.total_spent || 0) + amount })
            .eq("id", selectedSale.client_id);
        }
      }

      if (newStatus === "paid") {
        toast.success("✅ Venda quitada! Pagamento registrado com sucesso.");
      } else {
        toast.success(`Pagamento de ${formatCurrency(amount)} registrado. Saldo restante: ${formatCurrency(selectedSale.total_amount - newPaidAmount)}`);
      }

      setDialogOpen(false);
      loadPendingSales();
    } catch (error: any) {
      toast.error(error.message || "Erro ao registrar pagamento");
    } finally {
      setRegisteringPayment(false);
    }
  };

  const filteredSales = pendingSales.filter((sale) => {
    const clientName = sale.clients?.name?.toLowerCase() || "";
    const sellerId = sale.id.toLowerCase();
    const q = search.toLowerCase();
    return clientName.includes(q) || sellerId.includes(q) || sale.seller_name.toLowerCase().includes(q);
  });

  const totalPending = pendingSales.reduce(
    (sum, s) => sum + (s.total_amount - s.paid_amount),
    0
  );

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-500" />
            Pagamentos Pendentes
          </h1>
          <p className="text-muted-foreground mt-1">
            Vendas com saldo a receber
          </p>
        </div>

        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/10">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(totalPending)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-amber-500 opacity-30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendas Pendentes</p>
                <p className="text-2xl font-bold">{pendingSales.length}</p>
              </div>
              <Clock className="w-10 h-10 text-muted-foreground opacity-30" />
            </CardContent>
          </Card>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, vendedor ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista */}
        <Card className="border-border/50 shadow-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              Vendas com Pagamento Parcial
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Carregando...</div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-60" />
                <p className="font-medium text-muted-foreground">
                  {search ? "Nenhuma venda encontrada." : "Nenhum pagamento pendente! 🎉"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSales.map((sale) => {
                  const remaining = sale.total_amount - sale.paid_amount;
                  const progressPct = (sale.paid_amount / sale.total_amount) * 100;
                  const baseMethod = sale.payment_method.split("_")[0];

                  return (
                    <div
                      key={sale.id}
                      className="p-4 border border-border/60 rounded-lg hover:border-primary/30 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              {sale.clients?.name || "Cliente não informado"}
                            </span>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                              Parcial
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Vendedor: {sale.seller_name} &middot;{" "}
                            {new Date(sale.created_at).toLocaleDateString("pt-BR")} &middot;{" "}
                            {paymentMethodLabel[baseMethod] || sale.payment_method}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ID: {sale.id.slice(0, 8)}...
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openHistoryDialog(sale)}
                          >
                            <History className="w-4 h-4 mr-1" />
                            Histórico
                          </Button>
                          <Button
                            size="sm"
                            className=""
                            onClick={() => openRegisterDialog(sale)}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Registrar Pagamento
                          </Button>
                        </div>
                      </div>

                      {/* Valores */}
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="p-2 bg-muted/40 rounded-md">
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-bold">{formatCurrency(sale.total_amount)}</p>
                        </div>
                        <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                          <p className="text-xs text-muted-foreground">Pago</p>
                          <p className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(sale.paid_amount)}
                          </p>
                        </div>
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md">
                          <p className="text-xs text-muted-foreground">Restante</p>
                          <p className="font-bold text-amber-600 dark:text-amber-400">
                            {formatCurrency(remaining)}
                          </p>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progresso do pagamento</span>
                          <span>{progressPct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-green-400 rounded-full transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/40 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold">
                    {selectedSale.clients?.name || "Não informado"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total da venda</span>
                  <span className="font-bold">{formatCurrency(selectedSale.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Já pago</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(selectedSale.paid_amount)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-medium">Saldo restante</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(selectedSale.total_amount - selectedSale.paid_amount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount">Valor Recebido*</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedSale.total_amount - selectedSale.paid_amount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo: {formatCurrency(selectedSale.total_amount - selectedSale.paid_amount)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterPayment}
              disabled={registeringPayment}
              className=""
            >
              {registeringPayment ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Histórico de Pagamentos */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Pagamentos
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-semibold">{selectedSale.clients?.name || "Não informado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total da venda</span>
                  <span className="font-bold">{formatCurrency(selectedSale.total_amount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Recebimentos
                </p>
                {selectedSale.sale_payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhum recebimento registrado.</p>
                ) : (
                  selectedSale.sale_payments
                    .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime())
                    .map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">
                            {formatDate(payment.payment_date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {paymentMethodLabel[payment.payment_method] || payment.payment_method}
                            {payment.notes ? ` — ${payment.notes}` : ""}
                          </p>
                        </div>
                        <p className="font-bold text-green-600 dark:text-green-400">
                          +{formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))
                )}
              </div>

              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total recebido</span>
                  <span className="font-bold text-green-600">{formatCurrency(selectedSale.paid_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Restante</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(selectedSale.total_amount - selectedSale.paid_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {selectedSale.total_amount - selectedSale.paid_amount <= 0 ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Pago
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      Pagamento parcial
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
