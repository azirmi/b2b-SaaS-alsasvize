import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HttpResult {
  ok: boolean;
  status: number;
  payload: unknown;
  message: string;
}

type JsonRecord = Record<string, unknown>;

export interface DijizinSystemForm {
  formId: string;
  name: string;
  isActive: boolean;
}

export interface DijizinCustomerForm {
  formId: string;
  name: string;
  status: string | null;
  sentAt: string | null;
  answeredAt: string | null;
}

@Injectable()
export class DijizinService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendConsentRequest(mobilePhone: string): Promise<{ message: string }> {
    const form = new URLSearchParams();
    form.set('mobile_phone', mobilePhone);
    form.set('send_method', 'sms');
    form.set('status', 'ONAY');
    form.set('kvkk', '4');

    const payload = await this.requestWithAuth('POST', '/api/consents', form);

    return {
      message:
        this.readMessage(payload) ??
        'Dijizin KVKK onay kodu SMS olarak gonderildi.',
    };
  }

  async verifyConsentCode(
    mobilePhone: string,
    code: string,
  ): Promise<{ message: string }> {
    const form = new URLSearchParams();
    form.set('status', 'ONAY');
    form.set('kvkk', '4');
    form.set('codes[4]', code);

    const payload = await this.requestWithAuth(
      'POST',
      `/api/consents/${encodeURIComponent(mobilePhone)}`,
      form,
    );

    return {
      message:
        this.readMessage(payload) ??
        'Dijizin KVKK dogrulama islemi basariyla tamamlandi.',
    };
  }

  async getSystemForms(): Promise<DijizinSystemForm[]> {
    const payload = await this.requestWithAuth('GET', '/api/forms');
    return this.mapSystemForms(payload);
  }

  async sendFormToCustomer(
    mobilePhone: string,
    formId: string,
  ): Promise<{ message: string }> {
    const form = new URLSearchParams();
    form.set('form_id', formId);
    form.set('form_ids[]', formId);

    const payload = await this.requestWithAuth(
      'POST',
      `/api/customers/${encodeURIComponent(mobilePhone)}/forms`,
      form,
    );

    return {
      message:
        this.readMessage(payload) ?? 'Secilen Dijizin formu musterine gonderildi.',
    };
  }

  async getCustomerForms(mobilePhone: string): Promise<DijizinCustomerForm[]> {
    const payload = await this.requestWithAuth(
      'GET',
      `/api/customers/${encodeURIComponent(mobilePhone)}/forms`,
    );
    return this.mapCustomerForms(payload);
  }

  private async requestWithAuth(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    form?: URLSearchParams,
  ): Promise<unknown> {
    let token = await this.getAccessToken();
    let result = await this.request(method, path, token, form);

    if (result.status === 401 || result.status === 403) {
      token = await this.getAccessToken(true);
      result = await this.request(method, path, token, form);
    }

    if (!result.ok) {
      throw new BadGatewayException(
        `Dijizin istegi basarisiz oldu (${result.status}): ${result.message}`,
      );
    }

    return result.payload;
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.tokenCache &&
      this.tokenCache.expiresAt > now + 5000
    ) {
      return this.tokenCache.token;
    }

    const clientId = this.getRequiredEnv('DIJIZIN_CLIENT_ID');
    const clientSecret = this.getRequiredEnv('DIJIZIN_CLIENT_SECRET');

    const form = new URLSearchParams();
    form.set('client_id', clientId);
    form.set('client_secret', clientSecret);
    form.set('username', clientId);
    form.set('password', clientSecret);

    const login = await this.request('POST', '/api/auth/login', null, form);
    if (!login.ok) {
      throw new BadGatewayException(
        `Dijizin kimlik dogrulama basarisiz (${login.status}): ${login.message}`,
      );
    }

    const token = this.extractToken(login.payload);
    if (!token) {
      throw new BadGatewayException(
        'Dijizin kimlik dogrulama yanitinda erisim tokeni bulunamadi.',
      );
    }

    const expiresInSeconds = this.extractExpiresIn(login.payload);
    this.tokenCache = {
      token,
      expiresAt: now + expiresInSeconds * 1000,
    };

    return token;
  }

  private async request(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    token: string | null,
    form?: URLSearchParams,
  ): Promise<HttpResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs());

    try {
      const response = await fetch(`${this.baseUrl()}${path}`, {
        method,
        headers: this.headers(token, Boolean(form)),
        body: form ? form.toString() : undefined,
        signal: controller.signal,
      });

      const raw = await response.text();
      const payload = this.parsePayload(raw);

      return {
        ok: response.ok,
        status: response.status,
        payload,
        message: (this.readMessage(payload) ?? raw) || 'Bilinmeyen hata',
      };
    } catch {
      throw new BadGatewayException('Dijizin servisine ulasilamadi.');
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(token: string | null, hasBody: boolean): Headers {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    headers.set('X-Request-Version', 'v2');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (hasBody) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
    return headers;
  }

  private baseUrl(): string {
    const value = this.config.get<string>('DIJIZIN_BASE_URL')?.trim();
    if (!value) {
      throw new InternalServerErrorException(
        'Dijizin ayarlari eksik: DIJIZIN_BASE_URL tanimli degil.',
      );
    }
    return value.replace(/\/$/, '');
  }

  private timeoutMs(): number {
    const raw = Number(this.config.get('DIJIZIN_REQUEST_TIMEOUT_MS'));
    if (Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    return 15000;
  }

  private getRequiredEnv(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new InternalServerErrorException(
        `Dijizin ayarlari eksik: ${name} tanimli degil.`,
      );
    }
    return value;
  }

  private parsePayload(raw: string): unknown {
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  private extractToken(payload: unknown): string | null {
    const root = this.asRecord(payload);
    if (!root) {
      return null;
    }

    const direct = this.readString(root, ['token', 'access_token']);
    if (direct) {
      return direct;
    }

    const data = this.asRecord(root.data);
    if (!data) {
      return null;
    }

    return this.readString(data, ['token', 'access_token']);
  }

  private extractExpiresIn(payload: unknown): number {
    const root = this.asRecord(payload);
    if (!root) {
      return 900;
    }

    const direct = this.readNumber(root, ['expires_in', 'expiresIn']);
    if (direct) {
      return direct;
    }

    const data = this.asRecord(root.data);
    if (!data) {
      return 900;
    }

    return this.readNumber(data, ['expires_in', 'expiresIn']) ?? 900;
  }

  private mapSystemForms(payload: unknown): DijizinSystemForm[] {
    const rows = this.firstArray(payload, ['data', 'forms', 'items']);

    return rows
      .map((row) => this.asRecord(row))
      .filter((row): row is JsonRecord => Boolean(row))
      .map((row) => {
        const formId =
          this.readString(row, ['id', 'form_id', 'formId', 'uuid']) ?? '';
        const name =
          this.readString(row, ['name', 'title', 'form_name', 'formName']) ??
          `Form ${formId}`;

        const activeRaw = row.active ?? row.is_active ?? row.status ?? row.state;
        const isActive = this.toActiveFlag(activeRaw);

        return { formId, name, isActive };
      })
      .filter((row) => row.formId.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }

  private mapCustomerForms(payload: unknown): DijizinCustomerForm[] {
    const rows = this.firstArray(payload, ['data', 'forms', 'items']);

    return rows
      .map((row) => this.asRecord(row))
      .filter((row): row is JsonRecord => Boolean(row))
      .map((row) => {
        const formId =
          this.readString(row, ['form_id', 'formId', 'id', 'uuid']) ?? '';
        const name =
          this.readString(row, ['form_name', 'formName', 'name', 'title']) ??
          `Form ${formId}`;

        return {
          formId,
          name,
          status:
            this.readString(row, ['status', 'state', 'answer_status']) ?? null,
          sentAt:
            this.readString(row, ['sent_at', 'sentAt', 'created_at', 'createdAt']) ??
            null,
          answeredAt:
            this.readString(row, [
              'answered_at',
              'answeredAt',
              'completed_at',
              'completedAt',
              'filled_at',
              'filledAt',
            ]) ?? null,
        };
      })
      .filter((row) => row.formId.length > 0)
      .sort((a, b) => {
        const aTime = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const bTime = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  private readMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      return payload;
    }

    const root = this.asRecord(payload);
    if (!root) {
      return null;
    }

    return (
      this.readString(root, ['message', 'error', 'detail']) ??
      this.readString(this.asRecord(root.data), ['message', 'error', 'detail'])
    );
  }

  private firstArray(payload: unknown, keys: string[]): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    const root = this.asRecord(payload);
    if (!root) {
      return [];
    }

    for (const key of keys) {
      const candidate = root[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    const nested = this.asRecord(root.data);
    if (!nested) {
      return [];
    }

    for (const key of keys) {
      const candidate = nested[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }

    return [];
  }

  private toActiveFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'active', 'aktif', 'onay'].includes(normalized);
    }
    return false;
  }

  private asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as JsonRecord;
  }

  private readString(
    record: JsonRecord | null,
    keys: string[],
  ): string | null {
    if (!record) {
      return null;
    }
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private readNumber(record: JsonRecord, keys: string[]): number | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
    return null;
  }
}
