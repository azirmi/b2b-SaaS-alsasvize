import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Department, Role, VisaStage } from '../generated/prisma/enums';

/** Client-facing event names (kept as constants so producers/consumers agree). */
export const EVENT_APPLICATION_CLAIMED = 'applicationClaimed';
export const EVENT_STAGE_CHANGED = 'stageChanged';
export const EVENT_SLA_BREACHED = 'slaBreached';

/** Socket.io room that only privileged (non-customer) users are placed in. */
const STAFF_ROOM = 'staff';

/** Emitted when a staff member claims an application out of a pool. */
export interface ApplicationClaimedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  department: Department;
  claimedByUserId: string;
  assignedStaffId: string;
  at: string;
}

/** Emitted when an application advances from one stage to the next. */
export interface StageChangedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  performedByUserId: string;
  at: string;
}

/** Emitted when the SLA cron reverts a stalled application back to its pool. */
export interface SlaBreachedPayload {
  applicationId: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  revertedStaffId: string;
  thresholdHours: number;
  at: string;
}

/** Authenticated principal stored on the socket after a successful handshake. */
interface AuthenticatedSocketData {
  user: JwtPayload;
}

/**
 * Comma-separated allow-list read from the process environment at load time so
 * it is populated in production (Coolify injects real env vars). Falls back to
 * reflecting the request origin in local dev.
 */
const CORS_ORIGIN = process.env.CORS_ORIGIN?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Real-time hub. Authenticates every socket with the same JWT used by the REST
 * API (HTTP-only cookie for web, `auth.token` for mobile) and rejects anonymous
 * connections. Privileged users join a staff room; workflow events are pushed to
 * that room so clients never poll or refresh.
 */
@WebSocketGateway({
  namespace: 'events',
  cors: {
    origin: CORS_ORIGIN && CORS_ORIGIN.length > 0 ? CORS_ORIGIN : true,
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Authenticates the handshake; drops the socket if the token is missing/invalid. */
  handleConnection(client: Socket): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new Error('Missing authentication token');
      }

      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      (client.data as AuthenticatedSocketData).user = payload;
      if (payload.role !== Role.CUSTOMER) {
        void client.join(STAFF_ROOM);
      }
    } catch {
      client.disconnect(true);
    }
  }

  /** Broadcasts an application claim to every connected staff/admin client. */
  emitApplicationClaimed(payload: ApplicationClaimedPayload): void {
    this.server?.to(STAFF_ROOM).emit(EVENT_APPLICATION_CLAIMED, payload);
  }

  /** Broadcasts a stage transition to every connected staff/admin client. */
  emitStageChanged(payload: StageChangedPayload): void {
    this.server?.to(STAFF_ROOM).emit(EVENT_STAGE_CHANGED, payload);
  }

  /** Broadcasts an SLA breach (auto-revert to pool) to staff/admin clients. */
  emitSlaBreached(payload: SlaBreachedPayload): void {
    this.server?.to(STAFF_ROOM).emit(EVENT_SLA_BREACHED, payload);
  }

  /** Pulls the JWT from the mobile `auth.token` handshake or the web auth cookie. */
  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token as unknown;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return null;
    }
    for (const part of cookieHeader.split(';')) {
      const separator = part.indexOf('=');
      if (separator === -1) {
        continue;
      }
      const name = part.slice(0, separator).trim();
      if (name === ACCESS_TOKEN_COOKIE) {
        return decodeURIComponent(part.slice(separator + 1).trim());
      }
    }
    return null;
  }
}
