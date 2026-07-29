import { IsObject } from 'class-validator';

export class SimulateDrawRuleDto {
  @IsObject()
  ruleDefinition: Record<string, unknown>;
}
