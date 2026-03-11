import { Module, Injectable, Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { PersonService, PersonModule } from '../person/person.module';

@Injectable()
export class ValidationEngine {
  constructor(private readonly graphService: GraphService) {}

  async validateRelation(parent_id: string, child_id: string): Promise<void> {
    const parentQuery = `MATCH (p:Person {person_id: $person_id}) RETURN p`;
    const childQuery = `MATCH (p:Person {person_id: $person_id}) RETURN p`;
    
    const [parentResult] = await this.graphService.runQuery(parentQuery, { person_id: parent_id });
    const [childResult] = await this.graphService.runQuery(childQuery, { person_id: child_id });

    if (!parentResult || !childResult) {
      throw new HttpException('Person not found', HttpStatus.NOT_FOUND);
    }

    const parent = parentResult.p.properties;
    const child = childResult.p.properties;

    // Rule 1: Max parents = 2
    const parentCountQuery = `MATCH (child:Person {person_id: $child_id})<-[:PARENT]-(p:Person) RETURN count(p) as count`;
    const parentCount = await this.graphService.runQuery(parentCountQuery, { child_id });
    if (parentCount[0].count >= 2) {
      throw new HttpException('Maximum parents exceeded (limit 2)', HttpStatus.BAD_REQUEST);
    }

    // Rule 2: Parent must be older than child
    if (parent.birth_year >= child.birth_year) {
      throw new HttpException('Parent must be older than child', HttpStatus.BAD_REQUEST);
    }

    // Rule 3: Prevent circular relationships
    // Check if child is an ancestor of parent
    const circularQuery = `
      MATCH (p:Person {person_id: $parent_id}), (c:Person {person_id: $child_id})
      MATCH path = (c)-[:PARENT*]->(p)
      RETURN path
    `;
    const circularResult = await this.graphService.runQuery(circularQuery, { parent_id, child_id });
    if (circularResult.length > 0) {
      throw new HttpException('Circular relationship detected', HttpStatus.BAD_REQUEST);
    }
  }
}

@Injectable()
export class RelationshipService {
  constructor(
    private readonly graphService: GraphService,
    private readonly validator: ValidationEngine
  ) {}

  async addParent(child_id: string, parent_id: string): Promise<void> {
    await this.validator.validateRelation(parent_id, child_id);
    const query = `
      MATCH (c:Person {person_id: $child_id}), (p:Person {person_id: $parent_id})
      MERGE (p)-[:PARENT]->(c)
      MERGE (c)-[:CHILD]->(p)
    `;
    await this.graphService.runQuery(query, { child_id, parent_id });
  }

  async addSpouse(person_id: string, spouse_id: string): Promise<void> {
    const query = `
      MATCH (p1:Person {person_id: $person_id}), (p2:Person {person_id: $spouse_id})
      MERGE (p1)-[:SPOUSE]-(p2)
    `;
    await this.graphService.runQuery(query, { person_id, spouse_id });
  }
}

@Controller('circle/relationship')
export class RelationshipController {
  constructor(private readonly service: RelationshipService) {}

  @Post()
  async create(@Body() body: { person_id: string; relative_id: string; type: string }) {
    if (body.type === 'PARENT') {
      return this.service.addParent(body.person_id, body.relative_id);
    } else if (body.type === 'CHILD') {
        return this.service.addParent(body.relative_id, body.person_id);
    } else if (body.type === 'SPOUSE') {
      return this.service.addSpouse(body.person_id, body.relative_id);
    }
    throw new HttpException('Invalid relationship type', HttpStatus.BAD_REQUEST);
  }
}

@Module({
  imports: [GraphModule, PersonModule],
  providers: [ValidationEngine, RelationshipService],
  controllers: [RelationshipController],
  exports: [RelationshipService],
})
export class RelationshipModule {}
