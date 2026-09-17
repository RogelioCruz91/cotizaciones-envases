"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard",    icon: "📊", label: "Dashboard"    },
  { href: "/clientes",     icon: "👥", label: "Clientes"     },
  { href: "/envases",      icon: "📦", label: "Envases"      },
  { href: "/cotizaciones", icon: "📋", label: "Cotizaciones" },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={`bg-gray-900 text-white flex flex-col shrink-0 transition-all duration-300 ${collapsed ? "w-14" : "w-56"}`}>
      <div className={`flex items-center border-b border-gray-700 h-14 px-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <div>
            <p className="font-bold text-sm leading-tight">Envases</p>
            <p className="text-[10px] text-gray-400 leading-tight">Cotizaciones</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV.map(({ href, icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-sm
                ${active ? "bg-blue-700 text-white" : "text-gray-400 hover:bg-gray-700 hover:text-white"}
                ${collapsed ? "justify-center" : ""}`}
            >
              <span className="text-lg shrink-0">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-gray-700">
          <p className="text-xs text-gray-500">Sistema de Cotizaciones v1.0</p>
        </div>
      )}
    </aside>
  );
}
