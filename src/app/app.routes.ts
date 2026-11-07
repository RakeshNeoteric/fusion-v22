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
        path: 'company-details',
        title: 'Company Details',
        data: { breadcrumb: 'Company / Company Details' },
        canMatch: [canAccess('CMP')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/company/company-details-page').then((m) => m.CompanyDetailsPage),
      },
      {
        path: 'cases',
        title: 'Cases',
        data: { breadcrumb: 'Call Centre / Cases' },
        canMatch: [canAccess('CASES')],
        loadComponent: () =>
          import('@features/cases/case-list/cases-page').then((m) => m.CasesPage),
      },
      {
        path: 'cases/case-details',
        title: 'Case Details',
        data: { breadcrumb: 'Call Centre / Case Details' },
        canMatch: [canAccess('CASES')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/cases/case-details/case-details-page').then((m) => m.CaseDetailsPage),
      },
      {
        path: 'client/client',
        title: 'Clients',
        data: { breadcrumb: 'Client' },
        canMatch: [canAccess('CLIENT')],
        loadComponent: () => import('@features/clients/clients-page').then((m) => m.ClientsPage),
      },
      {
        path: 'client/client-group',
        title: 'Client Groups',
        data: { breadcrumb: 'Client / Client Group' },
        canMatch: [canAccess('CLIENT_GRP')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/client-groups/client-groups-page').then(
            (m) => m.ClientGroupsPage,
          ),
      },
      {
        path: 'services/service-types',
        title: 'Service Types',
        data: { breadcrumb: 'Services / Service Types' },
        canMatch: [canAccess('SRV_PRV_TY')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/configuration/service-types/service-types-page').then(
            (m) => m.ServiceTypesPage,
          ),
      },
      {
        path: 'services/services',
        title: 'Services',
        data: { breadcrumb: 'Services' },
        canMatch: [canAccess('SERVICES')],
        loadComponent: () =>
          import('@features/configuration/services/services-page').then((m) => m.ServicesPage),
      },
      {
        path: 'services/service-providers',
        title: 'Service Providers',
        data: { breadcrumb: 'Services / Service Providers' },
        canMatch: [canAccess('SERVICE_PR')],
        loadComponent: () =>
          import('@features/services/service-providers/service-providers-page').then(
            (m) => m.ServiceProvidersPage,
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
        path: 'users',
        title: 'Users',
        data: { breadcrumb: 'Security / Users' },
        canMatch: [canAccess('USR')],
        loadComponent: () => import('@features/security/users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        title: 'Roles',
        data: { breadcrumb: 'Security / Roles' },
        canMatch: [canAccess('ROLES')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () => import('@features/security/roles/roles-page').then((m) => m.RolesPage),
      },
      {
        // Opened from Roles; maintaining permissions is part of maintaining roles (v21).
        path: 'permissions/:roleId',
        title: 'Permissions',
        data: { breadcrumb: 'Security / Permissions' },
        canMatch: [canAccess('ROLES')],
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('@features/security/permissions/permissions-page').then((m) => m.PermissionsPage),
      },
      {
        path: 'userrolemap',
        title: 'User Roles Mapping',
        data: { breadcrumb: 'Security / User Roles Mapping' },
        canMatch: [canAccess('USRROLEMAP')],
        loadComponent: () =>
          import('@features/security/user-roles/user-roles-page').then((m) => m.UserRolesPage),
      },
      {
        path: 'voucherapproval',
        title: 'Voucher Approval',
        data: { breadcrumb: 'Security / Voucher Approval' },
        canMatch: [canAccess('VchApprvl')],
        loadComponent: () =>
          import('@features/voucher-approval/voucher-approval-page').then(
            (m) => m.VoucherApprovalPage,
          ),
      },
      {
        path: 'reports/clientreports',
        title: 'Client Reports',
        data: { breadcrumb: 'Reports / Client Reports' },
        canMatch: [canAccess('CLIENT_REPORTS')],
        loadComponent: () =>
          import('@features/reports/client-reports/client-reports-page').then(
            (m) => m.ClientReportsPage,
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
