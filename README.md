# SiteView 2.3

Visualizador local de projetos web.

## Atualização 2.3
- Mantém as funcionalidades da versão 2.2.
- A opção **Instalar** permanece na barra superior, junto de **Sobre** e **Limpar**.
- Ao tocar em **Instalar**, abre uma janela própria com descrição da instalação, benefícios, status e ação para instalar.
- Quando o navegador disponibiliza `beforeinstallprompt`, o botão **Instalar SiteView** inicia a instalação.
- Quando o navegador não disponibiliza o prompt automático, a janela explica como instalar pelo menu do navegador/adicionar à tela inicial.
- O ícone atual do SiteView é mantido.

## Limitação do navegador
A instalação PWA depende de HTTPS/localhost, manifest válido, service worker e dos critérios do navegador. Nem todo navegador oferece o prompt automático em todas as situações.
