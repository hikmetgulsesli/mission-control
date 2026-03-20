/**
 * Komponent Kutuphanesi Eslestirme — PRD'deki UI komponentlerini
 * shadcn/ui + Radix primitives ile eslestirir.
 */

interface ComponentMapping {
  prdTerm: string;
  shadcnComponent: string;
  radixPrimitive: string | null;
  importPath: string;
  props: string[];
  notes: string;
}

const COMPONENT_MAP: ComponentMapping[] = [
  // Layout
  { prdTerm: 'card', shadcnComponent: 'Card', radixPrimitive: null, importPath: '@/components/ui/card', props: ['CardHeader', 'CardContent', 'CardFooter', 'CardTitle', 'CardDescription'], notes: 'Icerik kartlari icin' },
  { prdTerm: 'kart', shadcnComponent: 'Card', radixPrimitive: null, importPath: '@/components/ui/card', props: ['CardHeader', 'CardContent', 'CardFooter', 'CardTitle', 'CardDescription'], notes: 'Icerik kartlari icin' },
  { prdTerm: 'sidebar', shadcnComponent: 'Sheet', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/sheet', props: ['SheetTrigger', 'SheetContent', 'SheetHeader', 'SheetTitle'], notes: 'Mobile sidebar / yan panel icin' },
  { prdTerm: 'yan panel', shadcnComponent: 'Sheet', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/sheet', props: ['SheetTrigger', 'SheetContent'], notes: 'Mobile sidebar icin' },

  // Navigation
  { prdTerm: 'tab', shadcnComponent: 'Tabs', radixPrimitive: '@radix-ui/react-tabs', importPath: '@/components/ui/tabs', props: ['TabsList', 'TabsTrigger', 'TabsContent'], notes: 'Sekme navigasyonu' },
  { prdTerm: 'sekme', shadcnComponent: 'Tabs', radixPrimitive: '@radix-ui/react-tabs', importPath: '@/components/ui/tabs', props: ['TabsList', 'TabsTrigger', 'TabsContent'], notes: 'Sekme navigasyonu' },
  { prdTerm: 'nav', shadcnComponent: 'NavigationMenu', radixPrimitive: '@radix-ui/react-navigation-menu', importPath: '@/components/ui/navigation-menu', props: ['NavigationMenuList', 'NavigationMenuItem', 'NavigationMenuTrigger', 'NavigationMenuContent'], notes: 'Ana navigasyon menüsü' },
  { prdTerm: 'breadcrumb', shadcnComponent: 'Breadcrumb', radixPrimitive: null, importPath: '@/components/ui/breadcrumb', props: ['BreadcrumbList', 'BreadcrumbItem', 'BreadcrumbLink', 'BreadcrumbSeparator'], notes: 'Sayfa yolu gostergesi' },

  // Actions
  { prdTerm: 'button', shadcnComponent: 'Button', radixPrimitive: null, importPath: '@/components/ui/button', props: ['variant: default|destructive|outline|secondary|ghost|link', 'size: default|sm|lg|icon'], notes: 'Her turlü buton icin' },
  { prdTerm: 'buton', shadcnComponent: 'Button', radixPrimitive: null, importPath: '@/components/ui/button', props: ['variant', 'size', 'disabled', 'asChild'], notes: 'Her turlü buton icin' },
  { prdTerm: 'dropdown', shadcnComponent: 'DropdownMenu', radixPrimitive: '@radix-ui/react-dropdown-menu', importPath: '@/components/ui/dropdown-menu', props: ['DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuSeparator'], notes: 'Acilir menu' },
  { prdTerm: 'menu', shadcnComponent: 'DropdownMenu', radixPrimitive: '@radix-ui/react-dropdown-menu', importPath: '@/components/ui/dropdown-menu', props: ['DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'], notes: 'Secenekler menusu' },

  // Forms
  { prdTerm: 'input', shadcnComponent: 'Input', radixPrimitive: null, importPath: '@/components/ui/input', props: ['type', 'placeholder', 'disabled'], notes: 'Tek satir metin girisi' },
  { prdTerm: 'form', shadcnComponent: 'Form', radixPrimitive: null, importPath: '@/components/ui/form', props: ['FormField', 'FormItem', 'FormLabel', 'FormControl', 'FormMessage'], notes: 'React Hook Form entegrasyonlu form' },
  { prdTerm: 'textarea', shadcnComponent: 'Textarea', radixPrimitive: null, importPath: '@/components/ui/textarea', props: ['placeholder', 'rows', 'disabled'], notes: 'Cok satirli metin girisi' },
  { prdTerm: 'select', shadcnComponent: 'Select', radixPrimitive: '@radix-ui/react-select', importPath: '@/components/ui/select', props: ['SelectTrigger', 'SelectContent', 'SelectItem', 'SelectValue'], notes: 'Secim listesi' },
  { prdTerm: 'checkbox', shadcnComponent: 'Checkbox', radixPrimitive: '@radix-ui/react-checkbox', importPath: '@/components/ui/checkbox', props: ['checked', 'onCheckedChange', 'disabled'], notes: 'Onay kutusu' },
  { prdTerm: 'switch', shadcnComponent: 'Switch', radixPrimitive: '@radix-ui/react-switch', importPath: '@/components/ui/switch', props: ['checked', 'onCheckedChange'], notes: 'Acma/kapama toggle' },
  { prdTerm: 'toggle', shadcnComponent: 'Switch', radixPrimitive: '@radix-ui/react-switch', importPath: '@/components/ui/switch', props: ['checked', 'onCheckedChange'], notes: 'Toggle switch' },
  { prdTerm: 'slider', shadcnComponent: 'Slider', radixPrimitive: '@radix-ui/react-slider', importPath: '@/components/ui/slider', props: ['value', 'onValueChange', 'min', 'max', 'step'], notes: 'Deger kaydirici' },
  { prdTerm: 'datepicker', shadcnComponent: 'Calendar + Popover', radixPrimitive: null, importPath: '@/components/ui/calendar', props: ['selected', 'onSelect', 'mode'], notes: 'Tarih secici (Calendar + Popover birlesimi)' },
  { prdTerm: 'tarih', shadcnComponent: 'Calendar + Popover', radixPrimitive: null, importPath: '@/components/ui/calendar', props: ['selected', 'onSelect'], notes: 'Tarih secici' },

  // Feedback
  { prdTerm: 'modal', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter'], notes: 'Popup/modal pencere' },
  { prdTerm: 'dialog', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription'], notes: 'Onay/bilgi dialog' },
  { prdTerm: 'popup', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent'], notes: 'Popup pencere' },
  { prdTerm: 'alert', shadcnComponent: 'Alert', radixPrimitive: null, importPath: '@/components/ui/alert', props: ['AlertTitle', 'AlertDescription', 'variant: default|destructive'], notes: 'Bildirim/uyari kutusu' },
  { prdTerm: 'toast', shadcnComponent: 'Toast', radixPrimitive: '@radix-ui/react-toast', importPath: '@/components/ui/toast', props: ['title', 'description', 'variant', 'action'], notes: 'Gecici bildirim (sonner/toast)' },
  { prdTerm: 'bildirim', shadcnComponent: 'Toast', radixPrimitive: '@radix-ui/react-toast', importPath: '@/components/ui/toast', props: ['title', 'description'], notes: 'Bildirim popup' },
  { prdTerm: 'tooltip', shadcnComponent: 'Tooltip', radixPrimitive: '@radix-ui/react-tooltip', importPath: '@/components/ui/tooltip', props: ['TooltipTrigger', 'TooltipContent'], notes: 'Hover bilgi baloncugu' },
  { prdTerm: 'popover', shadcnComponent: 'Popover', radixPrimitive: '@radix-ui/react-popover', importPath: '@/components/ui/popover', props: ['PopoverTrigger', 'PopoverContent'], notes: 'Tikla-ac bilgi baloncugu' },
  { prdTerm: 'progress', shadcnComponent: 'Progress', radixPrimitive: '@radix-ui/react-progress', importPath: '@/components/ui/progress', props: ['value', 'max'], notes: 'Ilerleme cubugu' },
  { prdTerm: 'skeleton', shadcnComponent: 'Skeleton', radixPrimitive: null, importPath: '@/components/ui/skeleton', props: ['className'], notes: 'Yukleme placeholder' },

  // Data Display
  { prdTerm: 'table', shadcnComponent: 'Table', radixPrimitive: null, importPath: '@/components/ui/table', props: ['TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell'], notes: 'Veri tablosu' },
  { prdTerm: 'tablo', shadcnComponent: 'Table', radixPrimitive: null, importPath: '@/components/ui/table', props: ['TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell'], notes: 'Veri tablosu' },
  { prdTerm: 'badge', shadcnComponent: 'Badge', radixPrimitive: null, importPath: '@/components/ui/badge', props: ['variant: default|secondary|destructive|outline'], notes: 'Etiket/rozet' },
  { prdTerm: 'etiket', shadcnComponent: 'Badge', radixPrimitive: null, importPath: '@/components/ui/badge', props: ['variant'], notes: 'Etiket/rozet' },
  { prdTerm: 'avatar', shadcnComponent: 'Avatar', radixPrimitive: '@radix-ui/react-avatar', importPath: '@/components/ui/avatar', props: ['AvatarImage', 'AvatarFallback'], notes: 'Profil resmi/avatar' },
  { prdTerm: 'accordion', shadcnComponent: 'Accordion', radixPrimitive: '@radix-ui/react-accordion', importPath: '@/components/ui/accordion', props: ['AccordionItem', 'AccordionTrigger', 'AccordionContent', 'type: single|multiple'], notes: 'Acilir-kapanir icerik' },
  { prdTerm: 'carousel', shadcnComponent: 'Carousel', radixPrimitive: null, importPath: '@/components/ui/carousel', props: ['CarouselContent', 'CarouselItem', 'CarouselPrevious', 'CarouselNext'], notes: 'Gorsel slider' },
  { prdTerm: 'separator', shadcnComponent: 'Separator', radixPrimitive: '@radix-ui/react-separator', importPath: '@/components/ui/separator', props: ['orientation: horizontal|vertical'], notes: 'Ayirici cizgi' },
  { prdTerm: 'scroll-area', shadcnComponent: 'ScrollArea', radixPrimitive: '@radix-ui/react-scroll-area', importPath: '@/components/ui/scroll-area', props: ['className'], notes: 'Ozel scrollbar alani' },

  // Special
  { prdTerm: 'command', shadcnComponent: 'Command', radixPrimitive: 'cmdk', importPath: '@/components/ui/command', props: ['CommandInput', 'CommandList', 'CommandItem', 'CommandGroup'], notes: 'Arama + komut paleti (cmdk)' },
  { prdTerm: 'arama', shadcnComponent: 'Command', radixPrimitive: 'cmdk', importPath: '@/components/ui/command', props: ['CommandInput', 'CommandList', 'CommandItem'], notes: 'Arama/filtreleme' },
  { prdTerm: 'header', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/layout/header', props: ['logo', 'nav', 'actions'], notes: 'Ozel header componenti — shadcn layout yok, proje icinde olustur' },
  { prdTerm: 'footer', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/layout/footer', props: ['links', 'copyright'], notes: 'Ozel footer componenti' },
  { prdTerm: 'liste', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/ui/list', props: ['items', 'renderItem'], notes: 'Liste gorunumu — Card veya custom' },
  { prdTerm: 'list', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/ui/list', props: ['items', 'renderItem'], notes: 'Liste gorunumu — Card veya custom' },
  { prdTerm: 'chart', shadcnComponent: 'Recharts', radixPrimitive: null, importPath: 'recharts', props: ['LineChart', 'BarChart', 'PieChart', 'AreaChart'], notes: 'Grafik — recharts kutuphanesi' },
  { prdTerm: 'grafik', shadcnComponent: 'Recharts', radixPrimitive: null, importPath: 'recharts', props: ['LineChart', 'BarChart', 'PieChart'], notes: 'Grafik — recharts kutuphanesi' },
];

export interface MappedComponent {
  term: string;
  component: string;
  importPath: string;
  radix: string | null;
  props: string[];
  notes: string;
}

export function mapComponentsFromPrd(prdContent: string): MappedComponent[] {
  const lower = prdContent.toLowerCase();
  const matched = new Set<string>();
  const results: MappedComponent[] = [];

  for (const mapping of COMPONENT_MAP) {
    if (lower.includes(mapping.prdTerm) && !matched.has(mapping.shadcnComponent)) {
      matched.add(mapping.shadcnComponent);
      results.push({
        term: mapping.prdTerm,
        component: mapping.shadcnComponent,
        importPath: mapping.importPath,
        radix: mapping.radixPrimitive,
        props: mapping.props,
        notes: mapping.notes,
      });
    }
  }

  return results;
}

export function generateComponentSection(mappings: MappedComponent[]): string {
  if (mappings.length === 0) return '';

  let md = '\n## Komponent Kutuphanesi Eslestirmesi\n\n';
  md += '| PRD Terimi | shadcn/ui | Import | Radix Primitive | Notlar |\n';
  md += '|------------|-----------|--------|-----------------|--------|\n';

  for (const m of mappings) {
    md += `| ${m.term} | \`${m.component}\` | \`${m.importPath}\` | ${m.radix ? `\`${m.radix}\`` : '-'} | ${m.notes} |\n`;
  }

  md += '\n### Kullanim Detaylari\n\n';
  for (const m of mappings) {
    md += `**${m.component}** (\`${m.importPath}\`)\n`;
    md += `- Props: ${m.props.join(', ')}\n`;
    if (m.radix) md += `- Radix primitive: \`${m.radix}\`\n`;
    md += '\n';
  }

  return md;
}
