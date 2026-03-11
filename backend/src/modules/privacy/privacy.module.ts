import { Module, Injectable, Controller, Patch, Param, Body } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';

@Injectable()
export class PrivacyService {
  constructor(private readonly graphService: GraphService) {}

  async updatePrivacy(person_id: string, visibility: 'public' | 'family' | 'private'): Promise<void> {
    const query = `
      MATCH (p:Person {person_id: $person_id})
      SET p.visibility = $visibility
    `;
    await this.graphService.runQuery(query, { person_id, visibility });
  }

  async filterForUser(person: any, requester_id: string): Promise<any> {
    if (person.visibility === 'public') return person;
    
    // Check if requester is in family circle
    const familyCheck = `
      MATCH (p:Person {person_id: $person_id})
      MATCH (u:Person {person_id: $requester_id})
      MATCH path = (p)-[:PARENT|CHILD|SPOUSE*1..3]-(u)
      RETURN path
    `;
    const inFamily = await this.graphService.runQuery(familyCheck, { 
      person_id: person.person_id, 
      requester_id 
    });

    if (inFamily.length > 0) return person;
    
    // Privacy: obfuscate sensitive data if private
    return {
      person_id: person.person_id,
      name: 'Private Person',
      gender: person.gender,
      birth_year: 'XXXX',
      visibility: person.visibility
    };
  }
}

@Controller('circle/privacy')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Patch(':id')
  async update(@Param('id') id: string, @Body('visibility') visibility: any) {
    return this.service.updatePrivacy(id, visibility);
  }
}

@Module({
  imports: [GraphModule],
  providers: [PrivacyService],
  controllers: [PrivacyController],
  exports: [PrivacyService],
})
export class PrivacyModule {}
