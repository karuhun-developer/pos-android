import type { Db } from '../types'

export const protectLegacyCashflowDefaults = {
    version: 6,
    name: 'protect-legacy-cashflow-defaults',
    up: async (db: Db) => {
      // Sebelum seed baru menjadi clean, sembilan default ini pernah ditulis
      // dirty tanpa envelope outbox, bersama-sama dalam satu timestamp. Karena
      // tak ada penanda provenance, hanya cohort lengkap dan eksak yang aman
      // dibersihkan; batch parsial, campuran, atau berlebih tetap dirty. CTE
      // literal ini snapshot historis, bukan daftar default masa depan.
      await db.run(`
        WITH canonical_defaults(name, type, is_system, sort_order) AS (
          VALUES
            ('Penjualan', 'income', 1, 0),
            ('Modal / Setoran', 'income', 0, 1),
            ('Pendapatan Lain', 'income', 0, 2),
            ('Belanja Stok', 'expense', 0, 3),
            ('Gaji Karyawan', 'expense', 0, 4),
            ('Sewa Tempat', 'expense', 0, 5),
            ('Listrik & Air', 'expense', 0, 6),
            ('Operasional', 'expense', 0, 7),
            ('Lain-lain', 'expense', 0, 8)
        ),
        complete_seed_cohorts AS (
          SELECT cashflow_categories.created_at
          FROM cashflow_categories
          LEFT JOIN canonical_defaults
            ON canonical_defaults.name = cashflow_categories.name
           AND canonical_defaults.type = cashflow_categories.type
           AND canonical_defaults.is_system = cashflow_categories.is_system
           AND canonical_defaults.sort_order = cashflow_categories.sort_order
          LEFT JOIN outbox
            ON outbox.entity = 'cashflow_categories'
           AND outbox.entity_id = cashflow_categories.id
          GROUP BY cashflow_categories.created_at
          HAVING COUNT(*) = 9
             AND COUNT(canonical_defaults.name) = 9
             AND COUNT(DISTINCT canonical_defaults.name) = 9
             AND SUM(
               CASE
                 WHEN cashflow_categories.dirty = 1
                  AND cashflow_categories.deleted_at IS NULL
                  AND cashflow_categories.sync_version = 0
                  AND cashflow_categories.remote_id IS NULL
                  AND cashflow_categories.created_at = cashflow_categories.updated_at
                  AND outbox.entity_id IS NULL
                 THEN 1
                 ELSE 0
               END
             ) = 9
        )
        UPDATE cashflow_categories
        SET dirty = 0
        WHERE created_at IN (SELECT created_at FROM complete_seed_cohorts)
      `)
    },
  }
