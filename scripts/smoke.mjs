import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:5173'
const errors = []
const log = (...a) => console.log('•', ...a)

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

async function q(sql) {
  return page.evaluate((s) => window.__db.query(s), sql)
}

try {
  // 1) Boot — HomePage tampil = initDb() sukses (app mount setelah DB siap)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('Menu Utama').waitFor({ timeout: 15000 })
  log('Boot OK — DB terinisialisasi, HomePage tampil')

  // seed cashflow categories harus ada (migration v2)
  const cats = await q(
    "SELECT COUNT(*) as n FROM cashflow_categories WHERE deleted_at IS NULL",
  )
  log('Seed cashflow_categories:', cats[0].n, '(harusnya 5)')

  // 2) Ke Produk
  await page.getByRole('link', { name: /Produk/ }).first().click()
  await page.getByPlaceholder(/Cari produk/).waitFor({ timeout: 10000 })
  log('Halaman Produk OK')

  // 3) Buat kategori
  await page.goto(BASE + '/categories', { waitUntil: 'networkidle' })
  await page.getByPlaceholder('Nama kategori baru').fill('Roti')
  await page.getByRole('button', { name: /Tambah/ }).click()
  await page.getByText('Roti').waitFor({ timeout: 8000 })
  log('Tambah kategori OK')

  // 4) Buat produk
  await page.goto(BASE + '/products/new', { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Bolu Coklat/).fill('Bolu Coklat')
  // harga
  const priceInput = page.locator('input[inputmode="numeric"]').first()
  await priceInput.fill('26000')
  await page.getByRole('button', { name: /Simpan Produk/ }).click()
  await page.waitForTimeout(1200)
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
  await page.getByText('Bolu Coklat').waitFor({ timeout: 8000 })
  log('Tambah produk OK — muncul di list')

  // 5) Cek DB: produk tersimpan + dirty=1
  const prod = await q(
    "SELECT name, price, dirty, deleted_at FROM products WHERE name='Bolu Coklat'",
  )
  if (!prod.length) throw new Error('Produk tidak ada di DB')
  log('DB row:', JSON.stringify(prod[0]))
  if (prod[0].dirty !== 1) throw new Error('dirty flag bukan 1')
  if (prod[0].price !== 26000) throw new Error('harga tidak 26000')

  // 6) Outbox — bukti sync-ready
  const ob = await q(
    "SELECT entity, op FROM outbox ORDER BY created_at DESC LIMIT 5",
  )
  log('Outbox terbaru:', JSON.stringify(ob))
  const hasInsert = ob.some((r) => r.entity === 'products' && r.op === 'insert')
  if (!hasInsert) throw new Error('Outbox tidak mencatat insert produk')
  log('Outbox mencatat perubahan ✔ (sync-ready)')

  // 7) Persistensi offline — reload, data harus tetap ada
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
  await page.getByText('Bolu Coklat').waitFor({ timeout: 10000 })
  log('Persistensi OK — data bertahan setelah reload')

  // 8) Soft delete
  await page.getByText('Bolu Coklat').click()
  page.on('dialog', (d) => d.accept())
  await page.locator('header button').last().click() // tombol hapus
  await page.waitForTimeout(1500)
  const afterDel = await q(
    "SELECT deleted_at FROM products WHERE name='Bolu Coklat'",
  )
  if (afterDel[0] && afterDel[0].deleted_at == null)
    throw new Error('soft delete gagal set deleted_at')
  log('Soft delete OK — deleted_at terisi, row tetap ada buat sync')

  if (errors.length) {
    console.log('\n⚠️  Console errors:')
    errors.forEach((e) => console.log('  -', e))
    throw new Error(`${errors.length} console error`)
  }

  console.log('\n✅ SEMUA SMOKE TEST LULUS')
  await browser.close()
  process.exit(0)
} catch (err) {
  console.error('\n❌ GAGAL:', err.message)
  if (errors.length) errors.forEach((e) => console.log('  console:', e))
  await page.screenshot({ path: 'scripts/smoke-fail.png' }).catch(() => {})
  await browser.close()
  process.exit(1)
}
