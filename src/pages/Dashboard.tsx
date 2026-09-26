import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import StatCard from "@/components/StatCard";
import { DollarSign, TrendingUp, Package, Users, ShoppingCart, ArrowUpRight, Plus, UserPlus, Boxes, Activity, ChevronRight, Clock, CheckCircle2, AlertCircle, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    dailySales: 0,
    monthlySales: 0,
    totalClients: 0,
    lowStockProducts: 0,
  });
  const [orderStats, setOrderStats] = useState({
    awaiting_shipment: 0,
    in_production: 0,
    received: 0,
    ready: 0,
    late: 0,
  });
  const chartBars = [38, 54, 46, 68, 58, 88, 72];

  useEffect(() => {
    checkAuth();
    loadStats();
    loadOrderStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/");
    }
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];

    // Usar financial_transactions para refletir o dinheiro EFETIVAMENTE recebido
    // (não o total da venda, que pode ter pagamento parcial)
    const { data: dailyIncome } = await supabase
      .from("financial_transactions")
      .select("amount")
      .eq("type", "income")
      .eq("category", "Venda")
      .eq("date", today);

    const { data: monthlyIncome } = await supabase
      .from("financial_transactions")
      .select("amount")
      .eq("type", "income")
      .eq("category", "Venda")
      .gte("date", firstDayOfMonth);

    const { data: clients } = await supabase.from("clients").select("id");

    const { data: lowStockProducts } = await supabase
      .from("products")
      .select("id, stock, low_stock_alert")
      .filter("stock", "lte", "low_stock_alert");

    setStats({
      dailySales: dailyIncome?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
      monthlySales: monthlyIncome?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
      totalClients: clients?.length || 0,
      lowStockProducts: lowStockProducts?.length || 0,
    });
  };

  const loadOrderStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select("status, estimated_delivery");

      if (orders) {
        setOrderStats({
          awaiting_shipment: orders.filter(o => o.status === "sale_created").length,
          in_production: orders.filter(o => o.status === "in_production").length,
          received: orders.filter(o => o.status === "received").length,
          ready: orders.filter(o => o.status === "ready").length,
          late: orders.filter(o =>
            o.estimated_delivery && o.estimated_delivery < today && o.status !== "delivered"
          ).length,
        });
      }
    } catch {
      // tabela orders pode não existir ainda (migração pendente)
    }
  };

  return (
    <Layout>
      <div className="max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary font-semibold uppercase mb-2">
              <Activity className="w-3.5 h-3.5" />
              Central de comando
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Visão geral</h1>
            <p className="text-muted-foreground mt-1">Acompanhe o desempenho do seu negócio em tempo real.</p>
          </div>
          <Button onClick={() => navigate("/sales")} className="h-11 px-5">
            <Plus className="w-4 h-4" />
            Nova venda
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Vendas de Hoje"
            value={`R$ ${stats.dailySales.toFixed(2)}`}
            icon={DollarSign}
            trend="+12.5% vs ontem"
            trendUp={true}
          />
          <StatCard
            title="Vendas do Mês"
            value={`R$ ${stats.monthlySales.toFixed(2)}`}
            icon={TrendingUp}
            trend="+23.1% vs mês anterior"
            trendUp={true}
          />
          <StatCard
            title="Total de Clientes"
            value={stats.totalClients.toString()}
            icon={Users}
          />
          <StatCard
            title="Produtos c/ Estoque Baixo"
            value={stats.lowStockProducts.toString()}
            icon={Package}
          />
        </div>


        {/* Orders Overview */}
        <div className="pt-2">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Pedidos na Ótica
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Prontos para Retirada", value: orderStats.ready || 0, status: "ready", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/10 border-green-200 dark:border-green-800/50" },
              { label: "Pedidos Atrasados", value: orderStats.late || 0, status: "late", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-800/50" },
            ].map(s => (
              <div
                key={s.status}
                className={`cursor-pointer rounded-lg border p-4 flex items-center justify-between hover:shadow-md transition-all ${s.bg}`}
                onClick={() => navigate(`/pedidos?status=${s.status}`)}
              >
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Package className={`w-8 h-8 opacity-20 ${s.color}`} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card className="overflow-hidden shadow-medium">
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">Performance semanal</p>
                <CardTitle className="mt-2 text-2xl">Faturamento</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-primary bg-accent border border-primary/20 rounded-md px-2.5 py-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +18%
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-3xl font-bold tabular-nums">R$ {stats.monthlySales.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">este mês</span>
              </div>
              <div className="h-48 flex items-end gap-2 sm:gap-4 border-b border-border pb-3">
                {chartBars.map((height, index) => (
                  <div key={index} className="flex-1 h-full flex items-end group">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 group-hover:opacity-80 ${index === 5 ? " shadow-sm" : "bg-secondary"}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 pt-3 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <span key={day}>{day}</span>)}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  Ações rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Registrar nova venda", icon: Plus, path: "/sales" },
                  { label: "Cadastrar cliente", icon: UserPlus, path: "/clients" },
                  { label: "Cadastrar produto", icon: Boxes, path: "/products" },
                ].map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <Button key={action.label} onClick={() => navigate(action.path)} variant={index === 0 ? "default" : "outline"} className="w-full h-11 justify-start px-3">
                      <Icon className="w-4 h-4" />
                      {action.label}
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary shadow-sm animate-pulse" />
                  Status operacional
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sistema</span><span className="text-success font-semibold">Online</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sincronização</span><span className="font-semibold">Em tempo real</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Estoque crítico</span><span className="font-semibold">{stats.lowStockProducts} itens</span></div>
              </CardContent>
            </Card>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold">Atividade recente</h2>
              <p className="text-xs text-muted-foreground">Últimas movimentações registradas</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="text-primary">Ver relatórios <ChevronRight /></Button>
          </div>
          <Card className="border-dashed">
            <CardContent className="py-10 text-center">
              <div className="w-10 h-10 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center text-muted-foreground"><Activity className="w-5 h-5" /></div>
              <p className="text-sm font-medium">Nenhuma atividade recente</p>
              <p className="text-xs text-muted-foreground mt-1">As novas movimentações aparecerão aqui.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
}