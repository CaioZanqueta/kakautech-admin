import rateLimit from 'express-rate-limit';

// Limitador mais rigoroso para tentativas de login e registo
export const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 1000, // Aumentado para facilitar desenvolvimento e testes
	message: { error: 'Demasiadas tentativas a partir deste IP. Por favor, tente novamente após 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 10000, // Aumentado para desenvolvimento
  message: { error: 'Demasiadas requisições. Por favor, aguarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});