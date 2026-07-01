import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

/**
 * Provides the real-time {@link EventsGateway}. JwtModule is registered locally
 * so the gateway can verify handshake tokens; the secret is passed explicitly at
 * verify time from ConfigService (globally available).
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
