import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
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
    AuthModule,
    UsersModule,
    VisaApplicationsModule,
    DocumentsModule,
    AuditLogsModule,
    SlaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
