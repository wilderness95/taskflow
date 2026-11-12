import type { FastifyInstance } from 'fastify'
import { adminUsersQuerySchema, idParamsSchema, setAdminRoleSchema } from '@taskflow/shared'
import { clientIp, requireActor } from '../../auth/auth.plugin.js'
import type { AdminContext, AdminService } from './admin.service.js'

export function adminRoutes(service: AdminService) {
  const ctx = (req: Parameters<typeof clientIp>[0]): AdminContext => ({ ip: clientIp(req) })
  const userId = (req: { params: unknown }) => idParamsSchema.parse(req.params).id

  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/admin/users', async (req) =>
      service.listUsers(requireActor(req), adminUsersQuerySchema.parse(req.query)),
    )

    app.get('/api/v1/admin/users/:id', async (req) =>
      service.getUser(requireActor(req), userId(req)),
    )

    app.post('/api/v1/admin/users/:id/suspend', async (req) =>
      service.suspendUser(requireActor(req), userId(req), ctx(req)),
    )

    app.post('/api/v1/admin/users/:id/restore', async (req) =>
      service.restoreUser(requireActor(req), userId(req), ctx(req)),
    )

    app.post('/api/v1/admin/users/:id/revoke-sessions', async (req) =>
      service.revokeSessions(requireActor(req), userId(req), ctx(req)),
    )

    app.post('/api/v1/admin/users/:id/resend-verification', async (req) =>
      service.resendVerification(requireActor(req), userId(req), ctx(req)),
    )

    app.put('/api/v1/admin/users/:id/admin', async (req) =>
      service.setAdminRole(
        requireActor(req),
        userId(req),
        setAdminRoleSchema.parse(req.body),
        ctx(req),
      ),
    )
  }
}
