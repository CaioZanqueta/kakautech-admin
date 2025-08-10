import nodemailer from "nodemailer";

class MailService {
  constructor() {
    this.transporter = null;
  }

  initialize() {
    if (this.transporter) {
      return;
    }

    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      console.error(
        "!!! ERRO: Credenciais de email (MAIL_USER, MAIL_PASS) não encontradas no .env !!!"
      );
      console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
      throw new Error("Credenciais de email não configuradas.");
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    console.log("📧 Serviço de email inicializado com sucesso. 📧");
  }

  async sendMail(to, subject, html) {
    if (!this.transporter) {
      this.initialize();
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"Kakau Tech" <noreply@kakautech.com>',
        to: to,
        subject: subject,
        html: html,
      });
      console.log(`✅ Email enviado para o Mailtrap: ${info.messageId}`);
    } catch (error) {
      console.error("❌ Falha ao enviar email:", error);
      throw error;
    }
  }
}

export default new MailService();
