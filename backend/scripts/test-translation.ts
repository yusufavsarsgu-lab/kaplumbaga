import { translateText } from '../src/services/TranslationService';

async function main() {
  console.log('--- Translation Tests ---\n');

  // Test 1: Turkish -> Thai (Yusuf -> Neeja)
  const r1 = await translateText('Seni seviyorum', 'tr', 'th');
  console.log('tr->th:', r1);

  // Test 2: Thai -> Turkish (Neeja -> Yusuf)
  const r2 = await translateText('ฉันรักคุณ', 'th', 'tr');
  console.log('th->tr:', r2);

  // Test 3: Unknown text (should fallback)
  const r3 = await translateText('Merhaba nasılsın bugün', 'tr', 'th');
  console.log('unknown tr->th:', r3);

  // Test 4: Same language (no translation)
  const r4 = await translateText('Seni seviyorum', 'tr', 'tr');
  console.log('tr->tr:', r4);

  // Test 5: With emoji and punctuation
  const r5 = await translateText('Seni seviyorum! ❤️', 'tr', 'th');
  console.log('with emoji tr->th:', r5);

  // Test 6: Substring match
  const r6 = await translateText('Ben seni çok seviyorum aşkım', 'tr', 'th');
  console.log('substring tr->th:', r6);
}

main().catch(console.error);
