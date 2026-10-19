export interface NavItem {
  label: string;
  route: string;
  icon: string;
  isMainTab?: boolean;
}

export const APP_NAV_ITEMS: NavItem[] = [
  { label: 'Início', route: '/dashboard', icon: 'home-outline', isMainTab: true },
  { label: 'Lançamentos', route: '/lancamentos', icon: 'list-outline', isMainTab: true },
  { label: 'Contas Planejadas', route: '/contasPlanejadas', icon: 'wallet-outline', isMainTab: true },
  { label: 'Mais', route: '/mais', icon: 'ellipsis-horizontal', isMainTab: true },

  // Itens complementares da Sidebar Desktop
  { label: 'Cartões', route: '/cartoes', icon: 'card-outline' },
  { label: 'Empréstimos', route: '/emprestimos', icon: 'cash-outline' },
  { label: 'Categorias', route: '/categorias', icon: 'pricetag-outline' },
  { label: 'Contas a Pagar', route: '/contas-pagar', icon: 'card-outline' },
  { label: 'Contas a Receber', route: '/contas-receber', icon: 'arrow-down-circle-outline' },
  { label: 'Relatórios', route: '/relatorios', icon: 'bar-chart-outline' },
  { label: 'Configurações', route: '/configuracoes', icon: 'settings-outline' },
];