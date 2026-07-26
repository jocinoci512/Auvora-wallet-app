import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ClockPort, IdGeneratorPort } from '../../application/ports/clock.port';

@Injectable()
export class SystemClockAdapter implements ClockPort {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class UuidIdGeneratorAdapter implements IdGeneratorPort {
  uuid(): string {
    return randomUUID();
  }
}
