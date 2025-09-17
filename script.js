const qrcode = require('qrcode-terminal')
const { Client, buttons, list, MessageMedia } = require('whatsapp-web.js')
const client = new Client()
const { gerarComprovante } = require("./pdf");
const axios = require('axios')

// serviço de leitura do qr code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});
// apos isso ele diz que foi tudo certo
client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});
// E inicializa tudo 
client.initialize();

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('./sqlite/banco.db')

// Garante que a tabela exista logo na inicialização
db.run(`
    CREATE TABLE IF NOT EXISTS conversas (
        user_id TEXT PRIMARY KEY,
        etapa TEXT,
        chave_pix TEXT,
        valor REAL,
        emprestimo REAL,
        fatura REAL
    )
`);


function setEtapa(userId, etapa, extra = {}) {
    db.run(
        `INSERT INTO conversas (user_id, etapa, chave_pix, valor, emprestimo, fatura)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET 
            etapa=excluded.etapa, 
            chave_pix=excluded.chave_pix, 
            valor=excluded.valor,
            emprestimo=excluded.emprestimo,
            fatura=excluded.fatura`,
        [userId, etapa, extra.chave_pix || null, extra.valor || null, extra.emprestimo || null, extra.fatura || null]
    );
}



function getEtapa(userId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM conversas WHERE user_id=?`, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function resetEtapa(userId) {
    db.run(`DELETE FROM conversas WHERE user_id=?`, [userId]);
}


const delay = ms => new Promise(res => setTimeout(res, ms)); // Função que usamos para criar o delay entre uma ação e outra


client.on('message', async msg => {
    if (!msg.from.endsWith('@c.us')) return;

    const userId = msg.from;
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const name = contact.pushname.split(" ")[0];

    const estado = await getEtapa(userId);

    // Passo 1 - entrada
    if (msg.body.match(/(Transferência PIX)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Olá ${name}! Informe a *chave PIX* do destinatário:`);
        setEtapa(userId, 'aguardando_chave');
        return;
    }

    // lista fixa de clientes
    const clientes = [
        "João Silva (Itaú)",
        "Mariana Costa (Bradesco)",
        "Felipe Souza (Banco do Brasil)",
        "Camila Almeida (Santander)",
        "Rodrigo Oliveira (Caixa Econômica)",
        "Ana Beatriz Lima (Nubank)",
        "Gustavo Martins (Banco Inter)",
        "Larissa Rocha (Safra)",
        "Pedro Henrique Santos (BTG Pactual)",
        "Júlia Ferreira (Banrisul)",
        "Thiago Moreira (C6 Bank)",
        "Vanessa Ribeiro (Original)",
        "Rafael Castro (Mercado Pago)",
        "Lucas Carvalho (Banco Pan)",
        "Carolina Mendes (Sicredi)",
        "Bruno Araújo (Bleu Bank)",
        "Fernanda Nogueira (Bleu Bank)",
        "Eduardo Teixeira (Bleu Bank)",
        "Patrícia Gomes (Bleu Bank)",
        "André Pereira (Bleu Bank)"
    ];

    // Passo 2 - recebe chave pix
    if (estado?.etapa === 'aguardando_chave') {
        const chave = msg.body.trim();
        await chat.sendStateTyping();
        await delay(2000);

        // sorteia um cliente aleatório
        const clienteSorteado = clientes[Math.floor(Math.random() * clientes.length)];

        await client.sendMessage(
            userId,
            `✅ Chave PIX encontrada: *${chave}*\nNome: ${clienteSorteado}\n\nAgora digite o valor da transferência:`
        );

        setEtapa(userId, 'aguardando_valor', { chave_pix: chave });
        return;
    }

    // Passo 3 - recebe valor
    if (estado?.etapa === 'aguardando_valor') {
        const valor = parseFloat(msg.body.replace(',', '.'));
        if (isNaN(valor)) {
            await client.sendMessage(userId, `❌ Valor inválido. Por favor, digite apenas números (ex: 150.00)`);
            return;
        }

        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Você deseja transferir *R$ ${valor.toFixed(2)}* para a chave *${estado.chave_pix}*?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`);
        setEtapa(userId, 'aguardando_confirmacao', { chave_pix: estado.chave_pix, valor });
        return;
    }

    // Passo 4 - confirmação
    if (estado?.etapa === 'aguardando_confirmacao') {
        if (msg.body.toLowerCase() === 'sim') {
            await chat.sendStateTyping();
            await delay(2000);

            // Espera o PDF ser gerado
            const filePath = await gerarComprovante({
                titulo: "Comprovante de Transferência PIX",
                campos: [
                    ["Remetente", name,],
                    ["Chave Destinatário", estado.chave_pix,],
                    ["Valor", estado.valor,]
                    ["Data", new Date().toLocaleString()],
                    ["Protocolo", Math.floor(Math.random() * 999999)],
                ]
            });

            // Envia o PDF pelo WhatsApp
            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(userId, media, { caption: "📄 Seu comprovante PIX\n Muito obrigado por escolher o Bleu Bank, foi um prazer prestar serviços com você! 😉" });
            await registrarPedido("Transferência PIX", estado.valor, name)

            resetEtapa(userId);
        } else {
            await client.sendMessage(userId, `❌ Transferência cancelada.`);
            resetEtapa(userId);
        }
            return;
    }  
      
    if (msg.body.match(/(Solicitar Empréstimo)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Olá ${name}! Insira o valor que deseja pegar emprestado (O Bleu Bank conta com uma taxa de juros de 3,7% ao mês): `);
        setEtapa(userId, 'aguardando_valor_emprestimo');
        return;
    }

    if (estado?.etapa === 'aguardando_valor_emprestimo') {
        const emprestimo = parseFloat(msg.body.replace(',', '.'));
        if (isNaN(emprestimo)) {
            await client.sendMessage(userId, `❌ Valor inválido. Por favor, digite apenas números (ex: 150.00)`);
            return;
        }

        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Voce deseja pegar emprestado *R$ ${emprestimo.toFixed(2)}*?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`);
        setEtapa(userId, 'aguardando_confirmacao_emprestimo', { emprestimo });
        return;  
    }

    if (estado?.etapa === 'aguardando_confirmacao_emprestimo') {
        if (msg.body.toLowerCase() === 'sim') {
            await chat.sendStateTyping();
            await delay(2000);

            // Espera o PDF ser gerado
            const filePath = await gerarComprovante({
                titulo: "Comprovante de Empréstimo",
                campos: [
                    ["Remetente", "Blue Bank",],
                    ["Valor", estado.emprestimo,],
                    ["Recebedor", name,],
                    ["Data", new Date().toLocaleString()],
                    ["Protocolo", Math.floor(Math.random() * 999999)],
                ]
            });

            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(userId, media, { caption: "📄 Seu comprovante de empréstimo.\nMuito obrigado por escolher o Bleu Bank, foi um prazer prestar serviços com você! 😉" });

            await registrarPedido("Empréstimo", estado.emprestimo, name)
            resetEtapa(userId);
        } else {
            await client.sendMessage(userId, `❌ Transferência cancelada.`);
            resetEtapa(userId);
        }
        return;
    }

    let valor_fatura = Math.floor(Math.random() * 999);
    if (msg.body.match(/(Pagar Fatura)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Olá ${name}! A sua fatura está em atualmente: R$${valor_fatura}. Deseja pagar a sua fatura?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`,);
        setEtapa(userId, 'aguardando_confirmacao_fatura');
        return;
    }

    if (estado?.etapa === 'aguardando_confirmacao_fatura') {
        if (msg.body.toLowerCase() === 'sim') {
            await chat.sendStateTyping();
            await delay(2000);

            const filePath = 'static/assets/qrcode.png';

            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(userId, media, { caption: "A sua fatura pode ser paga integralmente ou parcialmente através deste qrcode. Caso deseje, pode também efetuar o pagamento pela chave pix: bleubank@gmail.com\nAgradecemos por escolher o Bleu Bank, foi um prazer prestar serviços com você! 😉" });
            await registrarPedido("Pagar Fatura", 0, name)

            resetEtapa(userId);
        } else {
            await client.sendMessage(userId, `❌ Pagamento cancelado.`);
            resetEtapa(userId);
        }
        return;
    }

    if (msg.body.match(/(Ver Fatura)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Olá ${name}! Deseja ver a sua fatura?\n\nResponda *SIM* para confirmar ou *NÃO* para cancelar: `);
        setEtapa(userId, 'aguardando_confirmacao_ver_fatura');
        return;
    }

    if (estado?.etapa === 'aguardando_confirmacao_ver_fatura') {
        if (msg.body.toLowerCase() === 'sim') {
            await chat.sendStateTyping();
            await delay(2000);

            const compras = [
                { loja: "Supermercado Pão de Açúcar", valor: 142.50 },
                { loja: "iFood", valor: 36.90 },
                { loja: "Uber", valor: 23.80 },
                { loja: "Amazon", valor: 189.00 },
                { loja: "Netflix", valor: 55.90 },
                { loja: "Spotify", valor: 34.90 },
                { loja: "Mercado Livre", valor: 87.45 },
                { loja: "Magazine Luiza", valor: 429.99 },
                { loja: "Shopee", valor: 78.20 },
                { loja: "Google Play", valor: 29.99 },
                { loja: "Apple Store", valor: 64.90 },
                { loja: "Boticário", valor: 120.00 },
                { loja: "Farmácia Droga Raia", valor: 52.30 },
                { loja: "Posto Shell", valor: 210.00 },
                { loja: "McDonald’s", valor: 42.70 },
                { loja: "Burger King", valor: 39.50 },
                { loja: "Lojas Americanas", valor: 88.90 },
                { loja: "Renner", valor: 159.99 },
                { loja: "Casas Bahia", valor: 1299.00 },
                { loja: "Decathlon", valor: 249.90 },
                { loja: "Centauro", valor: 179.90 },
                { loja: "Steam", valor: 99.90 },
                { loja: "Playstation Store", valor: 229.00 },
                { loja: "Xbox Live", valor: 59.00 },
                { loja: "Hotmart", valor: 397.00 },
                { loja: "Udemy", valor: 49.90 },
                { loja: "Passagens Latam", valor: 1280.00 },
                { loja: "Hotel Urbano", valor: 560.00 },
                { loja: "Drogasil", valor: 33.40 },
                { loja: "Padaria Dona Maria", valor: 18.90 }
            ];

            function sortearCompras(lista, quantidade) {
                const sorteadas = [];
                const usadas = new Set();

                while (sorteadas.length < quantidade) {
                    const i = Math.floor(Math.random() * lista.length);
                    if (!usadas.has(i)) {
                        usadas.add(i);
                        sorteadas.push(lista[i]);
                    }
                }
                return sorteadas;
            }

            // Sortear 6 compras
            const comprasSorteadas = sortearCompras(compras, 6);

            // Criar campos fixos + compras sorteadas
            const campos = [
                ["Remetente", "Blue Bank"],
                ["Data", new Date().toLocaleString()],
                ...comprasSorteadas.map(c => [c.loja, `R$ ${c.valor.toFixed(2)}`])
            ];

            // Gerar comprovante
            const filePath = await gerarComprovante({
                titulo: "Fatura de Cartão de Crédito",
                campos: campos
            });

            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(userId, media, { caption: "📄 Sua fatura de cartão de crédito. Você pode retornar a página de serviços para pagar integralmente ou parcialmente o valor.\nMuito obrigado por escolher o Bleu Bank, foi um prazer prestar serviços com você! 😉" });
            await registrarPedido("Ver Fatura", 0, name)

            resetEtapa(userId);
        } else {
            await client.sendMessage(userId, `❌ Visualização cancelada.`);
            resetEtapa(userId);
        }
        return;
    }

    if (msg.body.match(/(Investir)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Olá ${name}! Deseja investir com o Bleu Bank? Nossas opções de investimento são:\n1) Renda Fixa CDB 15% ao ano\n2) Renda Fixa CDI 4% ao mês\n3) Renda variável BlueBank Trades.\n\nInsira 1, 2 ou 3 para investir, e 4 para cancelar o serviço.`);
        setEtapa(userId, 'aguardando_opcao');
        return;
    }

    if (estado?.etapa === 'aguardando_opcao' && msg.body.match(/(1)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Com a renda fixa CDB 15% ao ano, seu valor investido poderá ser resgatado em um ano com lucros de 15%.\n\n*EXEMPLO* Valor Inicial: R$1000 -> R$1150\n\nDeseja Prosseguir com o serviço?\n SIM para confirmar e NAO para cancelar o serviço.`);
        setEtapa(userId, 'aguardando_confirmacao_investimento');
        return;
    }

    if (estado?.etapa === 'aguardando_opcao' && msg.body.match(/(2)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Com a renda fixa CDI 4% ao mês, seu valor investido poderá ser resgatado em um mês com lucros de 4%.\n\n*EXEMPLO* Valor Inicial: R$1000 -> R$1040\n\nDeseja Prosseguir com o serviço?\n SIM para confirmar e NAO para cancelar o serviço.`);    
        setEtapa(userId, 'aguardando_confirmacao_investimento');
        return;
    }

    if (estado?.etapa === 'aguardando_opcao' && msg.body.match(/(3)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `Com a renda variável BlueBank trades, seu dinheiro estará sendo investido por uma equipe de profissionais da Blue Bank, poderá ser resgatado a qualquer momento, e terá variações de +20% ou -10% ao mês.\n\n*EXEMPLO* Valor Inicial: R$1000 -> R$1200 OU R$900\n\nDeseja Prosseguir com o serviço?\n SIM para confirmar e NAO para cancelar o serviço.`);
        setEtapa(userId, 'aguardando_confirmacao_investimento');
        return;
    }

    if (estado?.etapa === 'aguardando_opcao' && msg.body.match(/(4)/i)) {
        await chat.sendStateTyping();
        await delay(2000);
        await client.sendMessage(userId, `❌ Serviço cancelado. Obrigado por usar o Blue Bank.`);
        resetEtapa(userId);
        return;
    }

    if (estado?.etapa === 'aguardando_confirmacao_investimento') {
        if (msg.body.toLowerCase() === 'sim') {
            await chat.sendStateTyping();
            await delay(2000);

            const filePath = 'static/assets/qrcode.png';

            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(userId, media, { caption: "O valor que deseja investir pode ser enviado através deste qrcode. Caso deseje, pode também efetuar o pagamento pela chave pix: bleubank@gmail.com\nAgradecemos por escolher o Bleu Bank, foi um prazer prestar serviços com você! 😉" });
            await registrarPedido("Investimento", 0, name)
        } else {
            await client.sendMessage(userId, `❌ Serviço cancelado. Obrigado por usar o Blue Bank.`);
            resetEtapa(userId);
            return;
        }
    }
});

async function registrarPedido(servico, valor, cliente) {
  const data = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  try {
    await axios.post('https://hook.us2.make.com/wkl7nxluxohei1ewoed3ajd3q4x2sigl', {
      servico,
      valor,
      cliente,
      data,
    })
    console.log('Pedido registrado:', { servico, cliente, valor })
  } catch (erro) {
    console.error('Erro ao registrar pedido:', erro?.response?.data || erro.message)
  }
}