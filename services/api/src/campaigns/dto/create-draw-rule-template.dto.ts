import { IsObject, IsString, MinLength } from 'class-validator';

export class CreateDrawRuleTemplateDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(3)
  description: string;

  @IsObject()
  ruleDefinition: Record<string, unknown>;
}
