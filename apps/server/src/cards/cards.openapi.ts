import { z } from 'zod'
import {
    startCardRoundSchema,
    observeCardRoundSchema,
    cancelCardRoundSchema,
    cardRoundAccessSchema,
    cardRoundSnapshotSchema,
} from '@guess-my-move/core'

/** Same schemas used by request validation and response serialization. */
export function cardsOpenApiPaths() {
    return Object.fromEntries(
        [
            {
                path: '/api/cards/rounds',
                id: 'startCardRound',
                summary: 'Iniciar rodada competitiva efêmera',
                input: startCardRoundSchema,
                output: cardRoundAccessSchema,
                status: '201',
                authorized: false,
            },
            {
                path: '/api/cards/rounds/{id}/observe',
                id: 'observeCardRound',
                summary: 'Observar ângulo com relógio e avaliação do servidor',
                input: observeCardRoundSchema,
                output: cardRoundSnapshotSchema,
                status: '200',
                authorized: true,
            },
            {
                path: '/api/cards/rounds/{id}/cancel',
                id: 'cancelCardRound',
                summary:
                    'Cancelar sem conceder pontos; resultado final é imutável',
                input: cancelCardRoundSchema,
                output: cardRoundSnapshotSchema,
                status: '200',
                authorized: true,
            },
        ].map((route) => [
            route.path,
            {
                post: {
                    operationId: route.id,
                    summary: route.summary,
                    description:
                        'Experimental, sem ranking. Exige Origin permitido. Somente ângulo escalar/null; não enviar mídia, landmarks, timestamps ou pontuação. Limite de corpo 2048 B; comandos de observação espaçados em pelo menos 50 ms; acesso válido por 40 s nas cartas atuais, com varredura de descarte a cada segundo.',
                    security: route.authorized ? [{ cardRoundToken: [] }] : [],
                    ...(route.authorized
                        ? {
                              parameters: [
                                  {
                                      name: 'id',
                                      in: 'path',
                                      required: true,
                                      schema: {
                                          type: 'string',
                                          format: 'uuid',
                                      },
                                  },
                              ],
                          }
                        : {}),
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: z.toJSONSchema(route.input, {
                                    io: 'input',
                                }),
                            },
                        },
                    },
                    responses: {
                        [route.status]: {
                            description: 'Resposta válida',
                            content: {
                                'application/json': {
                                    schema: z.toJSONSchema(route.output, {
                                        io: 'input',
                                    }),
                                },
                            },
                        },
                        ...Object.fromEntries(
                            [400, 401, 403, 404, 409, 413, 415, 429, 503].map(
                                (status) => [
                                    String(status),
                                    {
                                        description:
                                            'Comando recusado sem dados privados',
                                    },
                                ],
                            ),
                        ),
                    },
                },
            },
        ]),
    )
}
