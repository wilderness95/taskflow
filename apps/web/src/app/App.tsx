import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage'
import { GuestOnly, RequireAuth } from '../features/auth/RequireAuth'
import { BoardPage } from '../features/boards/BoardPage'
import { WorkspacePage } from '../features/workspaces/WorkspacePage'
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
          <Route element={<RequireAuth />}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/w/:workspaceId" element={<WorkspacePage />} />
            <Route path="/b/:boardId" element={<BoardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
