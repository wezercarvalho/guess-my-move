/**
 * Contratos compartilhados do Guess My Move.
 *
 * Os tipos de dados da carta são derivados dos schemas Zod em `schemas/`, a
 * fonte única de verdade; aqui ficam só os re-exports (sem lógica, sem I/O). A
 * fronteira de informação é inviolável: o jogador e uma IA jogadora futura
 * nunca recebem a avaliação da carta (o critério do gesto).
 */
export type {
    Card,
    CardEvaluation,
    CardPublic,
    HandAngleOscillationCriterion,
} from './schemas/index.js'
