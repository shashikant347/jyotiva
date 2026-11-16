import { io, type Socket } from 'socket.io-client'
import { getAccessToken, refreshSession } from '../services/api'

/**
 * One Socket.IO connection, signed in with the current access token (read fresh on every connect).
 * The server rejects an expired token with UNAUTHORIZED and Socket.IO does not retry that on its own,
 * so we refresh the token and connect again (at most twice in a row).
 */
export function openSocket(): Socket {
  const socket = io({ auth: cb => cb({ token: getAccessToken() ?? '' }) })
  let retries = 0
  socket.on('connect', () => { retries = 0 })
  socket.on('connect_error', async err => {
    if (err.message === 'UNAUTHORIZED' && retries < 2) {
      retries++
      if (await refreshSession()) socket.connect()
    }
  })
  return socket
}
