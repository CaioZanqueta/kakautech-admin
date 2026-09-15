import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

// Login e cadastro: 10 tentativas por IP a cada 15 minutos
// Em desenvolvimento, limites mais altos para não atrapalhar testes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 200,
  message: { error: 'Muitas tentativas de login. Por favor, tente novamente após 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não conta tentativas bem-sucedidas no limite
});

// API geral: 100 requisições por IP a cada 15 minutos
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 2000,
  message: { error: 'Muitas requisições. Por favor, aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
