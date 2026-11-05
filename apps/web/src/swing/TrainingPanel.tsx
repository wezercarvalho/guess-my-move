import { TRAINING_EXERCISES, type TrainingProgress } from './training.js'

export function TrainingPanel({ progress }: { progress: TrainingProgress }) {
    return (
        <details className="swing-training" open>
            <summary>Exercícios do treino</summary>
            <fieldset>
                <legend className="sr-only">Exercícios do treino</legend>
                <p>Explore no seu ritmo, sem tempo nem pontuação. Os gestos precisam produzir a ação no jogo.</p>
                <ul aria-live="polite">
                    {TRAINING_EXERCISES.map(([id, label]) => (
                        <li key={id} data-done={progress[id]}>
                            <span aria-hidden="true">{progress[id] ? '✓' : '○'}</span>{' '}
                            {label}<span className="sr-only">{progress[id] ? ' — concluído' : ' — pendente'}</span>
                        </li>
                    ))}
                </ul>
                {TRAINING_EXERCISES.every(([id]) => progress[id]) ? <p>Todos os exercícios concluídos! Continue explorando.</p> : null}
            </fieldset>
        </details>
    )
}
