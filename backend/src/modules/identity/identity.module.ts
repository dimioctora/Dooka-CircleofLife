import { Module, Injectable, Controller, Post, Body, Get, Param } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { v4 as uuidv4 } from 'uuid';

export interface Identity {
  identity_id: string;
  person_id: string;
  source_user_id: string;
  source_type: string;
  confidence_score: number;
  created_at: string;
}

@Injectable()
export class IdentityService {
  constructor(private readonly graphService: GraphService) {}

  async create(data: Partial<Identity>): Promise<Identity | null> {
    const identity_id = uuidv4();
    const created_at = new Date().toISOString();
    const query = `
      MATCH (p:Person {person_id: $person_id})
      CREATE (i:Identity {
        identity_id: $identity_id,
        person_id: $person_id,
        source_user_id: $source_user_id,
        source_type: $source_type,
        confidence_score: $confidence_score,
        created_at: $created_at
      })
      CREATE (i)-[:IDENTITY_OF]->(p)
      RETURN i
    `;
    const params = {
      identity_id,
      person_id: data.person_id,
      source_user_id: data.source_user_id || 'system',
      source_type: data.source_type || 'user_submit',
      confidence_score: data.confidence_score || 1.0,
      created_at,
    };
    const result = await this.graphService.runQuery(query, params);
    if (result.length === 0) return null;
    return result[0].i.properties;
  }

  async findByIdentity(identity_id: string): Promise<Identity | null> {
    const query = `MATCH (i:Identity {identity_id: $identity_id}) RETURN i`;
    const result = await this.graphService.runQuery(query, { identity_id });
    if (result.length === 0) return null;
    return result[0].i.properties;
  }
}

@Controller('circle/identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  async create(@Body() data: Partial<Identity>) {
    return this.identityService.create(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.identityService.findByIdentity(id);
  }
}

@Module({
  imports: [GraphModule],
  providers: [IdentityService],
  controllers: [IdentityController],
  exports: [IdentityService],
})
export class IdentityModule {}
