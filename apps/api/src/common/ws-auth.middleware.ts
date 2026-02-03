import { JwtService } from "@nestjs/jwt";
import { Socket } from "socket.io";
import { Logger } from "@nestjs/common";

const logger = new Logger("WsAuthMiddleware");

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

/**
 * Creates a Socket.IO middleware that validates JWT tokens from the handshake.
 * Tokens can be provided via (in order of precedence):
 * - socket.handshake.auth.token (Socket.IO auth object)
 * - socket.handshake.headers.authorization (Bearer token)
 * - socket.handshake.query.token (query string - for native WebSocket compatibility)
 */
export function createWsAuthMiddleware(jwtService: JwtService) {
  return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    try {
      // Extract token from auth object, authorization header, or query string
      let token = socket.handshake.auth?.token;

      if (!token) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
      }

      // Fallback to query string token (for native WebSocket clients)
      if (!token && socket.handshake.query?.token) {
        token = socket.handshake.query.token as string;
      }

      if (!token) {
        logger.warn(
          `WebSocket connection rejected: No token provided (socket: ${socket.id})`,
        );
        return next(new Error("Authentication required"));
      }

      // Verify the token
      const payload = await jwtService.verifyAsync<JwtPayload>(token);

      // Attach user info to the socket
      socket.user = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
      };

      logger.debug(
        `WebSocket authenticated: ${payload.username} (socket: ${socket.id})`,
      );
      next();
    } catch (err) {
      logger.warn(
        `WebSocket authentication failed: ${(err as Error).message} (socket: ${socket.id})`,
      );
      next(new Error("Invalid or expired token"));
    }
  };
}
