import { Injectable } from '@nestjs/common';
import { evaluateExpression, type RuleContext, type RuleExpression } from '../../domain';

export interface EvaluatedRule {
  code: string;
  name: string;
  action: string;
  matched: boolean;
}

@Injectable()
export class RulesEngineService {
  evaluateAll(
    rules: Array<{
      code: string;
      name: string;
      action: string;
      expression: unknown;
      isEnabled: boolean;
      priority: number;
    }>,
    ctx: RuleContext,
  ): EvaluatedRule[] {
    return rules
      .filter((rule) => rule.isEnabled)
      .sort((a, b) => a.priority - b.priority)
      .map((rule) => ({
        code: rule.code,
        name: rule.name,
        action: rule.action,
        matched: evaluateExpression(rule.expression as RuleExpression, ctx),
      }));
  }
}
