import { Module, Injectable, Controller, Post, Body } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { PersonService, PersonModule } from '../person/person.module';

@Injectable()
export class MergeEngine {
  constructor(private readonly graphService: GraphService) {}

  async mergePersons(source_id: string, target_id: string): Promise<any> {
    // 1. Move relationships from source to target
    // Move outgoing relationships
    const moveOutgoing = `
      MATCH (source:Person {person_id: $source_id})-[r]->(other)
      MATCH (target:Person {person_id: $target_id})
      WHERE other.person_id <> $target_id
      CREATE (target)-[r2:TYPE(r)]->(other)
      SET r2 = r
      DELETE r
    `;
    
    // Move incoming relationships
    const moveIncoming = `
      MATCH (other)-[r]->(source:Person {person_id: $source_id})
      MATCH (target:Person {person_id: $target_id})
      WHERE other.person_id <> $target_id
      CREATE (other)-[r2:TYPE(r)]->(target)
      SET r2 = r
      DELETE r
    `;

    // 2. Move Identity nodes
    const moveIdentities = `
      MATCH (i:Identity)-[rel:IDENTITY_OF]->(source:Person {person_id: $source_id})
      MATCH (target:Person {person_id: $target_id})
      CREATE (i)-[:IDENTITY_OF]->(target)
      DELETE rel
    `;

    // 3. Record merge history (Audit log)
    const recordHistory = `
      MATCH (target:Person {person_id: $target_id})
      CREATE (h:MergeHistory {
        source_id: $source_id,
        target_id: $target_id,
        merged_at: datetime()
      })
      CREATE (h)-[:MERGED_FROM]->(target)
    `;

    // 4. Delete source person
    const deleteSource = `MATCH (source:Person {person_id: $source_id}) DELETE source`;

    const session = this.graphService.getSession();
    const tx = session.beginTransaction();
    try {
      await tx.run(moveOutgoing, { source_id, target_id });
      await tx.run(moveIncoming, { source_id, target_id });
      await tx.run(moveIdentities, { source_id, target_id });
      await tx.run(recordHistory, { source_id, target_id });
      await tx.run(deleteSource, { source_id });
      await tx.commit();
      return { success: true };
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      await session.close();
    }
  }
}

@Controller('circle/merge')
export class MergeController {
  constructor(private readonly engine: MergeEngine) {}

  @Post()
  async merge(@Body() body: { source_id: string; target_id: string }) {
    return this.engine.mergePersons(body.source_id, body.target_id);
  }
}

@Module({
  imports: [GraphModule, PersonModule],
  providers: [MergeEngine],
  controllers: [MergeController],
  exports: [MergeEngine],
})
export class MergeModule {}
