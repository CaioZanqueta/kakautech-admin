import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';
import 'dotenv/config';

// Configuração do cliente S3 usando as variáveis de ambiente
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Opções de armazenamento para o Multer
const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  // acl: 'public-read', // <<< LINHA REMOVIDA
  key: (req, file, cb) => {
    // Gera um nome de arquivo único para evitar sobreposição
    crypto.randomBytes(16, (err, hash) => {
      if (err) cb(err);

      const fileName = `${hash.toString('hex')}-${file.originalname}`;
      cb(null, fileName);
    });
  },
});

// Exporta a configuração do Multer
export default {
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB por arquivo
  },
  fileFilter: (req, file, cb) => {
    // Validação de tipos de arquivo (opcional, mas recomendado)
    const allowedMimes = [
        "image/png", 
        "image/gif", 
        "image/jpeg", 
        "application/pdf", 
        "application/zip", 
        "text/plain", 
        "application/msword", 
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo inválido."));
    }
  },
};