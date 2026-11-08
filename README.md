# Wes Sudoku

Sudoku em HTML, CSS e JavaScript puro: é uma página estática, sem build e sem dependências, pronta para o GitHub Pages.

## Funcionalidades

- **4 dificuldades**: Fácil, Médio, Difícil e Especialista. Cada jogo é gerado na hora e tem **solução única**.
- **Anotações**: no modo anotação você marca os números possíveis em cada casa. Ao colocar um número, ele some das anotações da mesma linha, coluna e bloco.
- **Auto-notas**: preenche todas as casas vazias com os números possíveis.
- **Dicas**: revelam a casa selecionada ou, se nenhuma estiver selecionada, a casa mais fácil do tabuleiro. A quantidade depende da dificuldade (5 / 4 / 3 / 2).
- **Limite de erros**: 5 no Fácil, 4 no Médio, 3 no Difícil e 2 no Especialista. Ao atingir o limite o jogo acaba e é preciso começar de novo (outro jogo ou o mesmo do zero).
- **Tema claro e escuro**: segue o sistema por padrão e lembra a sua escolha.
- **Erros**: números repetidos ficam em vermelho. Com a opção "Destacar números errados" ligada, todo número errado também fica destacado.
- Desfazer, cronômetro com pausa, recorde por dificuldade (só conta jogo sem dicas) e progresso salvo no navegador.
- Funciona no celular e no computador.

### Atalhos de teclado

| Tecla | Ação |
| --- | --- |
| `1`–`9` | Coloca o número |
| `Shift` + `1`–`9` | Anota o número (sem trocar de modo) |
| `N` | Liga/desliga o modo anotação |
| `H` | Dica |
| `Backspace` / `Delete` / `0` | Apaga |
| `Ctrl` + `Z` | Desfaz |
| Setas | Movem a seleção |
| `P` | Pausa |

## Rodar localmente

Abra o `index.html` no navegador ou suba um servidor estático:

```bash
python3 -m http.server 8000
```

## Publicar no GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Selecione o branch (por exemplo `main`) e a pasta `/ (root)`, e salve.
4. Em alguns minutos o jogo estará em `https://<seu-usuario>.github.io/wes-sudoku/`.

## Estrutura

```
index.html      Página
css/style.css   Estilos e temas
js/sudoku.js    Gerador e solucionador
js/app.js       Interface e lógica do jogo
```
