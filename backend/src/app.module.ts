import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from './prisma/prisma.module';
import { SlaModule } from './sla/sla.module';
import { UsersModule } from './users/users.module';
import { VisaApplicationsModule } from './visa-applications/visa-applications.module';

@Module({
  imports: [
    // Loads .env into process.env / ConfigService for the whole app.
    // (Prisma 7 does not read .env at runtime, so this is required.)
    ConfigModule.forRoot({ isGlobal: true }),
    // Powers the @Cron SLA monitor (see SlaModule).
    ScheduleModule.forRoot(),
    PrismaModule,
    EmailModule,
    AuthModule,
    UsersModule,
    VisaApplicationsModule,
    DocumentsModule,
    AuditLogsModule,
    AdminModule,
    SlaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
