import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download, Filter } from "lucide-react";
import { toast } from "sonner";

type Periodo = "diario" | "semanal" | "mensal" | "personalizado";

type Venda = {
  id: string;
  user_id: string;
  cliente_id: string | null;
  total: number | null;
  desconto: number | null;
  forma_pagamento: string | null;
  status: string | null;
  criado_em: string;
};

type Cliente = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  criado_em: string;
};

function inicioDoPeriodo(periodo: Periodo): Date | null {
  const agora = new Date();
  if (periodo === "diario") {
    const d = new Date(agora);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (periodo === "semanal") {
    const d = new Date(agora);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (periodo === "mensal") {
    const d = new Date(agora);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return null;
}

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatarMoeda(valor: number | null | undefined) {
  const n = Number(valor ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Reports() {
  const navigate = useNavigate();

  const [aba, setAba] = useState<"vendas" | "clientes">("vendas");

  // filtros de vendas
  const [periodoVendas, setPeriodoVendas] = useState<Periodo>("mensal");
  const [dataInicioVendas, setDataInicioVendas] = useState("");
  const [dataFimVendas, setDataFimVendas] = useState("");
  const [vendedorVendas, setVendedorVendas] = useState<string>("todos");

  // filtros de clientes
  const [periodoClientes, setPeriodoClientes] = useState<Periodo>("mensal");
  const [dataInicioClientes, setDataInicioClientes] = useState("");
  const [dataFimClientes, setDataFimClientes] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({});
  const [vendedores, setVendedores] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(false);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/");
      return false;
    }
    return true;
  };

  const buscarVendas = async () => {
    setCarregando(true);
    try {
      let query = supabase
        .from("sales")
        .select("id, user_id, client_id, total_amount, payment_method, seller_name, created_at")
        .order("created_at", { ascending: false });

      if (periodoVendas === "personalizado") {
        if (dataInicioVendas) query = query.gte("created_at", `${dataInicioVendas}T00:00:00`);
        if (dataFimVendas) query = query.lte("created_at", `${dataFimVendas}T23:59:59`);
      } else {
        const inicio = inicioDoPeriodo(periodoVendas);
        if (inicio) query = query.gte("created_at", inicio.toISOString());
      }

      if (vendedorVendas !== "todos") {
        query = query.eq("user_id", vendedorVendas);
      }

      const { data, error } = await query;
      if (error) throw error;

      const lista: Venda[] = (data || []).map((s: any) => ({
        id: s.id,
        user_id: s.user_id,
        cliente_id: s.client_id,
        total: Number(s.total_amount || 0),
        desconto: 0,
        forma_pagamento: s.payment_method,
        status: "Concluída",
        criado_em: s.created_at,
      }));
      setVendas(lista);

      // lista de vendedores (user_id) para o filtro
      const ids = Array.from(new Set(lista.map((v) => v.user_id))).filter(Boolean);
      setVendedores((prev) => Array.from(new Set([...prev, ...ids])));

      // nomes dos clientes das vendas
      const clienteIds = Array.from(
        new Set(lista.map((v) => v.cliente_id).filter((x): x is string => !!x))
      );
      if (clienteIds.length > 0) {
        const { data: cli } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clienteIds);
        const mapa: Record<string, string> = {};
        (cli ?? []).forEach((c: any) => {
          mapa[c.id] = c.name || "Cliente";
        });
        setNomesClientes(mapa);
      } else {
        setNomesClientes({});
      }
    } catch (err: any) {
      toast.error("Erro ao carregar vendas: " + (err?.message ?? "desconhecido"));
    } finally {
      setCarregando(false);
    }
  };

  const buscarClientes = async () => {
    setCarregando(true);
    try {
      let query = supabase
        .from("clients")
        .select("id, name, email, phone, cidade, estado, created_at")
        .order("created_at", { ascending: false });

      if (periodoClientes === "personalizado") {
        if (dataInicioClientes) query = query.gte("created_at", `${dataInicioClientes}T00:00:00`);
        if (dataFimClientes) query = query.lte("created_at", `${dataFimClientes}T23:59:59`);
      } else {
        const inicio = inicioDoPeriodo(periodoClientes);
        if (inicio) query = query.gte("created_at", inicio.toISOString());
      }

      if (buscaCliente.trim()) {
        query = query.ilike("name", `%${buscaCliente.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const lista: Cliente[] = (data || []).map((c: any) => ({
        id: c.id,
        nome: c.name || "",
        email: c.email || null,
        telefone: c.phone || null,
        cidade: c.cidade || null,
        estado: c.estado || null,
        criado_em: c.created_at,
      }));
      setClientes(lista);
    } catch (err: any) {
      toast.error("Erro ao carregar clientes: " + (err?.message ?? "desconhecido"));
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    checkAuth().then((isAutenticado) => {
      if (!isAutenticado) return;
      if (aba === "vendas") buscarVendas();
      else buscarClientes();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const totalVendas = useMemo(
    () => vendas.reduce((soma, v) => soma + Number(v.total ?? 0), 0),
    [vendas]
  );

  const exportarPDF = (titulo: string, corpoHtml: string) => {
    const janela = window.open("", "_blank", "width=900,height=650");
    if (!janela) {
      toast.error("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.");
      return;
    }
    const dataGeracao = new Date().toLocaleString("pt-BR");
    janela.document.write(`
      <html>
        <head>
          <title>${titulo}</title>
          <meta charset="utf-8" />
          <style>
            * { font-family: Arial, Helvetica, sans-serif; }
            body { padding: 24px; color: #111; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f3f3f3; }
            .total { margin-top: 12px; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${titulo}</h1>
          <div class="sub">Gerado em ${dataGeracao}</div>
          ${corpoHtml}
          <script>window.onload = function(){ window.print(); }<\/script>
        </body>
      </html>
    `);
    janela.document.close();
  };

  const exportarVendas = () => {
    if (vendas.length === 0) {
      toast.error("Nenhuma venda para exportar.");
      return;
    }
    const linhas = vendas
      .map(
        (v) => `
        <tr>
          <td>${formatarData(v.criado_em)}</td>
          <td>${v.cliente_id ? nomesClientes[v.cliente_id] ?? "-" : "-"}</td>
          <td>${v.forma_pagamento ?? "-"}</td>
          <td>${v.status ?? "-"}</td>
          <td>${formatarMoeda(v.total)}</td>
        </tr>`
      )
      .join("");
    const corpo = `
      <table>
        <thead>
          <tr><th>Data</th><th>Cliente</th><th>Forma de pagamento</th><th>Status</th><th>Total</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="total">Total geral: ${formatarMoeda(totalVendas)}</div>
    `;
    exportarPDF("Relatório de Vendas", corpo);
  };

  const exportarClientes = () => {
    if (clientes.length === 0) {
      toast.error("Nenhum cliente para exportar.");
      return;
    }
    const linhas = clientes
      .map(
        (c) => `
        <tr>
          <td>${c.nome}</td>
          <td>${c.email ?? "-"}</td>
          <td>${c.telefone ?? "-"}</td>
          <td>${[c.cidade, c.estado].filter(Boolean).join(" / ") || "-"}</td>
          <td>${formatarData(c.criado_em)}</td>
        </tr>`
      )
      .join("");
    const corpo = `
      <table>
        <thead>
          <tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Cidade/UF</th><th>Cadastro</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="total">Total de clientes: ${clientes.length}</div>
    `;
    exportarPDF("Relatório de Clientes", corpo);
  };

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">Análises e insights do negócio</p>
        </div>

        <Tabs value={aba} onValueChange={(v) => setAba(v as "vendas" | "clientes")}>
          <TabsList>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
          </TabsList>

          <TabsContent value="vendas" className="mt-4">
            <Card className="border-border/50 shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-primary" />
                  Filtros de Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Período</Label>
                    <Select value={periodoVendas} onValueChange={(v) => setPeriodoVendas(v as Periodo)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário (hoje)</SelectItem>
                        <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
                        <SelectItem value="mensal">Mensal (30 dias)</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {periodoVendas === "personalizado" && (
                    <>
                      <div className="space-y-2">
                        <Label>Data início</Label>
                        <Input
                          type="date"
                          value={dataInicioVendas}
                          onChange={(e) => setDataInicioVendas(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data fim</Label>
                        <Input
                          type="date"
                          value={dataFimVendas}
                          onChange={(e) => setDataFimVendas(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Vendedor</Label>
                    <Select value={vendedorVendas} onValueChange={setVendedorVendas}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {vendedores.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={buscarVendas} disabled={carregando}>
                    <Filter className="w-4 h-4 mr-2" />
                    Aplicar filtros
                  </Button>
                  <Button variant="outline" onClick={exportarVendas}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-medium mt-4">
              <CardHeader>
                <CardTitle>Resultado ({vendas.length} vendas)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Forma de pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhuma venda no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>{formatarData(v.criado_em)}</TableCell>
                          <TableCell>{v.cliente_id ? nomesClientes[v.cliente_id] ?? "-" : "-"}</TableCell>
                          <TableCell>{v.forma_pagamento ?? "-"}</TableCell>
                          <TableCell>{v.status ?? "-"}</TableCell>
                          <TableCell className="text-right">{formatarMoeda(v.total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {vendas.length > 0 && (
                  <div className="mt-4 text-right font-semibold">
                    Total geral: {formatarMoeda(totalVendas)}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="mt-4">
            <Card className="border-border/50 shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-primary" />
                  Filtros de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Período de cadastro</Label>
                    <Select
                      value={periodoClientes}
                      onValueChange={(v) => setPeriodoClientes(v as Periodo)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário (hoje)</SelectItem>
                        <SelectItem value="semanal">Semanal (7 dias)</SelectItem>
                        <SelectItem value="mensal">Mensal (30 dias)</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {periodoClientes === "personalizado" && (
                    <>
                      <div className="space-y-2">
                        <Label>Data início</Label>
                        <Input
                          type="date"
                          value={dataInicioClientes}
                          onChange={(e) => setDataInicioClientes(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data fim</Label>
                        <Input
                          type="date"
                          value={dataFimClientes}
                          onChange={(e) => setDataFimClientes(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Buscar por nome</Label>
                    <Input
                      placeholder="Nome do cliente"
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={buscarClientes} disabled={carregando}>
                    <Filter className="w-4 h-4 mr-2" />
                    Aplicar filtros
                  </Button>
                  <Button variant="outline" onClick={exportarClientes}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-medium mt-4">
              <CardHeader>
                <CardTitle>Resultado ({clientes.length} clientes)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum cliente no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.nome}</TableCell>
                          <TableCell>{c.email ?? "-"}</TableCell>
                          <TableCell>{c.telefone ?? "-"}</TableCell>
                          <TableCell>{[c.cidade, c.estado].filter(Boolean).join(" / ") || "-"}</TableCell>
                          <TableCell>{formatarData(c.criado_em)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
