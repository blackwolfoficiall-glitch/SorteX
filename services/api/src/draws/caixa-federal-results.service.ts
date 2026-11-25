import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

const CAIXA_FEDERAL_ENDPOINT =
  'https://servicebus2.caixa.gov.br/portaldeloterias/api/federal';
const MAX_BODY_BYTES = 64 * 1024;
const CAIXA_RESPONSE_ERROR =
  'A resposta da CAIXA não corresponde ao formato validado da Loteria Federal. Não foi importada.';

export const FEDERAL_EXTRACTION_PATTERN = /^[1-9][0-9]{0,8}$(?![\s\S])/;
type Prizes = [string, string, string, string, string];

@Injectable()
export class CaixaFederalResultsService {
  async fetchExtraction(extractionNumber: string) {
    if (!FEDERAL_EXTRACTION_PATTERN.test(extractionNumber))
      throw new BadRequestException('Informe um número de extração válido.');
    if (process.env.CAIXA_FEDERAL_IMPORT_ENABLED !== 'true')
      throw new ServiceUnavailableException(
        'Importação CAIXA não habilitada neste ambiente. Use o cadastro manual.',
      );

    const sourceUrl = `${CAIXA_FEDERAL_ENDPOINT}/${extractionNumber}`;
    let rawResponse: Buffer;
    try {
      const response = await fetch(sourceUrl, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok)
        throw new BadGatewayException(
          'A CAIXA não retornou a extração solicitada. Nada foi importado.',
        );

      rawResponse = await this.readBody(response);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        'Não foi possível consultar a CAIXA. Nada foi importado.',
      );
    }

    return {
      ...parseCaixaFederalResponse(rawResponse, extractionNumber),
      sourceUrl,
      sourceDocumentHash: createHash('sha256')
        .update(rawResponse)
        .digest('hex'),
    };
  }

  private async readBody(response: Response) {
    if (!response.body) throw new BadGatewayException(CAIXA_RESPONSE_ERROR);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new BadGatewayException(CAIXA_RESPONSE_ERROR);
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    return Buffer.concat(chunks);
  }
}

export function parseCaixaFederalResponse(
  rawResponse: Buffer,
  extractionNumber: string,
) {
  const reject = () => new BadGatewayException(CAIXA_RESPONSE_ERROR);
  let payload: unknown;
  try {
    payload = JSON.parse(rawResponse.toString('utf8')) as unknown;
  } catch {
    throw reject();
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    throw reject();
  const { tipoJogo, numero, listaDezenas, dataApuracao } = payload as Record<
    string,
    unknown
  >;
  if (
    tipoJogo !== 'LOTERIA_FEDERAL' ||
    typeof numero !== 'number' ||
    String(numero) !== extractionNumber ||
    !Array.isArray(listaDezenas) ||
    listaDezenas.length !== 5 ||
    !listaDezenas.every(
      (prize): prize is string =>
        typeof prize === 'string' &&
        ((prize.length === 5 && /^[0-9]{5}$/.test(prize)) ||
          (prize.length === 6 && /^0[0-9]{5}$/.test(prize))),
    ) ||
    typeof dataApuracao !== 'string' ||
    dataApuracao.length !== 10
  )
    throw reject();

  const parts = /^([0-9]{2})\/([0-9]{2})\/([0-9]{4})$/.exec(dataApuracao);
  if (!parts) throw reject();
  const [, day, month, year] = parts;
  const date = `${year}-${month}-${day}`;
  const drawDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(drawDate.getTime()) ||
    !drawDate.toISOString().startsWith(date)
  )
    throw reject();

  // The verified CAIXA feed adds exactly one zero to the five-digit ticket.
  // Do not coerce to numbers, strip multiple zeros, or truncate larger prizes.
  const sourcePrizes = [...listaDezenas] as Prizes;
  const prizes = sourcePrizes.map((value) =>
    value.length === 6 ? value.slice(1) : value,
  ) as Prizes;
  return { extractionNumber, drawDate, sourcePrizes, prizes };
}
