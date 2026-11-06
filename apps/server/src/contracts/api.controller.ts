import { HttpTimingInterceptor } from '../observability/http-timing.interceptor.js'
import {
    Controller,
    Get,
    Inject,
    NotFoundException,
    SerializeOptions,
    UseInterceptors,
    StandardSchemaSerializerInterceptor,
} from '@nestjs/common'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import {
    buildMultiplayerContract,
    buildOpenApiDocument,
    buildSwingContract,
} from './documents.js'
import { capabilities, capabilitiesResponseSchema } from './http-definitions.js'

@UseInterceptors(HttpTimingInterceptor, StandardSchemaSerializerInterceptor)
@Controller('api')
export class ApiController {
    constructor(@Inject(SERVER_CONFIG) private readonly config: ServerConfig) {}
    @Get('capabilities')
    @SerializeOptions({ schema: capabilitiesResponseSchema })
    capabilities() {
        return capabilities()
    }
    @Get('contracts/multiplayer')
    multiplayer() {
        return buildMultiplayerContract()
    }
    @Get('contracts/swing')
    swing() {
        return buildSwingContract()
    }
    @Get('openapi.json')
    openapi() {
        if (!this.config.enableApiDocs) throw new NotFoundException()
        return buildOpenApiDocument()
    }
}
