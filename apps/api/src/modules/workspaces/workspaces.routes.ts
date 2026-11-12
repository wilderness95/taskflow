import type { FastifyInstance } from 'fastify'
import {
  acceptInvitationSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema,
  idParamsSchema,
  invitationParamsSchema,
  memberParamsSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from '@taskflow/shared'
import { requireActor } from '../../auth/auth.plugin.js'
import type { Config } from '../../config.js'
import type { WorkspacesService } from './workspaces.service.js'

export function workspacesRoutes(service: WorkspacesService, config: Config) {
  const strict = {
    config: { rateLimit: { max: config.AUTH_RATE_LIMIT_MAX, timeWindow: '1 minute' } },
  }

  return async (app: FastifyInstance): Promise<void> => {
    app.get('/api/v1/workspaces', async (req) => ({ data: service.list(requireActor(req)) }))

    app.post('/api/v1/workspaces', async (req, reply) => {
      const workspace = service.create(requireActor(req), createWorkspaceSchema.parse(req.body))
      return reply.status(201).send(workspace)
    })

    app.get('/api/v1/workspaces/:id', async (req) =>
      service.get(requireActor(req), idParamsSchema.parse(req.params).id),
    )

    app.patch('/api/v1/workspaces/:id', async (req) =>
      service.update(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        updateWorkspaceSchema.parse(req.body),
      ),
    )

    app.delete('/api/v1/workspaces/:id', async (req, reply) => {
      service.remove(requireActor(req), idParamsSchema.parse(req.params).id)
      return reply.status(204).send()
    })

    app.get('/api/v1/workspaces/:id/members', async (req) => ({
      data: service.listMembers(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.patch('/api/v1/workspaces/:id/members/:userId', async (req) => {
      const { id, userId } = memberParamsSchema.parse(req.params)
      return service.updateMember(requireActor(req), id, userId, updateMemberSchema.parse(req.body))
    })

    app.delete('/api/v1/workspaces/:id/members/:userId', async (req, reply) => {
      const { id, userId } = memberParamsSchema.parse(req.params)
      service.removeMember(requireActor(req), id, userId)
      return reply.status(204).send()
    })

    app.get('/api/v1/workspaces/:id/invitations', async (req) => ({
      data: service.listInvitations(requireActor(req), idParamsSchema.parse(req.params).id),
    }))

    app.post('/api/v1/workspaces/:id/invitations', strict, async (req, reply) => {
      const invitation = service.invite(
        requireActor(req),
        idParamsSchema.parse(req.params).id,
        createWorkspaceInvitationSchema.parse(req.body),
      )
      return reply.status(201).send(invitation)
    })

    app.delete('/api/v1/workspaces/:id/invitations/:invitationId', async (req, reply) => {
      const { id, invitationId } = invitationParamsSchema.parse(req.params)
      service.revokeInvitation(requireActor(req), id, invitationId)
      return reply.status(204).send()
    })

    app.post('/api/v1/invitations/accept', strict, async (req) =>
      service.acceptInvitation(requireActor(req), acceptInvitationSchema.parse(req.body).token),
    )
  }
}
