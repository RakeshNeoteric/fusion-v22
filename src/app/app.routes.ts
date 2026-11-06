import type { Routes } from '@angular/router';
import { canAccess } from '@core/permissions/permission.guard';
import { signedInGuard, signedOutGuard } from '@core/session/session.guards';
import { unsavedChangesGuard } from '@shared/navigation/unsaved-changes.guard';

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
        path: 'body-location',
        title: 'Body Locations',
        data: { breadcrumb: 'Configuration / Body Locations' },
        canMatch: [canAccess('BODY_LOC')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/body-locations/body-locations-page').then(
            (m) => m.BodyLocationsPage,
          ),
      },
      {
        path: 'branches',
        title: 'Branches',
        data: { breadcrumb: 'Configuration / Branches' },
        canMatch: [canAccess('BRANCHES')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/branches/branches-page').then((m) => m.BranchesPage),
      },
      {
        path: 'documents/documents',
        title: 'Documents',
        data: { breadcrumb: 'Configuration / Documents' },
        canMatch: [canAccess('DOCUMENTS')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/documents/documents-page').then((m) => m.DocumentsPage),
      },
      {
        path: 'vehicle/vehicle',
        title: 'Vehicles',
        data: { breadcrumb: 'Vehicle' },
        canMatch: [canAccess('VEH_LIST')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/vehicles/vehicles-page').then((m) => m.VehiclesPage),
      },
      {
        path: 'transport-operator/transport',
        title: 'Transport Operators',
        data: { breadcrumb: 'Transport Operator' },
        canMatch: [canAccess('TRANS_OP')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/transport-operators/transport-operators-page').then(
            (m) => m.TransportOperatorsPage,
          ),
      },
      {
        path: 'claim-centre',
        title: 'Claim Centres',
        data: { breadcrumb: 'Configuration / Claim Centre' },
        canMatch: [canAccess('CLM_CTR')],
        loadComponent: () =>
          import('@features/configuration/claim-centres/claim-centres-page').then(
            (m) => m.ClaimCentresPage,
          ),
      },
      {
        path: 'list/list',
        title: 'Rating Questions',
        data: { breadcrumb: 'Rating Questions / List' },
        canMatch: [canAccess('RQL')],
        loadComponent: () =>
          import('@features/configuration/rating-questions/rating-questions-page').then(
            (m) => m.RatingQuestionsPage,
          ),
      },
      {
        path: 'options/options',
        title: 'Rating Question Options',
        data: { breadcrumb: 'Rating Questions / Options' },
        canMatch: [canAccess('RQO')],
        loadComponent: () =>
          import('@features/configuration/rating-question-options/rating-question-options-page').then(
            (m) => m.RatingQuestionOptionsPage,
          ),
      },
      {
        path: 'types/types',
        title: 'Rating Question Types',
        data: { breadcrumb: 'Rating Questions / Types' },
        canMatch: [canAccess('RQT')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/rating-question-types/rating-question-types-page').then(
            (m) => m.RatingQuestionTypesPage,
          ),
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
