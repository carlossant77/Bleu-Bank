const PdfPrinter = require("pdfmake");
const fs = require("fs");

const fonts = {
  Roboto: {
    normal: "fonts/Roboto/static/Roboto-Regular.ttf",
    bold: "fonts/Roboto/static/Roboto-Medium.ttf",
    italics: "fonts/Roboto/static/Roboto-Italic.ttf",
    bolditalics: "fonts/Roboto/static/Roboto-MediumItalic.ttf",
  },
};

const printer = new PdfPrinter(fonts);

function gerarComprovante({ titulo = "Comprovante", campos = [] }) {
  return new Promise((resolve, reject) => {
    // Garante que campos seja um array de arrays válido
    const body = campos.map(row => {
      // Cada row deve ser array com 2 ou mais itens, se não, substitui por ["N/A","N/A"]
      if (!Array.isArray(row) || row.length < 2) return ["N/A", "N/A"];
      return row.map(cell => cell ?? "N/A");
    });

    const docDefinition = {
      content: [
        { text: "Bleu Bank", style: "header", alignment: "center" },
        { text: titulo, style: "subheader", alignment: "center" },
        { text: "\n" },
        {
          table: {
            widths: Array(body[0]?.length || 2).fill("*"),
            body: body
          },
          layout: "lightHorizontalLines",
        },
        { text: "\n\nDocumento fictício - uso exclusivo para simulação", style: "footer", alignment: "center" },
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, margin: [0, 5, 0, 10] },
        footer: { fontSize: 9, italics: true },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const filePath = `./comprovantes/comprovante_${Date.now()}.pdf`;

    if (!fs.existsSync("./comprovantes")) fs.mkdirSync("./comprovantes");

    const stream = fs.createWriteStream(filePath);
    pdfDoc.pipe(stream);
    pdfDoc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", err => reject(err));
  });
}

module.exports = { gerarComprovante };
