import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import Client from "../models/client.js";
import User from "../models/user.js";

const ADMIN_ALLOWED_DOMAINS = (
  process.env.ADMIN_ALLOWED_DOMAINS || "kakautech.com,kakau.com.br"
)
  .split(",")
  .map((domain) => domain.trim().toLowerCase());

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

function isAdminEmail(email) {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return ADMIN_ALLOWED_DOMAINS.includes(domain);
}

function microsoftEmail(profile) {
  return profile.emails?.[0]?.value || profile._json?.mail || profile._json?.userPrincipalName;
}

passport.serializeUser((user, done) => {
  done(null, { id: user.id, type: user instanceof Client ? "client" : "user" });
});

passport.deserializeUser(async (sessionData, done) => {
  try {
    if (!sessionData?.type) return done(new Error("Dados de sessão inválidos."));
    const Model = sessionData.type === "client" ? Client : User;
    return done(null, await Model.findByPk(sessionData.id));
  } catch (error) {
    return done(error, null);
  }
});

passport.use(
  "local-admin",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ where: { email } });
        if (!user || !(await user.checkPassword(password))) {
          return done(null, false, { message: "Email ou senha inválidos." });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  "local-client",
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const client = await Client.findOne({ where: { email } });
        if (!client || !(await client.checkPassword(password))) {
          return done(null, false, { message: "Email ou senha inválidos." });
        }
        if (client.status !== "active") {
          return done(null, false, { message: "Sua conta está pendente de aprovação ou inativa." });
        }
        return done(null, client);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.use(
  "google-client",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/google/callback`,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Não foi possível obter o e-mail do Google."), false);
        let client = await Client.findOne({ where: { email } });
        if (!client) {
          await Client.create({
            google_id: profile.id,
            name: profile.displayName,
            email,
            status: "pending",
            projectId: null,
          });
          return done(null, false, { message: "Pendente de aprovação!" });
        }
        if (client.status !== "active") {
          return done(null, false, { message: "Sua conta está pendente de aprovação ou inativa." });
        }
        if (!client.google_id) await client.update({ google_id: profile.id });
        return done(null, client);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  "microsoft-client",
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/microsoft/callback`,
      scope: ["user.read"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = microsoftEmail(profile);
        if (!email) return done(new Error("Não foi possível obter o e-mail da Microsoft."), false);
        let client = await Client.findOne({ where: { email } });
        if (!client) {
          await Client.create({
            microsoft_id: profile.id,
            name: profile.displayName,
            email,
            status: "pending",
            projectId: null,
          });
          return done(null, false, { message: "Pendente de aprovação!" });
        }
        if (client.status !== "active") {
          return done(null, false, { message: "Sua conta está pendente de aprovação ou inativa." });
        }
        if (!client.microsoft_id) await client.update({ microsoft_id: profile.id });
        return done(null, client);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  "google-admin",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/admin/auth/google/callback`,
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!isAdminEmail(email)) {
          return done(null, false, { message: "Acesso permitido apenas para domínios autorizados da Kakau Tech." });
        }
        let adminUser = await User.findOne({ where: { email } });
        if (!adminUser) {
          adminUser = await User.create({
            name: profile.displayName,
            email,
            google_id: profile.id,
            role: "developer",
            status: "active",
          });
        } else if (!adminUser.google_id) {
          await adminUser.update({ google_id: profile.id });
        }
        return done(null, adminUser);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  "microsoft-admin",
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/admin/auth/microsoft/callback`,
      scope: ["user.read"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = microsoftEmail(profile);
        if (!isAdminEmail(email)) {
          return done(null, false, { message: "Acesso permitido apenas para domínios autorizados da Kakau Tech." });
        }
        let adminUser = await User.findOne({ where: { email } });
        if (!adminUser) {
          adminUser = await User.create({
            name: profile.displayName,
            email,
            microsoft_id: profile.id,
            role: "developer",
            status: "active",
          });
        } else if (!adminUser.microsoft_id) {
          await adminUser.update({ microsoft_id: profile.id });
        }
        return done(null, adminUser);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
