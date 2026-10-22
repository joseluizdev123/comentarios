// Tipos da caixa de comentários (comentarios.js) para projetos em TypeScript.
// Copie junto com o comentarios.js e importe: import './comentarios.js';

export interface Comentario {
  id: string;
  /** Nome da parte da tela (data-comment-target, aria-label ou o texto dela). */
  alvo: string;
  /** Página onde foi feito (título da página). */
  onde: string;
  /** data-comment-ref mais próximo (ex.: número do pedido), ou null. */
  referencia: string | null;
  texto: string;
  /** Nome digitado ("Seu nome" / "Quem comentou"); vazio quando o claude.ai deu o nome. */
  pessoa: string;
  /** Id de quem comentou no claude.ai (o nome é buscado na hora de mostrar). */
  autorId: string | null;
  criadoEm: string;
  resolvido: boolean;
  resolvidoEm: string | null;
}

export interface Armazem {
  listar(): Promise<Comentario[]>;
  criar(dados: Omit<Comentario, 'id'>): Promise<Comentario>;
  atualizar(id: string, dados: Partial<Comentario>): Promise<Comentario>;
  observar?(aoMudar: () => void): () => void;
  eu?(): Promise<{ id: string | null; nome: string; podeGravar: boolean | null }>;
  nomes?(ids: string[]): Promise<Record<string, string>>;
}

export interface OpcoesCaixa {
  /** Automático: banco do artefato no claude.ai, este navegador fora dele. */
  armazem?: 'auto' | 'artefato' | 'local' | Armazem;
  /** Título do painel lateral. */
  titulo?: string;
  posicao?: 'inferior-esquerda' | 'inferior-direita';
  /** false: só a equipe resolve, então ninguém vê o "Marcar como resolvido" nesta página. */
  podeResolver?: boolean;
  /** false: sem os botões flutuantes (use os seus com comentar() / abrirPainel()). */
  botoes?: boolean;
  /** false: sem o botão "Comentários" flutuante (só o "Comentar"). */
  botaoPainel?: boolean;
  cores?: { primaria?: string; escuro?: string; destaque?: string };
  /** Troca qualquer texto da interface (veja TEXTOS em comentarios.js). */
  textos?: Record<string, string>;
  aoMudar?(comentarios: Comentario[]): void;
  aoComentar?(comentario: Comentario): void;
}

export interface CaixaDeComentariosApi {
  iniciar(opcoes?: OpcoesCaixa): CaixaDeComentariosApi;
  parar(): void;
  /** Entra no modo de apontar (o mesmo que o botão Comentar). */
  comentar(): void;
  cancelar(): void;
  comentando(): boolean;
  abrirPainel(): void;
  /** Desenha formulário + lista dentro de um elemento seu; devolve a função que desmonta. */
  montarPainel(elemento: HTMLElement, opcoes?: { formulario?: boolean }): () => void;
  recarregar(): Promise<void>;
  lista(): Comentario[];
}

declare global {
  interface Window {
    CaixaDeComentarios: CaixaDeComentariosApi;
  }
  const CaixaDeComentarios: CaixaDeComentariosApi;
}
