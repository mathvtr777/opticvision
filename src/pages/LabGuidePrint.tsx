import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, Download, X } from "lucide-react";
import { toast } from "sonner";

export default function LabGuidePrint() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [receita, setReceita] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        clients (*),
        laboratories (*)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      toast.error("Erro ao carregar dados da guia.");
    } else {
      setOrder(data);
      if (data.client_id) {
        const { data: recData } = await supabase
          .from("receitas")
          .select("*")
          .eq("cliente_id", data.client_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setReceita(recData || null);
      }
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Gerando guia...</div>;
  }

  if (!order) {
    return <div className="flex h-screen items-center justify-center">Pedido não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans print:bg-white print:p-0">
      
      {/* Barra de Controles (Não aparece na impressão) */}
      <div className="mx-auto max-w-3xl mb-4 flex items-center justify-between rounded-lg bg-white p-4 shadow-sm print:hidden">
        <h2 className="font-bold text-lg flex items-center gap-2">
          Visualização da Guia
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={handlePrint} className="hidden sm:flex">
            {/* Como não há lib de PDF, instruímos usar a opção de "Salvar como PDF" do sistema */}
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button variant="ghost" onClick={() => window.close()}>
            <X className="w-4 h-4 mr-2" />
            Fechar
          </Button>
        </div>
      </div>

      {/* Papel A4 */}
      <div className="mx-auto max-w-[210mm] min-h-[297mm] bg-white p-10 shadow-lg print:shadow-none print:p-0">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black tracking-tighter text-slate-800">
              Simply
            </span>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-slate-800">Guia de Laboratório</h1>
              <p className="text-sm text-slate-600">Pedido #{String(order.order_number).padStart(5, "0")}</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-600 space-y-1">
            <p><strong>Data de Emissão:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
            <p><strong>Data do Pedido:</strong> {formatDate(order.created_at.split("T")[0])}</p>
            <p><strong>Vendedor:</strong> {order.seller_name || "—"}</p>
          </div>
        </div>

        <div className="space-y-8">
          
          {/* Cliente e Laboratório */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Identificação do Cliente</h3>
              <p className="text-sm"><span className="font-semibold text-slate-600">Nome:</span> {order.clients?.name || "—"}</p>
              <p className="text-sm"><span className="font-semibold text-slate-600">Telefone:</span> {order.clients?.phone || "—"}</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Identificação do Laboratório</h3>
              <p className="text-sm"><span className="font-semibold text-slate-600">Laboratório:</span> {order.laboratories?.name || "Não informado"}</p>
              <p className="text-sm"><span className="font-semibold text-slate-600">Nº da Ordem Lab:</span> {order.lab_order_number || "—"}</p>
              <p className="text-sm"><span className="font-semibold text-slate-600">Previsão:</span> {formatDate(order.lab_estimated_delivery)}</p>
            </div>
          </div>

          {/* Dados da Lente / Armação */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Dados de Produção</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm"><span className="font-semibold text-slate-600">Tipo de Lente:</span> {order.lens_type || "—"}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-600">Armação fornecida pelo cliente ou ótica</p>
                <div className="h-0.5 bg-slate-100"></div>
                <div className="h-0.5 bg-slate-100 mt-6"></div>
              </div>
            </div>
          </div>

          {/* Dados Ópticos e Receita */}
          <div>
            <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Grau (Receita Óptica)</h3>
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="border p-2 text-left font-semibold">Olho</th>
                  <th className="border p-2 text-center font-semibold">Esférico</th>
                  <th className="border p-2 text-center font-semibold">Cilíndrico</th>
                  <th className="border p-2 text-center font-semibold">Eixo</th>
                  <th className="border p-2 text-center font-semibold">Adição</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 font-medium">Direito (OD)</td>
                  <td className="border p-2 text-center">{receita?.od_esferico || "—"}</td>
                  <td className="border p-2 text-center">{receita?.od_cilindrico || "—"}</td>
                  <td className="border p-2 text-center">{receita?.od_eixo || "—"}</td>
                  <td className="border p-2 text-center">{receita?.od_adicao || "—"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">Esquerdo (OE)</td>
                  <td className="border p-2 text-center">{receita?.oe_esferico || "—"}</td>
                  <td className="border p-2 text-center">{receita?.oe_cilindrico || "—"}</td>
                  <td className="border p-2 text-center">{receita?.oe_eixo || "—"}</td>
                  <td className="border p-2 text-center">{receita?.oe_adicao || "—"}</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Medidas</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="border p-2 text-left font-semibold">Medida</th>
                  <th className="border p-2 text-center font-semibold">Olho Direito (OD)</th>
                  <th className="border p-2 text-center font-semibold">Olho Esquerdo (OE)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 font-medium">DNP</td>
                  <td className="border p-2 text-center">{order.dnp_od ? `${order.dnp_od} mm` : "—"}</td>
                  <td className="border p-2 text-center">{order.dnp_oe ? `${order.dnp_oe} mm` : "—"}</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">Altura Pupilar</td>
                  <td className="border p-2 text-center">{order.pupillary_height_od ? `${order.pupillary_height_od} mm` : "—"}</td>
                  <td className="border p-2 text-center">{order.pupillary_height_oe ? `${order.pupillary_height_oe} mm` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Observações */}
          {(order.notes || order.lab_notes || order.clients?.notes) && (
            <div>
              <h3 className="font-bold text-slate-800 uppercase text-xs mb-3 border-b pb-1">Observações</h3>
              {order.clients?.notes && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Anotações do Cliente:</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{order.clients.notes}</p>
                </div>
              )}
              {order.notes && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Anotações da Venda:</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{order.notes}</p>
                </div>
              )}
              {order.lab_notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Instruções Laboratoriais:</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{order.lab_notes}</p>
                </div>
              )}
            </div>
          )}

        </div>
        
        {/* Footer */}
        <div className="mt-16 text-center text-xs text-slate-400 border-t pt-4">
          Simply ERP — Sistema de Gestão para Óticas • Documento gerado eletronicamente.
        </div>
      </div>

    </div>
  );
}
