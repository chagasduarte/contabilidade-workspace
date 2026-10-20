import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonAccordion,
  IonAccordionGroup,
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
  IonMenuButton,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  closeOutline,
  folderOpenOutline,
  pencilOutline,
  pricetagOutline,
  trashOutline,
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
    IonMenuButton,
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

  // Campos do formulário de categoria
  formCategoriaNome = '';
  formCategoriaTipo: TipoCategoria = 'despesa';
  formCategoriaCor = '#3880ff';
  formCategoriaIcone = 'pricetag-outline';

  // Campos do formulário de subcategoria
  formSubcategoriaNome = '';
  formSubcategoriaCor = '#3880ff';
  formSubcategoriaIcone = 'pricetag-outline';

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
      pencilOutline,
      trashOutline,
      folderOpenOutline,
      pricetagOutline,
      closeOutline,
    });
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
    this.formCategoriaNome = '';
    const filtroAtual = this.tipoFiltro();
    this.formCategoriaTipo = filtroAtual === 'receita' ? 'receita' : 'despesa';
    this.formCategoriaCor = this.formCategoriaTipo === 'receita' ? '#2dd36f' : '#3880ff';
    this.formCategoriaIcone = 'pricetag-outline';
    this.modalCategoriaAberto.set(true);
  }

  abrirEditarCategoria(categoria: Categoria, event?: Event): void {
    event?.stopPropagation();
    this.categoriaEmEdicao.set(categoria);
    this.formCategoriaNome = categoria.nome;
    this.formCategoriaTipo = categoria.tipo ?? 'despesa';
    this.formCategoriaCor = categoria.cor || '#3880ff';
    this.formCategoriaIcone = categoria.icone || 'pricetag-outline';
    this.modalCategoriaAberto.set(true);
  }

  fecharModalCategoria(): void {
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
      });
    } else {
      this.categoriaService.criarCategoria(dto).subscribe({
        next: (nova) => {
          this.fecharModalCategoria();
          if (nova?.id) {
            this.carregarSubcategorias(nova.id);
          }
        },
      });
    }
  }

  confirmarExcluirCategoria(categoria: Categoria, event?: Event): void {
    event?.stopPropagation();
    const confirmado = confirm(
      `Deseja realmente excluir a categoria "${categoria.nome}" e suas subcategorias?`
    );
    if (!confirmado) return;

    this.categoriaService.removerCategoria(categoria.id).subscribe({
      next: () => {
        this.subcategoriasMap.update((mapa) => {
          const novo = { ...mapa };
          delete novo[categoria.id];
          return novo;
        });
      },
    });
  }

  // --- Operações de Subcategoria ---

  abrirNovaSubcategoria(categoria: Categoria, event?: Event): void {
    event?.stopPropagation();
    this.categoriaSelecionadaParaSub.set(categoria);
    this.subcategoriaEmEdicao.set(null);
    this.formSubcategoriaNome = '';
    this.formSubcategoriaCor = categoria.cor || '#3880ff';
    this.formSubcategoriaIcone = 'pricetag-outline';
    this.modalSubcategoriaAberto.set(true);
  }

  abrirEditarSubcategoria(subcategoria: Subcategoria): void {
    this.subcategoriaEmEdicao.set(subcategoria);
    this.formSubcategoriaNome = subcategoria.nome;
    this.formSubcategoriaCor = subcategoria.cor || '#3880ff';
    this.formSubcategoriaIcone = subcategoria.icone || 'pricetag-outline';
    this.modalSubcategoriaAberto.set(true);
  }

  fecharModalSubcategoria(): void {
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
      });
    }
  }

  confirmarExcluirSubcategoria(subcategoria: Subcategoria): void {
    const confirmado = confirm(
      `Deseja realmente excluir a subcategoria "${subcategoria.nome}"?`
    );
    if (!confirmado) return;

    this.categoriaService.removerSubcategoria(subcategoria.id).subscribe({
      next: () => {
        const catId = subcategoria.idcategoria;
        this.subcategoriasMap.update((mapa) => ({
          ...mapa,
          [catId]: (mapa[catId] ?? []).filter((s) => s.id !== subcategoria.id),
        }));
      },
    });
  }
}
