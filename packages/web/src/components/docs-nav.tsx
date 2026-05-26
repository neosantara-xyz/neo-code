"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/8bit/navigation-menu";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs/getting-started", label: "Start" },
  { href: "/docs/configuration", label: "Config" },
  { href: "/docs/tools", label: "Tools" },
  { href: "/docs/skills", label: "Skills" },
  { href: "https://github.com/neosantara-xyz/neo-code", label: "GitHub" },
];

export function DocsNav() {
  return (
    <nav className="mb-8 flex justify-center">
      <NavigationMenu font="retro">
        <NavigationMenuList className="flex-wrap gap-1">
          {navItems.map((item) => (
            <NavigationMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                  {item.label}
                </NavigationMenuLink>
              </Link>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    </nav>
  );
}
