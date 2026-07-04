import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Cross-cutting transactional email. Marked @Global (like PrismaModule) so any
 * service can inject {@link EmailService} without re-importing this module.
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
