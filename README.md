# comentarios

Skill do Claude Code que põe uma caixa de comentários dentro de um sistema publicado como artefato no claude.ai.

O cliente clica em **Comentar**, aponta a parte da tela que quer mudar e escreve ali. Os comentários ficam no banco do próprio artefato, e quem foi convidado como **Editor** pelo e-mail comenta. Não usa Google Docs nem banco externo.

## Instalar

```bash
git clone https://github.com/joseluizdev123/comentarios.git ~/.claude/skills/comentarios
```

Ou baixe o ZIP (botão **Code → Download ZIP**) e descompacte numa pasta `comentarios` dentro de `~/.claude/skills/` (no Windows: `C:\Users\<você>\.claude\skills\comentarios`). Depois abra uma sessão nova do Claude Code.

## Usar

No Claude Code, digite `/comentarios` ou peça "põe a caixa de comentários nesse projeto". O Claude copia a caixa para o projeto, liga os botões, publica o artefato e explica como convidar quem vai comentar.

## O que tem

- `SKILL.md`: o passo a passo que o Claude segue.
- `assets/comentarios.js`: a caixa, num arquivo só e sem dependências.
- `assets/comentarios.d.ts`: as opções, para projetos em TypeScript.
- `assets/exemplo.html`: uma página de exemplo. Abra no navegador para ver a caixa funcionando; fora do claude.ai os comentários ficam salvos só nesse navegador.
