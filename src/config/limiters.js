import rateLimit from 'express-rate-limit';

// Limitador mais rigoroso para tentativas de login e registo
export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // Janela de 15 minutos
	max: 10, // Bloqueia o IP após 10 tentativas
	message: { error: 'Demasiadas tentativas a partir deste IP. Por favor, tente novamente após 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitador mais geral para outras rotas de API
export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // Janela de 15 minutos
	max: 100, // Permite 100 requisições por janela
  message: { error: 'Demasiadas requisições. Por favor, aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});