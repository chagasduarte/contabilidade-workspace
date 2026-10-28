import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  airplaneOutline,
  alertCircleOutline,
  bagHandleOutline,
  barbellOutline,
  bedOutline,
  beerOutline,
  bicycleOutline,
  bookOutline,
  briefcaseOutline,
  busOutline,
  businessOutline,
  cafeOutline,
  calculatorOutline,
  callOutline,
  carOutline,
  cardOutline,
  cartOutline,
  cashOutline,
  closeOutline,
  constructOutline,
  cutOutline,
  fastFoodOutline,
  filmOutline,
  fitnessOutline,
  flashOutline,
  folderOpenOutline,
  gameControllerOutline,
  giftOutline,
  heartOutline,
  homeOutline,
  laptopOutline,
  medkitOutline,
  musicalNotesOutline,
  nutritionOutline,
  pawOutline,
  pencilOutline,
  phonePortraitOutline,
  pieChartOutline,
  pizzaOutline,
  pricetagOutline,
  receiptOutline,
  restaurantOutline,
  schoolOutline,
  shieldCheckmarkOutline,
  shirtOutline,
  statsChartOutline,
  storefrontOutline,
  ticketOutline,
  trainOutline,
  trashOutline,
  trendingDownOutline,
  trendingUpOutline,
  tvOutline,
  walletOutline,
  waterOutline,
  wifiOutline,
  wineOutline,
} from 'ionicons/icons';
import {
  Categoria,
  CreateCategoriaDto,
  CreateSubcategoriaDto,
  Subcategoria,
  TipoCategoria,
  UpdateCategoriaDto,
  UpdateSubcategoriaDto,
} from '@contabilidade/models';
import { CategoriaService } from '../../core/services/categoria.service';

type FiltroTipo = 'todas' | 'despesa' | 'receita';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonAccordionGroup,
    IonAccordion,
    IonItem,
    IonList,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonIcon,
    IonBadge,
    IonSpinner,
    IonNote,
    IonFab,
    IonFabButton,
    IonModal,
    IonInput,
    IonSelect,
    IonSelectOption,
  ],
  templateUrl: './categorias.page.html',
  styleUrl: './categorias.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriasPage implements OnInit {
  private readonly categoriaService = inject(CategoriaService);
  private readonly alertController = inject(AlertController);
  private readonly toastController = inject(ToastController);

  readonly categorias = this.categoriaService.categorias;
  readonly loading = this.categoriaService.loading;
  readonly error = this.categoriaService.error;

  readonly tipoFiltro = signal<FiltroTipo>('todas');
  readonly subcategoriasMap = signal<Record<number, Subcategoria[]>>({});

  readonly modalCategoriaAberto = signal<boolean>(false);
  readonly categoriaEmEdicao = signal<Categoria | null>(null);

  readonly modalSubcategoriaAberto = signal<boolean>(false);
  readonly subcategoriaEmEdicao = signal<Subcategoria | null>(null);
  readonly categoriaSelecionadaParaSub = signal<Categoria | null>(null);
  /** Mensagem de erro exibida dentro do modal aberto (409 duplicado, 403, 400...). */
  readonly erroFormulario = signal<string | null>(null);

  // Campos do formulário de categoria
  formCategoriaNome = '';
  formCategoriaTipo: TipoCategoria = 'despesa';
  formCategoriaCor = '#3880ff';
  formCategoriaIcone = 'pricetag-outline';

  // Campos do formulário de subcategoria
  formSubcategoriaNome = '';
  formSubcategoriaCor = '#3880ff';
  formSubcategoriaIcone = 'pricetag-outline';

  readonly iconesDisponiveis: readonly string[] = [
    'pricetag-outline',
    'cart-outline',
    'bag-handle-outline',
    'storefront-outline',
    'restaurant-outline',
    'fast-food-outline',
    'cafe-outline',
    'pizza-outline',
    'beer-outline',
    'wine-outline',
    'nutrition-outline',
    'home-outline',
    'bed-outline',
    'flash-outline',
    'water-outline',
    'wifi-outline',
    'call-outline',
    'phone-portrait-outline',
    'tv-outline',
    'construct-outline',
    'car-outline',
    'bus-outline',
    'train-outline',
    'airplane-outline',
    'bicycle-outline',
    'medkit-outline',
    'fitness-outline',
    'heart-outline',
    'barbell-outline',
    'school-outline',
    'book-outline',
    'game-controller-outline',
    'film-outline',
    'musical-notes-outline',
    'ticket-outline',
    'shirt-outline',
    'cut-outline',
    'gift-outline',
    'paw-outline',
    'cash-outline',
    'wallet-outline',
    'card-outline',
    'trending-up-outline',
    'trending-down-outline',
    'stats-chart-outline',
    'pie-chart-outline',
    'receipt-outline',
    'calculator-outline',
    'briefcase-outline',
    'business-outline',
    'laptop-outline',
    'shield-checkmark-outline',
  ];

  readonly categoriasFiltradas = computed(() => {
    const lista = this.categorias();
    const filtro = this.tipoFiltro();

    if (filtro === 'todas') {
      return lista;
    }

    return lista.filter((c) => (c.tipo ?? 'despesa') === filtro);
  });

  constructor() {
    addIcons({
      addOutline,
      airplaneOutline,
      alertCircleOutline,
      bagHandleOutline,
      barbellOutline,
      bedOutline,
      beerOutline,
      bicycleOutline,
      bookOutline,
      briefcaseOutline,
      busOutline,
      businessOutline,
      cafeOutline,
      calculatorOutline,
      callOutline,
      carOutline,
      cardOutline,
      cartOutline,
      cashOutline,
      closeOutline,
      constructOutline,
      cutOutline,
      fastFoodOutline,
      filmOutline,
      fitnessOutline,
      flashOutline,
      folderOpenOutline,
      gameControllerOutline,
      giftOutline,
      heartOutline,
      homeOutline,
      laptopOutline,
      medkitOutline,
      musicalNotesOutline,
      nutritionOutline,
      pawOutline,
      pencilOutline,
      phonePortraitOutline,
      pieChartOutline,
      pizzaOutline,
      pricetagOutline,
      receiptOutline,
      restaurantOutline,
      schoolOutline,
      shieldCheckmarkOutline,
      shirtOutline,
      statsChartOutline,
      storefrontOutline,
      ticketOutline,
      trainOutline,
      trashOutline,
      trendingDownOutline,
      trendingUpOutline,
      tvOutline,
      walletOutline,
      waterOutline,
      wifiOutline,
      wineOutline,
    });
  }

  selecionarIconeCategoria(icone: string): void {
    this.formCategoriaIcone = icone;
  }

  selecionarIconeSubcategoria(icone: string): void {
    this.formSubcategoriaIcone = icone;
  }

  ngOnInit(): void {
    this.carregarCategorias();
  }

  carregarCategorias(): void {
    this.categoriaService.listarCategorias().subscribe({
      next: (cats) => {
        cats.forEach((cat) => this.carregarSubcategorias(cat.id));
      },
    });
  }

  carregarSubcategorias(categoriaId: number): void {
    this.categoriaService.listarSubcategorias(categoriaId).subscribe({
      next: (subs) => {
        this.subcategoriasMap.update((mapa) => ({
          ...mapa,
          [categoriaId]: subs,
        }));
      },
    });
  }

  /** Itens com `userid === null` são padrão do sistema e não podem ser alterados. */
  isPadrao(item: Categoria | Subcategoria): boolean {
    return item.userid === null;
  }

  private mensagemErro(err: unknown, tipo: 'categoria' | 'subcategoria'): string {
    const http = err instanceof HttpErrorResponse ? err : null;
    const msgApi: string | undefined = http?.error?.erro;
    switch (http?.status) {
      case 409:
        return tipo === 'categoria'
          ? 'Já existe uma categoria sua com esse nome e tipo.'
          : 'Já existe uma subcategoria com esse nome nesta categoria.';
      case 403:
        return msgApi || 'Itens padrão do sistema não podem ser alterados.';
      case 404:
        return msgApi || `A ${tipo} não foi encontrada. Atualize a lista.`;
      case 0:
        return 'Sem conexão com o servidor. Tente novamente.';
      default:
        return msgApi || `Não foi possível salvar a ${tipo}.`;
    }
  }

  private async avisar(mensagem: string, color: 'danger' | 'success' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message: mensagem,
      duration: color === 'danger' ? 4000 : 2500,
      color,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }

  /** Confirmação destrutiva com ion-alert; resolve `true` só se o usuário confirmar. */
  private async confirmar(header: string, message: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Excluir', role: 'destructive', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  getSubcategorias(categoriaId: number): Subcategoria[] {
    return this.subcategoriasMap()[categoriaId] ?? [];
  }

  onFiltroChange(event: CustomEvent): void {
    const valor = event.detail.value as FiltroTipo | undefined;
    if (valor) {
      this.tipoFiltro.set(valor);
    }
  }

  onAccordionToggle(event: CustomEvent): void {
    const value = event.detail.value;
    if (value) {
      const idStr = Array.isArray(value) ? value[0] : value;
      const catId = Number(idStr);
      if (catId && !this.subcategoriasMap()[catId]) {
        this.carregarSubcategorias(catId);
      }
    }
  }

  // --- Operações de Categoria ---

  abrirNovaCategoria(): void {
    this.categoriaEmEdicao.set(null);
    this.erroFormulario.set(null);
    this.formCategoriaNome = '';
    const filtroAtual = this.tipoFiltro();
    this.formCategoriaTipo = filtroAtual === 'receita' ? 'receita' : 'despesa';
    this.formCategoriaCor = this.formCategoriaTipo === 'receita' ? '#2dd36f' : '#3880ff';
    this.formCategoriaIcone = 'pricetag-outline';
    this.modalCategoriaAberto.set(true);
  }

  abrirEditarCategoria(categoria: Categoria, event?: Event): void {
    event?.stopPropagation();
    if (this.isPadrao(categoria)) return;
    this.categoriaEmEdicao.set(categoria);
    this.erroFormulario.set(null);
    this.formCategoriaNome = categoria.nome;
    this.formCategoriaTipo = categoria.tipo ?? 'despesa';
    this.formCategoriaCor = categoria.cor || '#3880ff';
    this.formCategoriaIcone = categoria.icone || 'pricetag-outline';
    this.modalCategoriaAberto.set(true);
  }

  fecharModalCategoria(): void {
    this.erroFormulario.set(null);
    this.modalCategoriaAberto.set(false);
    this.categoriaEmEdicao.set(null);
  }

  salvarCategoria(): void {
    const nome = this.formCategoriaNome.trim();
    if (!nome) return;

    const dto: CreateCategoriaDto = {
      nome,
      tipo: this.formCategoriaTipo,
      cor: this.formCategoriaCor,
      icone: this.formCategoriaIcone,
    };

    const editando = this.categoriaEmEdicao();

    if (editando) {
      const updateDto: UpdateCategoriaDto = { ...dto };
      this.categoriaService.atualizarCategoria(editando.id, updateDto).subscribe({
        next: () => {
          this.fecharModalCategoria();
        },
        error: (err) => this.erroFormulario.set(this.mensagemErro(err, 'categoria')),
      });
    } else {
      this.categoriaService.criarCategoria(dto).subscribe({
        next: (nova) => {
          this.fecharModalCategoria();
          if (nova?.id) {
            this.carregarSubcategorias(nova.id);
          }
        },
        error: (err) => this.erroFormulario.set(this.mensagemErro(err, 'categoria')),
      });
    }
  }

  async confirmarExcluirCategoria(categoria: Categoria, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (this.isPadrao(categoria)) return;
    const confirmado = await this.confirmar(
      `Excluir "${categoria.nome}"?`,
      'As subcategorias dela também serão excluídas e os lançamentos que a usam ' +
        'ficarão sem categoria. Esta ação não pode ser desfeita.'
    );
    if (!confirmado) return;

    this.categoriaService.removerCategoria(categoria.id).subscribe({
      next: () => {
        this.subcategoriasMap.update((mapa) => {
          const novo = { ...mapa };
          delete novo[categoria.id];
          return novo;
        });
        this.avisar('Categoria excluída.', 'success');
      },
      error: (err) => this.avisar(this.mensagemErro(err, 'categoria')),
    });
  }

  // --- Operações de Subcategoria ---

  abrirNovaSubcategoria(categoria: Categoria, event?: Event): void {
    event?.stopPropagation();
    this.categoriaSelecionadaParaSub.set(categoria);
    this.subcategoriaEmEdicao.set(null);
    this.erroFormulario.set(null);
    this.formSubcategoriaNome = '';
    this.formSubcategoriaCor = categoria.cor || '#3880ff';
    this.formSubcategoriaIcone = 'pricetag-outline';
    this.modalSubcategoriaAberto.set(true);
  }

  abrirEditarSubcategoria(subcategoria: Subcategoria): void {
    if (this.isPadrao(subcategoria)) return;
    this.subcategoriaEmEdicao.set(subcategoria);
    this.erroFormulario.set(null);
    this.formSubcategoriaNome = subcategoria.nome;
    this.formSubcategoriaCor = subcategoria.cor || '#3880ff';
    this.formSubcategoriaIcone = subcategoria.icone || 'pricetag-outline';
    this.modalSubcategoriaAberto.set(true);
  }

  fecharModalSubcategoria(): void {
    this.erroFormulario.set(null);
    this.modalSubcategoriaAberto.set(false);
    this.subcategoriaEmEdicao.set(null);
    this.categoriaSelecionadaParaSub.set(null);
  }

  salvarSubcategoria(): void {
    const nome = this.formSubcategoriaNome.trim();
    if (!nome) return;

    const editando = this.subcategoriaEmEdicao();
    const categoria = this.categoriaSelecionadaParaSub();

    if (editando) {
      const updateDto: UpdateSubcategoriaDto = {
        nome,
        cor: this.formSubcategoriaCor,
        icone: this.formSubcategoriaIcone,
      };

      this.categoriaService
        .atualizarSubcategoria(editando.id, updateDto)
        .subscribe({
          next: (atualizada) => {
            const catId = editando.idcategoria;
            this.subcategoriasMap.update((mapa) => ({
              ...mapa,
              [catId]: (mapa[catId] ?? []).map((s) =>
                s.id === editando.id ? { ...s, ...atualizada, ...updateDto } : s
              ),
            }));
            this.fecharModalSubcategoria();
          },
          error: (err) => this.erroFormulario.set(this.mensagemErro(err, 'subcategoria')),
        });
    } else if (categoria) {
      const createDto: CreateSubcategoriaDto = {
        idcategoria: categoria.id,
        nome,
        cor: this.formSubcategoriaCor,
        icone: this.formSubcategoriaIcone,
      };

      this.categoriaService.criarSubcategoria(createDto).subscribe({
        next: (nova) => {
          this.subcategoriasMap.update((mapa) => ({
            ...mapa,
            [categoria.id]: [...(mapa[categoria.id] ?? []), nova],
          }));
          this.fecharModalSubcategoria();
        },
        error: (err) => this.erroFormulario.set(this.mensagemErro(err, 'subcategoria')),
      });
    }
  }

  async confirmarExcluirSubcategoria(subcategoria: Subcategoria): Promise<void> {
    if (this.isPadrao(subcategoria)) return;
    const confirmado = await this.confirmar(
      `Excluir "${subcategoria.nome}"?`,
      'Esta ação não pode ser desfeita.'
    );
    if (!confirmado) return;

    this.categoriaService.removerSubcategoria(subcategoria.id).subscribe({
      next: () => {
        const catId = subcategoria.idcategoria;
        this.subcategoriasMap.update((mapa) => ({
          ...mapa,
          [catId]: (mapa[catId] ?? []).filter((s) => s.id !== subcategoria.id),
        }));
        this.avisar('Subcategoria excluída.', 'success');
      },
      error: (err) => this.avisar(this.mensagemErro(err, 'subcategoria')),
    });
  }
}
