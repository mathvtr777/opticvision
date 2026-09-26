import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SIGNUP_TOKEN = "bokashipvp";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [token, setToken] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        if (token !== SIGNUP_TOKEN) {
          toast.error("Token inválido. Verifique e tente novamente.");
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              establishment_name: establishmentName,
            },
          },
        });
        
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setToken("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-hard border-border/50">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex items-center justify-center">
            <span className="text-4xl font-black tracking-tighter text-foreground py-6">
              Simply
            </span>
          </div>
          <CardDescription className="text-base">
            {isLogin ? "Entre na sua conta" : "Crie sua conta gratuitamente"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="establishment">Nome do Estabelecimento</Label>
                <Input
                  id="establishment"
                  type="text"
                  placeholder="Minha Loja"
                  value={establishmentName}
                  onChange={(e) => setEstablishmentName(e.target.value)}
                  required={!isLogin}
                  className="h-11"
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Digite o token de acesso"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required={!isLogin}
                  className="h-11"
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11  transition-opacity"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                isLogin ? "Entrar" : "Criar Conta"
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={toggleMode}
              disabled={loading}
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
