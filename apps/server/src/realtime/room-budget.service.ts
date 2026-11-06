import { Injectable } from '@nestjs/common'

/** Fontes explícitas dos domínios, consultadas sincronicamente antes de criar salas. */
@Injectable()
export class RoomBudget {
    private readonly sources = new Map<'marbles' | 'swing', () => number>()
    register(game: 'marbles' | 'swing', read: () => number): void {
        this.sources.set(game, read)
    }
    get activeRooms(): number {
        return [...this.sources.values()].reduce((sum, read) => sum + read(), 0)
    }
    canCreate(maxRooms: number): boolean {
        return this.activeRooms < maxRooms
    }
}
