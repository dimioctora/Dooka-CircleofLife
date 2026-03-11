import { Module, Injectable, Controller, Get, Param, Query, Post, Body } from '@nestjs/common';
import { GraphService, GraphModule } from '../graph/graph.module';
import { PersonService, PersonModule } from '../person/person.module';

@Injectable()
export class CircleOfLifeService {
  constructor(private readonly graphService: GraphService) {}

  private normalizeNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toInt === 'function') return val.toInt();
    if (typeof val.low !== 'undefined') {
      // Handle Neo4j Integer type
      return (val.high || 0) * 4294967296 + val.low;
    }
    return parseFloat(val.toString()) || 0;
  }

  async getTree(person_id: string, depth: number = 3): Promise<any> {
    const fallbackQuery = `
      MATCH (p:Person {person_id: $person_id})
      OPTIONAL MATCH path = (p)-[:PARENT|CHILD|SPOUSE*0..${depth}]-(relative)
      RETURN nodes(path) as nodes, relationships(path) as rels
    `;
    
    const results = await this.graphService.runQuery(fallbackQuery, { person_id });
    
    const nodesReturn: any[] = [];
    const edgesSet = new Set();
    const edgesReturn: any[] = [];

    const nodesMap = new Map();
    results.forEach(row => {
      row.nodes?.forEach(n => {
        const nodeId = n.properties.person_id || n.properties.union_id;
        if (nodeId && !nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, true);
          nodesReturn.push({
            id: String(nodeId),
            type: n.labels.includes('Union') ? 'union' : 'person',
            position: { 
              x: this.normalizeNumber(n.properties.x), 
              y: this.normalizeNumber(n.properties.y) 
            },
            data: { ...n.properties }
          });
        }
      });
      row.rels?.forEach(r => {
        const edgeId = r.properties.id || `${r.startNodeElementId}-${r.endNodeElementId}`;
        if (!edgesSet.has(edgeId)) {
          edgesSet.add(edgeId);
          
          // Find source and target IDs from the nodes in the same row or globally
          const sourceNode = row.nodes.find(n => n.elementId === r.startNodeElementId);
          const targetNode = row.nodes.find(n => n.elementId === r.endNodeElementId);
          
          const sourceId = sourceNode?.properties.person_id || sourceNode?.properties.union_id;
          const targetId = targetNode?.properties.person_id || targetNode?.properties.union_id;

          if (sourceId && targetId) {
            edgesReturn.push({
              id: String(edgeId),
              source: String(sourceId),
              target: String(targetId),
              label: r.type === 'PARENT' ? 'Parent' : r.type === 'SPOUSE' ? 'Partner' : '',
              sourceHandle: r.properties.sourceHandle || null,
              targetHandle: r.properties.targetHandle || null,
              type: r.properties.type || 'smoothstep'
            });
          }
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
    
    if (!payload.nodes || !Array.isArray(payload.nodes)) return;

    const nodeIds = payload.nodes.map(n => String(n.id));

    // 1. Process Nodes (People and Unions)
    for (const node of payload.nodes) {
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
          x: this.normalizeNumber(node.position.x),
          y: this.normalizeNumber(node.position.y)
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
          x: this.normalizeNumber(node.position.x), 
          y: this.normalizeNumber(node.position.y) 
        };
        await this.graphService.runQuery(query, params);
      }
    }

    // 2. Clear old relationships between these nodes to prevent duplicates/ghost lines
    if (nodeIds.length > 0) {
      const clearQuery = `
        MATCH (a)-[r:PARENT|SPOUSE|RELATION]->(b)
        WHERE (a.person_id IN $nodeIds OR a.union_id IN $nodeIds)
          AND (b.person_id IN $nodeIds OR b.union_id IN $nodeIds)
        DELETE r
      `;
      await this.graphService.runQuery(clearQuery, { nodeIds });
    }

    // 3. Process Relationships (Edges)
    if (payload.edges && Array.isArray(payload.edges)) {
      for (const edge of payload.edges) {
        const label = edge.label || 'Parent';
        const type = label === 'Parent' ? 'PARENT' : label === 'Partner' ? 'SPOUSE' : 'RELATION';
        
        const query = `
          MATCH (a), (b)
          WHERE (a.person_id = $source OR a.union_id = $source)
            AND (b.person_id = $target OR b.union_id = $target)
          MERGE (a)-[r:${type}]->(b)
          SET r.id = $id,
              r.sourceHandle = $sourceHandle,
              r.targetHandle = $targetHandle,
              r.type = $edgeType
          RETURN r
        `;
        await this.graphService.runQuery(query, { 
          id: String(edge.id), 
          source: String(edge.source), 
          target: String(edge.target),
          sourceHandle: edge.sourceHandle || '',
          targetHandle: edge.targetHandle || '',
          edgeType: edge.type || 'smoothstep'
        });
      }
    }
  }

  async getStats(): Promise<any> {
    const nodeCount = await this.graphService.runQuery(`MATCH (n) RETURN count(n) as total`);
    const relCount = await this.graphService.runQuery(`MATCH ()-[r]->() RETURN count(r) as total`);
    const personCount = await this.graphService.runQuery(`MATCH (n:Person) RETURN count(n) as total`);
    
    return {
      total_nodes: this.normalizeNumber(nodeCount[0]?.total),
      total_relationships: this.normalizeNumber(relCount[0]?.total),
      total_persons: this.normalizeNumber(personCount[0]?.total),
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
