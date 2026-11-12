import { beforeEach, describe, expect, it } from 'vitest'
import { workspaceMembers } from '../../db/schema.js'
import { bearer, createTestApp, signUp } from '../../testing/helpers.js'

let t: ReturnType<typeof createTestApp>

beforeEach(() => {
  t = createTestApp({ REGISTRATION_MODE: 'open', MAX_UPLOAD_MB: '1' })
})

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')

async function setup() {
  const owner = await signUp(t.app, 'owner@example.com', 'Olga')
  const viewer = await signUp(t.app, 'viewer@example.com', 'Vera')
  const stranger = await signUp(t.app, 'stranger@example.com', 'Samu')
  const ws = (await owner.api.get('/workspaces')).body.data[0]
  t.db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId: viewer.user.id, role: 'viewer' })
    .run()
  const board = (
    await owner.api.post(`/workspaces/${ws.id}/boards`, { title: 'T', visibility: 'workspace' })
  ).body
  const col = (await owner.api.post(`/boards/${board.id}/columns`, { title: 'Todo' })).body
  const card = (await owner.api.post(`/columns/${col.id}/cards`, { title: 'K' })).body
  return { owner, viewer, stranger, ws, board, card }
}

const upload = (
  who: { cookie: string },
  cardId: string,
  body: Buffer,
  type = 'image/png',
  name = 'kep.png',
) =>
  t.app.inject({
    method: 'POST',
    url: `/api/v1/cards/${cardId}/attachments?name=${encodeURIComponent(name)}`,
    headers: { cookie: who.cookie, 'content-type': type },
    payload: body,
  })

describe('attachments', () => {
  it('uploads, lists, downloads and deletes a file', async () => {
    const { owner, card } = await setup()
    const res = await upload(owner, card.id, PNG)
    expect(res.statusCode).toBe(201)
    const created = res.json()
    expect(created).toMatchObject({
      cardId: card.id,
      fileName: 'kep.png',
      mimeType: 'image/png',
      size: PNG.length,
      isImage: true,
    })
    expect(t.files.keys()).toHaveLength(1)
    expect((await owner.api.get(`/cards/${card.id}`)).body.attachmentCount).toBe(1)
    expect((await owner.api.get(`/cards/${card.id}/attachments`)).body.data).toHaveLength(1)

    const file = await t.app.inject({
      url: `/api/v1/attachments/${created.id}/file`,
      headers: { cookie: owner.cookie },
    })
    expect(file.statusCode).toBe(200)
    expect(file.headers['content-type']).toBe('image/png')
    expect(file.headers['content-disposition']).toContain('inline')
    expect(file.rawPayload.equals(PNG)).toBe(true)

    expect((await owner.api.delete(`/attachments/${created.id}`)).status).toBe(204)
    expect(t.files.keys()).toHaveLength(0)
    expect((await owner.api.get(`/cards/${card.id}/attachments`)).body.data).toEqual([])
  })

  it('serves non-images as downloads and sanitizes the file name', async () => {
    const { owner, card } = await setup()
    const res = await upload(
      owner,
      card.id,
      Buffer.from('<script>1</script>'),
      'text/html',
      '../x.html',
    )
    const created = res.json()
    expect(created.fileName).toBe('_x.html')
    expect(created.isImage).toBe(false)
    const file = await t.app.inject({
      url: `/api/v1/attachments/${created.id}/file`,
      headers: { cookie: owner.cookie },
    })
    expect(file.headers['content-type']).toBe('application/octet-stream')
    expect(file.headers['content-disposition']).toContain('attachment')
    expect(file.headers['x-content-type-options']).toBe('nosniff')
  })

  it('rejects empty and oversized files', async () => {
    const { owner, card } = await setup()
    expect((await upload(owner, card.id, Buffer.alloc(0))).statusCode).toBe(400)
    const big = await upload(owner, card.id, Buffer.alloc(1024 * 1024 + 1), 'application/pdf')
    expect(big.statusCode).toBe(413)
    expect(big.json().error.code).toBe('payload_too_large')
    expect(t.files.keys()).toHaveLength(0)
  })

  it('sets and clears a cover image; only images of this card are accepted', async () => {
    const { owner, board, card } = await setup()
    const image = (await upload(owner, card.id, PNG)).json()
    const doc = (await upload(owner, card.id, Buffer.from('x'), 'application/pdf', 'a.pdf')).json()

    expect((await owner.api.patch(`/cards/${card.id}`, { coverAttachmentId: doc.id })).status).toBe(
      422,
    )
    const set = await owner.api.patch(`/cards/${card.id}`, { coverAttachmentId: image.id })
    expect(set.body.coverAttachmentId).toBe(image.id)
    const view = (await owner.api.get(`/boards/${board.id}`)).body
    expect(view.columns[0].cards[0].coverAttachmentId).toBe(image.id)

    // a törlés leveszi a borítót
    await owner.api.delete(`/attachments/${image.id}`)
    expect((await owner.api.get(`/cards/${card.id}`)).body.coverAttachmentId).toBeNull()
    expect(
      (await owner.api.patch(`/cards/${card.id}`, { coverAttachmentId: image.id })).status,
    ).toBe(422)
  })

  it('removes the files when the card is deleted', async () => {
    const { owner, card } = await setup()
    await upload(owner, card.id, PNG)
    await owner.api.delete(`/cards/${card.id}`)
    await new Promise((resolve) => setImmediate(resolve))
    expect(t.files.keys()).toHaveLength(0)
  })

  it('lets viewers read but not write; strangers see nothing', async () => {
    const { owner, viewer, stranger, card } = await setup()
    const created = (await upload(owner, card.id, PNG)).json()

    expect((await upload(viewer, card.id, PNG)).statusCode).toBe(403)
    expect((await viewer.api.delete(`/attachments/${created.id}`)).status).toBe(403)
    expect((await viewer.api.get(`/cards/${card.id}/attachments`)).status).toBe(200)
    const read = await t.app.inject({
      url: `/api/v1/attachments/${created.id}/file`,
      headers: { cookie: viewer.cookie },
    })
    expect(read.statusCode).toBe(200)

    expect((await upload(stranger, card.id, PNG)).statusCode).toBe(404)
    expect((await stranger.api.get(`/cards/${card.id}/attachments`)).status).toBe(404)
    expect((await stranger.api.delete(`/attachments/${created.id}`)).status).toBe(404)
    const denied = await t.app.inject({
      url: `/api/v1/attachments/${created.id}/file`,
      headers: { cookie: stranger.cookie },
    })
    expect(denied.statusCode).toBe(404)
    const anonymous = await t.app.inject({ url: `/api/v1/attachments/${created.id}/file` })
    expect(anonymous.statusCode).toBe(401)
  })

  it('works with API keys: boards:write uploads, boards:read cannot', async () => {
    const { owner, card } = await setup()
    const mk = async (scopes: string[]) =>
      (await owner.api.post('/api-keys', { name: 'k', scopes })).body.key as string
    const writer = await mk(['boards:read', 'boards:write'])
    const reader = await mk(['boards:read'])
    const send = (key: string) =>
      t.app.inject({
        method: 'POST',
        url: `/api/v1/cards/${card.id}/attachments?name=a.png`,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'image/png' },
        payload: PNG,
      })
    expect((await send(writer)).statusCode).toBe(201)
    const denied = await send(reader)
    expect(denied.statusCode).toBe(403)
    expect(denied.json().error.code).toBe('insufficient_scope')
    expect((await bearer(t.app, reader).get(`/cards/${card.id}/attachments`)).status).toBe(200)
  })
})
