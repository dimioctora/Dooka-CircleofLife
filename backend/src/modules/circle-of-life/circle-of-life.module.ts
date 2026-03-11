import { Module, Injectable, Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { PersonService, PersonModule } from '../person/person.module';

@Injectable()
export class CircleOfLifeService {
  constructor(private readonly graphService: GraphService) {}

  async getTree(person_id: string, depth: number = 3): Promise<any> {
    const query = `
      MATCH (p:Person {person_id: $person_id})
      CALL apoc.path.subgraphAll(p, {
        relationshipFilter: 'PARENT>|CHILD>|SPOUSE',
        minLevel: 0,
        maxLevel: $depth
      })
      YIELD nodes, relationships
      RETURN nodes, relationships
    `;
    // If APOC is not installed, use standard Cypher
    const fallbackQuery = `
      MATCH (p:Person {person_id: $person_id})
      OPTIONAL MATCH path = (p)-[:PARENT|CHILD|SPOUSE*0..${depth}]-(relative:Person)
      RETURN nodes(path) as nodes, relationships(path) as rels
    `;
    
    const results = await this.graphService.runQuery(fallbackQuery, { person_id });
    
    const nodesReturn: any[] = [];
    const edgesSet = new Set();
    const edgesReturn: any[] = [];

    const nodesMap = new Map();
    results.forEach(row => {
      row.nodes?.forEach(n => {
        if (!nodesMap.has(n.properties.person_id)) {
          nodesMap.set(n.properties.person_id, true);
          nodesReturn.push({
            id: n.properties.person_id,
            type: n.labels.includes('Union') ? 'union' : 'person',
            position: { x: n.properties.x || 0, y: n.properties.y || 0 },
            data: { ...n.properties }
          });
        }
      });
      row.rels?.forEach(r => {
        const edgeId = r.properties.id || `${r.startNodeElementId}-${r.endNodeElementId}`;
        if (!edgesSet.has(edgeId)) {
          edgesSet.add(edgeId);
          edgesReturn.push({
            id: edgeId,
            source: r.properties.start_id || row.nodes.find(n => n.elementId === r.startNodeElementId)?.properties.person_id || r.startNodeElementId,
            target: r.properties.end_id || row.nodes.find(n => n.elementId === r.endNodeElementId)?.properties.person_id || r.endNodeElementId,
            label: r.type === 'PARENT' ? 'Parent' : r.type === 'SPOUSE' ? 'Partner' : ''
          });
        }
      });
    });

    return {
      nodes: nodesReturn,
      edges: edgesReturn
    };
  }

  async findAncestors(person_id: string, generations: number = 5): Promise<any[]> {
    const query = `
      MATCH (p:Person {person_id: $person_id})
      MATCH path = (p)-[:PARENT*1..${generations}]->(ancestor:Person)
      RETURN ancestor
    `;
    const results = await this.graphService.runQuery(query, { person_id });
    return results.map(r => r.ancestor.properties);
  }

  async findDescendants(person_id: string, generations: number = 5): Promise<any[]> {
    const query = `
      MATCH (p:Person {person_id: $person_id})
      MATCH path = (p)-[:CHILD*1..${generations}]->(descendant:Person)
      RETURN descendant
    `;
    const results = await this.graphService.runQuery(query, { person_id });
    return results.map(r => r.descendant.properties);
  }

  async saveGraph(payload: { nodes: any[], edges: any[] }): Promise<void> {
    console.log('Incoming Payload:', JSON.stringify(payload));
    // 1. Process Nodes (People and Unions)
    for (const node of payload.nodes) {
      console.log(`Processing node type ${node.type}, id ${node.id}`);
      if (node.type === 'person') {
        const query = `
          MERGE (p:Person {person_id: $person_id})
          SET p += $props
          RETURN p
        `;
        const props = {
          name: node.data.name,
          gender: node.data.gender || 'male',
          birth_year: node.data.birth_year,
          death_year: node.data.death_year || null,
          memorial_id: node.data.memorial_id || '',
          visibility: node.data.visibility || 'private',
          photo: node.data.photo || '',
          isLinked: node.data.isLinked || false,
          x: node.position.x,
          y: node.position.y
        };
        await this.graphService.runQuery(query, { person_id: String(node.id), props });
      } else if (node.type === 'union') {
        const query = `
          MERGE (u:Union {union_id: $union_id}) 
          SET u.x = $x, u.y = $y
          RETURN u
        `;
        const params = { 
          union_id: String(node.id), 
          x: Number(node.position.x), 
          y: Number(node.position.y) 
        };
        console.log('Union Params:', params);
        await this.graphService.runQuery(query, params);
      }
    }

    // 2. Process Relationships (Edges)
    for (const edge of payload.edges) {
      const label = edge.label || 'Parent';
      const type = label === 'Parent' ? 'PARENT' : label === 'Partner' ? 'SPOUSE' : 'RELATION';
      
      const query = `
        MATCH (a), (b)
        WHERE (a.person_id = $source OR a.union_id = $source)
          AND (b.person_id = $target OR b.union_id = $target)
        MERGE (a)-[r:${type}]->(b)
        SET r.id = $id
        RETURN r
      `;
      await this.graphService.runQuery(query, { id: edge.id, source: edge.source, target: edge.target });
    }
  }

  async getStats(): Promise<any> {
    const nodeCount = await this.graphService.runQuery(`MATCH (n) RETURN count(n) as total`);
    const relCount = await this.graphService.runQuery(`MATCH ()-[r]->() RETURN count(r) as total`);
    const personCount = await this.graphService.runQuery(`MATCH (n:Person) RETURN count(n) as total`);
    
    // Helper to safely convert Neo4j types to JS numbers
    const normalize = (val: any) => {
      if (val === null || val === undefined) return 0;
      if (typeof val === 'number') return val;
      if (typeof val.toInt === 'function') return val.toInt();
      if (typeof val.low !== 'undefined') return val.low;
      return parseInt(val.toString()) || 0;
    };

    return {
      total_nodes: normalize(nodeCount[0]?.total),
      total_relationships: normalize(relCount[0]?.total),
      total_persons: normalize(personCount[0]?.total),
      status: 'Online'
    };
  }
}

@Controller('circle/tree')
export class CircleOfLifeController {
  constructor(private readonly service: CircleOfLifeService) {}

  @Get('stats')
  async getStats() {
    return this.service.getStats();
  }

  @Get(':person_id')
  async getTree(@Param('person_id') person_id: string, @Query('depth') depth?: number) {
    return this.service.getTree(person_id, depth || 3);
  }

  @Get(':person_id/ancestors')
  async getAncestors(@Param('person_id') person_id: string) {
    return this.service.findAncestors(person_id);
  }

  @Get(':person_id/descendants')
  async getDescendants(@Param('person_id') person_id: string) {
    return this.service.findDescendants(person_id);
  }

  @Post('save')
  async saveTree(@Body() payload: any) {
    return this.service.saveGraph(payload);
  }
}

@Module({
  imports: [GraphModule, PersonModule],
  providers: [CircleOfLifeService],
  controllers: [CircleOfLifeController],
  exports: [CircleOfLifeService],
})
export class CircleOfLifeModule {}
