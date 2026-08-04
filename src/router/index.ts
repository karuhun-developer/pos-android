import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },

  // Kunci app (Phase 5) — hanya tampil bila login aktif + PIN terpasang.
  {
    path: '/lock',
    name: 'lock',
    component: () => import('@/pages/settings/LockPage.vue'),
    meta: { hideNav: true },
  },

  // Sambungkan ke POS Pro / sync cloud (Phase 6C)
  {
    path: '/connect',
    name: 'connect',
    component: () => import('@/pages/settings/ConnectPage.vue'),
    meta: { hideNav: true },
  },

  // Produk (Phase 1)
  {
    path: '/products',
    name: 'products',
    component: () => import('@/pages/products/ProductsPage.vue'),
  },
  {
    path: '/products/new',
    name: 'product-new',
    component: () => import('@/pages/products/ProductFormPage.vue'),
    meta: { hideNav: true },
  },
  {
    path: '/products/:id/edit',
    name: 'product-edit',
    component: () => import('@/pages/products/ProductFormPage.vue'),
    meta: { hideNav: true },
  },
  {
    path: '/categories',
    name: 'categories',
    component: () => import('@/pages/products/CategoriesPage.vue'),
    meta: { hideNav: true },
  },

  // POS + transaksi (Phase 2)
  { path: '/pos', name: 'pos', component: () => import('@/pages/pos/PosPage.vue') },
  {
    path: '/transactions',
    name: 'transactions',
    component: () => import('@/pages/transactions/TransactionsPage.vue'),
  },
  {
    path: '/transactions/:id',
    name: 'transaction-detail',
    component: () => import('@/pages/transactions/TransactionDetailPage.vue'),
    meta: { hideNav: true },
  },

  // Kasir (Phase 3)
  {
    path: '/cashier',
    name: 'cashier',
    component: () => import('@/pages/cashier/CashierPage.vue'),
  },

  // Cashflow (Phase 4)
  {
    path: '/cashflow',
    name: 'cashflow',
    component: () => import('@/pages/cashflow/CashflowPage.vue'),
  },
  {
    path: '/cashflow/new',
    name: 'cashflow-new',
    component: () => import('@/pages/cashflow/CashflowEntryFormPage.vue'),
    meta: { hideNav: true },
  },
  {
    path: '/cashflow/categories',
    name: 'cashflow-categories',
    component: () => import('@/pages/cashflow/CashflowCategoriesPage.vue'),
    meta: { hideNav: true },
  },
  {
    path: '/cashflow/:id/edit',
    name: 'cashflow-edit',
    component: () => import('@/pages/cashflow/CashflowEntryFormPage.vue'),
    meta: { hideNav: true },
  },

  // Printer & setelan
  {
    path: '/printer',
    name: 'printer',
    component: () => import('@/pages/printer/PrinterPage.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/pages/settings/SettingsPage.vue'),
  },

  { path: '/:pathMatch(.*)*', redirect: '/' },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// Guard kunci lokal: kalau app terkunci, paksa ke /lock (simpan tujuan asli).
// Sebaliknya, /lock tak berguna saat tidak terkunci → lempar ke home.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (auth.isLocked && to.name !== 'lock') {
    return {
      name: 'lock',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
    }
  }
  if (!auth.isLocked && to.name === 'lock') {
    return { path: '/' }
  }
})
