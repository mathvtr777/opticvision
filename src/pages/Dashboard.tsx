import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import {
  DollarSign, TrendingUp, Package, Users, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Plus, UserPlus, Boxes,
  ChevronRight, Clock, CheckCircle2, AlertCircle, FlaskConical,
  Zap, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Skeleton ───────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#F0F0F0] dark:bg-[#1e1e1e] ${className}`} />;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({
  title, value, sub, trend, trendUp, icon: Icon, loading,
}: {
  title: string; value: string; sub?: string; trend?: string; trendUp?: boolean;
  icon: any; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    );
  }
  return (
    <div className="group bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide">{title}</p>
        <div className="w-8 h-8 rounded-lg bg-[#F8F8F8] dark:bg-[#1e1e1e] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#315B7D] dark:text-[#5F83A0]" />
        </div>
      </div>
      <p className="text-[28px] font-bold text-[#111111] dark:text-white leading-none tracking-tight">{value}</p>
      {(trend || sub) && (
        <div className="mt-2.5 flex items-center gap-1.5">
          {trend && (
            <>
              {trendUp
                ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
              }
              <span className={`text-xs font-semibold ${trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{trend}</span>
            </>
          )}
          {sub && <span className="text-xs text-[#aaaaaa] dark:text-[#555555]">{sub}</span>}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    dailySales: 0,
    monthlySales: 0,
    totalClients: 0,
    lowStockProducts: 0,
  });
  const [orderStats, setOrderStats] = useState({
    in_production: 0,
    ready: 0,
    late: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [labStats, setLabStats] = useState({ awaiting: 0, in_production: 0, received: 0 });

  const chartBars = [38, 54, 46, 68, 58, 88, 72];
  const chartMax = Math.max(...chartBars);

  useEffect(() => {
    checkAuth();
    Promise.all([loadStats(), loadOrderStats(), loadRecentSales()]).finally(() =>
      setLoading(false)
    );
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/");
  };

  const loadStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split("T")[0];

    const [{ data: dailyIncome }, { data: monthlyIncome }, { data: clients }, { data: lowStockProducts }] =
      await Promise.all([
        supabase.from("financial_transactions").select("amount").eq("type", "income").eq("category", "Venda").eq("date", today),
        supabase.from("financial_transactions").select("amount").eq("type", "income").eq("category", "Venda").gte("date", firstDayOfMonth),
        supabase.from("clients").select("id"),
        supabase.from("products").select("id, stock, low_stock_alert").filter("stock", "lte", "low_stock_alert"),
      ]);

    setStats({
      dailySales: dailyIncome?.reduce((s, t) => s + Number(t.amount), 0) || 0,
      monthlySales: monthlyIncome?.reduce((s, t) => s + Number(t.amount), 0) || 0,
      totalClients: clients?.length || 0,
      lowStockProducts: lowStockProducts?.length || 0,
    });
  };

  const loadOrderStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data: orders } = await supabase.from("orders").select("status, estimated_delivery");
      if (orders) {
        setOrderStats({
          in_production: orders.filter(o => o.status === "in_production").length,
          ready: orders.filter(o => o.status === "ready").length,
          late: orders.filter(o =>
            o.estimated_delivery && o.estimated_delivery < today && o.status !== "delivered"
          ).length,
        });
        setLabStats({
          awaiting: orders.filter(o => o.status === "sale_created").length,
          in_production: orders.filter(o => o.status === "in_production").length,
          received: orders.filter(o => o.status === "received").length,
        });
      }
    } catch { /* migração pendente */ }
  };

  const loadRecentSales = async () => {
    try {
      const { data } = await supabase
        .from("orders")
        .select(`order_number, status, created_at, lens_type, total_amount, clients(name)`)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentSales(data || []);
    } catch { /* */ }
  };

  const fmtCurrency = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusLabel: Record<string, string> = {
    sale_created: "Criado",
    in_production: "Produção",
    received: "Recebido",
    ready: "Pronto",
    delivered: "Entregue",
  };
  const statusColor: Record<string, string> = {
    sale_created: "bg-[#F0F0F0] text-[#555555] dark:bg-[#222222] dark:text-[#888888]",
    in_production: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    received: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    delivered: "bg-[#F0F0F0] text-[#555555] dark:bg-[#222222] dark:text-[#888888]",
  };

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#aaaaaa] dark:text-[#555555] mb-1">Bem-vindo de volta 👋</p>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-white tracking-tight">Visão geral</h1>
            <p className="text-sm text-[#999999] dark:text-[#555555] mt-0.5">Acompanhe o desempenho da sua ótica em tempo real.</p>
          </div>
          <Button
            onClick={() => navigate("/sales")}
            className="h-10 px-5 bg-[#111111] hover:bg-[#222222] dark:bg-white dark:text-[#111111] dark:hover:bg-[#eeeeee] text-white text-sm font-medium rounded-lg shadow-none transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova venda
          </Button>
        </div>

        {/* Metrics Row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard loading={loading} title="Vendas hoje" value={fmtCurrency(stats.dailySales)} trend="+12,5%" trendUp sub="vs ontem" icon={DollarSign} />
          <MetricCard loading={loading} title="Vendas do mês" value={fmtCurrency(stats.monthlySales)} trend="+23,1%" trendUp sub="vs mês anterior" icon={TrendingUp} />
          <MetricCard loading={loading} title="Clientes" value={stats.totalClients.toString()} sub="cadastrados" icon={Users} />
          <MetricCard loading={loading} title="Estoque crítico" value={stats.lowStockProducts.toString()} sub="produtos" icon={Package} />
        </div>

        {/* Middle Row — Chart + Orders */}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* Chart Card */}
          <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-1">Faturamento</p>
                {loading
                  ? <Skeleton className="h-8 w-36" />
                  : <p className="text-3xl font-bold text-[#111111] dark:text-white tracking-tight">{fmtCurrency(stats.monthlySales)}</p>
                }
                <p className="text-xs text-[#aaaaaa] dark:text-[#555555] mt-1">Este mês</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-lg">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +18%
              </div>
            </div>
            {/* Bar Chart */}
            <div className="h-40 flex items-end gap-2">
              {chartBars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 group-hover:opacity-70 ${i === 5 ? "bg-[#315B7D] dark:bg-[#5F83A0]" : "bg-[#E8E8E8] dark:bg-[#2a2a2a]"}`}
                    style={{ height: `${(h / chartMax) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 mt-2 text-center">
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => (
                <span key={d} className="text-[10px] font-medium text-[#aaaaaa] dark:text-[#444444] uppercase">{d}</span>
              ))}
            </div>
          </div>

          {/* Orders Card */}
          <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-0.5">Pedidos da ótica</p>
                <h3 className="text-base font-semibold text-[#111111] dark:text-white">Status atual</h3>
              </div>
              <Package className="w-5 h-5 text-[#315B7D] dark:text-[#5F83A0]" />
            </div>
            <div className="space-y-3 flex-1">
              {[
                { label: "Em produção", value: orderStats.in_production, icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", path: "/pedidos?status=in_production" },
                { label: "Prontos p/ retirada", value: orderStats.ready, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", path: "/pedidos?status=ready" },
                { label: "Atrasados", value: orderStats.late, icon: AlertCircle, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", path: "/pedidos" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    onClick={() => navigate(s.path)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#F8F8F8] dark:bg-[#1a1a1a] hover:bg-[#F0F0F0] dark:hover:bg-[#222222] transition-all text-left group"
                  >
                    <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <span className="flex-1 text-sm text-[#555555] dark:text-[#888888]">{s.label}</span>
                    <span className={`text-xl font-bold ${s.color}`}>{loading ? "—" : s.value}</span>
                  </button>
                );
              })}
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/pedidos")}
              className="mt-4 w-full h-9 text-sm text-[#315B7D] dark:text-[#5F83A0] hover:bg-[#EAF0F4] dark:hover:bg-[#1a2530]"
            >
              Ver todos os pedidos <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_300px]">
          {/* Recent Sales */}
          <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-0.5">Recentes</p>
                <h3 className="text-base font-semibold text-[#111111] dark:text-white">Últimas vendas</h3>
              </div>
              <ShoppingCart className="w-5 h-5 text-[#315B7D] dark:text-[#5F83A0]" />
            </div>
            <div className="space-y-1">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))
              ) : recentSales.length === 0 ? (
                <div className="py-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-[#E8E8E8] dark:text-[#333333] mx-auto mb-2" />
                  <p className="text-sm text-[#aaaaaa] dark:text-[#555555]">Nenhuma venda ainda.</p>
                  <button onClick={() => navigate("/sales")} className="mt-2 text-xs text-[#315B7D] dark:text-[#5F83A0] hover:underline">
                    Registrar primeira venda
                  </button>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <button
                    key={sale.order_number}
                    onClick={() => navigate(`/pedidos`)}
                    className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-[#F8F8F8] dark:hover:bg-[#1a1a1a] transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#EAF0F4] dark:bg-[#1a2530] flex items-center justify-center text-[#315B7D] dark:text-[#5F83A0] font-semibold text-xs">
                      {(sale.clients?.name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111111] dark:text-white truncate">{sale.clients?.name || "—"}</p>
                      <p className="text-xs text-[#aaaaaa] dark:text-[#555555]">Pedido #{String(sale.order_number).padStart(5, "0")} · {sale.lens_type || "—"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-[#111111] dark:text-white">
                        {sale.total_amount ? fmtCurrency(Number(sale.total_amount)) : "—"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor[sale.status] || statusColor.sale_created}`}>
                        {statusLabel[sale.status] || sale.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {recentSales.length > 0 && (
              <button onClick={() => navigate("/pedidos")} className="mt-4 w-full text-center text-xs text-[#315B7D] dark:text-[#5F83A0] hover:underline">
                Ver todas as vendas →
              </button>
            )}
          </div>

          {/* Laboratório */}
          <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-0.5">Lab</p>
                <h3 className="text-base font-semibold text-[#111111] dark:text-white">Laboratório</h3>
              </div>
              <FlaskConical className="w-5 h-5 text-[#315B7D] dark:text-[#5F83A0]" />
            </div>
            <div className="space-y-2 mb-5">
              {[
                { label: "Aguardando envio", value: labStats.awaiting },
                { label: "Em produção", value: labStats.in_production },
                { label: "Recebidos", value: labStats.received },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-[#F0F0F0] dark:border-[#222222] last:border-0">
                  <span className="text-sm text-[#555555] dark:text-[#888888]">{item.label}</span>
                  <span className="text-sm font-bold text-[#111111] dark:text-white">{loading ? "—" : item.value.toString().padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            {/* Mini flow */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#aaaaaa] dark:text-[#555555] mb-5 font-medium">
              {["Venda", "Produção", "Lab", "Recebido", "Retirada"].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-1.5">
                  <span className={`${i === 1 ? "text-[#315B7D] dark:text-[#5F83A0] font-semibold" : ""}`}>{step}</span>
                  {i < arr.length - 1 && <ChevronRight className="w-2.5 h-2.5" />}
                </span>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => navigate("/laboratorio")}
              className="w-full h-9 text-sm text-[#315B7D] dark:text-[#5F83A0] hover:bg-[#EAF0F4] dark:hover:bg-[#1a2530]"
            >
              Abrir laboratório <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Quick Actions + Status */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-4">Ações rápidas</p>
              <div className="space-y-2">
                {[
                  { label: "Nova venda", desc: "Registrar venda", icon: Plus, path: "/sales", primary: true },
                  { label: "Novo cliente", desc: "Cadastrar cliente", icon: UserPlus, path: "/clients" },
                  { label: "Novo produto", desc: "Adicionar ao estoque", icon: Boxes, path: "/products" },
                  { label: "Laboratório", desc: "Ver fila de produção", icon: FlaskConical, path: "/laboratorio" },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
                        action.primary
                          ? "bg-[#111111] dark:bg-white hover:bg-[#222222] dark:hover:bg-[#eeeeee] text-white dark:text-[#111111]"
                          : "bg-[#F8F8F8] dark:bg-[#1a1a1a] hover:bg-[#F0F0F0] dark:hover:bg-[#222222] text-[#555555] dark:text-[#888888]"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none">{action.label}</p>
                        <p className={`text-[11px] mt-0.5 ${action.primary ? "opacity-60" : "text-[#aaaaaa] dark:text-[#555555]"}`}>{action.desc}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-[#151515] rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <p className="text-xs font-medium text-[#999999] dark:text-[#555555] uppercase tracking-wide mb-3">Status operacional</p>
              <div className="space-y-2.5">
                {[
                  { label: "Sistema", status: "Online", color: "bg-emerald-500" },
                  { label: "Sincronização", status: "Tempo real", color: "bg-emerald-500" },
                  { label: "Banco de dados", status: "Conectado", color: "bg-emerald-500" },
                  { label: "Estoque crítico", status: `${stats.lowStockProducts} itens`, color: stats.lowStockProducts > 0 ? "bg-amber-500" : "bg-emerald-500" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-[#999999] dark:text-[#555555]">{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />
                      <span className="text-[#111111] dark:text-white font-medium text-xs">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}