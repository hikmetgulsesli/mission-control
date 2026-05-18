/**
 * Component library mapping for PRD UI component requests.
 * Maps PRD terms to shadcn/ui and Radix primitives.
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
  { prdTerm: 'card', shadcnComponent: 'Card', radixPrimitive: null, importPath: '@/components/ui/card', props: ['CardHeader', 'CardContent', 'CardFooter', 'CardTitle', 'CardDescription'], notes: 'Content cards' },
  { prdTerm: 'sidebar', shadcnComponent: 'Sheet', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/sheet', props: ['SheetTrigger', 'SheetContent', 'SheetHeader', 'SheetTitle'], notes: 'Mobile sidebar or side panel' },

  // Navigation
  { prdTerm: 'tab', shadcnComponent: 'Tabs', radixPrimitive: '@radix-ui/react-tabs', importPath: '@/components/ui/tabs', props: ['TabsList', 'TabsTrigger', 'TabsContent'], notes: 'Tabbed navigation' },
  { prdTerm: 'nav', shadcnComponent: 'NavigationMenu', radixPrimitive: '@radix-ui/react-navigation-menu', importPath: '@/components/ui/navigation-menu', props: ['NavigationMenuList', 'NavigationMenuItem', 'NavigationMenuTrigger', 'NavigationMenuContent'], notes: 'Primary navigation menu' },
  { prdTerm: 'breadcrumb', shadcnComponent: 'Breadcrumb', radixPrimitive: null, importPath: '@/components/ui/breadcrumb', props: ['BreadcrumbList', 'BreadcrumbItem', 'BreadcrumbLink', 'BreadcrumbSeparator'], notes: 'Page path indicator' },

  // Actions
  { prdTerm: 'button', shadcnComponent: 'Button', radixPrimitive: null, importPath: '@/components/ui/button', props: ['variant: default|destructive|outline|secondary|ghost|link', 'size: default|sm|lg|icon'], notes: 'All button variants' },
  { prdTerm: 'dropdown', shadcnComponent: 'DropdownMenu', radixPrimitive: '@radix-ui/react-dropdown-menu', importPath: '@/components/ui/dropdown-menu', props: ['DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuSeparator'], notes: 'Dropdown menu' },
  { prdTerm: 'menu', shadcnComponent: 'DropdownMenu', radixPrimitive: '@radix-ui/react-dropdown-menu', importPath: '@/components/ui/dropdown-menu', props: ['DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem'], notes: 'Options menu' },

  // Forms
  { prdTerm: 'input', shadcnComponent: 'Input', radixPrimitive: null, importPath: '@/components/ui/input', props: ['type', 'placeholder', 'disabled'], notes: 'Single-line text input' },
  { prdTerm: 'form', shadcnComponent: 'Form', radixPrimitive: null, importPath: '@/components/ui/form', props: ['FormField', 'FormItem', 'FormLabel', 'FormControl', 'FormMessage'], notes: 'React Hook Form integration' },
  { prdTerm: 'textarea', shadcnComponent: 'Textarea', radixPrimitive: null, importPath: '@/components/ui/textarea', props: ['placeholder', 'rows', 'disabled'], notes: 'Multi-line text input' },
  { prdTerm: 'select', shadcnComponent: 'Select', radixPrimitive: '@radix-ui/react-select', importPath: '@/components/ui/select', props: ['SelectTrigger', 'SelectContent', 'SelectItem', 'SelectValue'], notes: 'Selection list' },
  { prdTerm: 'checkbox', shadcnComponent: 'Checkbox', radixPrimitive: '@radix-ui/react-checkbox', importPath: '@/components/ui/checkbox', props: ['checked', 'onCheckedChange', 'disabled'], notes: 'Checkbox control' },
  { prdTerm: 'switch', shadcnComponent: 'Switch', radixPrimitive: '@radix-ui/react-switch', importPath: '@/components/ui/switch', props: ['checked', 'onCheckedChange'], notes: 'On/off toggle' },
  { prdTerm: 'toggle', shadcnComponent: 'Switch', radixPrimitive: '@radix-ui/react-switch', importPath: '@/components/ui/switch', props: ['checked', 'onCheckedChange'], notes: 'Toggle switch' },
  { prdTerm: 'slider', shadcnComponent: 'Slider', radixPrimitive: '@radix-ui/react-slider', importPath: '@/components/ui/slider', props: ['value', 'onValueChange', 'min', 'max', 'step'], notes: 'Value slider' },
  { prdTerm: 'datepicker', shadcnComponent: 'Calendar + Popover', radixPrimitive: null, importPath: '@/components/ui/calendar', props: ['selected', 'onSelect', 'mode'], notes: 'Date picker with Calendar and Popover' },

  // Feedback
  { prdTerm: 'modal', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter'], notes: 'Popup or modal window' },
  { prdTerm: 'dialog', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent', 'DialogHeader', 'DialogTitle', 'DialogDescription'], notes: 'Confirmation or information dialog' },
  { prdTerm: 'popup', shadcnComponent: 'Dialog', radixPrimitive: '@radix-ui/react-dialog', importPath: '@/components/ui/dialog', props: ['DialogTrigger', 'DialogContent'], notes: 'Popup window' },
  { prdTerm: 'alert', shadcnComponent: 'Alert', radixPrimitive: null, importPath: '@/components/ui/alert', props: ['AlertTitle', 'AlertDescription', 'variant: default|destructive'], notes: 'Notification or warning box' },
  { prdTerm: 'toast', shadcnComponent: 'Toast', radixPrimitive: '@radix-ui/react-toast', importPath: '@/components/ui/toast', props: ['title', 'description', 'variant', 'action'], notes: 'Temporary toast notification' },
  { prdTerm: 'tooltip', shadcnComponent: 'Tooltip', radixPrimitive: '@radix-ui/react-tooltip', importPath: '@/components/ui/tooltip', props: ['TooltipTrigger', 'TooltipContent'], notes: 'Hover help bubble' },
  { prdTerm: 'popover', shadcnComponent: 'Popover', radixPrimitive: '@radix-ui/react-popover', importPath: '@/components/ui/popover', props: ['PopoverTrigger', 'PopoverContent'], notes: 'Click-open information bubble' },
  { prdTerm: 'progress', shadcnComponent: 'Progress', radixPrimitive: '@radix-ui/react-progress', importPath: '@/components/ui/progress', props: ['value', 'max'], notes: 'Progress indicator' },
  { prdTerm: 'skeleton', shadcnComponent: 'Skeleton', radixPrimitive: null, importPath: '@/components/ui/skeleton', props: ['className'], notes: 'Loading placeholder' },

  // Data Display
  { prdTerm: 'table', shadcnComponent: 'Table', radixPrimitive: null, importPath: '@/components/ui/table', props: ['TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell'], notes: 'Data table' },
  { prdTerm: 'badge', shadcnComponent: 'Badge', radixPrimitive: null, importPath: '@/components/ui/badge', props: ['variant: default|secondary|destructive|outline'], notes: 'Badge or label' },
  { prdTerm: 'avatar', shadcnComponent: 'Avatar', radixPrimitive: '@radix-ui/react-avatar', importPath: '@/components/ui/avatar', props: ['AvatarImage', 'AvatarFallback'], notes: 'Profile image or avatar' },
  { prdTerm: 'accordion', shadcnComponent: 'Accordion', radixPrimitive: '@radix-ui/react-accordion', importPath: '@/components/ui/accordion', props: ['AccordionItem', 'AccordionTrigger', 'AccordionContent', 'type: single|multiple'], notes: 'Expandable content' },
  { prdTerm: 'carousel', shadcnComponent: 'Carousel', radixPrimitive: null, importPath: '@/components/ui/carousel', props: ['CarouselContent', 'CarouselItem', 'CarouselPrevious', 'CarouselNext'], notes: 'Image or content slider' },
  { prdTerm: 'separator', shadcnComponent: 'Separator', radixPrimitive: '@radix-ui/react-separator', importPath: '@/components/ui/separator', props: ['orientation: horizontal|vertical'], notes: 'Separator line' },
  { prdTerm: 'scroll-area', shadcnComponent: 'ScrollArea', radixPrimitive: '@radix-ui/react-scroll-area', importPath: '@/components/ui/scroll-area', props: ['className'], notes: 'Custom scroll area' },

  // Special
  { prdTerm: 'command', shadcnComponent: 'Command', radixPrimitive: 'cmdk', importPath: '@/components/ui/command', props: ['CommandInput', 'CommandList', 'CommandItem', 'CommandGroup'], notes: 'Search and command palette' },
  { prdTerm: 'header', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/layout/header', props: ['logo', 'nav', 'actions'], notes: 'Custom header component' },
  { prdTerm: 'footer', shadcnComponent: 'Custom', radixPrimitive: null, importPath: '@/components/layout/footer', props: ['links', 'copyright'], notes: 'Custom footer component' },
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

  let md = '\n## Component Library Mapping\n\n';
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
