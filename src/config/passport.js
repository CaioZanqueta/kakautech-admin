import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import Client from '../models/client';
import User from '../models/user';

passport.serializeUser((user, done) => {
  const userType = user instanceof Client ? 'client' : 'user';
  done(null, { id: user.id, type: userType });
});

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

passport.use('local-admin', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return done(null, false, { message: 'Email ou senha inválidos.' });
      }

      const isPasswordCorrect = await user.checkPassword(password);

      if (!isPasswordCorrect) {
        return done(null, false, { message: 'Email ou senha inválidos.' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.use('local-client', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password',
  },
  async (email, password, done) => {
    try {
      const client = await Client.findOne({ where: { email } });

      if (!client) {
        return done(null, false, { message: 'Email ou senha inválidos.' });
      }

      const isPasswordCorrect = await client.checkPassword(password);

      if (!isPasswordCorrect) {
        return done(null, false, { message: 'Email ou senha inválidos.' });
      }
      
      return done(null, client);
    } catch (error) {
      return done(error);
    }
  }
));

passport.use('google-client', new GoogleStrategy({
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

passport.use('microsoft-client', new MicrosoftStrategy({
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

passport.use('google-admin', new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/admin/auth/google/callback",
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;

      if (!email || !email.endsWith('@kakautech.com')) {
        return done(null, false, { message: 'Acesso permitido apenas para contas @kakautech.com.' });
      }
      
      let adminUser = await User.findOne({ where: { email } });

      if (!adminUser) {
        return done(null, false, { message: 'Este email não está registrado como um administrador.' });
      }

      if (!adminUser.google_id) {
        adminUser.google_id = profile.id;
        await adminUser.save();
      }
      
      return done(null, adminUser);
    } catch (error) {
      return done(error, false);
    }
  }
));

export default passport;