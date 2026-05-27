const { translateText } = require('../dist/services/TranslationService');

async function main() {
  const tests = [
    ['selam', 'tr', 'th'],
    ['nasılsın', 'tr', 'th'],
    ['selam nasılsın', 'tr', 'th'],
    ['bugün hava çok güzel', 'tr', 'th'],
    ['Seni seviyorum', 'tr', 'th'],
  ];

  for (const [text, src, tgt] of tests) {
    const r = await translateText(text, src, tgt);
    console.log(`${text} (${src}->${tgt}): ${r.status} = "${r.translatedText}"`);
  }
}

main().catch(console.error);
