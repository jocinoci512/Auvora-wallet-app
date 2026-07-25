export const CLOCK = Symbol('CLOCK');

export interface ClockPort {
  now(): Date;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGeneratorPort {
  uuid(): string;
}
