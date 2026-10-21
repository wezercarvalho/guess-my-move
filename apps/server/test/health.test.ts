import { Test } from '@nestjs/testing'
import { beforeAll, describe, expect, it } from 'vitest'

import { HealthController } from '../src/health/health.controller.js'

describe('HealthController', () => {
    let controller: HealthController

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [HealthController],
        }).compile()
        controller = moduleRef.get(HealthController)
    })

    it('GET /api/health responde status ok (sem rede)', () => {
        expect(controller.check()).toEqual({ status: 'ok' })
    })
})
