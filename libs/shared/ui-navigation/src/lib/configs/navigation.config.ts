export interface NavItem {
  label: string;
  route: string;
  icon: string;
  isMainTab?: boolean;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { label: 'Início', route: '/dashboard', icon: 'home-outline', isMainTab: true },
  { label: 'Lançamentos', route: '/lancamentos', icon: 'list-outline', isMainTab: true },
  { label: 'Planejamento', route: '/planejamento', icon: 'pie-chart-outline', isMainTab: true },
  { label: 'Mais', route: '/mais', icon: 'ellipsis-horizontal', isMainTab: true },

  // Itens complementares da Sidebar Desktop
  { label: 'Cartões', route: '/cartoes', icon: 'card-outline' },
  { label: 'Empréstimos', route: '/emprestimos', icon: 'cash-outline' },
  { label: 'Categorias', route: '/categorias', icon: 'pricetag-outline' },
  { label: 'Objetivos', route: '/objetivos', icon: 'flag-outline' },
  { label: 'Assistente IA', route: '/assistente', icon: 'sparkles-outline' },
  { label: 'Relatórios', route: '/relatorios', icon: 'bar-chart-outline' },
  { label: 'Meu perfil', route: '/perfil', icon: 'person-circle-outline' },
  { label: 'Configurações', route: '/configuracoes', icon: 'settings-outline' },
];
