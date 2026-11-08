// scripts/sfda-scrape.mjs
// Node 18+  |  تشغيل:  node scripts/sfda-scrape.mjs
//
// 1) يجلب قائمة كل الأغذية (كل المجموعات) صفحة صفحة -> data/sfda/list.json
// 2) يجلب تفاصيل كل صنف -> data/sfda/raw/<id>.json  (يكمل من حيث وقف لو انقطع)
//
// متغيرات بيئة اختيارية:
//   FOOD_GROUP_IDS=1054        يقتصر على مجموعة (1054 = الأطباق السعودية). اتركه فاضي لجلب الكل
//   DETAIL_URL=https://fd.sfda.gov.sa/gw/internal/Food/FoodDetails?FoodCode={id}   (تأكد من Request URL في DevTools)
//   HEADERS_FILE=scripts/sfda-headers.json   ملف JSON فيه الهيدرز اللي ينسخها من DevTools (الأسهل، خصوصاً في PowerShell)
//   HEADERS_JSON='{"Authorization":"Bearer ..."}'   بديل: الهيدرز مباشرة في الأمر
//   PAGE_SIZE=50  CONCURRENCY=3  DELAY_MS=400

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import path from 'node:path';

const LIST_URL = 'https://fd.sfda.gov.sa/gw/internal/Food';
const DETAIL_URL = process.env.DETAIL_URL ?? `${LIST_URL}/FoodDetails?FoodCode={id}`;
const GROUP_IDS = process.env.FOOD_GROUP_IDS ?? '';
const PAGE_SIZE = Number(process.env.PAGE_SIZE ?? 50);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
const DELAY_MS = Number(process.env.DELAY_MS ?? 400);
const OUT = 'data/sfda';

const exists = (p) => access(p).then(() => true, () => false);
const HEADERS_FILE = process.env.HEADERS_FILE ?? 'scripts/sfda-headers.json';
const fileHeaders = (await exists(HEADERS_FILE))
  ? JSON.parse(await readFile(HEADERS_FILE, 'utf8'))
  : {};

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'ar',
  'User-Agent': 'Mozilla/5.0 (compatible; HesbahImporter/1.0)',
  ...fileHeaders,
  ...(process.env.HEADERS_JSON ? JSON.parse(process.env.HEADERS_JSON) : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const itemId = (it) => it.foodCode ?? it.code ?? it.id ?? it.foodId;

async function fetchJson(url, tries = 5) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        const hint =
          res.status === 401 || res.status === 403
            ? ' — الموقع يرفض الطلب: الهيدرز/التوكن ناقصة أو منتهية. حدّث scripts/sfda-headers.json من DevTools'
            : '';
        const err = new Error(`HTTP ${res.status} for ${url}${hint}`);
        err.fatal = true;
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (e.fatal || attempt === tries) throw e;
      await sleep(1000 * 2 ** attempt); // backoff
    }
  }
}

async function fetchAllList() {
  const items = [];
  let total = Infinity;
  for (let page = 1; items.length < total; page++) {
    const qs = new URLSearchParams({ PageIndex: String(page), PageSize: String(PAGE_SIZE) });
    if (GROUP_IDS) qs.set('FoodGroupIds', GROUP_IDS);
    const json = await fetchJson(`${LIST_URL}?${qs}`);
    const data = json.data ?? json;
    const batch = data.foodItems ?? [];
    total = data.totalCount ?? total;
    if (page === 1) {
      console.log(`totalCount = ${total}`);
      console.log('مفاتيح أول عنصر:', Object.keys(batch[0] ?? {}));
    }
    if (batch.length === 0) break;
    items.push(...batch);
    console.log(`list page ${page}: ${items.length}/${total}`);
    await sleep(DELAY_MS);
  }
  return items;
}

async function runPool(tasks, concurrency) {
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) await tasks[i++]();
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  await mkdir(path.join(OUT, 'raw'), { recursive: true });

  const items = await fetchAllList();
  await writeFile(path.join(OUT, 'list.json'), JSON.stringify(items, null, 2));
  console.log(`saved list.json (${items.length} items)`);

  let done = 0;
  let failed = 0;
  const tasks = items.map((it) => async () => {
    const id = itemId(it);
    if (id == null) return void console.warn('عنصر بدون id:', it);
    const file = path.join(OUT, 'raw', `${id}.json`);
    if (await exists(file)) return void done++; // resume
    try {
      const json = await fetchJson(DETAIL_URL.replace('{id}', encodeURIComponent(id)));
      await writeFile(file, JSON.stringify(json, null, 2));
      done++;
    } catch (e) {
      failed++;
      console.warn(`فشل ${id}: ${e.message}`);
      if (failed === 3 && done === 0) {
        console.error('\nأول 3 طلبات فشلت: غالباً الرابط غلط، أو الهيدرز/التوكن ناقصة (401/403). راجع DevTools > Network > Headers.');
        process.exit(1);
      }
    }
    if ((done + failed) % 25 === 0) console.log(`detail ${done + failed}/${items.length} (failed ${failed})`);
    await sleep(DELAY_MS);
  });

  await runPool(tasks, CONCURRENCY);
  console.log(`\nانتهى. نجح ${done}، فشل ${failed}. أعد التشغيل لإعادة محاولة الفاشل.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

