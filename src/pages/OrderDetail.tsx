import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Package, CheckCircle2, Clock, Truck, ShoppingBag,
  MessageCircle, FileText, User, Calendar, DollarSign,
  ChevronRight, FlaskConical, Pencil, X, AlertTriangle, History,
  ArrowRight, Share2, Copy, Link2, ExternalLink,
} from "lucide-react";
import { STATUS_CONFIG } from "./Orders";

// ── Status flow ───────────────────────────────────────────────────────────────
const STATUS_ORDER = ["sale_created", "in_production", "received", "ready", "delivered"];
const NEXT_STATUS: Record<string, string> = {
  sale_created:  "in_production",
  in_production: "received",
  received:      "ready",
  ready:         "delivered",
};
const PREV_STATUS: Record<string, string> = {
  in_production: "sale_created",
  received:      "in_production",
  ready:         "received",
  delivered:     "ready",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro", debit: "Débito", credit: "Crédito", pix: "PIX",
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface StatusHistory {
  id: string;
  status: string;
  notes: string | null;
  changed_by: string;
  created_at: string;
}
interface SalePayment {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
}
interface Order {
  id: string;
  order_number: number;
  status: string;
  estimated_delivery: string | null;
  seller_name: string;
  notes: string | null;
  created_at: string;
  delivered_at: string | null;
  client_id: string | null;
  sale_id: string | null;
  laboratory_id: string | null;
  lab_order_number: string | null;
  lab_sent_date: string | null;
  lab_estimated_delivery: string | null;
  lab_received_date: string | null;
  lab_notes: string | null;
  clients: { name: string; phone: string | null; email: string | null } | null;
  sales: {
    total_amount: number;
    paid_amount: number;
    payment_status: string;
    payment_method: string;
    sale_items: { id: string; product_name: string; quantity: number; unit_price: number; subtotal: number }[];
  } | null;
  laboratories: { id: string; name: string; phone: string | null } | null;
  order_status_history: StatusHistory[];
  public_tracking_token: string | null;
  dnp_od: number | null;
  dnp_oe: number | null;
  pupillary_height_od: number | null;
  pupillary_height_oe: number | null;
  lens_type: string | null;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [receita, setReceita] = useState<any | null>(null);
  const [labs, setLabs] = useState<any[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [currentUser, setCurrentUser] = useState("");

  // Status change
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(""); // "next" | "prev" | specific
  const [statusNote, setStatusNote] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);

  // Lab edit
  const [labEditMode, setLabEditMode] = useState(false);
  const [labForm, setLabForm] = useState({
    laboratory_id: "",
    lab_order_number: "",
    lab_sent_date: "",
    lab_estimated_delivery: "",
    lab_received_date: "",
    lab_notes: "",
    estimated_delivery: "",
  });
  const [savingLab, setSavingLab] = useState(false);

  // Payment
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [registeringPay, setRegisteringPay] = useState(false);

  // Delivery
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [registeringDelivery, setRegisteringDelivery] = useState(false);

  // Share / Tracking
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAuth();
    loadOrder();
    loadLabs();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.email || "Usuário");
  };

  const loadOrder = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        clients (name, phone, email),
        sales (total_amount, paid_amount, payment_status, payment_method,
          sale_items (id, product_name, quantity, unit_price, subtotal)
        ),
        laboratories (id, name, phone),
        order_status_history (id, status, notes, changed_by, created_at)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Pedido não encontrado.");
      navigate("/pedidos");
      return;
    }
    setOrder(data as any);
    setTrackingToken((data as any).public_tracking_token || null);
    setLabForm({
      laboratory_id: data.laboratory_id || "",
      lab_order_number: data.lab_order_number || "",
      lab_sent_date: data.lab_sent_date || "",
      lab_estimated_delivery: data.lab_estimated_delivery || "",
      lab_received_date: data.lab_received_date || "",
      lab_notes: data.lab_notes || "",
      estimated_delivery: data.estimated_delivery || "",
    });

    // Load optical prescription (receita) by client
    if (data.client_id) {
      const { data: receitaData } = await supabase
        .from("receitas")
        .select("*")
        .eq("cliente_id", data.client_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setReceita(receitaData || null);
    }

    // Load sale payments
    if (data.sale_id) {
      const { data: payments } = await supabase
        .from("sale_payments")
        .select("*")
        .eq("sale_id", data.sale_id)
        .order("payment_date", { ascending: true });
      setSalePayments((payments as any) || []);
    }

    setLoading(false);
  };

  // ── Generate / get tracking token ─────────────────────────────────────────
  const generateAndGetToken = async () => {
    if (!order) return;
    // Se já existe, abre o modal direto
    if (trackingToken) { setShareDialogOpen(true); return; }
    setGeneratingToken(true);
    try {
      // Token: 12 chars base36 aleatório — difícil de adivinhar, não sequencial
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(9)))
        .map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
      const { error } = await supabase
        .from("orders")
        .update({ public_tracking_token: raw })
        .eq("id", order.id);
      if (error) throw error;
      setTrackingToken(raw);
      setShareDialogOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar link");
    } finally {
      setGeneratingToken(false);
    }
  };

  const getTrackingUrl = () => `${window.location.origin}/pedido/${trackingToken}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getTrackingUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: seleciona o campo para cópia manual
      const el = document.getElementById("tracking-url-input") as HTMLInputElement;
      el?.select();
      toast.info("Selecione e copie o link manualmente.");
    }
  };

  const handleShareWhatsApp = () => {
    if (!order) return;
    const phone = order.clients?.phone?.replace(/\D/g, "");
    if (!phone) { toast.error("Cliente sem telefone cadastrado."); return; }
    const firstName = order.clients?.name?.split(" ")[0] || "";
    const url = getTrackingUrl();
    const msg = `Olá, ${firstName}! 👋\n\nVocê pode acompanhar o andamento do seu pedido de óculos pelo link abaixo:\n\n${url}\n\nEstamos à disposição!`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const loadLabs = async () => {
    const { data } = await supabase.from("laboratories").select("id, name").eq("active", true).order("name");
    setLabs(data || []);
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const isLate = order
    ? !!order.estimated_delivery && order.estimated_delivery < today && order.status !== "delivered"
    : false;
  const isReady = order?.status === "ready";
  const isDelivered = order?.status === "delivered";
  const nextStatus = order ? NEXT_STATUS[order.status] : undefined;
  const prevStatus = order ? PREV_STATUS[order.status] : undefined;
  const total = order?.sales?.total_amount || 0;
  const paid = order?.sales?.paid_amount || 0;
  const remaining = total - paid;

  const daysLate = isLate && order?.estimated_delivery
    ? Math.floor((new Date().getTime() - new Date(`${order.estimated_delivery}T12:00:00`).getTime()) / 86400000)
    : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openStatusDialog = (target: string) => {
    setStatusTarget(target);
    setStatusNote("");
    setStatusDialogOpen(true);
  };

  const handleChangeStatus = async () => {
    if (!order || !statusTarget) return;
    setChangingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const updateData: any = { status: statusTarget };
      if (statusTarget === "delivered") updateData.delivered_at = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from("orders").update(updateData).eq("id", order.id);
      if (updateErr) throw updateErr;

      await supabase.from("order_status_history").insert([{
        order_id: order.id,
        user_id: user.id,
        status: statusTarget,
        changed_by: currentUser,
        notes: statusNote || null,
      }]);

      toast.success("Status atualizado!");
      setStatusDialogOpen(false);
      loadOrder();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar status");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleSaveLab = async () => {
    if (!order) return;
    setSavingLab(true);
    try {
      const { error } = await supabase.from("orders").update({
        laboratory_id: labForm.laboratory_id || null,
        lab_order_number: labForm.lab_order_number || null,
        lab_sent_date: labForm.lab_sent_date || null,
        lab_estimated_delivery: labForm.lab_estimated_delivery || null,
        lab_received_date: labForm.lab_received_date || null,
        lab_notes: labForm.lab_notes || null,
        estimated_delivery: labForm.estimated_delivery || null,
      }).eq("id", order.id);
      if (error) throw error;
      toast.success("Informações salvas!");
      setLabEditMode(false);
      loadOrder();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSavingLab(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!order) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error("Informe um valor válido."); return; }
    if (amount > remaining) { toast.error(`Valor não pode superar o saldo pendente (${formatCurrency(remaining)}).`); return; }

    setRegisteringPay(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const newPaid = paid + amount;
      const newStatus = newPaid >= total ? "paid" : "partial";
      const today2 = new Date().toISOString().split("T")[0];

      await supabase.from("sale_payments").insert([{
        sale_id: order.sale_id,
        user_id: user.id,
        amount,
        payment_method: payMethod,
        payment_date: today2,
        notes: newStatus === "paid" ? "Pagamento final — venda quitada" : "Pagamento parcial — via Pedidos",
      }]);

      await supabase.from("sales").update({ paid_amount: newPaid, payment_status: newStatus }).eq("id", order.sale_id);

      await supabase.from("financial_transactions").insert([{
        user_id: user.id,
        type: "income",
        category: "Venda",
        amount,
        description: `Pedido #${String(order.order_number).padStart(5, "0")} — ${PAYMENT_METHOD_LABEL[payMethod] || payMethod}`,
        date: today2,
      }]);

      if (order.client_id) {
        const { data: client } = await supabase.from("clients").select("total_spent").eq("id", order.client_id).single();
        if (client) {
          await supabase.from("clients").update({ total_spent: Number(client.total_spent || 0) + amount }).eq("id", order.client_id);
        }
      }

      toast.success(newStatus === "paid" ? "✅ Pagamento quitado!" : `Pagamento de ${formatCurrency(amount)} registrado.`);
      setPayDialogOpen(false);
      setPayAmount("");
      loadOrder();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar pagamento");
    } finally {
      setRegisteringPay(false);
    }
  };

  const handleRegisterDelivery = async () => {
    if (!order) return;
    setRegisteringDelivery(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      await supabase.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", order.id);
      await supabase.from("order_status_history").insert([{
        order_id: order.id, user_id: user.id, status: "delivered",
        changed_by: currentUser, notes: "Entrega registrada",
      }]);

      toast.success("✅ Entrega registrada com sucesso!");
      setDeliveryDialogOpen(false);
      loadOrder();
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar entrega");
    } finally {
      setRegisteringDelivery(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = order?.clients?.phone?.replace(/\D/g, "");
    if (!phone) { toast.error("Cliente sem telefone cadastrado."); return; }
    const num = String(order!.order_number).padStart(5, "0");
    const name = order!.clients?.name || "Cliente";
    const msgs: Record<string, string> = {
      ready:         `Olá, ${name}! Seu óculos está pronto para retirada. Pedido #${num} já disponível em nossa ótica. 😊`,
      in_production: `Olá, ${name}! Seu pedido #${num} está em produção. Avisaremos assim que estiver pronto para retirada.`,
      received:      `Olá, ${name}! Seu pedido #${num} chegou à nossa ótica e em breve estará pronto para retirada.`,
    };
    const msg = msgs[order!.status] || `Olá, ${name}! Seu pedido #${num} — status: ${STATUS_CONFIG[order!.status]?.label}.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleGeneratePDF = () => {
    if (!order) return;
    const num = String(order.order_number).padStart(5, "0");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { toast.error("Permita pop-ups para gerar o PDF."); return; }
    const items = order.sales?.sale_items || [];
    win.document.write(`
      <html><head><title>Pedido #${num}</title><meta charset="utf-8"/>
      <style>
        *{font-family:Arial,sans-serif;box-sizing:border-box;}
        body{padding:32px;color:#111;}
        h1{font-size:22px;margin:0 0 4px;}
        .sub{color:#666;font-size:12px;margin-bottom:20px;}
        .section{margin-bottom:20px;}
        .section h2{font-size:14px;font-weight:bold;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:10px;}
        .row{display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;}
        .label{color:#555;}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
        th{background:#f5f5f5;}
        .status{display:inline-block;padding:3px 10px;border-radius:4px;font-weight:bold;font-size:12px;background:#f0f0f0;}
        .footer{margin-top:32px;font-size:11px;color:#999;text-align:center;}
      </style></head>
      <body>
        <h1>Pedido #${num}</h1>
        <div class="sub">Gerado em ${new Date().toLocaleString("pt-BR")}</div>
        <div class="section">
          <h2>Cliente</h2>
          <div class="row"><span class="label">Nome</span><span>${order.clients?.name || "—"}</span></div>
          <div class="row"><span class="label">Telefone</span><span>${order.clients?.phone || "—"}</span></div>
        </div>
        <div class="section">
          <h2>Pedido</h2>
          <div class="row"><span class="label">Data da venda</span><span>${formatDate(order.created_at.split("T")[0])}</span></div>
          <div class="row"><span class="label">Vendedor</span><span>${order.seller_name || "—"}</span></div>
          <div class="row"><span class="label">Previsão de entrega</span><span>${formatDate(order.estimated_delivery)}</span></div>
          <div class="row"><span class="label">Status</span><span class="status">${STATUS_CONFIG[order.status]?.label || order.status}</span></div>
        </div>

        ${order.lens_type || order.dnp_od || order.dnp_oe || order.pupillary_height_od || order.pupillary_height_oe ? `
        <div class="section">
          <h2>Dados da Lente</h2>
          ${order.lens_type ? `<div style="margin-bottom:8px;"><span class="label" style="display:block;margin-bottom:2px;">Tipo de lente:</span><strong>${order.lens_type}</strong></div>` : ""}
          
          <table style="margin-top:0;">
            <thead><tr><th>Medida</th><th>Olho Direito (OD)</th><th>Olho Esquerdo (OE)</th></tr></thead>
            <tbody>
              ${order.dnp_od || order.dnp_oe ? `<tr><td>DNP</td><td>${order.dnp_od ? order.dnp_od + " mm" : "—"}</td><td>${order.dnp_oe ? order.dnp_oe + " mm" : "—"}</td></tr>` : ""}
              ${order.pupillary_height_od || order.pupillary_height_oe ? `<tr><td>Altura Pupilar</td><td>${order.pupillary_height_od ? order.pupillary_height_od + " mm" : "—"}</td><td>${order.pupillary_height_oe ? order.pupillary_height_oe + " mm" : "—"}</td></tr>` : ""}
            </tbody>
          </table>
        </div>
        ` : ""}
        <div class="section">
          <h2>Produtos</h2>
          <table><thead><tr><th>Produto</th><th>Qtd</th><th>Valor unit.</th><th>Subtotal</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>R$ ${Number(i.unit_price).toFixed(2)}</td><td>R$ ${Number(i.subtotal).toFixed(2)}</td></tr>`).join("")}
          </tbody></table>
        </div>
        <div class="section">
          <h2>Laboratório</h2>
          <div class="row"><span class="label">Laboratório</span><span>${order.laboratories?.name || "—"}</span></div>
          <div class="row"><span class="label">N° da ordem</span><span>${order.lab_order_number || "—"}</span></div>
          <div class="row"><span class="label">Previsão lab.</span><span>${formatDate(order.lab_estimated_delivery)}</span></div>
        </div>

        ${order.notes || order.lab_notes ? `
        <div class="section">
          <h2>Observações</h2>
          ${order.notes ? `<p style="font-size:12px;margin:4px 0;"><strong>Venda/Pedido:</strong> ${order.notes}</p>` : ""}
          ${order.lab_notes ? `<p style="font-size:12px;margin:4px 0;"><strong>Laboratório:</strong> ${order.lab_notes}</p>` : ""}
        </div>
        ` : ""}
        <div class="section">
          <h2>Financeiro</h2>
          <div class="row"><span class="label">Total</span><span>${formatCurrency(total)}</span></div>
          <div class="row"><span class="label">Pago</span><span>${formatCurrency(paid)}</span></div>
          <div class="row"><span class="label">Pendente</span><span>${formatCurrency(remaining)}</span></div>
        </div>
        <div class="footer">Simply ERP — Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
        <script>window.onload=()=>window.print();<\/script>
      </body></html>
    `);
    win.document.close();
  };

  // ── Timeline ──────────────────────────────────────────────────────────────
  const TimelineSection = () => {
    const history = [...(order?.order_status_history || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return (
      <div className="space-y-4">
        {STATUS_ORDER.map((st, idx) => {
          const done = STATUS_ORDER.indexOf(order!.status) >= idx;
          const event = history.find(h => h.status === st);
          const Icon = [Package, Clock, Truck, CheckCircle2, ShoppingBag][idx];
          return (
            <div key={st} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? "bg-primary border-primary text-white" : "border-border bg-background text-muted-foreground"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {idx < STATUS_ORDER.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 ${done && STATUS_ORDER.indexOf(order!.status) > idx ? "bg-primary" : "bg-border"}`} style={{ minHeight: 24 }} />
                )}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <p className={`font-semibold text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>
                  {STATUS_CONFIG[st]?.label}
                </p>
                {event ? (
                  <div className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                    <p>{formatDateTime(event.created_at)}</p>
                    <p>Por: {event.changed_by}</p>
                    {event.notes && <p className="italic">"{event.notes}"</p>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Pendente</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="text-center py-24 text-muted-foreground">Carregando pedido...</div>
      </Layout>
    );
  }
  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status];
  const statusIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl">

        {/* Back + Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground" onClick={() => navigate("/pedidos")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Pedidos
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              Pedido #{String(order.order_number).padStart(5, "0")}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className={`text-xs ${cfg?.color}`}>{cfg?.label}</Badge>
              {isLate && (
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  ⚠ Atrasado há {daysLate} dia{daysLate !== 1 ? "s" : ""}
                </Badge>
              )}
              {isDelivered && (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  ✓ Entregue
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={generateAndGetToken} disabled={generatingToken}>
              <Share2 className="w-4 h-4 mr-1.5" />
              {generatingToken ? "Gerando..." : "Compartilhar"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handleGeneratePDF}>
              <FileText className="w-4 h-4 mr-1.5" /> Gerar PDF
            </Button>
            {!isDelivered && nextStatus && (
              <Button size="sm" className="" onClick={() => openStatusDialog(nextStatus)}>
                <ArrowRight className="w-4 h-4 mr-1.5" /> Avançar Status
              </Button>
            )}
          </div>
        </div>

        {/* Ready Banner */}
        {isReady && (
          <Card className="border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/20">
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-400">🟢 Pronto para retirada!</span>
              </div>
              <div className="flex gap-2">
                {remaining > 0 && (
                  <Button size="sm" variant="outline" className="border-green-300" onClick={() => { setPayAmount(remaining.toFixed(2)); setPayDialogOpen(true); }}>
                    <DollarSign className="w-4 h-4 mr-1" /> Registrar Pagamento
                  </Button>
                )}
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setDeliveryDialogOpen(true)}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Registrar Entrega
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Late Banner */}
        {isLate && !isDelivered && (
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-800 dark:text-red-400 text-sm font-medium">
                Pedido atrasado — previsão era {formatDate(order.estimated_delivery)} ({daysLate} dia{daysLate !== 1 ? "s" : ""} atrás)
              </span>
            </CardContent>
          </Card>
        )}

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left Column (2/3) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Order Info */}
            <Card className="border-border/50 shadow-medium">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="w-4 h-4 text-primary" />Informações do Pedido</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs mb-0.5">Cliente</p><p className="font-semibold">{order.clients?.name || "Não informado"}</p></div>
                <div><p className="text-muted-foreground text-xs mb-0.5">Telefone</p><p className="font-semibold">{order.clients?.phone || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs mb-0.5">E-mail</p><p className="font-semibold">{order.clients?.email || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs mb-0.5">Vendedor</p><p className="font-semibold">{order.seller_name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs mb-0.5">Data da venda</p><p className="font-semibold">{formatDate(order.created_at.split("T")[0])}</p></div>
                <div><p className="text-muted-foreground text-xs mb-0.5">Previsão de entrega</p><p className={`font-semibold ${isLate ? "text-red-600" : ""}`}>{formatDate(order.estimated_delivery)}</p></div>
                {order.delivered_at && (
                  <div><p className="text-muted-foreground text-xs mb-0.5">Data de entrega</p><p className="font-semibold text-green-600">{formatDateTime(order.delivered_at)}</p></div>
                )}
                {order.notes && (
                  <div className="sm:col-span-2"><p className="text-muted-foreground text-xs mb-0.5">Observações</p><p>{order.notes}</p></div>
                )}
              </CardContent>
            </Card>

            {/* Products */}
            {order.sales?.sale_items && order.sales.sale_items.length > 0 && (
              <Card className="border-border/50 shadow-medium">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="w-4 h-4 text-primary" />Produtos da Venda</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/60">
                    {order.sales.sale_items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-medium text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity}x {formatCurrency(item.unit_price)}</p>
                        </div>
                        <p className="font-bold text-sm">{formatCurrency(item.subtotal)}</p>
                      </div>
                    ))}
                    <div className="flex justify-between p-4 bg-muted/30">
                      <span className="font-bold">Total</span>
                      <span className="font-bold text-primary">{formatCurrency(total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Laboratory */}
            <Card className="border-border/50 shadow-medium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4 text-primary" />Laboratório</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setLabEditMode(!labEditMode)}>
                    {labEditMode ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {labEditMode ? (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Laboratório</Label>
                        <Select value={labForm.laboratory_id} onValueChange={v => setLabForm(f => ({ ...f, laboratory_id: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {labs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">N° da ordem no laboratório</Label>
                        <Input value={labForm.lab_order_number} onChange={e => setLabForm(f => ({ ...f, lab_order_number: e.target.value }))} placeholder="Ex: LAB-1234" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data de envio</Label>
                        <Input type="date" value={labForm.lab_sent_date} onChange={e => setLabForm(f => ({ ...f, lab_sent_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Previsão do laboratório</Label>
                        <Input type="date" value={labForm.lab_estimated_delivery} onChange={e => setLabForm(f => ({ ...f, lab_estimated_delivery: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Data de recebimento</Label>
                        <Input type="date" value={labForm.lab_received_date} onChange={e => setLabForm(f => ({ ...f, lab_received_date: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Previsão de entrega ao cliente</Label>
                        <Input type="date" value={labForm.estimated_delivery} onChange={e => setLabForm(f => ({ ...f, estimated_delivery: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observações do laboratório</Label>
                      <Textarea value={labForm.lab_notes} onChange={e => setLabForm(f => ({ ...f, lab_notes: e.target.value }))} rows={2} placeholder="Informações relevantes..." />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveLab} disabled={savingLab} className="">
                        {savingLab ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setLabEditMode(false)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    {[
                      ["Laboratório", order.laboratories?.name || "Não informado"],
                      ["N° da ordem", order.lab_order_number || "—"],
                      ["Data de envio", formatDate(order.lab_sent_date)],
                      ["Previsão lab.", formatDate(order.lab_estimated_delivery)],
                      ["Recebido em", formatDate(order.lab_received_date)],
                      ["Previsão ao cliente", formatDate(order.estimated_delivery)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium">{value}</p>
                      </div>
                    ))}
                    {order.lab_notes && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground">Observações</p>
                        <p>{order.lab_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Optical Data (Dados Ópticos) */}
            {(order.lens_type || order.dnp_od || order.dnp_oe || order.pupillary_height_od || order.pupillary_height_oe) && (
              <Card className="border-border/50 shadow-medium">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-primary" />Dados Ópticos</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.lens_type && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Tipo de Lente</p>
                        <p className="font-semibold text-sm">{order.lens_type}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      {(order.dnp_od || order.dnp_oe) && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">DNP</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm"><span>OD:</span><span className="font-medium">{order.dnp_od ? `${order.dnp_od} mm` : "—"}</span></div>
                            <div className="flex justify-between text-sm"><span>OE:</span><span className="font-medium">{order.dnp_oe ? `${order.dnp_oe} mm` : "—"}</span></div>
                          </div>
                        </div>
                      )}
                      {(order.pupillary_height_od || order.pupillary_height_oe) && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Altura Pupilar</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm"><span>OD:</span><span className="font-medium">{order.pupillary_height_od ? `${order.pupillary_height_od} mm` : "—"}</span></div>
                            <div className="flex justify-between text-sm"><span>OE:</span><span className="font-medium">{order.pupillary_height_oe ? `${order.pupillary_height_oe} mm` : "—"}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Optical Prescription */}
            {receita && (
              <Card className="border-border/50 shadow-medium">
                <CardHeader><CardTitle className="text-base">Receita Óptica</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{formatDate(receita.data_receita)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Médico</p><p className="font-medium">{receita.medico || "—"}</p></div>
                    {[["OD Esf.", receita.od_esferico], ["OD Cil.", receita.od_cilindrico], ["OD Eixo", receita.od_eixo], ["OD Ad.", receita.od_adicao],
                      ["OE Esf.", receita.oe_esferico], ["OE Cil.", receita.oe_cilindrico], ["OE Eixo", receita.oe_eixo], ["OE Ad.", receita.oe_adicao]
                    ].map(([lbl, val]) => val && (
                      <div key={lbl}><p className="text-xs text-muted-foreground">{lbl}</p><p className="font-medium">{val}</p></div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column (1/3) */}
          <div className="space-y-6">

            {/* Timeline */}
            <Card className="border-border/50 shadow-medium">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" />Timeline</CardTitle></CardHeader>
              <CardContent>
                <TimelineSection />
                {!isDelivered && (
                  <div className="flex gap-2 mt-4 pt-4 border-t flex-col">
                    {nextStatus && (
                      <Button size="sm" className=" w-full" onClick={() => openStatusDialog(nextStatus)}>
                        <ArrowRight className="w-3.5 h-3.5 mr-1" />
                        Avançar para {STATUS_CONFIG[nextStatus]?.label}
                      </Button>
                    )}
                    {prevStatus && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => openStatusDialog(prevStatus)}>
                        Voltar para {STATUS_CONFIG[prevStatus]?.label}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card className="border-border/50 shadow-medium">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" />Pagamento</CardTitle>
                  {remaining > 0 && !isDelivered && (
                    <Button size="sm" className="" onClick={() => { setPayAmount(remaining.toFixed(2)); setPayDialogOpen(true); }}>
                      <DollarSign className="w-3.5 h-3.5 mr-1" /> Registrar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 bg-muted/40 rounded-md">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-bold">{formatCurrency(total)}</p>
                  </div>
                  <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="font-bold text-green-600">{formatCurrency(paid)}</p>
                  </div>
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md">
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className={`font-bold ${remaining > 0 ? "text-amber-600" : "text-green-600"}`}>{formatCurrency(remaining)}</p>
                  </div>
                </div>

                {/* Payment history */}
                {salePayments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Recebimentos</p>
                    {salePayments.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-sm">
                        <div>
                          <p className="text-xs font-medium">{formatDate(p.payment_date)}</p>
                          <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method}</p>
                        </div>
                        <p className="font-semibold text-green-600">+{formatCurrency(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {remaining <= 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 w-full justify-center">
                    ✓ Pago integralmente
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Status Change Dialog ──────────────────────────────────────────── */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar status do pedido?</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg text-sm">
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">De</p>
                  <Badge variant="secondary" className={`${STATUS_CONFIG[order.status]?.color} mt-1`}>
                    {STATUS_CONFIG[order.status]?.label}
                  </Badge>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <div className="text-center flex-1">
                  <p className="text-xs text-muted-foreground">Para</p>
                  <Badge variant="secondary" className={`${STATUS_CONFIG[statusTarget]?.color} mt-1`}>
                    {STATUS_CONFIG[statusTarget]?.label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status-note" className="text-sm">Observação (opcional)</Label>
                <Input
                  id="status-note"
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                  placeholder="Ex: Enviado ao laboratório..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleChangeStatus} disabled={changingStatus} className="">
              {changingStatus ? "Atualizando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Register Delivery Dialog ───────────────────────────────────────── */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar entrega do pedido?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-semibold">{order.clients?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pedido</span><span className="font-bold">#{String(order.order_number).padStart(5, "0")}</span></div>
              {remaining > 0 && (
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted-foreground">Valor pendente</span>
                  <span className="font-bold text-amber-600">{formatCurrency(remaining)}</span>
                </div>
              )}
            </div>
            {remaining > 0 && (
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-xs p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Este pedido possui pagamento pendente. Você pode registrar o pagamento antes ou após a entrega.</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterDelivery} disabled={registeringDelivery} className="bg-green-600 hover:bg-green-700 text-white">
              {registeringDelivery ? "Registrando..." : "Confirmar Entrega"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Register Payment Dialog ────────────────────────────────────────── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" /> Registrar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted/40 rounded-lg text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatCurrency(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Já pago</span><span className="text-green-600 font-semibold">{formatCurrency(paid)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground font-medium">Saldo pendente</span><span className="font-bold text-amber-600">{formatCurrency(remaining)}</span></div>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Valor Recebido*</Label>
              <Input
                id="pay-amount" type="number" step="0.01" min="0.01"
                max={remaining} value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground">Máximo: {formatCurrency(remaining)}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRegisterPayment} disabled={registeringPay} className="">
              {registeringPay ? "Registrando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Share Tracking Dialog ─────────────────────────────────────────── */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-primary" />
              Compartilhar acompanhamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Envie este link para o cliente acompanhar o andamento do pedido em tempo real, sem precisar criar uma conta.
            </p>

            {/* Link field */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Link de acompanhamento</Label>
              <div className="flex gap-2">
                <Input
                  id="tracking-url-input"
                  readOnly
                  value={trackingToken ? getTrackingUrl() : ""}
                  className="text-xs font-mono bg-muted/40 cursor-text"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="flex-shrink-0"
                  onClick={handleCopyLink}
                  title="Copiar link"
                >
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4" />
                  }
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Link copiado!
                </p>
              )}
            </div>

            {/* Preview link */}
            {trackingToken && (
              <a
                href={getTrackingUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Visualizar como o cliente verá
              </a>
            )}

            {/* Tracking section info */}
            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">O cliente verá:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5 list-none">
                <li>✓ Primeiro nome e número do pedido</li>
                <li>✓ Status atual com mensagem amigável</li>
                <li>✓ Timeline visual de progresso</li>
                <li>✓ Previsão de entrega (se definida)</li>
                <li>✓ Botão para falar com a ótica</li>
                <li>✗ Dados financeiros, receita ou internos</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleCopyLink}
            >
              {copied ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
            <Button
              className="w-full sm:w-auto bg-[#25D366] hover:bg-[#22c55e] text-white"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Enviar pelo WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
