SiteView — Visualizador de Projetos Web

Sobre o projeto

O SiteView é um visualizador local de projetos web criado para facilitar a rotina de quem está desenvolvendo sites e precisa conferir o resultado rapidamente.

A proposta é simples: **visualizar um projeto antes de publicá-lo**. Em vez de precisar enviar o site para um servidor, publicar uma nova versão ou realizar etapas extras apenas para conferir uma alteração, o desenvolvedor pode carregar o projeto no SiteView e abrir uma visualização diretamente no navegador.

Isso ajuda a economizar tempo, reduzir tarefas repetitivas e diminuir o estresse durante o desenvolvimento, principalmente quando são necessárias muitas alterações e testes rápidos.

> O SiteView foi pensado como uma ferramenta prática de apoio ao desenvolvimento: editar, salvar, atualizar e visualizar novamente, com o mínimo de interrupções possível.

Principais recursos

- Carregamento de pastas completas.
- Importação de arquivos individuais.
- Importação de projetos em ZIP.
- Arrastar e soltar arquivos e pastas quando suportado pelo navegador.
- Detecção automática de `index.html`.
- Seleção de outras páginas HTML como entrada.
- Visualização sem precisar publicar o projeto.
- Atualização da visualização sem fechar a tela de preview quando a origem permite reutilização da pasta.
- Preparação de caminhos locais para HTML, CSS e JavaScript.
- Suporte a módulos JavaScript e referências relativas.
- Processamento de imagens, fontes, áudio, vídeo e outros recursos locais compatíveis.
- Tratamento de `srcset` e URLs em CSS.
- Modos de visualização para desktop, tablet e celular.
- Diagnóstico básico de erros de JavaScript durante a visualização.
- Tela de carregamento para informar o processamento do sistema.
- PWA instalável em navegadores compatíveis.
- Interface responsiva para telas menores.

Como usar

1. Carregar um projeto

Na tela principal, escolha uma das opções disponíveis:

- **Selecionar pasta** — recomendado para projetos em desenvolvimento, pois permite utilizar a função de atualização com a pasta original.
- **Arquivos / ZIP** — útil para arquivos individuais ou projetos compactados.
- **Arrastar e soltar** — quando o navegador oferecer suporte.

O SiteView procura automaticamente uma página HTML de entrada, dando preferência a `index.html`.

### 2. Visualizar

Depois que o projeto for processado, selecione **Visualizar site**.

A visualização é aberta em uma tela própria, com controles para:

- atualizar o projeto;
- alternar entre desktop, tablet e celular;
- voltar ao painel principal.

### 3. Atualizar durante o desenvolvimento

Quando o projeto foi carregado por uma pasta com uma referência reutilizável, o fluxo recomendado é:

**Editar → salvar → voltar ao SiteView → Atualizar**

O SiteView relê os arquivos disponíveis e reconstrói a visualização sem exigir que o preview seja fechado e aberto novamente.

## Estrutura do projeto

A versão está organizada para facilitar a manutenção:

```text
SiteView_2_6/
├── index.html              # Estrutura da interface principal
├── manifest.json           # Configuração do aplicativo/PWA
├── sw.js                   # Service Worker e cache do PWA
├── favicon-64.png          # Favicon
├── icon-192.png            # Ícone PWA 192×192
├── icon-512.png            # Ícone PWA 512×512
├── assets/
│   ├── css/
│   │   └── style.css      # Todo o estilo visual da interface
│   └── js/
│       └── app.js         # Lógica principal do SiteView
└── README.md               # Documentação do projeto
```

Compatibilidade e limitações

O SiteView foi projetado principalmente para **projetos web front-end que possam ser executados no navegador**.

Projetos que dependem de tecnologias de servidor, como PHP, Node.js, Python, banco de dados, APIs privadas ou outros serviços de backend, continuam precisando do ambiente correspondente. Um visualizador executado somente no navegador não substitui esse servidor.

Recursos externos também podem depender de conexão com a internet, políticas do navegador ou permissões do próprio serviço.

Instalação como aplicativo

O SiteView possui suporte a **PWA (Progressive Web App).

Quando o navegador atender aos requisitos necessários, a opção **Instalar** poderá ser utilizada para adicionar o SiteView como aplicativo.

A disponibilidade da instalação depende do navegador e do ambiente utilizado, incluindo HTTPS ou localhost, manifesto válido e Service Worker ativo.

Privacidade

O objetivo do SiteView é processar os arquivos do projeto **localmente no navegador**. O SiteView não precisa publicar o projeto para realizar a visualização.

Isso não significa que recursos externos usados pelo próprio projeto deixem de realizar suas próprias conexões. Por exemplo, uma página que carregue uma fonte, imagem, biblioteca ou API externa continuará sujeita ao comportamento desse serviço.

Versão

SiteView 2.10.0**

Esta versão mantém as funcionalidades da versão anterior e reorganiza o código para facilitar futuras alterações e manutenção, separando a estrutura HTML, os estilos CSS e a lógica JavaScript.

Objetivo

O SiteView nasceu de uma necessidade prática do desenvolvimento web: ver rapidamente o que está sendo construído sem precisar publicar o projeto a cada alteração.

A ferramenta busca tornar esse ciclo mais simples:

**desenvolver → salvar → visualizar → ajustar → atualizar**

Menos etapas desnecessárias significam mais tempo para desenvolver e testar o projeto.


Autoria, direitos e distribuição

SiteView — Visualizador de Projetos** é um projeto desenvolvido por PRMdL.

© 2026 PRMdL. Todos os direitos reservados.**

O código-fonte, a estrutura do projeto, a interface, a identidade visual e os demais elementos originais desenvolvidos para o SiteView pertencem ao autor. Este projeto não é disponibilizado como software de código aberto nem sob uma licença que permita sua livre redistribuição.

Não é permitida, sem autorização do autor, a **cópia, reprodução, distribuição, redistribuição, publicação, comercialização, edição, alteração, adaptação ou criação de versões derivadas** do código ou de partes substanciais do projeto para posterior publicação ou distribuição.

O uso do SiteView não transfere a terceiros os direitos sobre seu código, design, identidade visual ou demais elementos originais.

### Edição do código

O código pode ser analisado pelo desenvolvedor para manutenção e evolução do próprio projeto. Qualquer versão modificada destinada a ser publicada, compartilhada, redistribuída ou apresentada como um projeto próprio depende de autorização do autor.

### Desenvolvedor

PRMdL

SiteView — Visualizador de Projetos

© 2026 PRMdL — Todos os direitos reservados.

Referências legais

Direitos autorais e proteção de programas de computador: Lei nº 9.610/1998, arts. 7º, 28 e 29; * nº 9.609/1998, art. 2º.
