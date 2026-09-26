import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package, Search, List, LayoutGrid, ChevronRight,
  Clock, AlertCircle, CheckCircle2, Truck, ShoppingBag,
  Plus, ArrowRight, Eye,
} from "lucide-react";

// ── Status configuration ────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  sale_created:  { label: "Venda Realizada",      color: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300" },
  in_production: { label: "Em Produção",           color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  received:      { label: "Recebido na Ótica",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  ready:         { label: "Pronto para Retirada",  color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  delivered:     { label: "Entregue",              color: "bg-primary/10 text-primary" },
};

const KANBAN_COLUMNS = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({ key, ...cfg }));

// ── Interfaces ───────────────────────────────────────────────────────────────
interface SaleItem { product_name: string; quantity: number; subtotal: number; }
interface OrderListItem {
  id: string;
  order_number: number;
  status: string;
  estimated_delivery: string | null;
  seller_name: string;
  created_at: string;
  client_id: string | null;
  clients: { name: string; phone: string | null } | null;
  sales: { total_amount: number; paid_amount: number; payment_status: string; sale_items: SaleItem[] } | null;
  laboratories: { name: string } | null;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
};

// ── Component ────────────────────────────────────────────────────────────────
export default function Orders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // New Order dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [newClientId, setNewClientId] = useState("");
  const [newEstimated, setNewEstimated] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);

  useEffect(() => {
    checkAuth();
    loadOrders();
    loadClients();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, estimated_delivery, seller_name, created_at, client_id,
        clients (name, phone),
        sales (total_amount, paid_amount, payment_status,
          sale_items (product_name, quantity, subtotal)
        ),
        laboratories (name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos.");
    } else {
      setOrders((data as any) || []);
    }
    setLoading(false);
  };

  const loadClients = async () => {
    const { data } = await supabase.from("clients").select("id, name").order("name");
    setClients(data || []);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const isLate = (o: OrderListItem) =>
    !!o.estimated_delivery && o.estimated_delivery < today && o.status !== "delivered";

  const getProductsSummary = (o: OrderListItem) => {
    const items = o.sales?.sale_items;
    if (!items?.length) return "—";
    if (items.length === 1) return items[0].product_name;
    return `${items[0].product_name} +${items.length - 1}`;
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    all:           orders.length,
    in_production: orders.filter(o => o.status === "in_production").length,
    received:      orders.filter(o => o.status === "received").length,
    ready:         orders.filter(o => o.status === "ready").length,
    delivered:     orders.filter(o => o.status === "delivered").length,
    late:          orders.filter(o => isLate(o)).length,
  }), [orders, today]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter === "late") {
      result = result.filter(o => isLate(o));
    } else if (statusFilter !== "all") {
      result = result.filter(o => o.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.clients?.name?.toLowerCase().includes(q) ||
        o.clients?.phone?.includes(q) ||
        String(o.order_number).includes(q) ||
        o.seller_name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, search, today]);

  // ── Create manual order ────────────────────────────────────────────────────
  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const client = clients.find(c => c.id === newClientId);
      const { error } = await supabase.from("orders").insert([{
        user_id: user.id,
        client_id: newClientId || null,
        seller_name: "—",
        status: "sale_created",
        estimated_delivery: newEstimated || null,
        notes: newNotes || null,
      }]);
      if (error) throw error;

      // status history
      const { data: created } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (created) {
        await supabase.from("order_status_history").insert([{
          order_id: created.id,
          user_id: user.id,
          status: "sale_created",
          changed_by: "Sistema",
          notes: "Pedido criado manualmente",
        }]);
      }

      toast.success("Pedido criado com sucesso!");
      setShowNewDialog(false);
      setNewClientId(""); setNewEstimated(""); setNewNotes("");
      loadOrders();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar pedido.");
    } finally {
      setCreatingOrder(false);
    }
  };

  // ── Sub-components ─────────────────────────────────────────────────────────
  const StatusBadge = ({ status, late }: { status: string; late: boolean }) => {
    const cfg = STATUS_CONFIG[status];
    return (
      <div className="flex flex-col gap-1 items-end">
        <Badge variant="secondary" className={`text-xs whitespace-nowrap ${cfg?.color}`}>
          {cfg?.label || status}
        </Badge>
        {late && (
          <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            ⚠ Atrasado
          </Badge>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              Pedidos
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe os pedidos de óculos desde a venda até a entrega.
            </p>
          </div>
          <Button
            className="bg-gradient-kiwi hover:opacity-90 h-11"
            onClick={() => setShowNewDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo pedido
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: "Todos",        value: stats.all,           key: "all",          Icon: Package,       color: "text-foreground" },
            { label: "Em Produção",  value: stats.in_production, key: "in_production", Icon: Clock,        color: "text-amber-600" },
            { label: "Recebidos",    value: stats.received,      key: "received",      Icon: Truck,        color: "text-blue-600" },
            { label: "Prontos",      value: stats.ready,         key: "ready",         Icon: CheckCircle2, color: "text-green-600" },
            { label: "Entregues",    value: stats.delivered,     key: "delivered",     Icon: ShoppingBag,  color: "text-primary" },
            { label: "Atrasados",    value: stats.late,          key: "late",          Icon: AlertCircle,  color: "text-red-600" },
          ].map(({ label, value, key, Icon, color }) => (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pedido, cliente ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              title="Lista"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"}
              size="icon"
              title="Kanban"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "all",          label: "Todos" },
            { key: "sale_created", label: "Venda Realizada" },
            { key: "in_production",label: "Em Produção" },
            { key: "received",     label: "Recebidos" },
            { key: "ready",        label: "Prontos" },
            { key: "delivered",    label: "Entregues" },
            { key: "late",         label: "Atrasados" },
          ].map(f => (
            <Button
              key={f.key}
              size="sm"
              variant={statusFilter === f.key ? "default" : "outline"}
              className={statusFilter === f.key ? "bg-gradient-kiwi hover:opacity-90" : ""}
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
              {f.key === "late" && stats.late > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {stats.late}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* ── List View ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando pedidos...</div>
        ) : viewMode === "list" ? (
          <Card className="border-border/50 shadow-medium">
            <CardContent className="p-0">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-medium text-muted-foreground">
                    {search || statusFilter !== "all" ? "Nenhum pedido encontrado." : "Nenhum pedido ainda."}
                  </p>
                  {!search && statusFilter === "all" && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        Quando uma venda for concluída, o pedido aparecerá aqui automaticamente.
                      </p>
                      <Button variant="outline" className="mt-4" onClick={() => navigate("/sales")}>
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Ir para Vendas
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {filteredOrders.map(order => {
                    const late = isLate(order);
                    const total = order.sales?.total_amount || 0;
                    const paid = order.sales?.paid_amount || 0;
                    const remaining = total - paid;
                    return (
                      <div
                        key={order.id}
                        className="p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/pedidos/${order.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-primary text-sm">
                                #{String(order.order_number).padStart(5, "0")}
                              </span>
                              <span className="font-semibold">
                                {order.clients?.name || "Cliente não informado"}
                              </span>
                              {order.clients?.phone && (
                                <span className="text-xs text-muted-foreground">{order.clients.phone}</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{getProductsSummary(order)}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span>Vendedor: {order.seller_name || "—"}</span>
                              <span>Data: {formatDate(order.created_at.split("T")[0])}</span>
                              {order.estimated_delivery && (
                                <span className={late ? "text-red-600 font-semibold" : ""}>
                                  Previsão: {formatDate(order.estimated_delivery)}
                                  {late && " ⚠"}
                                </span>
                              )}
                              {order.laboratories?.name && (
                                <span>Lab: {order.laboratories.name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-shrink-0">
                            <div className="text-right space-y-0.5">
                              <p className="font-bold">{total > 0 ? formatCurrency(total) : "—"}</p>
                              {total > 0 && remaining > 0 && (
                                <p className="text-xs text-amber-600">Pendente: {formatCurrency(remaining)}</p>
                              )}
                              {total > 0 && remaining <= 0 && (
                                <p className="text-xs text-green-600">✓ Pago</p>
                              )}
                            </div>
                            <StatusBadge status={order.status} late={late} />
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        ) : (
          /* ── Kanban View ──────────────────────────────────────────────── */
          <div className="overflow-x-auto pb-4 -mx-2 px-2">
            <div className="flex gap-4 min-w-max">
              {KANBAN_COLUMNS.map(col => {
                const colOrders = filteredOrders.filter(o => o.status === col.key);
                return (
                  <div key={col.key} className="w-72 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <h3 className="font-semibold text-sm">{col.label}</h3>
                      <Badge variant="secondary" className="text-xs">{colOrders.length}</Badge>
                    </div>
                    <div className="space-y-3 min-h-24">
                      {colOrders.length === 0 ? (
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                          Nenhum pedido
                        </div>
                      ) : colOrders.map(order => {
                        const late = isLate(order);
                        const total = order.sales?.total_amount || 0;
                        const remaining = total - (order.sales?.paid_amount || 0);
                        return (
                          <Card
                            key={order.id}
                            className={`cursor-pointer hover:shadow-md transition-all ${late ? "border-red-200 dark:border-red-900/50" : ""}`}
                            onClick={() => navigate(`/pedidos/${order.id}`)}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-primary text-sm">
                                  #{String(order.order_number).padStart(5, "0")}
                                </span>
                                {late && (
                                  <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                    Atrasado
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{order.clients?.name || "—"}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {getProductsSummary(order)}
                                </p>
                              </div>
                              <div className="pt-2 border-t border-border/60 space-y-1">
                                {total > 0 && <p className="font-bold text-sm">{formatCurrency(total)}</p>}
                                {remaining > 0
                                  ? <p className="text-xs text-amber-600">🟠 {formatCurrency(remaining)} pendente</p>
                                  : total > 0 && <p className="text-xs text-green-600">✓ Pago</p>
                                }
                                {order.estimated_delivery && (
                                  <p className={`text-xs ${late ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                    Previsão: {formatDate(order.estimated_delivery)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">{order.seller_name || "—"}</p>
                                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── New Order Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Novo Pedido Manual
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pedidos são criados automaticamente ao finalizar uma venda. Use este formulário apenas para casos especiais.
          </p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente (opcional)" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-estimated">Previsão de Entrega</Label>
              <Input
                id="new-estimated"
                type="date"
                value={newEstimated}
                onChange={e => setNewEstimated(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-notes">Observações</Label>
              <Input
                id="new-notes"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Detalhes do pedido..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creatingOrder}
              className="bg-gradient-kiwi hover:opacity-90"
            >
              {creatingOrder ? "Criando..." : "Criar Pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
