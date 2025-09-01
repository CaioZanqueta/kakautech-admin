const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  console.log('Iniciando teste de geração de PDF...');
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('-> Navegador iniciado.');

    const page = await browser.newPage();
    console.log('-> Nova página criada.');
    
    // Usamos o HTML mais simples possível para o teste
    await page.setContent('<h1>Olá, Mundo!</h1><p>Este é um teste de PDF.</p>', {
      waitUntil: 'domcontentloaded'
    });
    console.log('-> Conteúdo carregado na página.');

    // Em vez de enviar o buffer, vamos salvar diretamente no disco
    await page.pdf({
      format: 'A4',
      path: 'teste_output.pdf' 
    });
    console.log('-> PDF salvo no disco.');

    await browser.close();
    console.log('-> Navegador fechado.');
    
    console.log('\nSUCESSO! O PDF foi salvo como "teste_output.pdf" na raiz do seu projeto.');
    console.log('Por favor, tente abrir o ficheiro "teste_output.pdf" para verificar se está correto.');

  } catch (error) {
    console.error('\nERRO DURANTE O TESTE DO PUPPETEER:', error);
  }
})();