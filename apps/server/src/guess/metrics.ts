import { Injectable, Logger } from '@nestjs/common'

/**
 * Métrica técnica de uma tentativa. Contém APENAS metadados: nunca conteúdo de
 * frame (base64/bytes/miniatura), nunca chave de provedor, nunca dado de carta.
 */
export interface GuessMetric {
    event: 'guess_attempt'
    outcome: 'success' | 'error'
    providerId: string
    frameCount: number
    durationMs: number
    errorCode?: string
}

/**
 * Registra métricas técnicas em log estruturado. A forma do objeto é fechada
 * (ver `GuessMetric`) para garantir, por construção, que nenhuma mídia ou
 * segredo entre no log.
 */
@Injectable()
export class GuessMetricsLogger {
    private readonly logger = new Logger('GuessMetrics')

    record(metric: GuessMetric): void {
        this.logger.log(JSON.stringify(metric))
    }
}
