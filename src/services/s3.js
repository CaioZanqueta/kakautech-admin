/**
 * Fix #16: generateSignedUrl extraída para serviço centralizado.
 * Antes existia duplicada em admin.api.routes.js, admin.pages.routes.js e portal.routes.js.
 *
 * Fix #17: credenciais AWS lidas via process.env diretamente,
 * eliminando a dependência do config/credentials.js para o S3.
 */
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Gera uma URL assinada temporária para leitura de um objeto S3.
 * @param {string} bucket  - Nome do bucket
 * @param {string} key     - Chave do objeto
 * @param {number} expires - Tempo de expiração em segundos (padrão: 3600)
 * @returns {Promise<string|null>}
 */
export async function generateSignedUrl(bucket, key, expires = 3600) {
  if (!bucket || !key) return null;
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return await getSignedUrl(s3, command, { expiresIn: expires });
  } catch (e) {
    console.error("Erro ao gerar URL assinada S3:", e);
    return null;
  }
}

/**
 * Deleta um objeto do S3.
 * @param {string} bucket
 * @param {string} key
 */
export async function deleteObject(bucket, key) {
  if (!bucket || !key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (e) {
    console.error("Erro ao deletar objeto S3:", e);
  }
}
