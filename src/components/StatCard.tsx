import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export default function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden hover:border-primary/30 hover:shadow-medium transition-all duration-300 hover:-translate-y-0.5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2.5 flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums truncate">{value}</p>
            {trend && (
              <p className={`text-xs font-semibold ${trendUp ? "text-success" : "text-destructive"}`}>
                {trend}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-accent border border-primary/20 flex items-center justify-center text-primary group-hover:shadow-kiwi transition-shadow">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}