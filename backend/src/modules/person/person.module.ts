import { Module, Injectable, Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { v4 as uuidv4 } from 'uuid';

export interface Person {
  person_id: string;
  name: string;
  gender: string;
  birth_year: number;
  death_year?: number;
  birth_place?: string;
  death_place?: string;
  memorial_id?: string;
  visibility: 'public' | 'family' | 'private';
  created_at: string;
}

@Injectable()
export class PersonService {
  constructor(private readonly graphService: GraphService) {}

  async create(data: Partial<Person>): Promise<Person> {
    const person_id = uuidv4();
    const created_at = new Date().toISOString();
    const query = `
      CREATE (p:Person {
        person_id: $person_id,
        name: $name,
        gender: $gender,
        birth_year: $birth_year,
        death_year: $death_year,
        birth_place: $birth_place,
        death_place: $death_place,
        memorial_id: $memorial_id,
        visibility: $visibility,
        created_at: $created_at
      })
      RETURN p
    `;
    const params = {
      person_id,
      name: data.name,
      gender: data.gender,
      birth_year: data.birth_year,
      death_year: data.death_year || null,
      birth_place: data.birth_place || '',
      death_place: data.death_place || '',
      memorial_id: data.memorial_id || '',
      visibility: data.visibility || 'private',
      created_at,
    };
    const result = await this.graphService.runQuery(query, params);
    return result[0].p.properties;
  }

  async findOne(person_id: string): Promise<Person | null> {
    const query = `MATCH (p:Person {person_id: $person_id}) RETURN p`;
    const result = await this.graphService.runQuery(query, { person_id });
    if (result.length === 0) return null;
    return result[0].p.properties;
  }

  async update(person_id: string, data: Partial<Person>): Promise<Person> {
    const query = `
      MATCH (p:Person {person_id: $person_id})
      SET p += $data
      RETURN p
    `;
    const result = await this.graphService.runQuery(query, { person_id, data });
    return result[0].p.properties;
  }

  async delete(person_id: string): Promise<void> {
    const query = `MATCH (p:Person {person_id: $person_id}) DETACH DELETE p`;
    await this.graphService.runQuery(query, { person_id });
  }
}

@Controller('circle/person')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Post()
  async create(@Body() data: Partial<Person>) {
    return this.personService.create(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.personService.findOne(id);
  }
}

@Module({
  imports: [GraphModule],
  providers: [PersonService],
  controllers: [PersonController],
  exports: [PersonService],
})
export class PersonModule {}
