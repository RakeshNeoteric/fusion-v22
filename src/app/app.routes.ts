import type { Routes } from '@angular/router';
import { canAccess } from '@core/permissions/permission.guard';
import { signedInGuard, signedOutGuard } from '@core/session/session.guards';

/**
 * Feature paths must stay the same as v21: menu links come from the backend
 * (`'/' + MenuViewName.toLowerCase()`). `data.breadcrumb` is the page title bar text.
 */
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [signedOutGuard],
    title: 'Login',
    loadComponent: () => import('@features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canMatch: [signedInGuard],
    loadComponent: () => import('@core/layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Home',
        data: { breadcrumb: 'Home' },
        loadComponent: () => import('@features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'dashboard',
        title: 'Dashboard',
        data: { breadcrumb: 'Dashboard' },
        canMatch: [canAccess('DBOARD')],
        loadComponent: () => import('@features/home/home-page').then((m) => m.DashboardPage),
      },
      {
        path: 'forbidden',
        title: 'Access denied',
        data: { breadcrumb: 'Access denied' },
        loadComponent: () => import('@core/layout/status-pages').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'Page not found',
        data: { breadcrumb: 'Page not found' },
        loadComponent: () => import('@core/layout/status-pages').then((m) => m.NotFoundPage),
      },
    ],
  },
];
