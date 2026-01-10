const express = require('express')
const os = require('os')
const http = require('http')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

app.use(cors())
app.use(express.json())

const signToken = (user) => {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  })
}

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    req.user = user
    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

const getLanAddress = () => {
  const networks = os.networkInterfaces()
  for (const name of Object.keys(networks)) {
    for (const net of networks[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

const getConversationUnread = async (conversationId, userId) => {
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  })

  const lastReadAt = membership?.lastReadAt
  return prisma.message.count({
    where: {
      conversationId,
      createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
      senderId: { not: userId },
    },
  })
}

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

const usersBySocket = new Map()
const socketsByUser = new Map()
const activeCalls = new Map()
const pendingCalls = new Map()

const buildUserList = () => {
  return Array.from(socketsByUser.keys()).map((username) => ({ username }))
}

const broadcastUsers = () => {
  io.emit('users:update', { users: buildUserList() })
}

const setCallPair = (a, b) => {
  if (!a || !b) return
  activeCalls.set(a, b)
  activeCalls.set(b, a)
}

const clearCallPair = (username) => {
  const peer = activeCalls.get(username)
  if (peer) {
    activeCalls.delete(peer)
  }
  activeCalls.delete(username)
  return peer
}

const setPendingPair = (a, b) => {
  if (!a || !b) return
  pendingCalls.set(a, b)
  pendingCalls.set(b, a)
}

const clearPendingPair = (username) => {
  const peer = pendingCalls.get(username)
  if (peer) {
    pendingCalls.delete(peer)
  }
  pendingCalls.delete(username)
  return peer
}

app.get('/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }

  const trimmed = String(username).trim().toLowerCase()
  if (!trimmed) {
    return res.status(400).json({ error: 'Invalid username' })
  }

  const exists = await prisma.user.findUnique({ where: { username: trimmed } })
  if (exists) {
    return res.status(409).json({ error: 'Username already exists' })
  }

  const passwordHash = await bcrypt.hash(String(password), 10)
  const user = await prisma.user.create({
    data: {
      username: trimmed,
      passwordHash,
    },
  })

  const token = signToken(user)
  return res.json({ token, user: { id: user.id, username: user.username } })
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }

  const trimmed = String(username).trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { username: trimmed } })
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = signToken(user)
  return res.json({ token, user: { id: user.id, username: user.username } })
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = req.user
  return res.json({ user: { id: user.id, username: user.username } })
})

app.put('/api/keys', authMiddleware, async (req, res) => {
  const { identityKey } = req.body || {}
  if (!identityKey) {
    return res.status(400).json({ error: 'Missing identity key' })
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { identityKey: String(identityKey) },
  })

  return res.json({ ok: true, identityKey: user.identityKey })
})

app.get('/api/keys/:username', authMiddleware, async (req, res) => {
  const username = String(req.params.username || '').trim().toLowerCase()
  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.identityKey) {
    return res.status(404).json({ error: 'Key not found' })
  }

  return res.json({ username: user.username, identityKey: user.identityKey })
})

app.get('/api/users', authMiddleware, async (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase()
  const users = await prisma.user.findMany({
    where: {
      username: search ? { contains: search } : undefined,
      id: { not: req.user.id },
    },
    take: 10,
    orderBy: { username: 'asc' },
  })

  res.json({
    users: users.map((user) => ({ id: user.id, username: user.username })),
  })
})

app.get('/api/conversations', authMiddleware, async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      members: {
        some: { userId: req.user.id },
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: 'desc' },
  })

  const formatted = await Promise.all(
    conversations.map(async (conversation) => {
      const unread = await getConversationUnread(conversation.id, req.user.id)
      const lastMessage = conversation.messages[0]
      return {
        id: conversation.id,
        title: conversation.title,
        isGroup: conversation.isGroup,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              createdAt: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              metadata: lastMessage.metadata,
            }
          : null,
        members: conversation.members.map((member) => ({
          id: member.user.id,
          username: member.user.username,
          role: member.role,
        })),
        unread,
      }
    }),
  )

  res.json({ conversations: formatted })
})

app.post('/api/conversations', authMiddleware, async (req, res) => {
  const { title, members = [] } = req.body || {}
  const usernames = Array.from(
    new Set(
      [req.user.username, ...members]
        .map((name) => String(name).trim().toLowerCase())
        .filter(Boolean),
    ),
  )

  const users = await prisma.user.findMany({
    where: {
      username: { in: usernames },
    },
  })

  if (users.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 members' })
  }

  const isGroup = users.length > 2

  if (!isGroup) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: users.map((user) => user.id) },
          },
        },
      },
      include: { members: true },
    })

    if (existing && existing.members.length === 2) {
      return res.json({ id: existing.id, reused: true })
    }
  }

  const conversation = await prisma.conversation.create({
    data: {
      title: isGroup ? title || 'New group' : null,
      isGroup,
      members: {
        create: users.map((user) => ({
          userId: user.id,
          role: user.id === req.user.id ? 'ADMIN' : 'MEMBER',
        })),
      },
    },
  })

  users.forEach((member) => {
    const socketId = socketsByUser.get(member.username)
    if (!socketId) return
    const socket = io.sockets.sockets.get(socketId)
    if (socket) {
      socket.join(`conversation:${conversation.id}`)
    }
    io.to(socketId).emit('conversation:created', { conversationId: conversation.id })
  })

  res.json({ id: conversation.id })
})

app.post('/api/conversations/:id/keys', authMiddleware, async (req, res) => {
  const conversationId = req.params.id
  const { keys = [] } = req.body || {}

  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user.id,
      },
    },
  })

  if (!membership || membership.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const payloads = Array.isArray(keys) ? keys : []
  const created = []

  for (const item of payloads) {
    if (!item?.userId || !item?.wrappedKey || !item?.iv) {
      continue
    }

    const entry = await prisma.conversationKey.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: item.userId,
        },
      },
      update: {
        wrappedKey: String(item.wrappedKey),
        iv: String(item.iv),
        createdById: req.user.id,
      },
      create: {
        conversationId,
        userId: item.userId,
        wrappedKey: String(item.wrappedKey),
        iv: String(item.iv),
        createdById: req.user.id,
      },
    })

    created.push(entry.userId)
  }

  res.json({ ok: true, users: created })
})

app.get('/api/conversations/:id/keys/me', authMiddleware, async (req, res) => {
  const conversationId = req.params.id
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user.id,
      },
    },
  })

  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const key = await prisma.conversationKey.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user.id,
      },
    },
    include: {
      createdBy: true,
    },
  })

  if (!key) {
    return res.status(404).json({ error: 'Key not found' })
  }

  res.json({
    wrappedKey: key.wrappedKey,
    iv: key.iv,
    createdBy: {
      id: key.createdBy.id,
      username: key.createdBy.username,
      identityKey: key.createdBy.identityKey,
    },
  })
})

app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  const conversationId = req.params.id
  const membership = await prisma.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user.id,
      },
    },
  })

  if (!membership) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 50,
    include: { sender: true },
  })

  res.json({
    messages: messages.map((message) => ({
      id: message.id,
      body: message.body,
      metadata: message.metadata,
      createdAt: message.createdAt,
      sender: { id: message.sender.id, username: message.sender.username },
    })),
  })
})

app.post('/api/conversations/:id/read', authMiddleware, async (req, res) => {
  const conversationId = req.params.id
  await prisma.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: req.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })
  res.json({ ok: true })
})

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) {
    return next(new Error('Unauthorized'))
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      return next(new Error('Unauthorized'))
    }
    socket.user = user
    return next()
  } catch (error) {
    return next(new Error('Unauthorized'))
  }
})

io.on('connection', async (socket) => {
  const user = socket.user
  usersBySocket.set(socket.id, user.username)
  socketsByUser.set(user.username, socket.id)

  const memberships = await prisma.conversationMember.findMany({
    where: { userId: user.id },
    select: { conversationId: true },
  })

  memberships.forEach((membership) => {
    socket.join(`conversation:${membership.conversationId}`)
  })

  socket.emit('user:ready', {
    username: user.username,
    users: buildUserList(),
  })

  broadcastUsers()

  socket.on('message:send', async ({ conversationId, body, metadata }) => {
    if (!conversationId || !body) return

    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    })

    if (!membership) {
      return
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        body: String(body),
        metadata: metadata && typeof metadata === 'object' ? metadata : null,
      },
      include: { sender: true },
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    })

    io.to(`conversation:${conversationId}`).emit('message:new', {
      id: message.id,
      conversationId,
      body: message.body,
      metadata: message.metadata,
      createdAt: message.createdAt,
      sender: { id: message.sender.id, username: message.sender.username },
    })
  })

  socket.on('conversation:join', async ({ conversationId }) => {
    if (!conversationId) return
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    })
    if (!membership) return
    socket.join(`conversation:${conversationId}`)
  })

  socket.on('conversation:read', async ({ conversationId }) => {
    if (!conversationId) return
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: { lastReadAt: new Date() },
    })
  })

  socket.on('call:invite', ({ to, type }) => {
    const from = user.username
    if (!from || !to) {
      return
    }

    const recipientSocketId = socketsByUser.get(to)
    if (!recipientSocketId) {
      socket.emit('call:unavailable', { to })
      return
    }

    if (
      activeCalls.has(to) ||
      activeCalls.has(from) ||
      pendingCalls.has(to) ||
      pendingCalls.has(from)
    ) {
      socket.emit('call:busy', { to })
      return
    }

    setPendingPair(from, to)
    io.to(recipientSocketId).emit('call:invite', { from, type })
  })

  socket.on('call:accept', ({ to }) => {
    const from = user.username
    if (!from || !to) {
      return
    }

    const recipientSocketId = socketsByUser.get(to)
    if (!recipientSocketId) {
      socket.emit('call:unavailable', { to })
      return
    }

    const pendingPeer = pendingCalls.get(from)
    if (pendingPeer && pendingPeer !== to) {
      socket.emit('call:busy', { to })
      return
    }

    clearPendingPair(from)
    setCallPair(from, to)
    io.to(recipientSocketId).emit('call:accept', { from })
  })

  socket.on('call:offer', ({ to, sdp }) => {
    const from = user.username
    if (!from || !to || !sdp) {
      return
    }

    const recipientSocketId = socketsByUser.get(to)
    if (!recipientSocketId) {
      socket.emit('call:unavailable', { to })
      return
    }

    setCallPair(from, to)
    io.to(recipientSocketId).emit('call:offer', { from, sdp })
  })

  socket.on('call:answer', ({ to, sdp }) => {
    const from = user.username
    if (!from || !to || !sdp) {
      return
    }

    const recipientSocketId = socketsByUser.get(to)
    if (!recipientSocketId) {
      socket.emit('call:unavailable', { to })
      return
    }

    setCallPair(from, to)
    io.to(recipientSocketId).emit('call:answer', { from, sdp })
  })

  socket.on('call:ice', ({ to, candidate }) => {
    const from = user.username
    if (!from || !to || !candidate) {
      return
    }

    const recipientSocketId = socketsByUser.get(to)
    if (!recipientSocketId) {
      return
    }

    io.to(recipientSocketId).emit('call:ice', { from, candidate })
  })

  socket.on('call:reject', ({ to }) => {
    const from = user.username
    if (!from || !to) {
      return
    }

    clearPendingPair(from)
    clearCallPair(from)
    const recipientSocketId = socketsByUser.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call:reject', { from })
    }
  })

  socket.on('call:end', ({ to }) => {
    const from = user.username
    if (!from || !to) {
      return
    }

    clearPendingPair(from)
    clearCallPair(from)
    const recipientSocketId = socketsByUser.get(to)
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call:end', { from })
    }
  })

  socket.on('disconnect', () => {
    const username = user.username
    if (username) {
      const pendingPeer = clearPendingPair(username)
      if (pendingPeer) {
        const pendingSocketId = socketsByUser.get(pendingPeer)
        if (pendingSocketId) {
          io.to(pendingSocketId).emit('call:end', { from: username })
        }
      }

      const peer = clearCallPair(username)
      if (peer) {
        const peerSocketId = socketsByUser.get(peer)
        if (peerSocketId) {
          io.to(peerSocketId).emit('call:end', { from: username })
        }
      }

      usersBySocket.delete(socket.id)
      socketsByUser.delete(username)
      broadcastUsers()
    }
  })
})

server.listen(PORT, HOST, () => {
  const lan = getLanAddress()
  console.log(`Server listening on http://${HOST}:${PORT}`)
  console.log(`LAN access: http://${lan}:${PORT}`)
})
