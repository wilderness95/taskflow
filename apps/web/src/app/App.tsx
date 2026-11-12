import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AdminLayout } from '../features/admin/AdminLayout'
import { AdminUsersPage } from '../features/admin/AdminUsersPage'
import { AdminOverviewPage } from '../features/admin/AdminOverviewPage'
import { ApiKeysPage } from '../features/apikeys/ApiKeysPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage'
import { GuestOnly, RequireAuth } from '../features/auth/RequireAuth'
import { BoardPage } from '../features/boards/BoardPage'
import { AcceptInvitationPage } from '../features/auth/AcceptInvitationPage'
import { ListPage } from '../features/lists/ListPage'
import { ListsPage } from '../features/lists/ListsPage'
import { WorkspaceMembersPage } from '../features/workspaces/WorkspaceMembersPage'
import { WorkspacePage } from '../features/workspaces/WorkspacePage'
import { ToastHost } from '../shared/ui/ToastHost'
import { PaletteHost } from '../features/palette/PaletteHost'
import { RootRedirect } from './RootRedirect'
import { queryClient } from './queryClient'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          {/* A levélben kapott hivatkozások bejelentkezett állapotban is működnek. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<PaletteHost />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/w/:workspaceId" element={<WorkspacePage />} />
              <Route path="/w/:workspaceId/lists" element={<ListsPage />} />
              <Route path="/l/:listId" element={<ListPage />} />
              <Route path="/w/:workspaceId/members" element={<WorkspaceMembersPage />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="users" element={<AdminUsersPage />} />
              </Route>
              <Route path="/settings/api-keys" element={<ApiKeysPage />} />
              <Route path="/b/:boardId" element={<BoardPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastHost />
    </QueryClientProvider>
  )
}
