import { SQSClientConfig } from '@aws-sdk/client-sqs';
import { ConfigService } from '@nestjs/config';

export const getSQSConfig = (configService: ConfigService): SQSClientConfig => ({
  region: configService.get('AWS_REGION') || 'us-east-1',
  credentials: {
    accessKeyId: configService.get('AWS_ACCESS_KEY_ID') || '',
    secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY') || '',
  },
});