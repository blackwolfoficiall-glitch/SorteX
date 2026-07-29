export interface LotteryResultsProvider {
  getByExtraction(extractionNumber: string): Promise<unknown>;
}
export const LOTTERY_RESULTS_PROVIDER = Symbol('LOTTERY_RESULTS_PROVIDER');

export class ManualLotteryResultsProvider implements LotteryResultsProvider {
  async getByExtraction() {
    throw new Error(
      'Consulta externa desativada: cadastre e revise o resultado manualmente.',
    );
  }
}
