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
async function run(sql) {
  // Bungkus di transaction() biar ke-commit (run pakai transaction:false).
  return page.evaluate((s) => window.__db.transaction((tx) => tx.run(s)), sql)
}

try {
  // 1) Boot — HomePage tampil = initDb() sukses (app mount setelah DB siap)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByText('Menu Utama').waitFor({ timeout: 15000 })
  log('Boot OK — DB terinisialisasi, HomePage tampil')

  // seed cashflow categories default harus ada (seedDefaultCashflowCategories)
  const cats = await q(
    "SELECT COUNT(*) as n FROM cashflow_categories WHERE deleted_at IS NULL",
  )
  if (cats[0].n !== 9) throw new Error(`Seed cashflow_categories salah: ${cats[0].n} (harusnya 9)`)
  const sysSales = await q(
    "SELECT name FROM cashflow_categories WHERE is_system=1 AND type='income' AND deleted_at IS NULL",
  )
  if (sysSales[0]?.name !== 'Penjualan')
    throw new Error(`Kategori sistem 'Penjualan' tak ada: ${JSON.stringify(sysSales)}`)
  log('Seed cashflow_categories: 9 default ✔ (sistem Penjualan ada)')

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

  // 4) Buat produk (+ upload foto)
  await page.goto(BASE + '/products/new', { waitUntil: 'networkidle' })
  await page.getByPlaceholder(/Bolu Coklat/).fill('Bolu Coklat')
  // harga
  const priceInput = page.locator('input[inputmode="numeric"]').first()
  await priceInput.fill('26000')
  // foto — PNG 1x1 lewat file picker (jalur web pickImage)
  const PNG_1x1 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Tambah Foto/ }).click(),
  ])
  await chooser.setFiles({
    name: 'bolu.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_1x1, 'base64'),
  })
  await page.locator('img[alt="Foto produk"]').waitFor({ timeout: 8000 })
  log('Foto terpilih — preview tampil')
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

  // 6b) Gambar sync-ready: media terpisah, produk cuma simpan ref pendek
  const prodImg = await q(
    "SELECT image_path FROM products WHERE name='Bolu Coklat'",
  )
  if (!String(prodImg[0]?.image_path || '').startsWith('media://'))
    throw new Error('image_path bukan ref media://')
  const mediaRows = await q(
    'SELECT id, mime, hash, length(data) AS len FROM media WHERE deleted_at IS NULL',
  )
  if (mediaRows.length !== 1 || !mediaRows[0].len || !mediaRows[0].hash)
    throw new Error('media row/hash/data tidak sesuai')
  const mediaOutbox = await q(
    "SELECT COUNT(*) AS n FROM outbox WHERE entity='media' AND op='insert'",
  )
  if (mediaOutbox[0].n < 1) throw new Error('Outbox tidak mencatat insert media')
  log(
    `Gambar: image_path=${prodImg[0].image_path.slice(0, 16)}…, media data ${mediaRows[0].len}B, outbox media insert ✔`,
  )

  // 6c) Bukti hemat: edit harga → payload outbox produk kecil (gak bawa base64),
  //     jumlah media gak nambah.
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
  await page.getByText('Bolu Coklat').click()
  await page.locator('input[inputmode="numeric"]').first().fill('27000')
  await page.getByRole('button', { name: /Simpan Perubahan/ }).click()
  await page.waitForTimeout(1200)
  const upd = await q(
    "SELECT length(payload) AS len FROM outbox WHERE entity='products' AND op='update' ORDER BY created_at DESC LIMIT 1",
  )
  if (!upd.length) throw new Error('Outbox update produk tidak ada')
  if (upd[0].len > 2000)
    throw new Error(`Payload update produk kegedean (${upd[0].len}B) — base64 bocor?`)
  const mediaAfter = await q(
    'SELECT COUNT(*) AS n FROM media WHERE deleted_at IS NULL',
  )
  if (mediaAfter[0].n !== 1)
    throw new Error('Edit harga bikin media nambah — harusnya gak nyentuh gambar')
  log(`Edit harga: payload produk ${upd[0].len}B (ringan), media tetap 1 ✔`)

  // 6c-bis) Buka kasir — modal awal 100000, sesi 'open' tersimpan.
  await page.goto(BASE + '/cashier', { waitUntil: 'networkidle' })
  await page.getByText('Buka Kasir').first().waitFor({ timeout: 8000 })
  await page.locator('input[inputmode="numeric"]').first().fill('100000')
  await page.getByRole('button', { name: /^Buka Kasir$/ }).click()
  await page.getByText('Kasir Terbuka').waitFor({ timeout: 8000 })
  const sess = await q(
    "SELECT id,status,opening_cash FROM cashier_sessions WHERE deleted_at IS NULL ORDER BY opened_at DESC LIMIT 1",
  )
  if (!sess.length) throw new Error('Sesi kasir tidak tercatat')
  if (sess[0].status !== 'open' || sess[0].opening_cash !== 100000)
    throw new Error(`Sesi buka salah: ${JSON.stringify(sess[0])}`)
  const sessionId = sess[0].id
  log(`Buka kasir OK — sesi ${sessionId.slice(0, 8)}…, modal 100000`)

  // 6d) POS + Checkout — jual Bolu Coklat, buktikan 1 transaksi atomic
  //     (sales + sale_items + kurangi stok + cashflow) + outbox lengkap.
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
  await page.getByText('Bolu Coklat').waitFor({ timeout: 8000 })
  // Aktifkan lacak stok + stok 10 (in-memory). Navigasi ke POS lewat klik nav
  // (client-side, tanpa reload) supaya perubahan in-memory ini kepakai.
  await run("UPDATE products SET track_stock=1, stock=10 WHERE name='Bolu Coklat'")
  await page.getByRole('link', { name: 'Kasir' }).click()
  await page.getByRole('button', { name: /Bolu Coklat/ }).click() // tambah ke cart
  await page.getByRole('button', { name: /Lihat Keranjang/ }).click()
  await page.getByRole('button', { name: 'Bayar' }).click()
  await page.getByText('Total Tagihan').waitFor({ timeout: 8000 })
  await page.locator('input[inputmode="numeric"]').first().fill('50000') // uang diterima
  await page.getByRole('button', { name: /Selesaikan Pembayaran/ }).click()
  await page.getByText('Transaksi Berhasil').waitFor({ timeout: 8000 })
  log('Checkout OK — layar sukses tampil')

  const sale = await q(
    "SELECT number,total,paid,change_due,payment_method,status,session_id FROM sales WHERE deleted_at IS NULL ORDER BY sold_at DESC LIMIT 1",
  )
  if (!sale.length) throw new Error('Sale tidak tercatat')
  const s0 = sale[0]
  if (s0.total !== 27000 || s0.paid !== 50000 || s0.change_due !== 23000)
    throw new Error(`Angka sale salah: ${JSON.stringify(s0)}`)
  if (s0.status !== 'completed') throw new Error('status sale bukan completed')
  if (s0.session_id !== sessionId)
    throw new Error(`Sale tidak ke-link ke sesi kasir: ${s0.session_id}`)

  const si = await q(
    "SELECT name_snapshot,qty,line_total FROM sale_items ORDER BY created_at DESC LIMIT 1",
  )
  if (si[0]?.name_snapshot !== 'Bolu Coklat' || si[0]?.qty !== 1 || si[0]?.line_total !== 27000)
    throw new Error(`sale_item salah: ${JSON.stringify(si[0])}`)

  const stock = await q("SELECT stock FROM products WHERE name='Bolu Coklat'")
  if (stock[0]?.stock !== 9) throw new Error(`Stok tidak berkurang: ${stock[0]?.stock}`)

  const cf = await q(
    "SELECT source,direction,amount FROM cashflow_entries WHERE source='sale' ORDER BY occurred_at DESC LIMIT 1",
  )
  if (cf[0]?.direction !== 'debit' || cf[0]?.amount !== 27000)
    throw new Error(`cashflow sale salah: ${JSON.stringify(cf[0])}`)

  const posOb = await q(
    "SELECT DISTINCT entity FROM outbox WHERE entity IN ('sales','sale_items','cashflow_entries')",
  )
  const ents = posOb.map((r) => r.entity)
  for (const e of ['sales', 'sale_items', 'cashflow_entries'])
    if (!ents.includes(e)) throw new Error(`Outbox tidak mencatat ${e}`)
  log(
    `Checkout atomic ✔ — sale ${s0.number}, item 1, stok 10→9, cashflow +${cf[0].amount}, outbox lengkap`,
  )

  // 6d-bis) Cashflow manual — catat pengeluaran 5000 (Belanja Stok) ke sesi aktif.
  //         Buktikan arah 'credit' diturunkan dari tipe kategori + link sesi.
  await page.goto(BASE + '/cashflow', { waitUntil: 'networkidle' })
  await page.getByText('Penjualan').first().waitFor({ timeout: 8000 }) // entri auto sale
  await page.goto(BASE + '/cashflow/new', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Pengeluaran/ }).click()
  await page.getByRole('button', { name: /Belanja Stok/ }).click()
  await page.locator('input[inputmode="numeric"]').first().fill('5000')
  await page.getByRole('button', { name: /^Simpan$/ }).click()
  await page.getByText(/Saldo ·/).waitFor({ timeout: 8000 }) // balik ke ledger (label DateRangeFilter)
  const man = await q(
    "SELECT direction,amount,source,session_id,category_id FROM cashflow_entries WHERE source='manual' ORDER BY occurred_at DESC LIMIT 1",
  )
  const m0 = man[0]
  if (!m0 || m0.direction !== 'credit' || m0.amount !== 5000 || m0.source !== 'manual')
    throw new Error(`Cashflow manual salah: ${JSON.stringify(m0)}`)
  if (m0.session_id !== sessionId)
    throw new Error(`Cashflow manual tidak ke-link sesi: ${m0.session_id}`)
  const manCat = await q(
    "SELECT name,type FROM cashflow_categories WHERE id='" + m0.category_id + "'",
  )
  if (manCat[0]?.name !== 'Belanja Stok' || manCat[0]?.type !== 'expense')
    throw new Error(`Kategori cashflow manual salah: ${JSON.stringify(manCat[0])}`)
  log('Cashflow manual ✔ — pengeluaran 5000 (Belanja Stok, credit) ke-link sesi')

  // 6e) Tutup kasir — expected = modal 100000 + tunai 27000 − manual 5000 = 122000.
  //     Hitung aktual 130000 → selisih +8000 (lebih).
  await page.goto(BASE + '/cashier', { waitUntil: 'networkidle' })
  await page.getByText('Kasir Terbuka').waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: /Tutup Kasir/ }).click()
  await page.getByText('Uang aktual dihitung').waitFor({ timeout: 8000 })
  await page.locator('input[inputmode="numeric"]').first().fill('130000')
  await page.getByRole('button', { name: /Tutup Sesi/ }).click()
  await page.getByText('Buka Kasir').first().waitFor({ timeout: 8000 }) // form buka balik
  const closed = await q(
    "SELECT status,expected_cash,counted_cash,difference FROM cashier_sessions WHERE id='" +
      sessionId +
      "'",
  )
  const c0 = closed[0]
  if (
    !c0 ||
    c0.status !== 'closed' ||
    c0.expected_cash !== 122000 ||
    c0.counted_cash !== 130000 ||
    c0.difference !== 8000
  )
    throw new Error(`Tutup kasir salah: ${JSON.stringify(c0)}`)
  log(
    `Tutup kasir ✔ — expected 122000 (modal+tunai−manual), dihitung 130000, selisih +${c0.difference}`,
  )

  // 7) Persistensi offline — reload, data harus tetap ada
  await page.reload({ waitUntil: 'networkidle' })
  await page.goto(BASE + '/products', { waitUntil: 'networkidle' })
  await page.getByText('Bolu Coklat').waitFor({ timeout: 10000 })
  log('Persistensi OK — data bertahan setelah reload')

  // 8) Soft delete — buka halaman edit langsung biar gak balapan sama render list.
  const prodRow = await q(
    "SELECT id FROM products WHERE name='Bolu Coklat' AND deleted_at IS NULL LIMIT 1",
  )
  page.once('dialog', (d) => d.accept())
  await page.goto(BASE + '/products/' + prodRow[0].id + '/edit', {
    waitUntil: 'networkidle',
  })
  const delBtn = page.locator('header button').last() // tombol hapus (ikon Trash)
  await delBtn.waitFor({ state: 'visible', timeout: 8000 })
  await delBtn.click()
  await page.waitForURL('**/products', { timeout: 8000 }) // remove() → router.push('/products')
  const afterDel = await q(
    "SELECT deleted_at FROM products WHERE name='Bolu Coklat'",
  )
  if (afterDel[0] && afterDel[0].deleted_at == null)
    throw new Error('soft delete gagal set deleted_at')
  log('Soft delete OK — deleted_at terisi, row tetap ada buat sync')

  // 9) Kunci PIN (Phase 5) — aktifkan login + set PIN, reload → terkunci.
  const tap = async (seq) => {
    for (const d of seq)
      await page.getByRole('button', { name: d, exact: true }).click()
  }
  const loginSwitch = () =>
    page
      .getByText('Aktifkan Login')
      .locator('xpath=ancestor::div[contains(@class,"items-center")][1]')
      .getByRole('switch')

  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await loginSwitch().click() // buka sheet PIN (login belum aktif sampai PIN dibuat)
  await page.getByText('Masukkan PIN 6 digit baru').waitFor({ timeout: 8000 })
  await tap('123456') // tahap enter
  await page.getByText('Ulangi PIN untuk konfirmasi').waitFor({ timeout: 8000 })
  await tap('123456') // tahap konfirmasi → simpan + aktifkan login
  await page
    .getByText('Ulangi PIN untuk konfirmasi')
    .waitFor({ state: 'hidden', timeout: 8000 })
  const le = await q("SELECT value FROM settings WHERE key='login_enabled'")
  const ph = await q("SELECT value FROM settings WHERE key='pin_hash'")
  if (le[0]?.value !== '1') throw new Error('login_enabled != 1')
  if (!ph[0]?.value || !ph[0].value.includes(':'))
    throw new Error('pin_hash tidak tersimpan bergaram')
  log('PIN diset ✔ — login aktif, pin_hash bergaram tersimpan')

  // reload di /settings → guard paksa ke /lock?redirect=/settings
  const path = () => new URL(page.url()).pathname
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByText('Masukkan PIN untuk membuka').waitFor({ timeout: 8000 })
  if (path() !== '/lock') throw new Error('tidak diarahkan ke /lock: ' + page.url())
  // PIN salah → tetap terkunci
  await tap('000000')
  await page.waitForTimeout(700) // biarkan verifikasi + reset PIN selesai
  if (path() !== '/lock') throw new Error('PIN salah tapi lolos kunci')
  // PIN benar → app kebuka + balik ke tujuan semula (/settings)
  await tap('123456')
  await page.getByText('Akun & Setelan').waitFor({ timeout: 8000 })
  if (path() !== '/settings')
    throw new Error('redirect setelah unlock gagal: ' + page.url())
  log('Lock screen ✔ — PIN salah ditolak, PIN benar membuka + balik ke tujuan')

  // Bersihkan: matikan login lagi supaya run berikutnya boot normal.
  await loginSwitch().click()
  await page.waitForTimeout(400)
  const off = await q("SELECT value FROM settings WHERE key='login_enabled'")
  const phOff = await q("SELECT value FROM settings WHERE key='pin_hash'")
  if (off[0]?.value !== '0') throw new Error('gagal matikan login')
  if (phOff[0]?.value) throw new Error('pin_hash tidak dibersihkan saat login off')
  log('Matikan login ✔ — login_enabled=0, PIN dibersihkan')

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
