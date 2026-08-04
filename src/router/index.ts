import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },

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
