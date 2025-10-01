import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Payment Processing System API - Welcome! Visit /api/docs for API documentation.';
  }
}
