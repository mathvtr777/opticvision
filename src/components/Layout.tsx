import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Package2,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  UserCog,
  Bell,
  Clock,
  FlaskConical,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: string;
}

const menuSections = [
  {
    title: "Início",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    ],
  },
  {
    title: "Operação",
    items: [
      { icon: ShoppingCart, label: "Vendas", path: "/sales" },
      { icon: Package, label: "Pedidos", path: "/pedidos" },
      { icon: FlaskConical, label: "Laboratório", path: "/laboratorio" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { icon: Users, label: "Clientes", path: "/clients" },
      { icon: Package2, label: "Produtos", path: "/products" },
      { icon: UserCog, label: "Vendedores", path: "/sellers" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { icon: DollarSign, label: "Financeiro", path: "/financial" },
      { icon: Clock, label: "Pag. Pendentes", path: "/pending-payments" },
      { icon: FileText, label: "Relatórios", path: "/reports" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { icon: Settings, label: "Configurações", path: "/settings" },
    ],
  },
];

const allMenuItems = menuSections.flatMap(s => s.items);

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const currentPage = allMenuItems.find(i => i.path === location.pathname);

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0B0B0B] flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-60" : "w-0"} fixed md:sticky top-0 h-screen bg-white dark:bg-[#111111] border-r border-[#E8E8E8] dark:border-[#222222] transition-all duration-300 z-40 overflow-hidden flex-shrink-0`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-[80px] flex items-center px-4 border-b border-[#E8E8E8] dark:border-[#222222]">
            <Link to="/dashboard" className="flex items-center">
              <img
                src="/simply-logo.png"
                alt="Simply"
                className="h-16 w-auto object-contain"
                style={{ mixBlendMode: "multiply" }}
              />
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
            {menuSections.map((section) => (
              <div key={section.title}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#aaaaaa] dark:text-[#555555]">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => isMobile && setSidebarOpen(false)}
                        className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group ${
                          active
                            ? "bg-[#EAF0F4] dark:bg-[#1a2530] text-[#315B7D] dark:text-[#5F83A0] font-medium"
                            : "text-[#555555] dark:text-[#888888] hover:bg-[#F5F5F5] dark:hover:bg-[#1a1a1a] hover:text-[#111111] dark:hover:text-white"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#315B7D] rounded-r-full" />
                        )}
                        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-[#315B7D] dark:text-[#5F83A0]" : "text-[#999999] dark:text-[#555555] group-hover:text-[#555555] dark:group-hover:text-[#888888]"}`} />
                        <span>{item.label}</span>
                        {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-[#E8E8E8] dark:border-[#222222] space-y-1">
            <div className="px-2.5 py-2 flex items-center gap-2 text-xs text-[#999999] dark:text-[#555555]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistema online
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-[#999999] dark:text-[#555555] hover:bg-[#F5F5F5] dark:hover:bg-[#1a1a1a] hover:text-[#111111] dark:hover:text-white transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-[60px] bg-white dark:bg-[#111111] border-b border-[#E8E8E8] dark:border-[#222222] flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#999999] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#1a1a1a] transition-all"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            {currentPage && (
              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                <img src="/simply-logo.png" alt="Simply" className="h-8 w-auto object-contain" style={{ mixBlendMode: "multiply" }} />
                <span className="text-[#aaaaaa] dark:text-[#555555]">/</span>
                <span className="text-[#111111] dark:text-white font-medium">{currentPage.label}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#aaaaaa] dark:text-[#555555] mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </div>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[#999999] hover:text-[#111111] dark:hover:text-white hover:bg-[#F5F5F5] dark:hover:bg-[#1a1a1a] transition-all relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#315B7D]" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#111111] dark:bg-white flex items-center justify-center">
              <span className="text-white dark:text-[#111111] text-xs font-bold">U</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 pb-24 md:p-6 lg:p-8 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white dark:bg-[#111111] border-t border-[#E8E8E8] dark:border-[#222222] z-30 grid grid-cols-4 px-2">
        {allMenuItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center gap-1 text-[10px] transition-colors ${active ? "text-[#315B7D]" : "text-[#aaaaaa]"}`}>
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button className="flex flex-col items-center justify-center gap-1 text-[10px] text-[#aaaaaa]" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}