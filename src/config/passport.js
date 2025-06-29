import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import Client from '../models/client';
import User from '../models/user'; // -> 1. IMPORTAÇÃO ADICIONADA

// =================================================================
// === INÍCIO: BLOCO DE SERIALIZAÇÃO ATUALIZADO                   ===
// =================================================================
// Serialização do usuário para a sessão.
// Agora armazena o tipo de usuário ('client' ou 'user') junto com o ID.
passport.serializeUser((user, done) => {
  const userType = user instanceof Client ? 'client' : 'user';
  done(null, { id: user.id, type: userType });
});

// Deserialização do usuário a partir da sessão.
// Lê o tipo de usuário e busca no modelo correto (Client ou User).
passport.deserializeUser(async (sessionData, done) => {
  try {
    if (!sessionData || !sessionData.type) {
      return done(new Error("Dados de sessão inválidos."));
    }
    const Model = sessionData.type === 'client' ? Client : User;
    const user = await Model.findByPk(sessionData.id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
// =================================================================
// === FIM: BLOCO DE SERIALIZAÇÃO ATUALIZADO                      ===
// =================================================================


// --- ESTRATÉGIAS PARA O PORTAL DO CLIENTE ---

// Estratégia do Google para Clientes
passport.use('google-client', new GoogleStrategy({ // -> 2. ESTRATÉGIA NOMEADA
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let client = await Client.findOne({ where: { google_id: profile.id } });
      if (client) return done(null, client);
      
      const email = profile.emails[0].value;
      client = await Client.findOne({ where: { email } });

      if (client) {
        client.google_id = profile.id;
        await client.save();
        return done(null, client);
      }
      
      const newClient = await Client.create({
        google_id: profile.id,
        name: profile.displayName,
        email: email,
      });
      return done(null, newClient);
    } catch (error) {
      return done(error, false);
    }
  }
));

// Estratégia da Microsoft para Clientes
passport.use('microsoft-client', new MicrosoftStrategy({ // -> 2. ESTRATÉGIA NOMEADA
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: "/auth/microsoft/callback",
    scope: ['user.read']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : profile._json.mail || profile._json.userPrincipalName;
      if (!email) {
          return done(new Error("Não foi possível obter o e-mail da Microsoft."), false);
      }

      let client = await Client.findOne({ where: { microsoft_id: profile.id } });
      if (client) return done(null, client);

      client = await Client.findOne({ where: { email } });
      if (client) {
        client.microsoft_id = profile.id;
        await client.save();
        return done(null, client);
      }
      
      const newClient = await Client.create({
        microsoft_id: profile.id,
        name: profile.displayName,
        email: email,
      });
      return done(null, newClient);
    } catch (error) {
      return done(error, false);
    }
  }
));


// ==========================================================
// === INÍCIO: NOVA ESTRATÉGIA PARA LOGIN ADMINJS         ===
// ==========================================================
passport.use('google-admin', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/admin/auth/google/callback", // URL de Callback exclusiva para o admin
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

      // -> 3. RESTRIÇÃO DE DOMÍNIO
      if (!email || !email.endsWith('@kakautech.com')) {
        return done(null, false, { message: 'Acesso permitido apenas para contas @kakautech.com.' });
      }
      
      // Procura um usuário administrador existente pelo e-mail
      let adminUser = await User.findOne({ where: { email } });

      // Por segurança, NUNCA criamos um usuário admin automaticamente. Ele deve existir no banco.
      if (!adminUser) {
        return done(null, false, { message: 'Este email não está registrado como um administrador.' });
      }

      // Se o usuário existe, vinculamos o ID do Google a ele (caso ainda não esteja vinculado)
      if (!adminUser.google_id) {
        adminUser.google_id = profile.id;
        await adminUser.save();
      }

      // Login bem-sucedido
      return done(null, adminUser);

    } catch (error) {
      return done(error, false);
    }
  }
));
// ==========================================================
// === FIM: NOVA ESTRATÉGIA PARA LOGIN ADMINJS            ===
// ==========================================================


export default passport;