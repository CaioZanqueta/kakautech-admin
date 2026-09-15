import nodemailer from "nodemailer";
import path from "path";

// Logo enviada como anexo inline (Content-ID) em todos os e-mails.
// __dirname aqui e o global do CommonJS gerado pelo build do Babel
// (mesmo padrao ja usado em server.js e nas rotas deste projeto).
// CID funciona em TODOS os clientes de email, incluindo o Outlook desktop
// classico (Windows), que renderiza HTML com o motor do Word e nao suporta
// imagens base64/data URI, e tambem bloqueia imagens externas por padrao.
const LOGO_PATH = path.join(__dirname, "../../public/kakauWhite.png");
const LOGO_CID = "kakau-logo";

class MailService {
  constructor() {
    this.transporter = null;
  }

  initialize() {
    if (this.transporter) {
      return;
    }

    if (
      !process.env.GMAIL_SMTP_USER ||
      !process.env.GMAIL_SMTP_CLIENT_ID ||
      !process.env.GMAIL_SMTP_CLIENT_SECRET ||
      !process.env.GMAIL_SMTP_REFRESH_TOKEN
    ) {
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error(
        "!!! ERRO: Credenciais de email (GMAIL_SMTP_*) não encontradas no .env !!!"
      );
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      throw new Error("Credenciais de email não configuradas.");
    }

    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GMAIL_SMTP_USER,
        clientId: process.env.GMAIL_SMTP_CLIENT_ID,
        clientSecret: process.env.GMAIL_SMTP_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_SMTP_REFRESH_TOKEN,
      },
    });

    console.log("📧 Serviço de email inicializado com sucesso (OAuth2). 📧");
  }

  async sendMail(to, subject, html) {
    if (!this.transporter) {
      this.initialize();
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.GMAIL_SMTP_USER,
        to: to,
        subject: subject,
        html: html,
        // Anexo inline da logo, referenciado nos templates via src="cid:kakau-logo".
        attachments: [
          {
            filename: "kakauWhite.png",
            path: LOGO_PATH,
            cid: LOGO_CID,
            contentDisposition: "inline",
          },
        ],
      });
      console.log(`✅ Email enviado: ${info.messageId}`);
    } catch (error) {
      console.error("❌ Falha ao enviar email:", error);
      throw error;
    }
  }
}

export default new MailService();
