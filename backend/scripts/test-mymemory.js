const { translateText } = require('../dist/services/TranslationService');

async function main() {
  const tests = [
    ['Seni seviyorum', 'tr', 'th'],
    ['selam', 'tr', 'th'],
    ['bugün hava güzel', 'tr', 'th'],
    ['Benim adım Yusuf', 'tr', 'th'],
    ['Nasılsın?', 'tr', 'th'],
  ];

  for (const [text, src, tgt] of tests) {
    try {
      const r = await translateText(text, src, tgt);
      console.log(`${text} (${src}->${tgt}): ${r.status} = "${r.translatedText}"`);
    } catch (err) {
      console.log(`${text} (${src}->${tgt}): HATA - ${err.message}`);
    }
  }
}

main().catch(console.error);
