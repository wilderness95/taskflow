import type { FastifyInstance } from 'fastify'
import {
  adminInvitationsQuerySchema,
  adminUsersQuerySchema,
  auditQuerySchema,
  createAdminInvitationSchema,
  idParamsSchema,
  pageQuerySchema,
  setAdminRoleSchema,
} from '@taskflow/shared'
import { clientIp, requireActor } from '../../auth/auth.plugin.js'
import type { AdminContext, AdminService } from './admin.service.js'

export function adminRoutes(service: AdminService) {
  const ctx = (req: Parameters<typeof clientIp>[0]): AdminContext => ({ ip: clientIp(req) })
  const userId = (req: { params: unknown }) => idParamsSchema.parse(req.params).id

  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/admin/overview', async (req) => service.overview(requireActor(req)))

    app.get('/api/v1/admin/audit', async (req) =>
      service.listAudit(requireActor(req), auditQuerySchema.parse(req.query)),
    )

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

    app.get('/api/v1/admin/workspaces', async (req) =>
      service.listWorkspaces(requireActor(req), pageQuerySchema.parse(req.query)),
    )

    app.get('/api/v1/admin/invitations', async (req) =>
      service.listInvitations(requireActor(req), adminInvitationsQuerySchema.parse(req.query)),
    )

    app.post('/api/v1/admin/invitations', async (req, reply) => {
      const invitation = await service.createInvitation(
        requireActor(req),
        createAdminInvitationSchema.parse(req.body),
        ctx(req),
      )
      return reply.status(201).send(invitation)
    })

    app.post('/api/v1/admin/invitations/:id/resend', async (req, reply) => {
      const invitation = await service.resendInvitation(requireActor(req), userId(req), ctx(req))
      return reply.status(201).send(invitation)
    })

    app.delete('/api/v1/admin/invitations/:id', async (req, reply) => {
      service.revokeInvitation(requireActor(req), userId(req), ctx(req))
      return reply.status(204).send()
    })
  }
}
