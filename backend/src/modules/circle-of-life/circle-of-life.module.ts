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
    
    console.log(`[CircleOfLifeService] getTree called for person_id: ${person_id}, depth: ${depth}`);
    const results = await this.graphService.runQuery(fallbackQuery, { person_id });
    console.log(`[CircleOfLifeService] getTree query returned ${results.length} rows`);
    
    const nodesReturn: any[] = [];
    const edgesSet = new Set();
    const edgesReturn: any[] = [];

    const nodesMap = new Map();
    results.forEach(row => {
      row.nodes?.forEach(n => {
        const rawId = n.properties.person_id || n.properties.union_id;
        if (rawId === undefined || rawId === null) return;
        
        const nodeId = String(rawId); // Force string ID
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, true);
          const nodeData = {
            id: nodeId,
            type: n.labels.includes('Union') ? 'union' : 'person',
            position: { 
              x: this.normalizeNumber(n.properties.x), 
              y: this.normalizeNumber(n.properties.y) 
            },
            data: { ...n.properties }
          };
          console.log(`[CircleOfLifeService] Extraction - Node Found: ID=${nodeData.id}, Type=${nodeData.type}`);
          nodesReturn.push(nodeData);
        }
      });
      
      row.rels?.forEach(r => {
        // Find source and target IDs from the nodes in the SAME row
        const sourceNode = row.nodes.find(n => n.elementId === r.startNodeElementId);
        const targetNode = row.nodes.find(n => n.elementId === r.endNodeElementId);
        
        const rawSourceId = sourceNode?.properties.person_id || sourceNode?.properties.union_id;
        const rawTargetId = targetNode?.properties.person_id || targetNode?.properties.union_id;

        if (rawSourceId && rawTargetId) {
          const sourceId = String(rawSourceId);
          const targetId = String(rawTargetId);
          const edgeId = r.properties.id || `${sourceId}-${targetId}`;
          
          if (!edgesSet.has(edgeId)) {
            edgesSet.add(edgeId);
            edgesReturn.push({
              id: edgeId,
              source: sourceId,
              target: targetId,
              label: r.type === 'PARENT' ? 'Parent' : r.type === 'SPOUSE' ? 'Partner' : '',
              sourceHandle: r.properties.sourceHandle || null,
              targetHandle: r.properties.targetHandle || null,
              type: r.properties.type || 'smoothstep'
            });
          }
        } else {
          console.warn(`[CircleOfLifeService] Could not resolve source/target for relation: ${r.elementId}`);
        }
      });
    });

    console.log(`[CircleOfLifeService] Returning ${nodesReturn.length} nodes and ${edgesReturn.length} edges`);
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

  async saveGraph(payload: { person_id: string, nodes: any[], edges: any[] }): Promise<void> {
    const { person_id, nodes, edges } = payload;
    console.log(`[CircleOfLifeService] saveGraph for person_id: ${person_id}`);
    console.log('Incoming Payload Nodes:', nodes?.length || 0);
    console.log('Incoming Payload Edges:', edges?.length || 0);
    
    if (!nodes || !Array.isArray(nodes) || !person_id) {
      console.warn('[CircleOfLifeService] Invalid payload or missing person_id, skipping save.');
      return;
    }

    const payloadNodeIds = nodes.map(n => String(n.id));

    // 1. SYNC/DELETE: Remove nodes that exist in DB but are NOT in payload
    // We only delete nodes that "belong" to this person_id (roots, relatives, and unions)
    const cleanupQuery = `
      MATCH (n)
      WHERE (
        (n:Person AND (n.person_id = $pid OR n.person_id STARTS WITH $relPrefix))
        OR 
        (n:Union AND (n.union_id = $pid OR n.union_id STARTS WITH $unionPrefix))
      )
      AND (
        (n:Person AND NOT n.person_id IN $payloadIds)
        OR
        (n:Union AND NOT n.union_id IN $payloadIds)
      )
      DETACH DELETE n
    `;
    
    console.log(`[CircleOfLifeService] Cleaning up deleted nodes for ${person_id}...`);
    await this.graphService.runQuery(cleanupQuery, { 
      pid: String(person_id), 
      relPrefix: `rel-${person_id}-`, 
      unionPrefix: `union-${person_id}-`,
      payloadIds: payloadNodeIds 
    });

    // 2. Process Nodes (People and Unions)
    for (const node of nodes) {
      if (node.type === 'person') {
        const query = `
          MERGE (p:Person {person_id: $person_id})
          SET p += $props
          RETURN p
        `;
        const props = {
          name: node.data.name,
          gender: node.data.gender || 'male',
          birth_date: node.data.birth_date || '',
          birth_year: node.data.birth_year,
          death_date: node.data.death_date || null,
          death_year: node.data.death_year || null,
          memorial_id: node.data.memorial_id || '',
          visibility: node.data.visibility || 'private',
          photo: node.data.photo || '',
          isLinked: node.data.isLinked || false,
          x: this.normalizeNumber(node.position.x),
          y: this.normalizeNumber(node.position.y)
        };
        console.log(`[CircleOfLifeService] Saving Person: ${props.name} (ID: ${node.id})`);
        await this.graphService.runQuery(query, { person_id: String(node.id), props });
      } else if (node.type === 'union') {
        const query = `
          MERGE (u:Union {union_id: $uid}) 
          SET u.x = $ux, u.y = $uy
          RETURN u
        `;
        const params = { 
          uid: String(node.id), 
          ux: this.normalizeNumber(node.position.x), 
          uy: this.normalizeNumber(node.position.y) 
        };
        console.log(`[CircleOfLifeService] Saving Union: (ID: ${node.id})`);
        await this.graphService.runQuery(query, params);
      }
    }

    // 3. Clear old relationships between these nodes to prevent duplicates/ghost lines
    if (payloadNodeIds.length > 0) {
      const clearQuery = `
        MATCH (a)-[r:PARENT|SPOUSE|RELATION]->(b)
        WHERE (a.person_id IN $nodeIds OR a.union_id IN $nodeIds)
          AND (b.person_id IN $nodeIds OR b.union_id IN $nodeIds)
        DELETE r
      `;
      await this.graphService.runQuery(clearQuery, { nodeIds: payloadNodeIds });
    }

    // 3. Process Relationships (Edges)
    if (payload.edges && Array.isArray(payload.edges)) {
      for (const edge of payload.edges) {
        const label = edge.label || 'Parent';
        const type = label === 'Parent' ? 'PARENT' : label === 'Partner' ? 'SPOUSE' : 'RELATION';
        
        // Fix: Use specific labels (Person or Union) to prevent Cartesian product and messy lines
        const query = `
          MATCH (a), (b)
          WHERE ((a:Person AND a.person_id = $source) OR (a:Union AND a.union_id = $source))
            AND ((b:Person AND b.person_id = $target) OR (b:Union AND b.union_id = $target))
          MERGE (a)-[r:${type}]->(b)
          SET r.id = $id,
              r.sourceHandle = $sourceHandle,
              r.targetHandle = $targetHandle,
              r.type = $edgeType
          RETURN r
        `;

        const edgeParams = { 
          id: String(edge.id), 
          source: String(edge.source), 
          target: String(edge.target),
          sourceHandle: edge.sourceHandle || '',
          targetHandle: edge.targetHandle || '',
          edgeType: edge.type || 'smoothstep'
        };

        await this.graphService.runQuery(query, edgeParams);
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
