import { Module, Injectable, Controller, Get, Param } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { PersonService, PersonModule } from '../person/person.module';

@Injectable()
export class MatchingEngine {
  constructor(private readonly graphService: GraphService) {}

  private normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
    for (let j = 1; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[len1][len2];
  }

  private getNameSimilarity(n1: string, n2: string): number {
    const norm1 = this.normalizeName(n1);
    const norm2 = this.normalizeName(n2);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 100;
    const dist = this.levenshteinDistance(norm1, norm2);
    return ((maxLen - dist) / maxLen) * 100;
  }

  async findCandidates(person_id: string): Promise<any[]> {
    const targetQuery = `MATCH (p:Person {person_id: $person_id}) RETURN p`;
    const [targetResult] = await this.graphService.runQuery(targetQuery, { person_id });
    if (!targetResult) return [];

    const target = targetResult.p.properties;
    
    // Simple candidate search by similar birth year or name prefix
    const candidateQuery = `
      MATCH (p:Person)
      WHERE p.person_id <> $person_id
      AND (
        abs(p.birth_year - $birth_year) <= 5
        OR p.name STARTS WITH substring($name, 0, 3)
      )
      RETURN p
    `;
    const candidates = await this.graphService.runQuery(candidateQuery, { 
      person_id, 
      birth_year: target.birth_year,
      name: target.name 
    });

    const results = candidates.map(c => {
      const candidate = c.p.properties;
      let score = 0;

      // Name similarity 40%
      const nameScore = this.getNameSimilarity(target.name, candidate.name);
      score += nameScore * 0.4;

      // Birth year match 20%
      if (target.birth_year === candidate.birth_year) score += 20;
      else if (Math.abs(target.birth_year - candidate.birth_year) <= 2) score += 10;

      // Death year match 20%
      if (target.death_year && candidate.death_year) {
        if (target.death_year === candidate.death_year) score += 20;
        else if (Math.abs(target.death_year - candidate.death_year) <= 2) score += 10;
      }

      // Location match (Check birth_place) 10%
      if (target.birth_place && candidate.birth_place && target.birth_place === candidate.birth_place) score += 10;

      // Family relation overlap 10% (skipped for simplicity in MVP, could check shared parents or kids)
      
      let status = 'IGNORE';
      if (score > 85) status = 'STRONG_MATCH';
      else if (score >= 70) status = 'POSSIBLE_MATCH';

      return {
        person: candidate,
        similarity_score: score,
        status: status
      };
    }).filter(r => r.status !== 'IGNORE');

    return results;
  }
}

@Controller('circle/match-candidates')
export class MatchingController {
  constructor(private readonly engine: MatchingEngine) {}

  @Get(':id')
  async getCandidates(@Param('id') id: string) {
    return this.engine.findCandidates(id);
  }
}

@Module({
  imports: [GraphModule, PersonModule],
  providers: [MatchingEngine],
  controllers: [MatchingController],
  exports: [MatchingEngine],
})
export class MatchingModule {}
