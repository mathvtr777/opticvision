import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Package, Clock, Truck, CheckCircle2, ShoppingBag, MessageCircle, RefreshCw } from "lucide-react";

// ── Status config (independente do ERP, sem import para não depender de auth) ──
const STATUS_CONFIG: Record<string, { label: string; message: string; icon: any }> = {
  sale_created:  {
    label:   "Venda Realizada",
    message: "Seu pedido foi registrado e já está sendo preparado.",
    icon:    Package,
  },
  in_production: {
    label:   "Em Produção",
    message: "Seu óculos está sendo produzido com cuidado.",
    icon:    Clock,
  },
  received: {
    label:   "Recebido na Ótica",
    message: "Seu óculos chegou à nossa ótica.",
    icon:    Truck,
  },
  ready: {
    label:   "Pronto para Retirada",
    message: "Seu óculos está pronto! Você já pode vir fazer a retirada. 🎉",
    icon:    CheckCircle2,
  },
  delivered: {
    label:   "Entregue",
    message: "Pedido entregue com sucesso. Obrigado pela preferência! 😊",
    icon:    ShoppingBag,
  },
};

const STATUS_ORDER = ["sale_created", "in_production", "received", "ready", "delivered"];

const formatDate = (d: string | null) => {
  if (!d) return null;
  return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface PublicOrder {
  id: string;
  order_number: number;
  status: string;
  estimated_delivery: string | null;
  created_at: string;
  delivered_at: string | null;
  user_id: string;
  clients: { name: string } | null;
  order_status_history: { status: string; created_at: string }[];
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [businessName, setBusinessName] = useState("Ótica");
  const [businessPhone, setBusinessPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    loadOrder();
  }, [token]);

  const loadOrder = async () => {
    if (!token) { setNotFound(true); setLoading(false); return; }

    // Buscar pedido pelo token público (sem auth)
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, estimated_delivery, created_at, delivered_at, user_id,
        clients (name),
        order_status_history (status, created_at)
      `)
      .eq("public_tracking_token", token)
      .single();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setOrder(data as any);
    setLastUpdated(new Date());

    // Buscar dados da ótica pelo user_id do pedido (nome + telefone)
    const { data: profile } = await supabase
      .from("profiles")
      .select("establishment_name, phone")
      .eq("user_id", data.user_id)
      .single();

    if (profile) {
      setBusinessName(profile.establishment_name || "Ótica");
      setBusinessPhone(profile.phone || "");
    }

    setLoading(false);
  };

  const handleContactWhatsApp = () => {
    const phone = businessPhone.replace(/\D/g, "");
    if (!phone) return;
    const firstName = order?.clients?.name?.split(" ")[0] || "";
    const num = String(order?.order_number || "").padStart(5, "0");
    const msg = `Olá! Tenho uma dúvida sobre meu pedido #${num}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const isLate =
    order?.estimated_delivery &&
    order.estimated_delivery < new Date().toISOString().split("T")[0] &&
    order.status !== "delivered";

  const currentIdx = STATUS_ORDER.indexOf(order?.status || "");
  const firstName = order?.clients?.name?.split(" ")[0] || "Cliente";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <Package className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Carregando acompanhamento...</p>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Package className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <h1 className="text-xl font-bold">Pedido não encontrado</h1>
          <p className="text-muted-foreground text-sm">
            Verifique se o link está correto ou entre em contato com a ótica.
          </p>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────────
  const currentStatus = STATUS_CONFIG[order.status];
  const StatusIcon = currentStatus?.icon || Package;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-background dark:to-muted/10">
      <div className="max-w-sm mx-auto px-4 py-8 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-2 pt-4">
          {/* Initials logo */}
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-lg">
            <span className="text-white font-bold text-xl">
              {businessName.charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {businessName}
          </p>
          <h1 className="text-lg font-bold text-foreground">Acompanhamento do pedido</h1>
        </div>

        {/* ── Order badge ─────────────────────────────────────────────────── */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pedido</p>
          <p className="text-2xl font-bold text-primary">
            #{String(order.order_number).padStart(5, "0")}
          </p>
        </div>

        {/* ── Greeting ────────────────────────────────────────────────────── */}
        <div className="text-center">
          <p className="text-xl font-bold">Olá, {firstName}! 👋</p>
          <p className="text-muted-foreground text-sm mt-1">
            {isLate
              ? "Seu pedido está em andamento. A previsão de entrega foi atualizada pela ótica."
              : currentStatus?.message}
          </p>
        </div>

        {/* ── Current status highlight ─────────────────────────────────────── */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${
          order.status === "ready"
            ? "bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/50"
            : order.status === "delivered"
            ? "bg-primary/5 border border-primary/10"
            : isLate
            ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50"
            : "bg-muted/40 border border-border"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            order.status === "ready" || order.status === "delivered"
              ? "bg-green-100 dark:bg-green-900/30"
              : isLate
              ? "bg-amber-100 dark:bg-amber-900/30"
              : "bg-primary/10"
          }`}>
            <StatusIcon className={`w-5 h-5 ${
              order.status === "ready" || order.status === "delivered"
                ? "text-green-600 dark:text-green-400"
                : isLate
                ? "text-amber-600 dark:text-amber-400"
                : "text-primary"
            }`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status atual</p>
            <p className="font-bold text-foreground">
              {isLate && order.status !== "delivered"
                ? `${currentStatus?.label} · Em atraso`
                : currentStatus?.label}
            </p>
          </div>
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-card rounded-2xl border border-border/60 p-5 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Progresso do pedido
          </p>
          <div className="space-y-0">
            {STATUS_ORDER.map((st, idx) => {
              const done = currentIdx >= idx;
              const isCurrent = currentIdx === idx;
              const cfg = STATUS_CONFIG[st];
              const Icon = cfg.icon;

              return (
                <div key={st} className="flex gap-3">
                  {/* Connector column */}
                  <div className="flex flex-col items-center w-9 flex-shrink-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                      done
                        ? isCurrent
                          ? "bg-primary border-primary text-white ring-4 ring-primary/20"
                          : "bg-primary border-primary text-white"
                        : "border-border bg-background text-muted-foreground/40"
                    }`}>
                      {done && !isCurrent
                        ? <CheckCircle2 className="w-4 h-4" />
                        : <Icon className="w-4 h-4" />
                      }
                    </div>
                    {idx < STATUS_ORDER.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-1 mb-1 rounded-full transition-all ${
                        currentIdx > idx ? "bg-primary" : "bg-border/60"
                      }`} style={{ minHeight: 20 }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-4 flex-1 min-w-0 pt-1 ${idx === STATUS_ORDER.length - 1 ? "pb-0" : ""}`}>
                    <p className={`font-semibold text-sm ${
                      isCurrent ? "text-primary" : done ? "text-foreground" : "text-muted-foreground/60"
                    }`}>
                      {cfg.label}
                      {isCurrent && (
                        <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                          atual
                        </span>
                      )}
                    </p>
                    {!done && !isCurrent && (
                      <p className="text-xs text-muted-foreground/50 mt-0.5">Pendente</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Delivery forecast ────────────────────────────────────────────── */}
        {order.estimated_delivery && order.status !== "delivered" && (
          <div className={`rounded-2xl p-4 text-center ${
            isLate
              ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50"
              : "bg-muted/30 border border-border/60"
          }`}>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              {isLate ? "⚠ Previsão original de entrega" : "📅 Previsão de entrega"}
            </p>
            <p className={`font-bold text-base ${isLate ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
              {formatDate(order.estimated_delivery)}
            </p>
            {isLate && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Em andamento — aguarde comunicado da ótica.
              </p>
            )}
          </div>
        )}

        {/* ── Delivered message ────────────────────────────────────────────── */}
        {order.status === "delivered" && (
          <div className="rounded-2xl p-5 text-center bg-green-50 border border-green-200 dark:bg-green-950/20 dark:border-green-900/50 space-y-1">
            <p className="text-3xl">🎉</p>
            <p className="font-bold text-green-800 dark:text-green-400">Entregue!</p>
            <p className="text-sm text-green-700 dark:text-green-500">
              Obrigado pela preferência. Esperamos que aprecie seus óculos!
            </p>
          </div>
        )}

        {/* ── Contact button ────────────────────────────────────────────────── */}
        {businessPhone && (
          <button
            onClick={handleContactWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#22c55e] text-white font-semibold text-sm transition-all active:scale-95 shadow-md shadow-green-200 dark:shadow-green-900/30"
          >
            <MessageCircle className="w-4 h-4" />
            Falar com a ótica
          </button>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="text-center pb-6 space-y-2">
          <button
            onClick={loadOrder}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar · {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </button>
          <p className="text-xs text-muted-foreground/50">
            {businessName} · Powered by KiwiFlow
          </p>
        </div>

      </div>
    </div>
  );
}
