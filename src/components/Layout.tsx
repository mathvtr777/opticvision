import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  DollarSign,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  UserCog,
  Bell,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: ShoppingCart, label: "Vendas", path: "/sales" },
  { icon: Clock, label: "Pagamentos Pendentes", path: "/pending-payments" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: Package, label: "Produtos", path: "/products" },
  { icon: UserCog, label: "Vendedores", path: "/sellers" },
  { icon: DollarSign, label: "Financeiro", path: "/financial" },
  { icon: FileText, label: "Relatórios", path: "/reports" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

export default function Layout({ children }: LayoutProps) {
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-0"} fixed md:sticky top-0 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 z-40 overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center justify-center px-4 border-b border-sidebar-border">
            <Link to="/dashboard" className="flex items-center justify-center w-full">
              <img
                src="/uploads/ChatGPT_Image_12_de_set._de_2026_18_01_37.png"
                alt="Logo"
                className="h-16 w-auto max-w-full object-contain"
              />
            </Link>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            <p className="px-3 pb-3 text-[10px] font-semibold uppercase text-muted-foreground">Navegação</p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-md transition-all ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground border border-primary/20"
                      : "text-sidebar-foreground border border-transparent hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-3 border-t border-sidebar-border">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-5 h-5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary shadow-kiwi animate-pulse" />
              Sistema online
            </div>
            <Button variant="outline" size="icon" aria-label="Notificações" className="relative rounded-full">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 pb-24 md:p-6 lg:p-8 md:pb-8 overflow-auto">
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-background/90 backdrop-blur-xl border-t border-border z-30 grid grid-cols-4 px-2">
        {menuItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center justify-center gap-1 text-[10px] ${isActive(item.path) ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <Button variant="ghost" className="h-full rounded-none flex-col gap-1 text-[10px] text-muted-foreground" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
          <span>Menu</span>
        </Button>
      </nav>
    </div>
  );
}