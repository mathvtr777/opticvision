import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FlaskConical, Search, FileText, ChevronRight, CheckCircle2,
  AlertCircle, Eye, Printer, Download, Truck, Package, Clock
} from "lucide-react";
import { Label } from "@/components/ui/label";

import { STATUS_CONFIG } from "./Orders";

export default function Laboratory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    checkAuth();
    loadOrders();
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
        id, order_number, status, lab_status, estimated_delivery, created_at, client_id,
        lens_type, lab_order_number, lab_estimated_delivery,
        clients (name, phone),
        laboratories (name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pedidos do laboratório.");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // General Search
      const searchLower = search.toLowerCase();
      const matchSearch =
        search === "" ||
        String(o.order_number).includes(searchLower) ||
        (o.clients?.name || "").toLowerCase().includes(searchLower) ||
        (o.clients?.phone || "").includes(search) ||
        (o.lab_order_number || "").toLowerCase().includes(searchLower) ||
        (o.laboratories?.name || "").toLowerCase().includes(searchLower);

      return matchSearch && matchDate;
    });
  }, [orders, search, startDate, endDate]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
  };

  return (
    <Layout>
      <div className="max-w-[1500px] mx-auto space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <FlaskConical className="w-8 h-8 text-primary" />
            Laboratório
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os pedidos e prepare as guias para produção.</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 items-end bg-card p-4 rounded-lg border shadow-sm">
          <div className="flex-1 space-y-2 w-full">
            <Label>Buscar cliente, pedido ou telefone</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2 w-full md:w-40">
            <Label>Data inicial</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2 w-full md:w-40">
            <Label>Data final</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Lista */}
        <Card className="border-border/50 shadow-medium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Lente</th>
                  <th className="px-4 py-3 font-medium">Laboratório</th>
                  <th className="px-4 py-3 font-medium">Previsão Lab</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum pedido encontrado no laboratório.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const st = STATUS_CONFIG[order.status];
                    return (
                      <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          #{String(order.order_number).padStart(5, "0")}
                        </td>
                        <td className="px-4 py-3">
                          {order.clients?.name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {order.created_at ? formatDate(order.created_at.split("T")[0]) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {order.lens_type || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {order.laboratories?.name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(order.lab_estimated_delivery)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={`${st?.color} border-0`}>
                            {st?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => window.open(`/guia-laboratorio/${order.id}`, '_blank')}
                          >
                            <FileText className="w-4 h-4 mr-1" /> Guia
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => navigate(`/pedidos/${order.id}`)}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Ver
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
