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

export interface DijizinConsentCustomerInput {
  mobilePhone: string;
  firstName: string;
  lastName: string;
}

interface DijizinNormalizedCustomer {
  mobilePhone: string;
  subscriberPhone: string;
  firstName: string;
  lastName: string;
}

const DIJIZIN_CONSENT_STATUS = 'ONAY';
const DIJIZIN_COUNTRY_CODE = '90';
const DIJIZIN_LOCALE = 'tr';
const DIJIZIN_RECIPIENT_TYPE = 'BIREYSEL';
const DIJIZIN_SEND_METHOD = 'sms';
const DIJIZIN_SOURCE = 'HS_EORTAM';
const DIJIZIN_ORIGIN = 'https://alsasvize.com';
const DIJIZIN_KVKK_TEXT_TYPE = 1;
const DIJIZIN_ETK_TEXT_TYPE = 3;
const DIJIZIN_ETK_TYPES = ['ARAMA', 'MESAJ', 'EPOSTA'] as const;

@Injectable()
export class DijizinService {
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendConsentRequest(
    customerInput: DijizinConsentCustomerInput,
  ): Promise<{ message: string }> {
    const customer = this.normalizeCustomerInput(customerInput);
    const { kvkkTextId, etkTextId } = await this.getValidTextIds();

    const payload = await this.requestWithAuth(
      'POST',
      '/api/consents',
      this.buildConsentSmsForm(customer, kvkkTextId, etkTextId),
    );

    return {
      message: this.readMessage(payload) ??
        'Dijizin KVKK onay kodu SMS olarak gonderildi.',
    };
  }

  async verifyConsentCode(
    mobilePhone: string,
    code: string,
  ): Promise<{ message: string }> {
    const { kvkkTextId } = await this.getValidTextIds();
    const normalizedPhone = this.normalizeMobilePhone(mobilePhone);
    const form = new URLSearchParams();
    form.set('status', DIJIZIN_CONSENT_STATUS);
    form.set('kvkk', kvkkTextId);
    form.set(`codes[${kvkkTextId}]`, code);

    const payload = await this.requestWithAuth(
      'POST',
      `/api/consents/${encodeURIComponent(normalizedPhone)}`,
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
    const normalizedPhone = this.normalizeMobilePhone(mobilePhone);
    const form = new URLSearchParams();
    form.set('form_id', formId);
    form.set('form_ids[]', formId);

    const payload = await this.requestWithAuth(
      'POST',
      `/api/customers/${encodeURIComponent(normalizedPhone)}/forms`,
      form,
    );

    return {
      message:
        this.readMessage(payload) ?? 'Secilen Dijizin formu musterine gonderildi.',
    };
  }

  async getCustomerForms(mobilePhone: string): Promise<DijizinCustomerForm[]> {
    const normalizedPhone = this.normalizeMobilePhone(mobilePhone);
    const payload = await this.requestWithAuth(
      'GET',
      `/api/customers/${encodeURIComponent(normalizedPhone)}/forms`,
    );
    return this.mapCustomerForms(payload);
  }

  private normalizeCustomerInput(
    input: DijizinConsentCustomerInput,
  ): DijizinNormalizedCustomer {
    return {
      mobilePhone: this.normalizeMobilePhone(input.mobilePhone),
      subscriberPhone: this.normalizeSubscriberPhone(input.mobilePhone),
      firstName: this.normalizeNamePart(input.firstName, 'Customer'),
      lastName: this.normalizeNamePart(input.lastName, 'User'),
    };
  }

  private normalizeNamePart(value: string | undefined, fallback: string): string {
    const normalized = value?.trim().replace(/\s+/g, ' ');
    return normalized && normalized.length > 0 ? normalized : fallback;
  }

  private normalizeMobilePhone(value: string): string {
    const digits = value.trim().replace(/\D/g, '');
    if (digits.length === 0) {
      return value.trim().replace(/^\+/, '');
    }
    if (digits.length === 10) {
      // Turkish local format: 5xxxxxxxxx -> 905xxxxxxxxx
      return `90${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `90${digits.slice(1)}`;
    }
    return digits;
  }

  private normalizeSubscriberPhone(value: string): string {
    const digits = value.trim().replace(/\D/g, '');
    if (digits.length === 10) {
      return digits;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits.slice(1);
    }
    if (digits.length === 12 && digits.startsWith('90')) {
      return digits.slice(2);
    }
    if (digits.length === 14 && digits.startsWith('0090')) {
      return digits.slice(4);
    }
    if (digits.length > 10) {
      return digits.slice(-10);
    }

    throw new BadGatewayException(
      'Dijizin SMS gonderimi icin gecerli telefon formati bulunamadi.',
    );
  }

  private buildConsentSmsForm(
    customer: DijizinNormalizedCustomer,
    kvkkTextId: string,
    etkTextId: string,
  ): URLSearchParams {
    const form = new URLSearchParams();

    form.set('first_name', customer.firstName);
    form.set('last_name', customer.lastName);
    form.set('country_code', DIJIZIN_COUNTRY_CODE);
    form.set('mobile_phone', customer.subscriberPhone);
    form.set('locale', DIJIZIN_LOCALE);
    form.set('kvkk', kvkkTextId);
    form.set('status', DIJIZIN_CONSENT_STATUS);
    form.set('etk', etkTextId);
    for (const type of DIJIZIN_ETK_TYPES) {
      form.append('types[]', type);
    }
    form.set('recipient_type', DIJIZIN_RECIPIENT_TYPE);
    form.set('send_method', DIJIZIN_SEND_METHOD);
    form.set('source', DIJIZIN_SOURCE);
    form.set('origin', DIJIZIN_ORIGIN);

    return form;
  }

  private async getValidTextIds(): Promise<{
    kvkkTextId: string;
    etkTextId: string;
  }> {
    const payload = await this.requestWithAuth('GET', '/api/texts');
    const rows = this.firstArray(payload, ['data', 'texts', 'items']);

    let kvkkTextId: string | null = null;
    let etkTextId: string | null = null;

    for (const rowValue of rows) {
      const row = this.asRecord(rowValue);
      if (!row) {
        continue;
      }

      const isActive = this.toActiveFlag(
        row.active ?? row.is_active ?? row.status ?? row.state,
      );
      if (!isActive) {
        continue;
      }

      const type = this.readNumber(row, ['type', 'text_type', 'textType']);
      const textId = this.readIdentifier(row, ['id', 'text_id', 'textId', 'uuid']);
      if (!type || !textId) {
        continue;
      }

      if (type === DIJIZIN_KVKK_TEXT_TYPE && !kvkkTextId) {
        kvkkTextId = textId;
      }
      if (type === DIJIZIN_ETK_TEXT_TYPE && !etkTextId) {
        etkTextId = textId;
      }

      if (kvkkTextId && etkTextId) {
        break;
      }
    }

    if (!kvkkTextId || !etkTextId) {
      throw new BadGatewayException(
        'Dijizin aktif KVKK/ETK metin ID degerleri bulunamadi.',
      );
    }

    return { kvkkTextId, etkTextId };
  }

  private async requestWithAuth(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    form?: URLSearchParams,
  ): Promise<unknown> {
    const result = await this.requestWithAuthResult(method, path, form);
    if (!result.ok) {
      this.throwProviderError(result);
    }

    return result.payload;
  }

  private async requestWithAuthResult(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    form?: URLSearchParams,
  ): Promise<HttpResult> {
    let token = await this.getAccessToken();
    let result = await this.request(method, path, token, form);

    if (result.status === 401 || result.status === 403) {
      token = await this.getAccessToken(true);
      result = await this.request(method, path, token, form);
    }

    return result;
  }

  private throwProviderError(result: HttpResult): never {
    this.logDijizinApiError({
      response: { data: result.payload },
      message: result.message,
    });
    throw new BadGatewayException(
      this.resolveProviderErrorMessage(result.payload) ??
        `Dijizin istegi basarisiz oldu (${result.status}): ${result.message}`,
    );
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
      this.logDijizinApiError({
        response: { data: login.payload },
        message: login.message,
      });
      throw new BadGatewayException(
        this.resolveProviderErrorMessage(login.payload) ??
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
    } catch (error) {
      this.logDijizinApiError(error);
      throw new BadGatewayException(
        this.resolveProviderErrorMessageFromError(error) ??
          'Dijizin servisine ulasilamadi.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveProviderErrorMessage(payload: unknown): string | null {
    const fromPayload = this.readMessage(payload);
    if (fromPayload) {
      return fromPayload;
    }
    if (typeof payload === 'string' && payload.trim().length > 0) {
      return payload.trim();
    }
    return null;
  }

  private resolveProviderErrorMessageFromError(error: unknown): string | null {
    const asAxiosLike = error as {
      response?: { data?: unknown };
      message?: string;
    };

    const providerMessage = this.resolveProviderErrorMessage(
      asAxiosLike.response?.data,
    );
    if (providerMessage) {
      return providerMessage;
    }

    const runtimeMessage = asAxiosLike.message;
    if (typeof runtimeMessage === 'string' && runtimeMessage.trim().length > 0) {
      return runtimeMessage.trim();
    }

    return null;
  }

  private logDijizinApiError(error: unknown): void {
    const asAxiosLike = error as {
      response?: { data?: unknown };
      message?: string;
    };
    console.error('DIJIZIN API ERROR:', asAxiosLike.response?.data ?? asAxiosLike.message);
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
      this.readValidationMessage(root) ??
      this.readString(this.asRecord(root.data), ['message', 'error', 'detail']) ??
      this.readValidationMessage(this.asRecord(root.data))
    );
  }

  private readValidationMessage(record: JsonRecord | null): string | null {
    if (!record) {
      return null;
    }

    const errors = this.asRecord(record.errors);
    if (!errors) {
      return null;
    }

    for (const value of Object.values(errors)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim().length > 0) {
            return item.trim();
          }
        }
      }

      const nested = this.asRecord(value);
      if (!nested) {
        continue;
      }
      const nestedMessage = this.readValidationMessage({ errors: nested });
      if (nestedMessage) {
        return nestedMessage;
      }
    }

    return null;
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

  private readIdentifier(
    record: JsonRecord,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
    }

    return null;
  }
}
