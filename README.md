# Bleu-Bank
--- 
Este repositório contém uma aplicação que simula um **banco digital**, no qual as suas operações são realizadas via **chatbot do Whatsapp**, utilizando a API: https://github.com/pedroslopez/whatsapp-web.js para integração do chatbot e implementação de **pagamentos via qrcode** com a API: https://github.com/ceciliadeveza/gerarqrcodepix. A aplicação utiliza a biblioteca "pdfmake" para criação de comprovantes de pagamento. Os dados das transações são enviados através da plataforma de automação **Make** para uma planilha do **Google Sheets**, podendo ser consultadas posteriormente (este trecho de código pode ser alterado livremente no arquivo "script.js".

# Demonstração Visual 🔎
![inicio](static/assets/index.png)
![login1](static/assets/login.png)
![foto1](static/assets/inicio.png)

# Tecnologias Utilizadas 💻
- **HTML:** Estruturação do Web Chat
- **CSS:** Estilização do Web CHat
- **Python:** Linguagem utilizada para incialização do servidor e navegação por rotas
- **Javascript:** Linguagem de programação utilizada para construção da aplicação, integração da API de chatbot do Whatsapp e biblioteca **pdfmake**
- **Node.Js:** Inicialização da API do chatbot e instalação de bibliotecas utilizadas com JavaScript
- **SQLite:** Banco de dados utilizado para armazenamento do estado das conversas
- **Make:** Envio de dados de transferência automaticamente para uma planilha
- **Google Sheets:** Tabela de armazenamento de dados simples

# Pré-Requisitos ⚙
- Python instalado na máquina.
- Biblioteca Flask instalada.
- Instalação do terminal qrcode.
- Instalação da API de chatbot do Whatsapp.
- Instalação da biblioteca de integração do SQLite.
- Instalação da biblioteca "axios" para automação com o make.
- Instalação da biblioteca "pdfmake" para gerar comprovantes.

